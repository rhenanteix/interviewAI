import { apiStreamEventOut } from '@interviewia/shared';

let contexto: AudioContext | null = null;
let stream: MediaStream | null = null;

let ws: WebSocket | null = null;
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let wsBackoffMs = 1000;
const WS_BACKOFF_MAX = 30000;
const WS_IDLE_TIMEOUT_MS = 30000;

let apiBaseUrl = 'http://localhost:3001';

function status(texto: string): void {
  void chrome.runtime.sendMessage({ type: 'status', text: texto }).catch(() => {});
}

function erro(texto: string): void {
  void chrome.runtime
    .sendMessage({ type: 'extension.error', message: texto })
    .catch(() => {});
}

function broadcast(mensagem: unknown): void {
  void chrome.runtime.sendMessage(mensagem).catch(() => {});
}

function setConnectionState(state: string): void {
  broadcast({ type: 'connection.state', state });
}

async function carregarConfiguracao(): Promise<void> {
  try {
    const itens = await chrome.storage.local.get(['apiUrl']);
    if (itens.apiUrl) apiBaseUrl = String(itens.apiUrl);
  } catch {
    // usar padrão
  }
}

async function obterTokenSessao(): Promise<string> {
  const res = await fetch(`${apiBaseUrl}/v1/session`, {
    method: 'POST',
    body: '{}',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Falha ao criar sessão: ${res.status}`);
  const body = await res.json();
  return body.token;
}

function pararWs(): void {
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = null;
  }
  if (ws) {
    ws.close(1000, 'Parando');
    ws = null;
  }
  wsBackoffMs = 1000;
}

function agendarReconexao(): void {
  pararWs();
  setConnectionState('conectando');
  wsReconnectTimer = setTimeout(() => {
    wsBackoffMs = Math.min(WS_BACKOFF_MAX, wsBackoffMs * 2);
    void conectarWs();
  }, wsBackoffMs);
}

async function conectarWs(): Promise<void> {
  try {
    const token = await obterTokenSessao();
    const url = `${apiBaseUrl.replace(/^http/, 'ws')}/v1/stream?token=${encodeURIComponent(token)}`;
    abrirWebSocket(url);
  } catch (e) {
    erro(`Não foi possível obter token de sessão: ${e instanceof Error ? e.message : String(e)}`);
    setConnectionState('erro');
    agendarReconexao();
  }
}

function abrirWebSocket(url: string): void {
  pararWs();
  ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';

  let tempoUltimaAtividade = Date.now();
  let timerIdle: ReturnType<typeof setInterval> | null = null;

  const fechar = (code: number, reason: string) => {
    if (timerIdle) clearInterval(timerIdle);
    if (ws) ws.close(code, reason);
    ws = null;
  };

  ws.onopen = () => {
    wsBackoffMs = 1000;
    setConnectionState('ouvindo');
    status('Conectado à API. Aguardando áudio...');
    timerIdle = setInterval(() => {
      if (Date.now() - tempoUltimaAtividade > WS_IDLE_TIMEOUT_MS) {
        fechar(1001, 'Sessão ociosa');
        agendarReconexao();
      }
    }, 5000);
  };

  ws.onmessage = (evento: MessageEvent) => {
    tempoUltimaAtividade = Date.now();
    try {
      const dado = JSON.parse(evento.data as string);
      const eventoValidado = apiStreamEventOut.safeParse(dado);
      if (!eventoValidado.success) return;
      const ev = eventoValidado.data;
      broadcast(ev);
      if (ev.type === 'audio_ready') {
        setConnectionState('ouvindo');
        status('Pronto para receber áudio.');
      }
      if (ev.type === 'audio_closed') {
        fechar(1000, 'Sessão fechada pela API');
        agendarReconexao();
      }
    } catch {
      // ignora mensagens malformadas
    }
  };

  ws.onerror = () => {
    erro('Erro na conexão WebSocket com a API.');
    setConnectionState('erro');
    fechar(1006, 'Erro');
    agendarReconexao();
  };

  ws.onclose = (evento: CloseEvent) => {
    if (timerIdle) clearInterval(timerIdle);
    ws = null;
    if (evento.wasClean) {
      setConnectionState('disconnected');
    } else {
      setConnectionState('erro');
      agendarReconexao();
    }
  };
}

function pararTudo(): void {
  pararWs();
  if (contexto) {
    void contexto.close().catch(() => {});
    contexto = null;
  }
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
}

chrome.runtime.onMessage.addListener((mensagem) => {
  void (async () => {
    if ((mensagem as { type: string }).type === 'offscreen.start') {
      const { streamId, tabId } = mensagem as { streamId: string; tabId: number };
      await carregarConfiguracao();
      pararTudo();

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { mandatory: { chromeMediaSourceId: streamId } },
        } as unknown as MediaStreamConstraints);
      } catch (e) {
        erro(`Não foi possível abrir o stream de áudio da aba: ${e instanceof Error ? e.message : String(e)}`);
        setConnectionState('erro');
        return;
      }

      contexto = new AudioContext();
      const origem = contexto.createMediaStreamSource(stream);
      origem.connect(contexto.destination);

      await contexto.audioWorklet.addModule(chrome.runtime.getURL('audio-worklet.js'));
      const processador = new AudioWorkletNode(contexto, 'interview-audio-processor');
      origem.connect(processador);

      processador.port.onmessage = (evento: MessageEvent) => {
        const { pcm16, sampleRate, level } = evento.data as { pcm16: Int16Array; sampleRate: number; level: number };
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(pcm16);
        }
        broadcast({ type: 'audio.level', level });
      };

      void conectarWs();
      return;
    }
    if ((mensagem as { type: string }).type === 'capture.stop') {
      pararTudo();
      setConnectionState('disconnected');
      status('Captura parada.');
      return;
    }
  })();
});
