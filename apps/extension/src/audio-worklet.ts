export const TARGET_SAMPLE_RATE = 16000;

export function toMonoFloat32(canais: Float32Array[]): Float32Array {
  const quadros = canais[0].length;
  const saida = new Float32Array(quadros);
  for (let i = 0; i < quadros; i++) {
    let soma = 0;
    for (const canal of canais) soma += canal[i];
    saida[i] = soma / canais.length;
  }
  return saida;
}

export function resampleTo(entrada: Float32Array, deTaxa: number, paraTaxa: number): Float32Array {
  if (deTaxa === paraTaxa) return entrada;
  const razao = deTaxa / paraTaxa;
  const comprimento = Math.floor(entrada.length / razao);
  const saida = new Float32Array(comprimento);
  for (let i = 0; i < comprimento; i++) {
    const src = i * razao;
    const i0 = Math.floor(src);
    const frac = src - i0;
    const i1 = Math.min(i0 + 1, entrada.length - 1);
    saida[i] = entrada[i0] * (1 - frac) + entrada[i1] * frac;
  }
  return saida;
}

export function float32ToPcm16(amostras: Float32Array): Int16Array {
  const saida = new Int16Array(amostras.length);
  for (let i = 0; i < amostras.length; i++) {
    let v = amostras[i];
    if (v > 1) v = 1;
    if (v < -1) v = -1;
    saida[i] = Math.round(v * 32767);
  }
  return saida;
}

function concatenar(a: Float32Array, b: Float32Array): Float32Array {
  const saida = new Float32Array(a.length + b.length);
  saida.set(a);
  saida.set(b, a.length);
  return saida;
}

type AudioWorkletProcessorCtor = new (...args: unknown[]) => {
  port: { postMessage: (mensagem: unknown) => void };
  sampleRate: number;
  process(entradas: unknown[], saidas: unknown[], parametros: unknown): boolean;
};

const workletGlobal = globalThis as unknown as {
  AudioWorkletProcessor?: AudioWorkletProcessorCtor;
  registerProcessor?: (nome: string, processador: AudioWorkletProcessorCtor) => void;
};

if (workletGlobal.AudioWorkletProcessor && workletGlobal.registerProcessor) {
  class ProcessadorAudio extends (workletGlobal.AudioWorkletProcessor as unknown as new (
    ...args: unknown[]
  ) => {
    port: { postMessage: (mensagem: unknown) => void };
    sampleRate: number;
    process(entradas: unknown[], saidas: unknown[], parametros: unknown): boolean;
  }) {
    private buffer: Float32Array = new Float32Array(0);

    process(
      entradas: Float32Array[][],
      _saidas: Float32Array[][],
      _parametros: Record<string, Float32Array>,
    ): boolean {
      const entrada = entradas[0]?.[0];
      if (!entrada) return true;

      const mono = toMonoFloat32(entradas[0]);
      const remixado = resampleTo(mono, (this as unknown as { sampleRate: number }).sampleRate, TARGET_SAMPLE_RATE);
      this.buffer = concatenar(this.buffer, remixado);

      while (this.buffer.length >= TARGET_SAMPLE_RATE) {
        const quadro = this.buffer.subarray(0, TARGET_SAMPLE_RATE);
        this.buffer = this.buffer.subarray(TARGET_SAMPLE_RATE);
        (this as unknown as { port: { postMessage: (mensagem: { pcm16: Int16Array; sampleRate: number }) => void } }).port.postMessage({
          pcm16: float32ToPcm16(quadro).slice(),
          sampleRate: TARGET_SAMPLE_RATE,
        });
      }

      return true;
    }
  }

  workletGlobal.registerProcessor('interview-audio-processor', ProcessadorAudio);
}
