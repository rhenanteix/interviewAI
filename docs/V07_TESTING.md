# InterviewIA v0.7 — teste local

## Requisitos
Node.js 22+, npm, navegador Chrome/Edge, conta Deepgram e provedor LLM opcional. **Não publique a API em rede pública**: autenticação e limites ainda precisam de hardening.

## Instalação
1. `npm install`
2. `cp .env.example .env` (PowerShell: `Copy-Item .env.example .env`)
3. Defina `JWT_SECRET` com segredo aleatório, `DEEPGRAM_API_KEY` com chave **nova**, e `ANTHROPIC_API_KEY` para respostas reais.
4. `npm run dev` (alternativamente execute cada workspace em terminal separado).
5. Landing `http://localhost:5174`, console `http://localhost:5173`, Swagger `http://localhost:3001/docs`.

## Cenário ponta a ponta
1. No Swagger, `POST /api/v1/auth/register` com nome, email e senha de no mínimo 10 caracteres.
2. No console > Streaming Deepgram, faça login com as credenciais criadas.
3. Escolha `Aba ou tela`, `Português`, `Tradução + resposta`.
4. Inicie e compartilhe uma aba com áudio em inglês (habilite compartilhamento de áudio).
5. Verifique transcrição, tradução e resposta. Com Anthropic ausente, a resposta é MOCK; não confundir com tradução real.
6. Teste microfone e outros idiomas; encerre e confirme liberação de tracks.
7. Simule falha de rede e confirme indicação de desconexão. Reconexão automática com retomada exata ainda não está implementada.
8. Rode `npm run typecheck`, `npm test`, `npm run build`.

## Limitações conhecidas
- Microfone virtual não foi implementado: usar VB-CABLE/BlackHole com roteamento manual e validar no sistema operacional.
- TTS utiliza síntese de voz do navegador; não há TTS de provedor nem voz traduzida roteada automaticamente para outros apps.
- A captura de abas depende do navegador/OS e não substitui integração nativa Zoom/Teams/Discord.
- Ticket é associado a JWT assinado e de uso único, mas falta controle de cota persistente, validação de conta revogada, CSRF, observabilidade e rate limiting robusto.
- Keepalive e buffer inicial existem; não há recuperação automática de sessão após queda nem garantia de menos de 2 s de áudio perdido.
- AudioWorklet reduz overhead na thread principal; não comprova metas p95 sem benchmark real.
