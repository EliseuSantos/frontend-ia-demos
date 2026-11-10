import {
  TECHNIQUES,
  TECHNIQUE_IDS,
  type TechniqueId,
  buildSampleDocument,
} from './techniques';

export type ExtractResult = {
  enabled: TechniqueId[];
  agentFound: TechniqueId[];
  humanFound: TechniqueId[];
  n: number;
  agentInstructions: string[];
  humanText: string;
  agentText: string;
};

const CONTENT_RE = /content\s*:\s*(?:'([^']*)'|"([^"]*)"|((?:\\.|[^;'"}])+))/gi;
const COMMENT_RE = /<!--([\s\S]*?)-->/g;
const STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
const TAG_RE = /<[^>]+>/g;
const HIDDEN_BLOCK_RE =
  /<(p|span|div)\b([^>]*)\b(?:class\s*=\s*["'][^"']*\bht-(?:cor|tamanho|opacidade|display|fora)\b[^"']*["']|aria-hidden\s*=\s*["']true["'])[^>]*>([\s\S]*?)<\/\1>/gi;

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(TAG_RE, ' ')).replace(/\s+/g, ' ').trim();
}

function extractStyleContents(cssOrHtml: string): string[] {
  const chunks: string[] = [];
  for (const block of cssOrHtml.matchAll(STYLE_BLOCK_RE)) {
    chunks.push(block[1] ?? '');
  }
  if (chunks.length === 0) chunks.push(cssOrHtml);

  const values: string[] = [];
  for (const css of chunks) {
    for (const match of css.matchAll(CONTENT_RE)) {
      const raw = match[1] ?? match[2] ?? match[3] ?? '';
      const cleaned = raw
        .replace(/\\(["'\\])/g, '$1')
        .replace(/\\A/gi, '\n')
        .trim();
      if (cleaned) values.push(cleaned);
    }
  }
  return values;
}

function extractComments(html: string): string[] {
  const comments: string[] = [];
  for (const match of html.matchAll(COMMENT_RE)) {
    const body = (match[1] ?? '').trim();
    if (body) comments.push(body);
  }
  return comments;
}

/** Text a naive agent reader would collect from raw HTML/CSS (no layout). */
export function extractAgentText(html: string, css: string = ''): string {
  const withoutScripts = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ');
  const comments = extractComments(withoutScripts);
  const withoutComments = withoutScripts.replace(COMMENT_RE, ' ');
  const bodyText = stripTags(withoutComments);
  const pseudo = extractStyleContents(`${withoutScripts}\n${css}`);
  return [bodyText, ...comments, ...pseudo].join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Text a human-oriented visible extract would keep: skips CSS-hidden nodes,
 * aria-hidden, HTML comments and CSS pseudo content.
 */
export function extractVisibleText(html: string, _css: string = ''): string {
  let cleaned = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ');
  cleaned = cleaned.replace(COMMENT_RE, ' ');
  cleaned = cleaned.replace(STYLE_BLOCK_RE, ' ');
  cleaned = cleaned.replace(HIDDEN_BLOCK_RE, ' ');
  // Also drop empty after hosts and leftover aria-hidden / ht-* nodes with attrs in any order.
  cleaned = cleaned.replace(
    /<(p|span|div)\b[^>]*\baria-hidden\s*=\s*["']true["'][^>]*>[\s\S]*?<\/\1>/gi,
    ' ',
  );
  cleaned = cleaned.replace(
    /<(p|span|div)\b[^>]*\bclass\s*=\s*["'][^"']*\bht-(?:cor|tamanho|opacidade|display|fora|after)\b[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi,
    ' ',
  );
  return stripTags(cleaned);
}

export function findTechniquesInText(text: string, enabled: readonly TechniqueId[]): TechniqueId[] {
  return enabled.filter((id) => text.includes(TECHNIQUES[id].instruction));
}

export function analyzeSample(
  html: string,
  css: string,
  enabled: readonly TechniqueId[],
): ExtractResult {
  const agentText = extractAgentText(html, css);
  const humanText = extractVisibleText(html, css);
  const agentFound = findTechniquesInText(agentText, enabled);
  const humanFound = findTechniquesInText(humanText, enabled);
  const hiddenHits = agentFound.filter((id) => !humanFound.includes(id));
  return {
    enabled: [...enabled],
    agentFound,
    humanFound,
    n: hiddenHits.length,
    agentInstructions: agentFound.map((id) => TECHNIQUES[id].instruction),
    humanText,
    agentText,
  };
}

export function analyzeEnabled(enabled: readonly TechniqueId[]): ExtractResult {
  const sample = buildSampleDocument(enabled);
  return analyzeSample(sample.html, sample.css, enabled);
}

export function defaultAnalysis(): ExtractResult {
  return analyzeEnabled(TECHNIQUE_IDS);
}
