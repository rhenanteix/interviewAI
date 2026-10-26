import { captureStart, captureStop } from '@interviewia/shared';

const CONSENT_KEY = 'interviewia_consent_v1';

const btnConsentAccept = document.querySelector<HTMLButtonElement>('#btnConsentAccept')!;
const consentModal = document.getElementById('consentModal')!;
const app = document.getElementById('app')!;
const btnStart = document.querySelector<HTMLButtonElement>('#btnStart')!;
const btnStop = document.querySelector<HTMLButtonElement>('#btnStop')!;
const btnClear = document.querySelector<HTMLButtonElement>('#btnClear')!;
const statusEl = document.querySelector<HTMLElement>('#status')!;
const connectionEl = document.querySelector<HTMLElement>('#connectionState')!;
const transEl = document.querySelector<HTMLElement>('#transcript')!;
const partialEl = document.querySelector<HTMLElement>('#partialLine')!;
const tradEl = document.querySelector<HTMLElement>('#translation')!;
const levelFill = document.querySelector<HTMLElement>('#levelFill')!;
const levelValue = document.querySelector<HTMLElement>('#levelValue')!;
const latStt = document.querySelector<HTMLElement>('#latStt')!;
const latTrans = document.querySelector<HTMLElement>('#latTrans')!;
const latTotal = document.querySelector<HTMLElement>('#latTotal')!;
const capturingIndicator = document.getElementById('capturingIndicator')!;

let ativo = false;
let nivelAtual = 0;
let parcialTimeout: ReturnType<typeof setTimeout> | null = null;

function api(mensagem: unknown): Promise<unknown> {
  return chrome.runtime.sendMessage(mensagem);
}

function status(texto: string): void {
  statusEl.textContent = texto;
}

function botoes(): void {
  btnStart.disabled = ativo;
  btnStop.disabled = !ativo;
}

function adiciona(el: HTMLElement, texto: string): void {
  const linha = document.createElement('div');
  linha.textContent = texto;
  el.prepend(linha);
}

function atualizarNivel(nivel: number): void {
  nivelAtual = nivel;
  const pct = Math.round(nivel * 1000);
  levelFill.style.width = `${Math.min(pct, 100)}%`;
  levelFill.style.background = pct > 60 ? '#ef4444' : pct > 30 ? '#f59e0b' : '#22c55e';
  levelValue.textContent = `${Math.min(pct, 100)}%`;
}

function setConnectionState(state: string): void {
  connectionEl.className = 'chip ' + state;
  connectionEl.textContent = state.charAt(0).toUpperCase() + state.slice(1);
  switch (state) {
    case 'conectando': status('Conectando à API...'); break;
    case 'ouvindo': status('Ouvindo áudio da aba...'); break;
    case 'erro': status('Erro de conexão. Reconectando automaticamente...'); break;
    case 'pausado': status('Pausado.'); break;
    case 'disconnected': status('Desconectado.'); break;
  }
}

function atualizarLatencia(stt: number | null, trans: number | null, total: number | null): void {
  latStt.textContent = stt != null ? String(stt) : '—';
  latTrans.textContent = trans != null ? String(trans) : '—';
  latTotal.textContent = total != null ? String(total) : '—';
}

function mostrarCapturando(mostrar: boolean): void {
  capturingIndicator.classList.toggle('escondido', !mostrar);
}

async function consentimentoDado(): Promise<boolean> {
  const itens = await chrome.storage.local.get([CONSENT_KEY]);
  return itens[CONSENT_KEY] === true;
}

async function gravarConsentimento(): Promise<void> {
  await chrome.storage.local.set({ [CONSENT_KEY]: true });
}

function limparDadosLocais(): void {
  chrome.storage.local.remove(['apiUrl', 'sourceLang', 'targetLang', CONSENT_KEY]).catch(() => {});
  localStorage.clear();
  status('Dados locais apagados.');
}

btnConsentAccept.addEventListener('click', async () => {
  await gravarConsentimento();
  consentModal.style.display = 'none';
  app.style.display = '';
  botoes();
  setConnectionState('disconnected');
});

btnStart.addEventListener('click', async () => {
  const dado = await consentimentoDado();
  if (!dado) {
    consentModal.style.display = 'flex';
    app.style.display = 'none';
    return;
  }
  const abas = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = abas[0]?.id;
  if (tabId === undefined) {
    status('Nenhuma aba ativa.');
    return;
  }
  await api({ type: 'capture.start', tabId });
  ativo = true;
  botoes();
  mostrarCapturando(true);
  status('Iniciando captura...');
});

btnStop.addEventListener('click', async () => {
  const abas = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = abas[0]?.id;
  if (tabId === undefined) return;
  await api({ type: 'capture.stop' });
  ativo = false;
  botoes();
  mostrarCapturando(false);
  status('Captura parada.');
  atualizarNivel(0);
  setConnectionState('disconnected');
  atualizarLatencia(null, null, null);
  if (parcialTimeout) clearTimeout(parcialTimeout);
  partialEl.textContent = '';
  partialEl.style.display = 'none';
});

btnClear.addEventListener('click', () => {
  limparDadosLocais();
});

chrome.runtime.onMessage.addListener((mensagem: unknown) => {
  if ((mensagem as { type?: string }).type === 'status') {
    status(String((mensagem as { text?: unknown }).text));
    return true;
  }
  if ((mensagem as { type?: string }).type === 'audio.level') {
    atualizarNivel((mensagem as { level?: number }).level ?? 0);
    return true;
  }
  if ((mensagem as { type?: string }).type === 'connection.state') {
    setConnectionState((mensagem as { state?: string }).state ?? 'disconnected');
    return true;
  }
  if ((mensagem as { type?: string }).type === 'partial') {
    const m = mensagem as { text?: string; lang?: string };
    if (m.text) {
      partialEl.textContent = m.text;
      partialEl.style.display = 'block';
      if (parcialTimeout) clearTimeout(parcialTimeout);
      parcialTimeout = setTimeout(() => {
        partialEl.textContent = '';
        partialEl.style.display = 'none';
      }, 3000);
    }
    return true;
  }
  if ((mensagem as { type?: string }).type === 'final') {
    const m = mensagem as { text?: string; lang?: string; sttLatency_ms?: number };
    if (m.text) {
      if (parcialTimeout) clearTimeout(parcialTimeout);
      partialEl.textContent = '';
      partialEl.style.display = 'none';
      adiciona(transEl, m.text);
      if (typeof m.sttLatency_ms === 'number') {
        atualizarLatencia(m.sttLatency_ms, null, null);
      }
    }
    return true;
  }
  if ((mensagem as { type?: string }).type === 'translated') {
    const m = mensagem as { original?: string; translated?: string; sttLatency_ms?: number; translationLatency_ms?: number; totalLatency_ms?: number };
    if (m.translated) {
      adiciona(tradEl, m.translated);
    }
    if (typeof m.sttLatency_ms === 'number' || typeof m.translationLatency_ms === 'number' || typeof m.totalLatency_ms === 'number') {
      atualizarLatencia(
        m.sttLatency_ms ?? null,
        m.translationLatency_ms ?? null,
        m.totalLatency_ms ?? null,
      );
    }
    return true;
  }
  return false;
});

(async () => {
  const dado = await consentimentoDado();
  if (dado) {
    consentModal.style.display = 'none';
    app.style.display = '';
    botoes();
    setConnectionState('disconnected');
  } else {
    consentModal.style.display = 'flex';
    app.style.display = 'none';
  }
})();
