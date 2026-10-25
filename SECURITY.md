# Política de Segurança

## Versões suportadas

| Versão | Suportada |
|--------|-----------|
| 0.1.x  | ✅        |
| < 0.1  | ❌        |

## Reportando uma vulnerabilidade

Não abra issues públicas para relatar vulnerabilidades de segurança.

Envie um e-mail para: **security@interviewia.local** (ou abra um advisory privado
no GitHub, se disponível) incluindo:

- Descrição da vulnerabilidade e passos para reproduzir.
- Versão afetada e ambiente.
- Possível impacto e sugestão de correção (se houver).

## O que esperar

- Confirmação de recebimento em até 5 dias úteis.
- Avaliação inicial e retorno sobre a gravidade em até 14 dias.
- Divulgação coordenada após correção e lançamento de patch.

## Escopo

Inclui o código-fonte em `apps/`, `packages/` e configurações de CI/infra.
Não inclui serviços de terceiros (Deepgram, Anthropic, Stripe) — reporte
problemas desses provedores diretamente aos respectivos canais.

## Boas práticas para contribuidores

- Nunca commite chaves, tokens ou segredos (use `.env.example`).
- Variáveis obrigatórias são validadas com Zod no boot da API.
- Rotas expostas publicamente devem ter autenticação e rate limiting.
