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

const DEFAULT_QUERY = 'how do I stop the animation from freezing';

const loadButton = required<HTMLButtonElement>('#load');
const resetButton = required<HTMLButtonElement>('#reset');
const searchButton = required<HTMLButtonElement>('#search');
const queryInput = required<HTMLInputElement>('#query');
const progress = required<HTMLElement>('#progress');
const meter = required<HTMLElement>('#meter');
const meterBar = required<HTMLElement>('#meter-bar');
const modelPanel = required<HTMLElement>('#modelo');
const searchPanel = required<HTMLElement>('#busca');
const backendEl = required<HTMLElement>('#backend');
const loadMsEl = required<HTMLElement>('#load-ms');
const indexMsEl = required<HTMLElement>('#index-ms');
const dimsEl = required<HTMLElement>('#dims');
const queryMsEl = required<HTMLElement>('#query-ms');
const hitsEl = required<HTMLElement>('#hits');
const suggestions = required<HTMLElement>('#suggestions');
const serverRequests = required<HTMLElement>('#server-requests');
const localMs = required<HTMLElement>('#local-ms');
const serverVerdict = required<HTMLElement>('#server-verdict');
const localVerdict = required<HTMLElement>('#local-verdict');
const runLine = required<HTMLElement>('#run-line');
const runFlag = required<HTMLElement>('#run-flag');
const runState = required<HTMLElement>('#run-state');
const takeaway = required<HTMLElement>('#takeaway');

let embedder: LoadedEmbedder | null = null;
let index: IndexedArticle[] = [];
let loading = false;
const suggestionButtons: HTMLButtonElement[] = [];

const initialQuery = new URLSearchParams(location.search).get('consulta');
if (initialQuery !== null) queryInput.value = initialQuery;

for (const suggestion of SUGGESTIONS) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = suggestion;
  button.disabled = true;
  button.addEventListener('click', () => {
    queryInput.value = suggestion;
    syncQuery();
    void runSearch();
  });
  suggestionButtons.push(button);
  suggestions.append(button);
}

loadButton.addEventListener('click', () => {
  void runLoad();
});
resetButton.addEventListener('click', reset);
searchButton.addEventListener('click', () => {
  void runSearch();
});
queryInput.addEventListener('input', syncQuery);
queryInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    void runSearch();
  }
});

async function runLoad(): Promise<void> {
  if (loading) return;
  loading = true;
  loadButton.disabled = true;
  searchButton.disabled = true;
  queryInput.disabled = true;
  setSuggestions(false);
  hitsEl.replaceChildren();
  clearSearchReadout();
  setRun('running', 'Rodando', 'Em andamento');
  setText(takeaway, '');
  modelPanel.setAttribute('aria-busy', 'true');
  try {
    embedder = await loadEmbedder((update) => {
      progress.textContent = update.line;
      paintMeter(update.percent);
    });
    backendEl.textContent = `${embedder.backend} / ${embedder.dtype}`;
    loadMsEl.textContent = `${embedder.loadMs.toFixed(0)} ms`;
    progress.textContent = `Modelo ${MODEL_ID} pronto. Indexando ${ARTICLES.length} textos...`;
    paintMeter(null);

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
    markReady();
    await runSearch();
  } catch (error) {
    progress.textContent =
      error instanceof Error
        ? `Não consegui carregar o modelo. ${error.message}`
        : 'Não consegui carregar o modelo.';
    paintMeter(null);
    loadButton.disabled = false;
    loadButton.classList.remove('secondary');
    searchButton.classList.add('secondary');
    setRun('error', 'Erro', 'Falhou');
    setText(takeaway, 'O modelo não baixou. Confira a rede e tente de novo.');
  } finally {
    loading = false;
    modelPanel.setAttribute('aria-busy', 'false');
  }
}

