import type {
  SttEvent,
  SttEventHandler,
  SttEventKind,
  SttProvider,
  SttProviderOptions,
} from './interfaces.js';
import { SimpleEventEmitter } from './event-emitter.js';

export class DeepgramSttProvider implements SttProvider {
  private emitter = new SimpleEventEmitter();
  private ws?: WebSocket;
  private started = false;
  private readonly apiKey: string;
  private readonly language: string;
  private readonly sampleRate: number;

  constructor(options: {
    apiKey?: string;
    language?: string;
    sampleRate?: number;
  } = {}) {
    this.apiKey = options.apiKey ?? process.env.DEEPGRAM_API_KEY ?? '';
    this.language = options.language ?? 'pt-BR';
    this.sampleRate = options.sampleRate ?? 16000;
  }

  async start(_options?: SttProviderOptions): Promise<void> {
    if (this.started) return;
    if (!this.apiKey) {
      throw new Error('DEEPGRAM_API_KEY não configurada. Defina a variável de ambiente ou passe apiKey.');
    }
    const params = new URLSearchParams({
      encoding: 'linear16',
      sample_rate: String(this.sampleRate),
      channels: '1',
      language: this.language,
      interim_results: 'true',
      punctuate: 'true',
    });
    const url = `wss://api.deepgram.com/v1/listen?${params}`;

    this.ws = new WebSocket(url, {
      headers: { Authorization: `Token ${this.apiKey}` },
    } as unknown as string[]);

    const ws = this.ws;
    if (!ws) throw new Error('WebSocket não inicializado');

    ws.binaryType = 'arraybuffer';

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout conectando ao Deepgram')), 10000);

      ws.onopen = () => {
        clearTimeout(timeout);
        this.started = true;
        resolve();
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data as string) as unknown;
          if (data && typeof data === 'object' && 'is_final' in data) {
            const isFinal = (data as { is_final?: boolean }).is_final === true;
            const channel = (data as { channel?: { alternatives?: Array<{ transcript?: string }> } }).channel;
            const transcript = channel?.alternatives?.[0]?.transcript ?? '';
            if (!transcript) return;
            if (isFinal) {
              this.emitter.emit('final', {
                type: 'final',
                text: transcript,
                isFinal: true,
              });
            } else {
              this.emitter.emit('partial', {
                type: 'partial',
                text: transcript,
                stability: 1,
              });
            }
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onerror = (event: Event) => {
        clearTimeout(timeout);
        this.emitter.emit('error', {
          type: 'error',
          error: { message: 'Deepgram WebSocket error', code: 'WS_ERROR' },
        });
        reject(new Error('Falha ao conectar ao Deepgram'));
      };

      ws.onclose = (event: CloseEvent) => {
        this.started = false;
        this.emitter.emit('close', {
          type: 'close',
          code: event.code,
          reason: event.reason,
        });
      };
    });
  }

  sendAudio(pcm16: Int16Array, _sampleRate: number): void {
    if (!this.started || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(pcm16);
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.ws?.close();
    this.started = false;
    this.ws = undefined;
    this.emitter.emit('close', { type: 'close' });
    this.emitter.removeAllListeners();
  }

  on(kind: SttEventKind, handler: SttEventHandler): void {
    this.emitter.on(kind, handler as unknown as (event: unknown) => void);
  }

  off(kind: SttEventKind, handler: SttEventHandler): void {
    this.emitter.off(kind, handler as unknown as (event: unknown) => void);
  }
}
