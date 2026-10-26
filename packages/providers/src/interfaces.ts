import type { Lang } from './lang.js';

export type SttEventKind = 'partial' | 'final' | 'error' | 'close';

export interface SttPartialEvent {
  type: 'partial';
  text: string;
  stability?: number;
}

export interface SttFinalEvent {
  type: 'final';
  text: string;
  isFinal: true;
  language?: string;
}

export interface SttErrorEvent {
  type: 'error';
  error: { message: string; code?: string };
}

export interface SttCloseEvent {
  type: 'close';
  code?: number;
  reason?: string;
}

export type SttEvent = SttPartialEvent | SttFinalEvent | SttErrorEvent | SttCloseEvent;
export type SttEventHandler = (event: SttEvent) => void;

export interface SttProviderOptions {
  language?: string;
  sampleRate?: number;
}

export interface SttProvider {
  start(options?: SttProviderOptions): Promise<void>;
  sendAudio(pcm16: Int16Array, sampleRate: number): void;
  stop(): Promise<void>;
  on(kind: SttEventKind, handler: SttEventHandler): void;
  off(kind: SttEventKind, handler: SttEventHandler): void;
}

export type TranslationEventKind = 'partial' | 'final' | 'error' | 'close';

export interface TranslationPartialEvent {
  type: 'partial';
  text: string;
}

export interface TranslationFinalEvent {
  type: 'final';
  text: string;
}

export interface TranslationErrorEvent {
  type: 'error';
  error: { message: string; code?: string };
}

export interface TranslationCloseEvent {
  type: 'close';
}

export type TranslationEvent = TranslationPartialEvent | TranslationFinalEvent | TranslationErrorEvent | TranslationCloseEvent;
export type TranslationEventHandler = (event: TranslationEvent) => void;

export interface TranslationOptions {
  targetLang: Lang;
  sourceLang?: Lang;
}

export interface TranslationProvider {
  start(options?: TranslationOptions): Promise<void>;
  sendText(text: string): void;
  stop(): Promise<void>;
  on(kind: TranslationEventKind, handler: TranslationEventHandler): void;
  off(kind: TranslationEventKind, handler: TranslationEventHandler): void;
}

export type SttProviderType = 'fake' | 'deepgram' | 'whisper';

export interface SttProviderConfig {
  type: SttProviderType;
  deepgramApiKey?: string;
  whisperUrl?: string;
  language?: string;
  sampleRate?: number;
  fixturePath?: string;
}

export interface TranslationProviderConfig {
  type: 'demo' | 'anthropic';
  targetLang?: Lang;
  sourceLang?: Lang;
  debounceMs?: number;
  anthropicApiKey?: string;
  model?: string;
}
