import type { Lang } from './lang.js';
import type {
  TranslationEvent,
  TranslationEventHandler,
  TranslationEventKind,
  TranslationOptions,
  TranslationProvider,
} from './interfaces.js';
import { SimpleEventEmitter } from './event-emitter.js';

export class AnthropicTranslationProvider implements TranslationProvider {
  private emitter = new SimpleEventEmitter();
  private started = false;
  private readonly apiKey: string;
  private readonly model: string;
  private options: TranslationOptions = { targetLang: 'en' };

  constructor(opts: { apiKey?: string; model?: string } = {}) {
    this.apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY ?? '';
    this.model = opts.model ?? process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001';
  }

  async start(opts?: TranslationOptions): Promise<void> {
    if (this.started) return;
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY não configurada. Defina a variável de ambiente ou passe apiKey.');
    }
    this.started = true;
    this.options = opts ?? { targetLang: 'en' };
  }

  async sendText(texto: string): Promise<void> {
    if (!this.started) return;
    if (!texto.trim()) return;
    const { targetLang, sourceLang } = this.options;
    if (sourceLang && sourceLang === targetLang) {
      this.emitter.emit('final', { type: 'final', text: texto });
      return;
    }
    try {
      const traduzido = await this.traduzir(texto, targetLang);
      this.emitter.emit('final', { type: 'final', text: traduzido });
    } catch (e) {
      this.emitter.emit('error', {
        type: 'error',
        error: { message: e instanceof Error ? e.message : String(e), code: 'TRANSLATION_FAILED' },
      });
    }
  }

  private async traduzir(texto: string, alvo: Lang): Promise<string> {
    const system = `Traduza com precisão para ${alvo}. Preserve números, nomes e termos técnicos. Retorne apenas a tradução, sem aspas ou comentários adicionais.`;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 512,
        system,
        messages: [{ role: 'user', content: texto }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
    const data = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
    return data.content?.filter((x) => x.type === 'text').map((x) => x.text || '').join('') || texto;
  }

  async stop(): Promise<void> {
    this.started = false;
    this.emitter.emit('close', { type: 'close' });
    this.emitter.removeAllListeners();
  }

  on(kind: TranslationEventKind, handler: TranslationEventHandler): void {
    this.emitter.on(kind, handler as unknown as (event: unknown) => void);
  }

  off(kind: TranslationEventKind, handler: TranslationEventHandler): void {
    this.emitter.off(kind, handler as unknown as (event: unknown) => void);
  }
}