async function runSearch(): Promise<void> {
  if (!embedder || index.length === 0 || loading) return;
  const query = queryInput.value.trim();
  if (!query) return;
  syncQuery();
  searchButton.disabled = true;
  searchPanel.setAttribute('aria-busy', 'true');
  setRun('running', 'Rodando', 'Em andamento');
  try {
    const started = performance.now();
    const vector = await embedder.embed(query);
    const hits = searchTop(index, vector, 3);
    const elapsed = performance.now() - started;
    queryMsEl.textContent = `Consulta em ${elapsed.toFixed(1)} ms, dimensão ${vector.length}.`;
    localMs.textContent = elapsed.toFixed(1);
    serverRequests.textContent = '0';
    setText(serverVerdict, 'Nada saiu daqui');
    serverVerdict.className = 'verdict verdict--good';
    setText(localVerdict, 'Consulta local');
    localVerdict.className = 'verdict verdict--good';
    const where =
      embedder.backend === 'wasm'
        ? 'WASM (q8), porque WebGPU não estava disponível'
        : 'WebGPU (fp16)';
    setRun('done', 'Feito', 'Concluído');
    setText(
      takeaway,
      `A consulta levou ${elapsed.toFixed(1)} ms neste navegador, sem servidor. O modelo rodou em ${where}.`,
    );
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
    searchPanel.setAttribute('aria-busy', 'false');
  }
}

function reset(): void {
  queryInput.value = DEFAULT_QUERY;
  hitsEl.replaceChildren();
  queryMsEl.textContent = '';
  clearSearchReadout();
  setText(takeaway, '');
  history.replaceState(null, '', location.pathname);
  if (embedder && index.length > 0) {
    markReady();
    setRun('idle', 'Parado', 'Pronto para buscar');
    return;
  }
  progress.textContent = 'Ainda não carreguei nada.';
  paintMeter(null);
  backendEl.textContent = '...';
  loadMsEl.textContent = '...';
  indexMsEl.textContent = '...';
  dimsEl.textContent = '...';
  loadButton.disabled = false;
  loadButton.classList.remove('secondary');
  searchButton.classList.add('secondary');
  searchButton.disabled = true;
  queryInput.disabled = true;
  setSuggestions(false);
  setRun('idle', 'Parado', 'Pronto');
}

function markReady(): void {
  queryInput.disabled = false;
  searchButton.disabled = false;
  loadButton.disabled = false;
  loadButton.classList.add('secondary');
  searchButton.classList.remove('secondary');
  setSuggestions(true);
}

function clearSearchReadout(): void {
  serverRequests.textContent = 'ainda não';
  localMs.textContent = 'ainda não';
  setText(serverVerdict, 'Aguardando');
  serverVerdict.className = 'verdict';
  setText(localVerdict, 'Aguardando');
  localVerdict.className = 'verdict';
}

function paintMeter(percent: number | null): void {
  if (percent === null) {
    meter.hidden = true;
    return;
  }
  meter.hidden = false;
  const width = Math.max(0, Math.min(100, percent));
  meterBar.style.width = `${width}%`;
}

function setSuggestions(enabled: boolean): void {
  for (const button of suggestionButtons) button.disabled = !enabled;
}

function syncQuery(): void {
  const value = queryInput.value.trim();
  if (value === '' || value === DEFAULT_QUERY) {
    if (location.search) history.replaceState(null, '', location.pathname);
    return;
  }
  const next = `${location.pathname}?consulta=${encodeURIComponent(value)}`;
  if (`${location.pathname}${location.search}` !== next) history.replaceState(null, '', next);
}

function setRun(state: 'idle' | 'running' | 'done' | 'error', flag: string, label: string): void {
  if (runLine.dataset.state !== state) runLine.dataset.state = state;
  setText(runFlag, flag);
  setText(runState, label);
}

function setText(element: HTMLElement, value: string): void {
  if (element.textContent !== value) element.textContent = value;
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Elemento ausente: ${selector}`);
  return element as T;
}
