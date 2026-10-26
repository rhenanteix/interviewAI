import { z } from 'zod';

export const captureStart = z.object({
  type: z.literal('capture.start'),
  tabId: z.number().int().positive(),
});

export const captureStop = z.object({
  type: z.literal('capture.stop'),
});

export const transcript = z.object({
  type: z.literal('transcript'),
  text: z.string().min(1).max(100000),
  isFinal: z.boolean().default(false),
  language: z.string().min(1).max(8).optional(),
});

export const translation = z.object({
  type: z.literal('translation'),
  text: z.string().min(1).max(100000),
  targetLang: z.enum(['pt-BR', 'en', 'es']),
  sourceLang: z.enum(['pt-BR', 'en', 'es']).optional(),
});

export const extensionError = z.object({
  type: z.literal('extension.error'),
  message: z.string().min(1).max(1000),
  fatal: z.boolean().default(false),
});

export const extensionMessage = z.discriminatedUnion('type', [
  captureStart,
  captureStop,
  transcript,
  translation,
  extensionError,
]);

export type CaptureStart = z.infer<typeof captureStart>;
export type CaptureStop = z.infer<typeof captureStop>;
export type Transcript = z.infer<typeof transcript>;
export type Translation = z.infer<typeof translation>;
export type ExtensionError = z.infer<typeof extensionError>;
export type ExtensionMessage = z.infer<typeof extensionMessage>;

export type TranscriptSegment = {
  text: string;
  isFinal: boolean;
  language?: string;
};

export type TranslationSegment = {
  text: string;
  targetLang: 'pt-BR' | 'en' | 'es';
  sourceLang?: 'pt-BR' | 'en' | 'es';
};

// --- Contratos da API WebSocket (/v1/session e /v1/stream) ---

export const apiSessionRequest = z.object({});

export const apiSessionResponse = z.object({
  token: z.string(),
  expires_in: z.number(),
});

export const apiStreamMessageIn = z.object({
  type: z.enum(['configure', 'stop']),
  target_lang: z.enum(['pt-BR', 'en', 'es']).optional(),
  context: z.string().max(12000).optional(),
});

export const apiStreamEventOut = z.object({
  type: z.enum(['partial', 'final', 'error', 'audio_ready', 'audio_closed', 'translated']),
  text: z.string().optional(),
  lang: z.string().optional(),
  code: z.string().optional(),
  at: z.number().optional(),
  original: z.string().optional(),
  translated: z.string().optional(),
  sttLatency_ms: z.number().optional(),
  translationLatency_ms: z.number().optional(),
  totalLatency_ms: z.number().optional(),
});

export type ApiSessionRequest = z.infer<typeof apiSessionRequest>;
export type ApiSessionResponse = z.infer<typeof apiSessionResponse>;
export type ApiStreamMessageIn = z.infer<typeof apiStreamMessageIn>;
export type ApiStreamEventOut = z.infer<typeof apiStreamEventOut>;

export type ConnectionState = 'disconnected' | 'conectando' | 'ouvindo' | 'erro' | 'pausado';
