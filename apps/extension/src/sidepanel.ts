import {
  captureStart,
  captureStop,
  transcript,
  translation,
  extensionError,
  type Transcript,
  type Translation,
  type ExtensionError,
} from '@copilot/shared';

const btnStart = document.querySelector<HTMLButtonElement>('#btnStart')!;
const btnStop = document.querySelector<HTMLButtonElement>('#btnStop')!;
const selectLang = document.querySelector<HTMLSelectElement>('#targetLang')!;
const statusEl = document.querySelector<HTMLElement>('#status')!;
const transEl = document.querySelector<HTMLElement>('#transcript')!;
const tradEl = document.querySelector<HTMLElement>('#translation')!;

let ativo = false;
let idiomaAlvo = selectLang.value;

function api(mensagem: unknown): Promise<unknown> {
  return chrome.runtime.sendMessage(mensagem);
}

function status(texto: string): void {
  statusEl.textContent = texto;
}

function botoes(): void {
  btnStart.disabled = ativo;
  btnStop.disabled = !ativo;
  if (ativo) btnStart.classList.add('ativa'); else btnStart.classList.remove('ativa');
}

function adiciona(el: HTMLElement, texto: string): void {
  const linha = document.createElement('div');
  linha.textContent = texto;
  el.prepend(linha);
}

selectLang.addEventListener('change', () => {
  idiomaAlvo = selectLang.value;
  void api({ type: 'setTargetLang', targetLang: idiomaAlvo }).catch(() => {});
});

btnStart.addEventListener('click', async () => {
  const abas = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = abas[0]?.id;
  if (tabId === undefined) {
    status('Nenhuma aba ativa.');
    return;
  }
  idiomaAlvo = selectLang.value;
  await api({ type: 'capture.start', tabId });
  ativo = true;
  botoes();
  status('Capturando áudio da aba. Fale na aba da entrevista.');
});

btnStop.addEventListener('click', async () => {
  const abas = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = abas[0]?.id;
  if (tabId === undefined) return;
  await api({ type: 'capture.stop' });
  ativo = false;
  botoes();
  status('Captura parada.');
});

chrome.runtime.onMessage.addListener((mensagem: unknown) => {
  if (transcript.safeParse(mensagem).success) {
    const segmento = transcript.parse(mensagem) as Transcript;
    adiciona(transEl, segmento.text);
    void api({ type: 'translate', text: segmento.text, targetLang: idiomaAlvo, sourceLang: segmento.language }).catch(() => {});
    return true;
  }
  if (translation.safeParse(mensagem).success) {
    const segmento = translation.parse(mensagem) as Translation;
    adiciona(tradEl, segmento.text);
    return true;
  }
  if (extensionError.safeParse(mensagem).success) {
    const err = extensionError.parse(mensagem) as ExtensionError;
    status(`Erro: ${err.message}`);
    return true;
  }
  if ((mensagem as { type?: string }).type === 'status') {
    status(String((mensagem as { text?: unknown }).text));
    return true;
  }
});

botoes();
