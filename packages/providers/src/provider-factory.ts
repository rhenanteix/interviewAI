import type { SttProvider } from './interfaces.js';
import { DeepgramSttProvider } from './deepgram-stt.js';
import { FakeSttProvider } from './fake-stt.js';
import { WhisperSttProvider } from './whisper-stt.js';
import type { SttProviderConfig } from './interfaces.js';
import type { TranslationProvider } from './interfaces.js';
import { AnthropicTranslationProvider } from './anthropic-translation.js';
import { FakeTranslationProvider } from './fake-translation.js';
import type { TranslationProviderConfig } from './interfaces.js';

export function createSttProvider(config: SttProviderConfig): SttProvider {
  switch (config.type) {
    case 'deepgram':
      return new DeepgramSttProvider({
        apiKey: config.deepgramApiKey,
        language: config.language,
        sampleRate: config.sampleRate,
      });
    case 'whisper':
      return new WhisperSttProvider({
        whisperUrl: config.whisperUrl,
        language: config.language,
        sampleRate: config.sampleRate,
      });
    case 'fake':
    default:
      return new FakeSttProvider({
        fixturePath: config.fixturePath,
        language: config.language,
        sampleRate: config.sampleRate,
      });
  }
}

export function createTranslationProvider(config: TranslationProviderConfig): TranslationProvider {
  switch (config.type) {
    case 'anthropic':
      return new AnthropicTranslationProvider({
        apiKey: config.anthropicApiKey,
        model: config.model,
      });
    case 'demo':
    default:
      return new FakeTranslationProvider(config.debounceMs);
  }
}
