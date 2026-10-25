# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adota [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Adicionado
- LICENSE MIT para adoção ampla.
- `.env.example` completo, comentado e com validação Zod no boot da API.
- CI (GitHub Actions): lint, typecheck, test, build e secret scanning.
- Templates de issue (bug, feature) e pull request.
- Labels `good first issue` e `help wanted`.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`.
- `docs/history/` com versões anteriores do README (V07, V08).

### Alterado
- README.md reescrito com quickstart de 3 comandos, tabela de status, arquitetura e FAQ de privacidade.

## [0.1.0] - 2026-10-25

### Adicionado
- Monorepo npm workspaces: `apps/api` (Fastify), `apps/web` (React/Vite), `apps/landing`, `apps/desktop`, `apps/extension`, `packages/shared`.
- Ticket de WebSocket de uso único com expiração de 30s.
- Contratos Zod (`input`, `sessionStart`, `control`).
- Pipeline de texto simulado (`MockLlm`, `processTurn`) nos modos `assist` e `translate`.
- Interface responsiva com transcrição, tradução, resposta e cópia.
- Entidades Drizzle (`users`, `profiles`, `sessions`, `turns`) e Docker Compose PostgreSQL/pgvector + Redis.
- Testes unitários do pipeline com vitest.

### Não entregue
- STT real, captura de áudio, provedores Deepgram/Anthropic, TTS, diarização.
- Autenticação completa, RBAC, persistência distribuída, RAG, criptografia, cobrança.
- Apps desktop/extensão, CI/CD completo, observabilidade, benchmarks, SLOs.

[Unreleased]: https://github.com/rhenan/interviewAI/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/rhenan/interviewAI/releases/tag/v0.1.0
