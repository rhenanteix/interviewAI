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
provedor de STT (Deepgram ou Whisper local), traduz e gera sugestões de resposta
contextualizadas (Anthropic ou modo demo simulado). Tudo roda localmente ou em
containers Docker, sem enviar dados para terceiros sem o seu consentimento.

### Principais funcionalidades

- Transcrição de áudio em tempo real via WebSocket (Deepgram STT ou Whisper local).
- Tradução entre português, inglês e espanhol (modo demo ou Anthropic).
- Modo assistência: sugestões de resposta para perguntas de entrevista.
- **Chrome Extension (MV3)**: captura de áudio da aba via side panel, indicador visual
  de captura, consentimento obrigatório no primeiro uso e botão de apagar dados locais.
- Persistência local de sessões, perfis e histórico (opcional, desativada por padrão).
- API REST com Swagger (`/docs`) e WebSocket para áudio em tempo real.
- Docker Compose com PostgreSQL/pgvector e Redis.
- **Nada é persistido por padrão**: áudio e transcrições não são gravados em disco.

---

## Demo

![Demo do InterviewIA](docs/demo.gif)

> Coloque um GIF real da aplicação em execução em `docs/demo.gif` e atualize o link acima.
> Sugestão: grave uma sessão curta (consentimento → captura de aba → transcrição →
> tradução → sugestão de resposta) com aproximadamente 800x450 px.

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

### Carregar a extensão Chrome (MV3)

1. `npm run build --workspace @interviewia/extension` (gera `apps/extension/dist`)
2. Acesse `chrome://extensions/` no Chrome/Edge
3. Ative "Modo do desenvolvedor"
4. Clique "Carregar sem compactação" e selecione `apps/extension/dist`
5. Abra o painel lateral da extensão ao lado de uma aba com áudio/vídeo

---

## Tabela de status

| Componente | Status | Observação |
|------------|--------|------------|
| API Fastify + WebSocket | ✅ | Funcional (modo demo sem chaves) |
| Transcrição STT (Deepgram) | ⚠️ | Requer `DEEPGRAM_API_KEY` |
| Transcrição STT (Whisper local) | ⚠️ | Requer container whisper.cpp, `WHISPER_URL` |
| Tradução/LLM (Anthropic) | ⚠️ | Requer `ANTHROPIC_API_KEY` |
| Autenticação JWT | ✅ | Persistência JSON local (não produção) |
| Persistência PostgreSQL | ⚠️ | Docker Compose disponível, não conectado por padrão |
| Microfone virtual | ❌ | Não implementado |
| Apps desktop/extensão | ⚠️ | Extensão MV3 funcional (side panel); desktop em scaffold |
| Cobrança (Stripe) | ❌ | Modo mock |
| Consentimento de áudio (primeiro uso) | ✅ | Obrigatório, salvo em `chrome.storage.local` |
| Indicador "capturando áudio da aba" | ✅ | Visível no painel lateral durante a captura |
| Apagar dados locais | ✅ | Botão no painel lateral; limpa storage + localStorage |
| Persistência de áudio/transcrição | ❌ | Nada é persistido por padrão |

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
   ├─ Whisper local (STT: via whisper.cpp container)
   ├─ PostgreSQL/pgvector (via Docker Compose)
   └─ Redis (cache/filas)
```

Extensão Chrome MV3:
```
Side panel (React/Vite-like TS)
   │ chrome.runtime.sendMessage
   ▼
Service worker (background)
   ├─ tabCapture.getMediaStreamId
   ├─ offscreen.createDocument (AUDIO_PLAYBACK)
   └─ AudioWorklet + PCM16 16 kHz mono → API WebSocket
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

**O áudio do microfone/aba sai do meu computador?**

Somente quando você inicia uma sessão de streaming e há uma chave Deepgram ou
Whisper local configurada. Caso contrário, nada é enviado para a rede.

**O áudio e as transcrições são persistidos?**

Não por padrão. A extensão não grava áudio nem transcrições em disco. O botão
"Apagar dados locais" limpa qualquer configuração armazenada em
`chrome.storage.local` e `localStorage`.

**Posso excluir meus dados?**

Sim. Use `DELETE /api/v1/me` para remover conta e registros associados, ou
exporte via `GET /api/v1/export`. Na extensão, use "Apagar dados locais".

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
