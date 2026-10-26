import type { Lang, TranslationOptions, TranslationProvider } from './interfaces';

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

export class DemoTranslationProvider implements TranslationProvider {
  async translate(texto: string, options: TranslationOptions): Promise<string> {
    const { targetLang, sourceLang } = options;
    if (!texto.trim()) return texto;
    if (sourceLang && sourceLang === targetLang) return texto;
    let resultado = texto;
    if (targetLang === 'en') resultado = traduzirPalavras(resultado, PT_EN);
    else if (targetLang === 'es') {
      const en = traduzirPalavras(resultado, PT_EN);
      resultado = traduzirPalavras(en, EN_ES);
    }
    if (resultado === texto) resultado = `${texto} [${targetLang}]`;
    return resultado;
  }
}
