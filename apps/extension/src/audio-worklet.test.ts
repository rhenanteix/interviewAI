import { describe, expect, it } from 'vitest';
import { toMonoFloat32, resampleTo, float32ToPcm16, TARGET_SAMPLE_RATE } from './audio-worklet';

describe('pipeline de áudio (AudioWorklet, puro)', () => {
  it('TARGET_SAMPLE_RATE é 16 kHz', () => {
    expect(TARGET_SAMPLE_RATE).toBe(16000);
  });

  it('toMonoFloat32 downmix estéreo para mono', () => {
    const esquerda = new Float32Array([1, -1, 0]);
    const direita = new Float32Array([-1, 1, 0]);
    const mono = toMonoFloat32([esquerda, direita]);
    expect(Array.from(mono)).toEqual([0, 0, 0]);
  });

  it('resampleTo 48 kHz para 16 kHz reduz em 3x', () => {
    const entrada = new Float32Array(48000);
    for (let i = 0; i < 48000; i++) entrada[i] = 0.5;
    const saida = resampleTo(entrada, 48000, 16000);
    expect(saida.length).toBe(16000);
    expect(saida[0]).toBeCloseTo(0.5);
  });

  it('resampleTo com taxas iguais devolve a mesma entrada', () => {
    const entrada = new Float32Array([0.1, -0.2, 0.3]);
    expect(resampleTo(entrada, 16000, 16000)).toBe(entrada);
  });

  it('float32ToPcm16 satura e converte', () => {
    const saida = float32ToPcm16(new Float32Array([1, -1, 0.5, -0.5, 0]));
    expect(Array.from(saida)).toEqual([32767, -32767, 16383, -16384, 0]);
  });
});
