import type { Lang } from './lang.js';
import type {
  TranslationEvent,
  TranslationEventHandler,
  TranslationEventKind,
  TranslationOptions,
  TranslationProvider,
} from './interfaces.js';
import { SimpleEventEmitter } from './event-emitter.js';

const PT_EN: Record<string, string> = {
  olá: 'hello',
  entrevista: 'interview',
  candidato: 'candidate',
  desafio: 'challenge',
  técnico: 'technical',
  experiência: 'experience',
  equipe: 'team',
  trabalho: 'work',
  prazos: 'deadlines',
  stack: 'stack',
};

const EN_ES: Record<string, string> = {
  hello: 'hola',
  interview: 'entrevista',
  candidate: 'candidato',
  challenge: 'desafío',
  technical: 'técnico',
  experience: 'experiencia',
  team: 'equipo',
  work: 'trabajo',
  deadlines: 'plazos',
  stack: 'pilas',
};

function traduzirPalavras(texto: string, dicionario: Record<string, string>): string {
  return texto.split(/\s+/).map((p) => dicionario[p] ?? p).join(' ');
}

export class DemoStreamingTranslationProvider implements TranslationProvider {
  private emitter = new SimpleEventEmitter();
  private started = false;
  private options: TranslationOptions = { targetLang: 'en' };

  async start(opts?: TranslationOptions): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.options = opts ?? { targetLang: 'en' };
  }

  sendText(texto: string): void {
    if (!this.started) return;
    if (!texto.trim()) return;
    const { targetLang, sourceLang } = this.options;
    if (sourceLang && sourceLang === targetLang) {
      this.emitter.emit('final', { type: 'final', text: texto });
      return;
    }
    let resultado = texto;
    if (targetLang === 'en') {
      resultado = traduzirPalavras(resultado, PT_EN);
    } else if (targetLang === 'es') {
      const en = traduzirPalavras(resultado, PT_EN);
      resultado = traduzirPalavras(en, EN_ES);
    }
    if (resultado === texto) resultado = `${texto} [${targetLang}]`;
    this.emitter.emit('partial', { type: 'partial', text: resultado });
    queueMicrotask(() => {
      this.emitter.emit('final', { type: 'final', text: resultado });
    });
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
