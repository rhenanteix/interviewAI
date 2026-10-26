import type {
  SttEvent,
  SttEventHandler,
  SttEventKind,
  SttProvider,
  SttProviderOptions,
} from './interfaces.js';
import { SimpleEventEmitter } from './event-emitter.js';

const SIMULATED_TRANSCRIPTS = [
  'ouvi a introdução da entrevista',
  'o candidato fala sobre a experiência anterior',
  'pergunta sobre desafios técnicos enfrentados',
  'resposta destaca trabalho em equipe e prazos',
  'discussão sobre stack e decisões de arquitetura',
];

function parseWavPcm16(buffer: Buffer): Int16Array {
  if (buffer.length < 44) throw new Error('WAV muito curto para conter cabeçalho');
  const riff = buffer.toString('ascii', 0, 4);
  if (riff !== 'RIFF') throw new Error('Não é um arquivo WAV válido (faltou RIFF)');
  const wave = buffer.toString('ascii', 8, 12);
  if (wave !== 'WAVE') throw new Error('Não é um arquivo WAV válido (faltou WAVE)');

  let offset = 12;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }
    offset += 8 + chunkSize;
  }

  if (dataOffset < 0) throw new Error('WAV não contém chunk de dados');
  const sampleCount = dataSize / 2;
  const samples = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = buffer.readInt16LE(dataOffset + i * 2);
  }
  return samples;
}

export class FakeSttProvider implements SttProvider {
  private emitter = new SimpleEventEmitter();
  private started = false;
  private bufferSamples = 0;
  private indice = 0;
  private readonly thresholdSamples = 8000;
  private pcmData: Int16Array = new Int16Array(0);
  private readonly options: Required<SttProviderOptions>;

  constructor(readonly config: { fixturePath?: string; language?: string; sampleRate?: number } = {}) {
    this.options = {
      language: config.language ?? 'pt-BR',
      sampleRate: config.sampleRate ?? 16000,
    };
  }

  async start(_options?: SttProviderOptions): Promise<void> {
    if (this.started) return;
    if (this.config.fixturePath) {
      try {
        const { readFile } = await import('node:fs/promises');
        const buffer = await readFile(this.config.fixturePath);
        this.pcmData = parseWavPcm16(buffer);
      } catch {
        this.pcmData = new Int16Array(0);
      }
    }
    this.started = true;
    this.bufferSamples = 0;
    this.indice = 0;
  }

  sendAudio(pcm16: Int16Array, _sampleRate: number): void {
    if (!this.started) return;
    this.bufferSamples += pcm16.length;
    while (this.bufferSamples >= this.thresholdSamples) {
      this.bufferSamples -= this.thresholdSamples;
      const texto = SIMULATED_TRANSCRIPTS[this.indice % SIMULATED_TRANSCRIPTS.length];
      this.indice += 1;
      this.emitter.emit('partial', { type: 'partial', text: texto, stability: 0.8 });
      queueMicrotask(() => {
        this.emitter.emit('final', {
          type: 'final',
          text: texto,
          isFinal: true,
          language: this.options.language,
        });
      });
    }
  }

  async stop(): Promise<void> {
    this.started = false;
    this.bufferSamples = 0;
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
