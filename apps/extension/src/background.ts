import { DemoSttProvider } from '@copilot/providers';
import { DemoTranslationProvider } from '@copilot/providers';
import {
  captureStart,
  captureStop,
  extensionError,
  transcript,
  translation,
} from '@copilot/shared';

type Lang = 'pt-BR' | 'en' | 'es';

interface Translate {
  type: 'translate';
  text: string;
  targetLang: Lang;
  sourceLang?: Lang;
}

interface SetTargetLang {
  type: 'setTargetLang';
  targetLang: Lang;
}

interface CaptureState {
  tabId: number;
  stream: MediaStream | null;
}

const capturas = new Map<number, CaptureState>();
const stt = new DemoSttProvider();
const tradutor = new DemoTranslationProvider();
let idiomaAlvo: Lang = 'en';
let sttIniciado = false;

function status(texto: string): void {
  void chrome.runtime.sendMessage({ type: 'status', text: texto }).catch(() => {});
}

function erro(texto: string, fatal = false): void {
  void chrome.runtime
    .sendMessage(extensionError.parse({ type: 'extension.error', message: texto, fatal }))
    .catch(() => {});
}

function broadcast(mensagem: unknown): void {
  void chrome.runtime.sendMessage(mensagem).catch(() => {});
}

async function iniciarCaptura(tabId: number): Promise<void> {
  let streamId: string;
  try {
    streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
  } catch (e) {
    erro(`Não foi possível capturar a aba: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }
  try {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Captura de áudio da aba para legendas ao vivo (STT local)',
    });
  } catch (e) {
    erro(`Não foi possível criar documento offscreen: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  capturas.set(tabId, { tabId, stream: null });
  if (!sttIniciado) {
    await stt.start({ language: 'pt-BR', sampleRate: 16000 });
    stt.onTranscript((segmento) => {
      void validarEEnviarTranscricao(segmento);
    });
    sttIniciado = true;
  }

  void chrome.runtime.sendMessage({ type: 'offscreen.start', streamId, tabId });
  status('Capturando áudio da aba. Fale na aba de entrevista.');
}

async function pararCaptura(tabId: number): Promise<void> {
  const estado = capturas.get(tabId);
  if (estado?.stream) {
    estado.stream.getTracks().forEach((t) => t.stop());
  }
  capturas.delete(tabId);
  await chrome.offscreen.closeDocument().catch(() => {});
  if (capturas.size === 0 && sttIniciado) {
    await stt.stop();
    sttIniciado = false;
  }
  status('Captura parada.');
}

async function validarEEnviarTranscricao(segmento: unknown): Promise<void> {
  const parsed = transcript.parse(segmento);
  await enviarTraducao(parsed.text, parsed.language);
  broadcast(parsed);
}

async function enviarTraducao(texto: string, idiomaFonte?: string): Promise<void> {
  const alvo = idiomaAlvo;
  const fonte = (idiomaFonte ?? 'pt-BR') as Lang | undefined;
  try {
    const traduzido = await tradutor.translate(texto, { targetLang: alvo, sourceLang: fonte });
    broadcast(translation.parse({ type: 'translation', text: traduzido, targetLang: alvo, sourceLang: fonte }));
  } catch (e) {
    erro(`Falha na tradução: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function tratarMensagem(mensagem: unknown): Promise<void> {
  try {
    if (captureStart.safeParse(mensagem).success) {
      const { tabId } = captureStart.parse(mensagem);
      await iniciarCaptura(tabId);
      return;
    }
    if (captureStop.safeParse(mensagem).success) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id;
      if (tabId === undefined) throw new Error('Nenhuma aba ativa');
      await pararCaptura(tabId);
      return;
    }
    if ((mensagem as SetTargetLang).type === 'setTargetLang') {
      idiomaAlvo = (mensagem as SetTargetLang).targetLang;
      return;
    }
    if ((mensagem as { type: string }).type === 'offscreen.start') {
      return;
    }
    if ((mensagem as { type: string }).type === 'audio.pcm') {
      const { pcm16, sampleRate } = mensagem as { pcm16: Int16Array; sampleRate: number };
      stt.sendAudio(pcm16, sampleRate);
      return;
    }
    if ((mensagem as Translate).type === 'translate') {
      const { text, targetLang, sourceLang } = mensagem as Translate;
      try {
        const traduzido = await tradutor.translate(text, { targetLang, sourceLang });
        broadcast(translation.parse({ type: 'translation', text: traduzido, targetLang, sourceLang }));
      } catch (e) {
        erro(`Falha na tradução: ${e instanceof Error ? e.message : String(e)}`);
      }
      return;
    }
  } catch (e) {
    erro(e instanceof Error ? e.message : String(e));
  }
}

chrome.runtime.onMessage.addListener((mensagem) => {
  void tratarMensagem(mensagem);
});
