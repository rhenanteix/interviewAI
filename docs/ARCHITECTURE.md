# Architecture v0.3

Browser React → Fastify REST /api/v1 and WebSocket /v1/realtime → Anthropic (optional).

Local development uses JSON persistence for accounts, documents and sessions. PostgreSQL, pgvector, Redis, Deepgram audio streaming, speaker diarization, enterprise SSO and production security are **not implemented**. The extension and Electron app are scaffolds.

See API documentation at http://localhost:3001/docs.
