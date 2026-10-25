# InterviewIA — Copilot de Entrevista ao Vivo

Copiloto multilíngue em tempo real para entrevistas: transcrição (STT), tradução e
assistência contextual com sugestões de resposta. Stack: TypeScript, React/Vite,
Fastify, WebSocket, Zod, Drizzle, PostgreSQL/pgvector, Redis.

> **Status:** desenvolvimento inicial (`0.1.x`). Não é um SaaS de produção.
> Funcionalidades de áudio real, autenticação distribuída e cobrança estão em
> construção. Consulte a tabela de status abaixo.

---

## O que é

O InterviewIA captura áudio do microfone (ou aba/sistema), transmite para um
provedor de STT (Deepgram), traduz e gera sugestões de resposta contextualizadas
(Anthropic ou modo demo simulado). Tudo roda localmente ou em containers Docker,
sem enviar dados para terceiros sem o seu consentimento.

### Principais funcionalidades

- Transcrição de áudio em tempo real via WebSocket.
- Tradução entre português, inglês e espanhol.
- Modo assistência: sugestões de resposta para perguntas de entrevista.
- Persistência local de sessões, perfis e histórico.
- API REST com Swagger (`/docs`) e WebSocket para áudio em tempo real.
- Docker Compose com PostgreSQL/pgvector e Redis.

---

## Demo

![Demo do InterviewIA](https://via.placeholder.com/800x450?text=Demo+do+InterviewIA)

> Substitua este placeholder por um GIF real da aplicação em execução.
> Grave uma sessão curta (transcrição → tradução → sugestão de resposta) e
> coloque o arquivo em `docs/demo.gif`, atualizando o link acima.

---

## Quickstart (3 comandos)

```bash
npm install
cp .env.example .env
npm run dev
```

Abra:
- Landing pública: http://localhost:5173
- Console de streaming: http://localhost:5173/app/
- API: http://localhost:3001
- Swagger: http://localhost:3001/docs

Configure `JWT_SECRET` (32+ caracteres) no `.env` antes de iniciar a API.

---

## Tabela de status

| Componente | Status | Observação |
|------------|--------|------------|
| API Fastify + WebSocket | ✅ | Funcional (modo demo sem chaves) |
| Transcrição STT (Deepgram) | ⚠️ | Requer `DEEPGRAM_API_KEY` |
| Tradução/LLM (Anthropic) | ⚠️ | Requer `ANTHROPIC_API_KEY` |
| Autenticação JWT | ✅ | Persistência JSON local (não produção) |
| Persistência PostgreSQL | ⚠️ | Docker Compose disponível, não conectado por padrão |
| Microfone virtual | ❌ | Não implementado |
| Apps desktop/extensão | ❌ | Scaffolds |
| Cobrança (Stripe) | ❌ | Modo mock |

---

## Arquitetura

```
Browser (React/Vite)
   │ HTTP / WebSocket
   ▼
Fastify API (localhost:3001)
   ├─ /api/v1/*  →  REST (auth, perfis, documentos, sessões)
   ├─ /v1/realtime →  WebSocket (texto, modo assist/translate)
   ├─ /v1/audio-stream →  WebSocket (PCM16 → Deepgram STT)
   └─ /docs      →  Swagger UI
   │
   ├─ Anthropic (LLM: tradução + resposta)
   ├─ Deepgram (STT: streaming de áudio)
   ├─ PostgreSQL/pgvector (via Docker Compose)
   └─ Redis (cache/filas)
```

Detalhes em `docs/ARCHITECTURE.md` e `docs/PLAN.md`.

---

## FAQ de privacidade

**Meus áudios e transcrições são enviados para terceiros?**

Apenas se você configurar chaves de provedor (Deepgram, Anthropic). Sem chaves,
o sistema roda em modo demo local, sem envio externo. Nunca envie dados de
terceiros sem consentimento explícito.

**Onde os dados são armazenados?**

Em desenvolvimento, em arquivo JSON local (`DATA_FILE`). Em produção, migre
para PostgreSQL com sessões em cookies `HttpOnly` e criptografia em repouso.

**Posso excluir meus dados?**

Sim. Use `DELETE /api/v1/me` para remover conta e registros associados, ou
exporte via `GET /api/v1/export`.

**O áudio do microfone sai do meu computador?**

Somente quando você inicia uma sessão de streaming e há uma chave Deepgram
configurada. Caso contrário, nada é enviado para a rede.

**Este projeto está em conformidade com LGPD/GDPR?**

Não ainda. A persistência local JSON e o modo demo não são adequados para
produção. Consulte `SECURITY.md` e planeje a migração para banco seguro antes
de expor a API publicamente.

---

## Verificações

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

---

## Licença

MIT — veja `LICENSE`. Adequado para adoção ampla, inclusive uso comercial.
