# InterviewIA v0.8 — npm

Read `docs/RESTRUCTURING_V08.md` for verified changes, manual tests, security limitations and Go/Rust evaluation.

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

- Marketing landing: http://localhost:5174
- Authenticated console: http://localhost:5173
- API: http://localhost:3001
- Swagger: http://localhost:3001/docs

Use a newly generated Deepgram API key. Never commit `.env` or send credentials in chat.

**Status:** development alpha, not a production-ready SaaS. Native virtual microphone, provider TTS, session resume, load/security testing and other requirements remain incomplete.
