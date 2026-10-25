# InterviewIA v0.8 — Reestruturação incremental

## Mudanças verificáveis
- Landing independente na porta 5174 e console na 5173.
- Tokens JWT obrigatórios para tickets do WebSocket de texto e áudio.
- Removido fallback inseguro de segredo JWT do gateway de áudio.
- `/ready` retorna HTTP 503 quando o segredo JWT não está configurado.
- Processamento de tradução e resposta executado em paralelo, reduzindo latência agregada em condições favoráveis.
- Cadastro e login diretamente no painel de streaming.
- Resposta automática após evento final de transcrição do Deepgram.
- Origem CORS configurável.

## Limitações reais
- Não há persistência distribuída dos tickets nem retomada real de áudio após desconexão.
- Não há microfone virtual instalado, integração nativa com Discord/Zoom/Teams ou TTS remoto.
- A integração com Deepgram e Anthropic depende de credenciais e testes em rede real.
- Ainda faltam migração de autenticação para armazenamento seguro, RAG vetorial, autorização por workspace, cobrança homologada, observabilidade e CI/CD completo.
- Não expor a API em produção antes de testes de segurança e rate limiting.

## Go vs Rust
- **Go**: experimentar gateway de WebSocket/áudio com benchmarks comparativos antes de migrar Node.
- **Rust**: avaliar DSP, VAD, resampling e integração nativa de dispositivo; não substituir toda a API.
- **TypeScript**: manter console, landing e orquestração de negócio.
- **Python**: avaliação offline e ML, fora do caminho crítico.

## Testes manuais
1. `npm install`, `cp .env.example .env`; configure `JWT_SECRET` com 32+ caracteres, `DEEPGRAM_API_KEY` e `ANTHROPIC_API_KEY`.
2. `npm run dev`; landing http://localhost:5174, console http://localhost:5173, API http://localhost:3001.
3. Alterne quatro idiomas na landing e abra o console.
4. Entre em Streaming Deepgram, crie conta ou entre, selecione aba e compartilhe áudio de vídeo em inglês.
5. Observe transcrição, tradução e resposta; confirme que uma pergunta final dispara processamento.
6. Teste microfone, modo tradução pura, encerramento de sessão, sem áudio e negação de permissão.
7. Sem token, `POST /v1/ws-ticket` deve retornar 401; com token deve fornecer ticket.
8. Remova JWT_SECRET e verifique `/ready` HTTP 503.
9. Rode `npm run typecheck`, `npm test`, `npm run build`; corrija quaisquer falhas antes de publicar.
10. Para benchmark, medir fim da fala → primeiro token de tradução e resposta em 100+ turnos com p50/p95, inclusive carga.
