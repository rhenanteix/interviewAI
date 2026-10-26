import { describe, expect, it, vi } from 'vitest';
import { FakeSttProvider } from './fake-stt';

const FIXTURE_PATH = new URL('./fixtures/test-audio.wav', import.meta.url).pathname;

describe('FakeSttProvider (sem chave, sem rede)', () => {
  it('emite eventos partial e final a partir de áudio PCM16', async () => {
    const provider = new FakeSttProvider({ fixturePath: FIXTURE_PATH, language: 'pt-BR', sampleRate: 16000 });
    const eventos: Array<{ type: string; text?: string }> = [];
    provider.on('partial', (e) => { if (e.type === 'partial') eventos.push({ type: e.type, text: e.text }); });
    provider.on('final', (e) => { if (e.type === 'final') eventos.push({ type: e.type, text: e.text }); });
    await provider.start({ language: 'pt-BR', sampleRate: 16000 });

    const umSegundo = new Int16Array(16000);
    provider.sendAudio(umSegundo, 16000);
    provider.sendAudio(umSegundo, 16000);

    await new Promise((r) => setTimeout(r, 100));

    const finals = eventos.filter((e) => e.type === 'final');
    expect(finals.length).toBeGreaterThan(0);
    expect(finals.every((e) => typeof e.text === 'string' && e.text.length > 0)).toBe(true);

    await provider.stop();
  });

  it('não emite eventos antes de start', () => {
    const provider = new FakeSttProvider();
    const handler = vi.fn();
    provider.on('final', handler);
    provider.sendAudio(new Int16Array(16000), 16000);
    expect(handler).not.toHaveBeenCalled();
  });

  it('emite close ao parar', async () => {
    const provider = new FakeSttProvider();
    const closeHandler = vi.fn();
    provider.on('close', closeHandler);
    await provider.start();
    await provider.stop();
    expect(closeHandler).toHaveBeenCalledTimes(1);
  });

  it('off remove o handler', async () => {
    const provider = new FakeSttProvider();
    const handler = vi.fn();
    provider.on('final', handler);
    provider.off('final', handler);
    await provider.start();
    provider.sendAudio(new Int16Array(16000), 16000);
    provider.sendAudio(new Int16Array(16000), 16000);
    await new Promise((r) => setTimeout(r, 100));
    expect(handler).not.toHaveBeenCalled();
    await provider.stop();
  });
});
