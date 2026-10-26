import type { Lang } from './lang.js';
import type {
  TranslationEvent,
  TranslationEventHandler,
  TranslationEventKind,
  TranslationOptions,
  TranslationProvider,
} from './interfaces.js';
import { SimpleEventEmitter } from './event-emitter.js';

export class FakeTranslationProvider implements TranslationProvider {
  private emitter = new SimpleEventEmitter();
  private started = false;
  private options: TranslationOptions = { targetLang: 'en' };
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingText = '';

  constructor(readonly debounceMs = 0) {}

  async start(opts?: TranslationOptions): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.options = opts ?? { targetLang: 'en' };
  }

  sendText(texto: string): void {
    if (!this.started) return;
    if (!texto.trim()) return;
    this.pendingText = texto;
    if (this.debounceMs > 0) {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.emitTraducao(), this.debounceMs);
    } else {
      this.emitTraducao();
    }
  }

  private emitTraducao(): void {
    const texto = this.pendingText;
    this.pendingText = '';
    if (!texto.trim()) return;
    const { targetLang, sourceLang } = this.options;
    if (sourceLang && sourceLang === targetLang) {
      this.emitter.emit('final', { type: 'final', text: texto });
      return;
    }
    let resultado = texto;
    if (targetLang === 'en') {
      resultado = texto.replace(/olá/g, 'hello').replace(/entrevista/g, 'interview').replace(/técnico/g, 'technical');
    } else if (targetLang === 'es') {
      resultado = texto.replace(/olá/g, 'hola').replace(/entrevista/g, 'entrevista').replace(/técnico/g, 'técnico');
    }
    if (resultado === texto) resultado = `${texto} [${targetLang}]`;
    this.emitter.emit('final', { type: 'final', text: resultado });
  }

  async stop(): Promise<void> {
    this.started = false;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
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
