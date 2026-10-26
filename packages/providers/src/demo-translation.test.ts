import { describe, expect, it } from 'vitest';
import { DemoTranslationProvider } from './demo-translation';

describe('DemoTranslationProvider (sem chave, sem rede)', () => {
  const provider = new DemoTranslationProvider();

  it('traduz palavras conhecidas do pt-BR para o en', async () => {
    const resultado = await provider.translate('olá entrevista técnico', { targetLang: 'en' });
    expect(resultado).toContain('hello');
    expect(resultado).toContain('interview');
    expect(resultado).toContain('technical');
  });

  it('traduz do pt-BR para o es via inglês', async () => {
    const resultado = await provider.translate('trabalho em equipe', { targetLang: 'es' });
    expect(resultado).toContain('trabajo');
    expect(resultado).toContain('equipo');
  });

  it('devolve o texto quando o idioma alvo é igual à origem', async () => {
    const texto = 'olá mundo';
    const resultado = await provider.translate(texto, { targetLang: 'pt-BR', sourceLang: 'pt-BR' });
    expect(resultado).toBe(texto);
  });

  it('marca textos sem dicionário com o idioma alvo', async () => {
    const resultado = await provider.translate('palavra desconhecida xyz', { targetLang: 'en' });
    expect(resultado).toContain('[en]');
  });
});
