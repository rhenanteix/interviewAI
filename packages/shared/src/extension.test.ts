import { describe, expect, it } from 'vitest';
import { extensionMessage, transcript, translation, captureStart, captureStop } from './extension';

describe('contratos de extensão (Zod)', () => {
  it('valida início de captura', () => {
    expect(captureStart.parse({ type: 'capture.start', tabId: 12 })).toEqual({
      type: 'capture.start',
      tabId: 12,
    });
  });

  it('rejeita tabId inválido', () => {
    expect(() => captureStart.parse({ type: 'capture.start', tabId: 0 })).toThrow();
  });

  it('valida parada de captura', () => {
    expect(captureStop.parse({ type: 'capture.stop' })).toEqual({ type: 'capture.stop' });
  });

  it('valida transcrição com idioma opcional', () => {
    expect(transcript.parse({ type: 'transcript', text: 'olá', isFinal: true, language: 'pt-BR' }).text).toBe('olá');
  });

  it('valida tradução', () => {
    expect(translation.parse({ type: 'translation', text: 'hello', targetLang: 'en' }).targetLang).toBe('en');
  });

  it('discriminated union aceita e rejeita mensagens', () => {
    expect(extensionMessage.parse({ type: 'capture.start', tabId: 1 }).type).toBe('capture.start');
    expect(() => extensionMessage.parse({ type: 'desconhecido' })).toThrow();
    expect(() => extensionMessage.parse({ type: 'translation', text: 'x', targetLang: 'xx' })).toThrow();
  });

  it('parada é distinta de início na união discriminada', () => {
    const parsed = extensionMessage.parse({ type: 'capture.stop' });
    expect(parsed.type).toBe('capture.stop');
    if (parsed.type === 'capture.start') throw new Error('não deveria ser start');
  });
});
