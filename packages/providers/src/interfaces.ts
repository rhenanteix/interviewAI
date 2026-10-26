import type { TranscriptSegment } from '@copilot/shared';

export type Lang = 'pt-BR' | 'en' | 'es';

export type SttHandler = (segment: TranscriptSegment) => void;

export interface SttProviderOptions {
  language?: string;
  sampleRate?: number;
}

export interface SttProvider {
  start(options?: SttProviderOptions): Promise<void>;
  sendAudio(pcm16: Int16Array, sampleRate: number): void;
  stop(): Promise<void>;
  onTranscript(handler: SttHandler): void;
}

export interface TranslationOptions {
  targetLang: Lang;
  sourceLang?: Lang;
}

export interface TranslationProvider {
  translate(text: string, options: TranslationOptions): Promise<string>;
}
