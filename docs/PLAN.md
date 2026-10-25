# Plano de implementação — status real

## Entregue nesta versão (0.1)
- Monorepo pnpm/Turborepo, web React/Vite e API Fastify com WebSocket.
- Ticket de WebSocket de uso único e expiração de 30 segundos (DEMO, sem autenticação).
- Contratos básicos Zod, pipeline de texto simulado, modo tradução pura e modo assistência.
- Interface responsiva com transcrição, tradução, resposta e cópia.
- Esboço de entidades Drizzle, Docker Compose PostgreSQL/pgvector + Redis, testes unitários do pipeline.

## Não entregue / não alegar como funcional
- STT real e captura de áudio; provedores Deepgram/AssemblyAI/Azure; Anthropic; TTS; diarização.
- Autenticação, RBAC, consentimento efetivo, persistência, RAG, criptografia e cobrança.
- Apps desktop/extensão, integração CRM, infraestrutura Terraform, CI/CD, observabilidade, benchmarks e SLOs.
- O WebSocket demo NÃO deve ser exposto publicamente sem autenticação e limites.

## Próximas fases
1. Auth completa, migrations Drizzle, tenant isolation e testes de autorização.
2. Adaptador STT Deepgram streaming com captura PCM16, endpointing, reconexão e controle de quota.
3. Adaptador LLM Anthropic com streaming, tradução incremental, abort e fallback.
4. Indexação de documentos/pgvector, citação e anti-alucinação.
5. UX real de áudio, onboarding e histórico; extensões e desktop.
6. Pós-reunião, treino, billing, Teams, operações, LGPD, CI e deploy.

## Riscos
- Latência alvo não foi medida; requer benchmarks com áudio real e rede representativa.
- Captura de áudio de sistema depende de permissões e SO.
- Consentimento de terceiros e conformidade exigem revisão jurídica e de segurança.
- Os identificadores de modelos do prompt devem ser verificados antes da integração.
