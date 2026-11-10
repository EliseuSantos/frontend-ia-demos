import '@demos/theme/theme.css';
import './style.css';
import { analyzeEnabled } from './extractor';
import {
  TECHNIQUES,
  TECHNIQUE_IDS,
  TOTAL_TECHNIQUES,
  type TechniqueId,
  buildSampleDocument,
  parseEnabledIds,
} from './techniques';

const scoreEl = required<HTMLElement>('#score');
const listEl = required<HTMLElement>('#technique-list');
const preview = required<HTMLIFrameElement>('#preview');
const agentList = required<HTMLElement>('#agent-list');
const resetButton = required<HTMLButtonElement>('#reset');

let enabled = new Set<TechniqueId>(readEnabledFromUrl());

buildControls();
render();

resetButton.addEventListener('click', () => {
  enabled = new Set(TECHNIQUE_IDS);
  syncChecks();
  shareState();
  render();
});

function buildControls(): void {
  listEl.replaceChildren();
  for (const id of TECHNIQUE_IDS) {
    const technique = TECHNIQUES[id];
    const item = document.createElement('li');
    item.className = 'technique-row';

    const label = document.createElement('label');
    label.className = 'check';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = enabled.has(id);
    input.dataset.testid = `tecnica-${id}`;
    input.setAttribute('data-technique', id);
    input.setAttribute('aria-describedby', `agente-${id}`);

    const meta = document.createElement('span');
    meta.className = 'technique-meta';
    const title = document.createElement('strong');
    title.textContent = technique.label;
    const summary = document.createElement('span');
    summary.textContent = technique.summary;
    meta.append(title, summary);

    label.append(input, meta);

    const flag = document.createElement('span');
    flag.className = 'agent-flag';
    flag.id = `agente-${id}`;
    flag.dataset.testid = `agente-${id}`;
    flag.dataset.followed = 'false';
    flag.textContent = 'agente não';

    input.addEventListener('change', () => {
      if (input.checked) enabled.add(id);
      else enabled.delete(id);
      shareState();
      render();
    });

    item.append(label, flag);
    listEl.append(item);
  }
}

function syncChecks(): void {
  for (const id of TECHNIQUE_IDS) {
    const input = required<HTMLInputElement>(`[data-testid="tecnica-${id}"]`);
    input.checked = enabled.has(id);
  }
}

function render(): void {
  const ordered = TECHNIQUE_IDS.filter((id) => enabled.has(id));
  const sample = buildSampleDocument(ordered);
  const result = analyzeEnabled(ordered);

  preview.srcdoc = sample.srcdoc;
  scoreEl.textContent = `${result.n} de ${TOTAL_TECHNIQUES}`;
  scoreEl.dataset.n = String(result.n);

  for (const id of TECHNIQUE_IDS) {
    const flag = required<HTMLElement>(`[data-testid="agente-${id}"]`);
    const followed = result.agentFound.includes(id);
    flag.dataset.followed = followed ? 'true' : 'false';
    flag.textContent = followed ? 'agente seguiu' : enabled.has(id) ? 'agente não' : 'desligada';
  }

  agentList.replaceChildren();
  if (result.agentInstructions.length === 0) {
    agentList.dataset.empty = 'true';
  } else {
    agentList.dataset.empty = 'false';
    for (const instruction of result.agentInstructions) {
      const item = document.createElement('li');
      item.textContent = instruction;
      agentList.append(item);
    }
  }
}

function readEnabledFromUrl(): TechniqueId[] {
  const params = new URLSearchParams(location.search);
  return parseEnabledIds(params.get('tecnicas'), params.get('tecnica'));
}

function shareState(): void {
  const params = new URLSearchParams();
  const ordered = TECHNIQUE_IDS.filter((id) => enabled.has(id));
  if (ordered.length === TECHNIQUE_IDS.length) {
    const next = location.pathname;
    if (`${location.pathname}${location.search}` !== next) history.replaceState(null, '', next);
    return;
  }
  const only = ordered[0];
  if (ordered.length === 1 && only) params.set('tecnica', only);
  else params.set('tecnicas', ordered.join(','));
  const next = `${location.pathname}?${params.toString()}`;
  if (`${location.pathname}${location.search}` !== next) history.replaceState(null, '', next);
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Elemento ausente: ${selector}`);
  return element as T;
}
