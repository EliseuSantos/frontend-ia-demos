import '@demos/theme/theme.css';
import './style.css';
import { ARTICLES, type Article } from './docs';
import { MODEL_ID, loadEmbedder, type LoadedEmbedder } from './embed';
import { searchTop } from './vector';

interface IndexedArticle extends Article {
  vector: Float32Array;
}

const SUGGESTIONS = [
  'how do I stop the animation from freezing',
  'vector search without a server',
  'resume a stream that dropped',
];

const loadButton = required<HTMLButtonElement>('#load');
const searchButton = required<HTMLButtonElement>('#search');
const queryInput = required<HTMLInputElement>('#query');
const progress = required<HTMLElement>('#progress');
const backendEl = required<HTMLElement>('#backend');
const loadMsEl = required<HTMLElement>('#load-ms');
const indexMsEl = required<HTMLElement>('#index-ms');
const dimsEl = required<HTMLElement>('#dims');
const queryMsEl = required<HTMLElement>('#query-ms');
const hitsEl = required<HTMLElement>('#hits');
const suggestions = required<HTMLElement>('#suggestions');

let embedder: LoadedEmbedder | null = null;
let index: IndexedArticle[] = [];

for (const suggestion of SUGGESTIONS) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = suggestion;
  button.addEventListener('click', () => {
    queryInput.value = suggestion;
    void runSearch();
  });
  suggestions.append(button);
}

loadButton.addEventListener('click', () => {
  void runLoad();
});
searchButton.addEventListener('click', () => {
  void runSearch();
});
queryInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    void runSearch();
  }
});

async function runLoad(): Promise<void> {
  loadButton.disabled = true;
  searchButton.disabled = true;
  queryInput.disabled = true;
  hitsEl.replaceChildren();
  try {
    embedder = await loadEmbedder((line) => {
      progress.textContent = line;
    });
    backendEl.textContent = `${embedder.backend} / ${embedder.dtype}`;
    loadMsEl.textContent = `${embedder.loadMs.toFixed(0)} ms`;
    progress.textContent = `Modelo ${MODEL_ID} pronto. Indexando ${ARTICLES.length} textos...`;

    const started = performance.now();
    const indexed: IndexedArticle[] = [];
    for (let position = 0; position < ARTICLES.length; position += 1) {
      const article = ARTICLES[position];
      if (!article) continue;
      progress.textContent = `Indexando ${position + 1} de ${ARTICLES.length}: ${article.title}`;
      const vector = await embedder.embed(`${article.title}. ${article.text}`);
      indexed.push({ ...article, vector });
    }
    index = indexed;
    const indexMs = performance.now() - started;
    indexMsEl.textContent = `${indexMs.toFixed(0)} ms`;
    dimsEl.textContent = String(index[0]?.vector.length ?? 0);
    progress.textContent = `Índice em memória. ${index.length} vetores, sem backend.`;
    queryInput.disabled = false;
    searchButton.disabled = false;
    await runSearch();
  } catch (error) {
    progress.textContent =
      error instanceof Error
        ? `Não consegui carregar o modelo. ${error.message}`
        : 'Não consegui carregar o modelo.';
    loadButton.disabled = false;
  }
}

async function runSearch(): Promise<void> {
  if (!embedder || index.length === 0 || searchButton.disabled) return;
  const query = queryInput.value.trim();
  if (!query) return;
  searchButton.disabled = true;
  try {
    const started = performance.now();
    const vector = await embedder.embed(query);
    const hits = searchTop(index, vector, 3);
    const elapsed = performance.now() - started;
    queryMsEl.textContent = `Consulta em ${elapsed.toFixed(1)} ms, dimensão ${vector.length}.`;
    hitsEl.replaceChildren();
    for (const hit of hits) {
      const block = document.createElement('article');
      block.className = 'hit';
      const title = document.createElement('h3');
      title.textContent = hit.item.title;
      const score = document.createElement('p');
      score.className = 'score';
      score.textContent = `cosseno ${hit.score.toFixed(3)}`;
      const text = document.createElement('p');
      text.textContent = hit.item.text;
      block.append(title, score, text);
      hitsEl.append(block);
    }
  } finally {
    searchButton.disabled = false;
  }
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Elemento ausente: ${selector}`);
  return element as T;
}
