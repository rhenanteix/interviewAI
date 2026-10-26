import type { SttHandler, SttProvider, SttProviderOptions } from './interfaces';
import { TranscriptSegment } from '@copilot/shared';

const FRASES_PT = [
  'ouvi a introdução da entrevista',
  'o candidato fala sobre a experiência anterior',
  'pergunta sobre desafios técnicos enfrentados',
  'resposta destaca trabalho em equipe e prazos',
  'discussão sobre stack e decisões de arquitetura',
];

export class DemoSttProvider implements SttProvider {
  private handler?: SttHandler;
  private started = false;
  private bufferSamples = 0;
  private indice = 0;
  private readonly thresholdSamples = 8000;

  async start(_options?: SttProviderOptions): Promise<void> {
    this.started = true;
    this.bufferSamples = 0;
  }

  sendAudio(pcm16: Int16Array, _sampleRate: number): void {
    if (!this.started || !this.handler) return;
    this.bufferSamples += pcm16.length;
    while (this.bufferSamples >= this.thresholdSamples) {
      this.bufferSamples -= this.thresholdSamples;
      const texto = FRASES_PT[this.indice % FRASES_PT.length];
      this.indice += 1;
      const segmento: TranscriptSegment = { text: texto, isFinal: true, language: 'pt-BR' };
      queueMicrotask(() => this.handler!(segmento));
    }
  }

  async stop(): Promise<void> {
    this.started = false;
    this.bufferSamples = 0;
  }

  onTranscript(handler: SttHandler): void {
    this.handler = handler;
  }
}
