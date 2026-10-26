import { describe, expect, it, vi } from 'vitest';
import { DemoSttProvider } from './demo-stt';

describe('DemoSttProvider (sem chave, sem rede)', () => {
  it('emite segmentos de transcrição a partir de áudio PCM16', async () => {
    const provider = new DemoSttProvider();
    const recebidos: Array<{ text: string; isFinal: boolean }> = [];
    provider.onTranscript((seg) => recebidos.push({ text: seg.text, isFinal: seg.isFinal }));
    await provider.start({ language: 'pt-BR', sampleRate: 16000 });

    const umSegundo = new Int16Array(16000);
    provider.sendAudio(umSegundo, 16000);
    provider.sendAudio(umSegundo, 16000);

    await new Promise((r) => setTimeout(r, 50));

    expect(recebidos.length).toBeGreaterThan(0);
    expect(recebidos.every((s) => typeof s.text === 'string' && s.text.length > 0)).toBe(true);
    expect(recebidos.every((s) => s.isFinal === true)).toBe(true);

    await provider.stop();
  });

  it('não emite antes de start', () => {
    const provider = new DemoSttProvider();
    const handler = vi.fn();
    provider.onTranscript(handler);
    provider.sendAudio(new Int16Array(16000), 16000);
    expect(handler).not.toHaveBeenCalled();
  });
});
