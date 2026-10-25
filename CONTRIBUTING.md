# Contribuindo com o InterviewIA

Obrigado pelo interesse em contribuir! Este projeto é um copiloto de entrevista
multilíngue em tempo real (STT, tradução e assistência contextual).

## Como contribuir

1. Abra uma issue descrevendo o problema ou a proposta (use os templates em `.github/ISSUE_TEMPLATE`).
2. Crie um branch a partir de `main`: `git checkout -b sua-feature`.
3. Faça as mudanças, incluindo testes quando aplicável.
4. Rode `npm run typecheck`, `npm run lint`, `npm test` e `npm run build`.
5. Abra um Pull Request para `main` usando o template em `.github/PULL_REQUEST_TEMPLATE.md`.

## Padrões de código

- TypeScript strict em todos os pacotes/apps.
- Commit messages no formato Conventional Commits (ex: `feat:`, `fix:`, `docs:`).
- Sem segredos ou chaves commitadas (use `.env.example`).

## Labels para iniciantes

Issues adequadas a primeira contribuição são marcadas com `good first issue`.
Ajuda geral é marcada com `help wanted`.

## Conduta

Todas as interações seguem o `CODE_OF_CONDUCT.md`. Leia antes de participar.

## Segurança

Vulnerabilidades devem ser reportadas pelo `SECURITY.md`, nunca em issues públicas.
