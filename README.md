# InterviewIA — Copilot Live v0.4 (npm)

A development foundation for multilingual meeting assistance. **Not production-ready**. The public landing and browser audio diagnostic studio are implemented; real virtual microphone and voice-to-voice translation are not.

## Start

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173, use **Página inicial** for the landing and **Estúdio de áudio** to test your microphone. API: http://localhost:3001; Swagger: http://localhost:3001/docs.

If the API does not load `.env`, start it separately with `node --env-file=.env --import tsx apps/api/src/index.ts` and the frontend with `npm run dev --workspace @copilot/web`.

## Checks

```bash
npm run typecheck
npm test
npm run build
```

See `docs/HALOVOICE_FEATURES.md` for feature truth table and manual acceptance checks. Use a recent Chromium browser and localhost or HTTPS for microphone permissions. Never capture other people without appropriate notice and consent.
