# InterviewIA v0.9 — UX + autenticação + roteamento

## Implementado
- `/` na porta 5173 é exclusivamente a landing.
- `/app/` na mesma origem é encaminhado ao console Vite (porta interna 5174) no ambiente de desenvolvimento.
- O console **não renderiza** até que `/api/v1/me` valide um JWT. Token ausente, inválido ou expirado redireciona para cadastro/login. Refresh é tentado quando disponível.
- Cadastro e login fazem chamadas reais à API. Após sucesso, o usuário entra no console.
- Logout remove tokens e volta para a tela de autenticação.
- Visual do console refeito com tema escuro, acento menta e formulários de autenticação.

## Teste manual
1. `npm install`, `cp .env.example .env` e configure JWT_SECRET (>=32 chars).
2. `npm run dev`.
3. Acesse http://localhost:5173/ — landing.
4. Acesse http://localhost:5173/app/ em janela anônima — deve aparecer cadastro/login, **não** o console.
5. Cadastre nome, email e senha >=10 caracteres. Deve abrir o console.
6. Saia; confirme retorno ao login.
7. Acesse /app/ sem login e tente token aleatório no localStorage — console não deve abrir.
8. Entre com conta criada e teste áudio com Deepgram.

## Limites e riscos ainda abertos
- Login local usa persistência JSON, não é apropriado para múltiplas instâncias ou produção. Migrar para PostgreSQL e sessões com refresh rotation em cookies HttpOnly.
- A rota /app/ usa proxy Vite apenas em desenvolvimento. Em produção configurar reverse proxy (NGINX, Cloudflare etc.) para servir landing em `/` e console em `/app/`.
- Streaming de voz, tradução e TTS dependem de provedores, chaves e testes reais; não estão homologados.
- Reconexão/resume, microfone virtual, integrações nativas, benchmarks e testes de segurança continuam pendentes.
- Não expor a API publicamente antes de reforçar autenticação, rate limiting e segurança.
