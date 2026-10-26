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
