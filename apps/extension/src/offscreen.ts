import { toMonoFloat32, resampleTo, float32ToPcm16, TARGET_SAMPLE_RATE } from './audio-worklet';

let contexto: AudioContext | null = null;
let stream: MediaStream | null = null;

function pararTudo(): void {
  if (contexto) {
    void contexto.close().catch(() => {});
    contexto = null;
  }
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
}

async function tratarMensagem(mensagem: unknown): Promise<void> {
  if ((mensagem as { type: string }).type !== 'offscreen.start') return;
  const { streamId, tabId } = mensagem as { streamId: string; tabId: number };

  pararTudo();

  const constraints = {
    audio: { mandatory: { chromeMediaSourceId: streamId } },
  } as unknown as MediaStreamConstraints;

  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (e) {
    void chrome.runtime
      .sendMessage({
        type: 'extension.error',
        message: `Não foi possível abrir o stream de áudio da aba: ${e instanceof Error ? e.message : String(e)}`,
      })
      .catch(() => {});
    return;
  }

  contexto = new AudioContext();
  const origem = contexto.createMediaStreamSource(stream);

  origem.connect(contexto.destination);

  await contexto.audioWorklet.addModule(chrome.runtime.getURL('audio-worklet.js'));
  const processador = new AudioWorkletNode(contexto, 'interview-audio-processor');
  origem.connect(processador);

  processador.port.onmessage = (evento: MessageEvent) => {
    const { pcm16, sampleRate } = evento.data as { pcm16: Int16Array; sampleRate: number };
    void chrome.runtime
      .sendMessage({ type: 'audio.pcm', pcm16, sampleRate, tabId })
      .catch(() => {});
  };
}

chrome.runtime.onMessage.addListener((mensagem) => {
  void tratarMensagem(mensagem);
});
