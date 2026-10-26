import { describe, expect, it } from 'vitest';
import { FakeSttProvider } from './fake-stt.js';
import { FakeTranslationProvider } from './fake-translation.js';

describe('FakeSttProvider + FakeTranslationProvider (integração, sem chave, sem rede)', () => {
  it('emite tradução final a partir de áudio PCM16 simulado', async () => {
    const stt = new FakeSttProvider({ language: 'pt-BR', sampleRate: 16000 });
    const translator = new FakeTranslationProvider(0);

    const sttFinais: string[] = [];
    const tradFinais: string[] = [];

    stt.on('final', (e: unknown) => {
      if ((e as { type: string }).type === 'final') {
        sttFinais.push((e as { text?: string }).text ?? '');
        void translator.sendText((e as { text?: string }).text ?? '');
      }
    });

    translator.on('final', (e: unknown) => {
      if ((e as { type: string }).type === 'final') {
        tradFinais.push((e as { text?: string }).text ?? '');
      }
    });

    await stt.start({ language: 'pt-BR', sampleRate: 16000 });
    await translator.start({ targetLang: 'en', sourceLang: 'pt-BR' });

    const umSegundo = new Int16Array(16000);
    stt.sendAudio(umSegundo, 16000);
    stt.sendAudio(umSegundo, 16000);

    await new Promise((r) => setTimeout(r, 200));

    expect(sttFinais.length).toBeGreaterThan(0);
    expect(tradFinais.length).toBeGreaterThan(0);
    expect(tradFinais.every((t) => typeof t === 'string' && t.length > 0)).toBe(true);

    await stt.stop();
    await translator.stop();
  });

  it('FakeTranslationProvider traduz para en com debounce zero', async () => {
    const translator = new FakeTranslationProvider(0);
    await translator.start({ targetLang: 'en', sourceLang: 'pt-BR' });
    translator.sendText('olá entrevista');
    await new Promise((r) => setTimeout(r, 50));

    const recebidos: string[] = [];
    translator.on('final', (e: unknown) => {
      if ((e as { type: string }).type === 'final') {
        recebidos.push((e as { text?: string }).text ?? '');
      }
    });

    // Re-send to trigger after listener registered
    translator.sendText('olá entrevista');
    await new Promise((r) => setTimeout(r, 50));

    expect(recebidos.length).toBeGreaterThan(0);
    expect(recebidos[0]).toContain('hello');
    expect(recebidos[0]).toContain('interview');

    await translator.stop();
  });

  it('FakeTranslationProvider devolve texto quando idiomas são iguais', async () => {
    const translator = new FakeTranslationProvider(0);
    await translator.start({ targetLang: 'pt-BR', sourceLang: 'pt-BR' });
    translator.sendText('olá mundo');
    await new Promise((r) => setTimeout(r, 50));

    const recebidos: string[] = [];
    translator.on('final', (e: unknown) => {
      if ((e as { type: string }).type === 'final') {
        recebidos.push((e as { text?: string }).text ?? '');
      }
    });

    translator.sendText('olá mundo');
    await new Promise((r) => setTimeout(r, 50));

    expect(recebidos.length).toBeGreaterThan(0);
    expect(recebidos[0]).toBe('olá mundo');

    await translator.stop();
  });
});
