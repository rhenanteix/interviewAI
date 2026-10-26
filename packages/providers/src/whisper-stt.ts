import type { Lang } from './lang.js';
import type {
  SttEvent,
  SttEventHandler,
  SttEventKind,
  SttProvider,
  SttProviderOptions,
} from './interfaces.js';
import { SimpleEventEmitter } from './event-emitter.js';

const VAD_FRAME_MS = 20; // cada frame de VAD tem 20 ms
const VAD_FRAME_SAMPLES = (16000 * VAD_FRAME_MS) / 1000; // 320 amostras a 16 kHz
const SPEECH_THRESHOLD = 0.015; // RMS acima disso é fala
const SILENCE_TIMEOUT_MS = 600; // silêncio para fechar segmento
const MAX_SEGMENT_MS = 15000; // segmento máximo antes de forçar envio
const MIN_SPEECH_MS = 300; // mínimo de fala para considerar segmento válido

function rmsPcm16(samples: Int16Array): number {
  let soma = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i] / 32768;
    soma += v * v;
  }
  return Math.sqrt(soma / samples.length);
}

function pcm16ToWav(samples: Int16Array, sampleRate: number): Uint8Array {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const chunkSize = 4 + 8 + dataSize;
  const fileSize = 4 + 8 + chunkSize + 8 + dataSize;
  const buf = new Uint8Array(fileSize);
  let offset = 0;
  const writeStr = (s: string) => {
    for (let i = 0; i < s.length; i++) buf[offset++] = s.charCodeAt(i);
  };
  const writeU32 = (v: number) => {
    buf[offset++] = v & 0xff;
    buf[offset++] = (v >> 8) & 0xff;
    buf[offset++] = (v >> 16) & 0xff;
    buf[offset++] = (v >> 24) & 0xff;
  };
  const writeU16 = (v: number) => {
    buf[offset++] = v & 0xff;
    buf[offset++] = (v >> 8) & 0xff;
  };
  writeStr('RIFF');
  writeU32(fileSize - 8);
  writeStr('WAVE');
  writeStr('fmt ');
  writeU32(16);
  writeU16(1); // PCM
  writeU16(1); // mono
  writeU32(sampleRate);
  writeU32(sampleRate * bytesPerSample);
  writeU16(bytesPerSample);
  writeU16(16);
  writeStr('data');
  writeU32(dataSize);
  const view = new DataView(samples.buffer, samples.byteOffset, samples.byteLength);
  for (let i = 0; i < samples.length; i++) {
    writeU16(view.getInt16(i * 2, true));
  }
  return buf;
}

export class WhisperSttProvider implements SttProvider {
  private emitter = new SimpleEventEmitter();
  private started = false;
  private buffer: Int16Array[] = [];
  private bufferSamples = 0;
  private speechSamples = 0;
  private silenceSamples = 0;
  private segmentStartMs = 0;
  private readonly options: Required<SttProviderOptions>;
  private readonly whisperUrl: string;
  private language: Lang;

  constructor(opts: { whisperUrl?: string; language?: string; sampleRate?: number } = {}) {
    this.whisperUrl = opts.whisperUrl ?? process.env.WHISPER_URL ?? 'http://localhost:8080/inference';
    this.options = {
      language: opts.language ?? 'pt-BR',
      sampleRate: opts.sampleRate ?? 16000,
    };
    this.language = this.options.language as Lang;
  }

  async start(_options?: SttProviderOptions): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.buffer = [];
    this.bufferSamples = 0;
    this.speechSamples = 0;
    this.silenceSamples = 0;
    this.segmentStartMs = Date.now();
  }

  sendAudio(pcm16: Int16Array, _sampleRate: number): void {
    if (!this.started) return;
    this.buffer.push(pcm16);
    this.bufferSamples += pcm16.length;

    // VAD por frame de 20 ms
    for (let i = 0; i + VAD_FRAME_SAMPLES <= pcm16.length; i += VAD_FRAME_SAMPLES) {
      const frame = pcm16.subarray(i, i + VAD_FRAME_SAMPLES);
      const level = rmsPcm16(frame);
      if (level > SPEECH_THRESHOLD) {
        this.speechSamples += VAD_FRAME_SAMPLES;
        this.silenceSamples = 0;
      } else {
        this.silenceSamples += VAD_FRAME_SAMPLES;
      }
    }

    const agora = Date.now();
    const segmentoMs = agora - this.segmentStartMs;
    const silencioMs = (this.silenceSamples / this.options.sampleRate) * 1000;
    const falaMs = (this.speechSamples / this.options.sampleRate) * 1000;

    const deveEnviar =
      (silencioMs > SILENCE_TIMEOUT_MS && falaMs > MIN_SPEECH_MS) ||
      segmentoMs > MAX_SEGMENT_MS;

    if (deveEnviar && this.bufferSamples > 0) {
      const segmento = this.concatenarBuffer();
      this.enviarWhisper(segmento);
      this.resetarBuffer();
    }
  }

  private concatenarBuffer(): Int16Array {
    const total = this.buffer.reduce((acc, b) => acc + b.length, 0);
    const saida = new Int16Array(total);
    let offset = 0;
    for (const b of this.buffer) {
      saida.set(b, offset);
      offset += b.length;
    }
    return saida;
  }

  private resetarBuffer(): void {
    this.buffer = [];
    this.bufferSamples = 0;
    this.speechSamples = 0;
    this.silenceSamples = 0;
    this.segmentStartMs = Date.now();
  }

  private async enviarWhisper(samples: Int16Array): Promise<void> {
    if (samples.length < this.options.sampleRate * 0.5) return; // menos de 0.5s, ignora
    try {
      const wav = pcm16ToWav(samples, this.options.sampleRate);
      const form = new FormData();
      form.append('file', new Blob([wav as unknown as BlobPart], { type: 'audio/wav' }), 'audio.wav');
      form.append('language', this.language);
      form.append('task', 'transcribe');
      const res = await fetch(this.whisperUrl, { method: 'POST', body: form });
      if (!res.ok) {
        this.emitter.emit('error', {
          type: 'error',
          error: { message: `Whisper HTTP ${res.status}`, code: 'WHISPER_HTTP_ERROR' },
        });
        return;
      }
      const data = (await res.json()) as { text?: string };
      const texto = data.text?.trim();
      if (texto) {
        this.emitter.emit('final', { type: 'final', text: texto, isFinal: true, language: this.language });
      }
    } catch (e) {
      this.emitter.emit('error', {
        type: 'error',
        error: { message: e instanceof Error ? e.message : String(e), code: 'WHISPER_ERROR' },
      });
    }
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.started = false;
    if (this.bufferSamples > 0 && this.speechSamples > 0) {
      await this.enviarWhisper(this.concatenarBuffer());
    }
    this.emitter.emit('close', { type: 'close' });
    this.emitter.removeAllListeners();
  }

  on(kind: SttEventKind, handler: SttEventHandler): void {
    this.emitter.on(kind, handler as unknown as (event: unknown) => void);
  }

  off(kind: SttEventKind, handler: SttEventHandler): void {
    this.emitter.off(kind, handler as unknown as (event: unknown) => void);
  }
}
