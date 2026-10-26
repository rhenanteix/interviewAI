import type { FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { FakeSttProvider, WhisperSttProvider, createSttProvider, createTranslationProvider } from '@interviewia/providers';
import type { SttProviderConfig } from '@interviewia/providers';
import type { TranslationProviderConfig } from '@interviewia/providers';

const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutos
const IDLE_TIMEOUT_MS = 30 * 1000; // 30 segundos sem atividade
const MAX_FRAME_BYTES = 64_000; // ~2s de PCM16 mono 16 kHz
const MAX_TOTAL_BYTES = 96_000_000; // 96 MB por sessão
const MAX_CONNECTIONS_PER_CLIENT = 5;

// --- Contratos Zod ---

export const sessionRequest = z.object({});

export const sessionResponse = z.object({
  token: z.string(),
  expires_in: z.number(),
});

export const streamMessageIn = z.object({
  type: z.enum(['configure', 'stop']),
  target_lang: z.enum(['pt-BR', 'en', 'es']).optional(),
  context: z.string().max(12000).optional(),
});

export const streamEventOut = z.object({
  type: z.enum(['partial', 'final', 'error', 'audio_ready', 'audio_closed', 'translated']),
  text: z.string().optional(),
  lang: z.string().optional(),
  code: z.string().optional(),
  at: z.number().optional(),
  original: z.string().optional(),
  translated: z.string().optional(),
  sttLatency_ms: z.number().optional(),
  translationLatency_ms: z.number().optional(),
  totalLatency_ms: z.number().optional(),
});

// --- Estado global da API ---

const sessions = new Map<string, { expires: number; userId: string }>();
const connectionsByClient = new Map<string, Set<WebSocket>>();

function getClientKey(req: { headers: Record<string, string> }): string {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ??
    req.headers['x-real-ip'] ??
    'unknown'
  );
}

function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [k, v] of sessions) {
    if (v.expires < now) sessions.delete(k);
  }
}

function pruneClosedConnections(clientKey: string): void {
  const set = connectionsByClient.get(clientKey);
  if (!set) return;
  for (const ws of set) {
    if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      set.delete(ws);
    }
  }
  if (set.size === 0) connectionsByClient.delete(clientKey);
}

function getSttProviderConfig(): SttProviderConfig {
  if (process.env.WHISPER_URL) {
    return {
      type: 'whisper',
      whisperUrl: process.env.WHISPER_URL,
      language: 'pt-BR',
      sampleRate: 16000,
    };
  }
  return {
    type: 'fake',
    fixturePath: undefined,
    language: 'pt-BR',
    sampleRate: 16000,
  };
}

function getTranslationProviderConfig(): TranslationProviderConfig {
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      type: 'anthropic',
      targetLang: 'en',
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL,
    };
  }
  return {
    type: 'demo',
    targetLang: 'en',
    debounceMs: 0,
  };
}

export function registerStream(app: FastifyInstance): void {
  const jwtSecret = process.env.JWT_SECRET || 'LOCAL_DEMO_ONLY_CHANGE_ME';

  app.post('/v1/session', async (req, reply) => {
    sessionRequest.parse(req.body);
    cleanupExpiredSessions();

    if (!jwtSecret || jwtSecret.length < 32) {
      return reply.code(503).send({ error: 'JWT_SECRET_REQUIRED' });
    }

    const userId = randomUserId();
    const token = jwt.sign({ sub: userId, type: 'stream' }, jwtSecret, {
      expiresIn: '5m',
    });
    sessions.set(token, { expires: Date.now() + SESSION_TTL_MS, userId });

    return reply.send(
      sessionResponse.parse({ token, expires_in: Math.round(SESSION_TTL_MS / 1000) }),
    );
  });

  app.get('/v1/stream', { websocket: true }, (client, req) => {
    const clientKey = getClientKey(req as unknown as { headers: Record<string, string> });
    pruneClosedConnections(clientKey);

    const token = (req.query as { token?: string }).token;
    let userId = '';
    try {
      if (!token) throw new Error('MISSING_TOKEN');
      const payload = jwt.verify(token, jwtSecret) as { sub?: string; type?: string };
      if (!payload.sub || payload.type !== 'stream') throw new Error('INVALID_TOKEN');
      const session = sessions.get(token);
      if (!session || session.expires < Date.now()) throw new Error('SESSION_EXPIRED');
      userId = session.userId;
      sessions.delete(token); // single-use
    } catch {
      client.close(1008, 'Invalid or expired session token');
      return;
    }

    const clientConns = connectionsByClient.get(clientKey) ?? new Set();
    if (clientConns.size >= MAX_CONNECTIONS_PER_CLIENT) {
      client.close(1008, 'Too many connections per client');
      return;
    }
    clientConns.add(client);
    connectionsByClient.set(clientKey, clientConns);

    const sttConfig = getSttProviderConfig();
    const stt = createSttProvider(sttConfig);
    void stt.start({ language: sttConfig.language, sampleRate: sttConfig.sampleRate });

    const translationConfig = getTranslationProviderConfig();
    const translator = createTranslationProvider(translationConfig);
    void translator.start({ targetLang: translationConfig.targetLang ?? 'en' });

    let totalBytes = 0;
    let lastActivity = Date.now();
    let ended = false;
    let closeTimer: NodeJS.Timeout | null = null;
    const sessionStartMs = Date.now();
    let lastOriginalText = '';
    let lastOriginalLang: string | undefined;
    let translationStartMs = 0;
    let lastSttLatencyMs = 0;

    const resetIdle = () => {
      lastActivity = Date.now();
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        if (!ended) {
          ended = true;
          try {
            client.close(1001, 'Idle session timeout');
          } catch {}
          stt.stop();
          void translator.stop();
        }
      }, IDLE_TIMEOUT_MS);
    };
    resetIdle();

    const send = (obj: unknown) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(streamEventOut.parse(obj)));
      }
    };

    const handleSttFinal = async (text: string, language?: string) => {
      resetIdle();
      const sttLatencyMs = Date.now() - sessionStartMs;
      lastOriginalText = text;
      lastOriginalLang = language;
      lastSttLatencyMs = sttLatencyMs;

      send({
        type: 'final',
        text,
        lang: language,
        at: Date.now(),
        sttLatency_ms: sttLatencyMs,
      });

      translationStartMs = Date.now();
      try {
        await translator.sendText(text);
      } catch {
        // translation errors handled via translator 'error' event
      }
    };

    translator.on('final', (e: unknown) => {
      if ((e as { type: string }).type !== 'final') return;
      const ev = e as { type: string; text?: string };
      const translationLatencyMs = Date.now() - translationStartMs;
      const totalLatencyMs = (Date.now() - sessionStartMs) + translationLatencyMs;
      send({
        type: 'translated',
        original: lastOriginalText,
        translated: ev.text,
        lang: lastOriginalLang ? undefined : translationConfig.targetLang,
        sttLatency_ms: lastSttLatencyMs,
        translationLatency_ms: translationLatencyMs,
        totalLatency_ms: totalLatencyMs,
        at: Date.now(),
      });
    });

    stt.on('partial', (e: unknown) => {
      if ((e as { type: string }).type === 'partial') {
        resetIdle();
        const ev = e as { type: string; text?: string; language?: string };
        send({
          type: 'partial',
          text: ev.text,
          lang: ev.language,
          at: Date.now(),
        });
      }
    });

    stt.on('final', (e: unknown) => {
      if ((e as { type: string }).type !== 'final') return;
      const ev = e as { type: string; text?: string; language?: string };
      void handleSttFinal(ev.text ?? '', ev.language);
    });

    stt.on('error', () => {
      send({ type: 'error', code: 'STT_PROVIDER_ERROR', at: Date.now() });
    });

    translator.on('error', () => {
      send({ type: 'error', code: 'TRANSLATION_PROVIDER_ERROR', at: Date.now() });
    });

    send({ type: 'audio_ready', sample_rate: 16000, at: Date.now() });

    client.on('message', (raw, isBinary) => {
      resetIdle();
      if (ended) return;
      const buf: Buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as unknown as ArrayBuffer);
      if (isBinary) {
        if (buf.length > MAX_FRAME_BYTES) {
          client.close(1009, 'Frame too large');
          return;
        }
        totalBytes += buf.length;
        if (totalBytes > MAX_TOTAL_BYTES) {
          client.close(1009, 'Audio quota exceeded');
          return;
        }
        stt.sendAudio(new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2), 16000);
        return;
      }
      try {
        const d = streamMessageIn.parse(JSON.parse(raw.toString()));
        if (d.type === 'stop' && !ended) {
          ended = true;
          if (closeTimer) clearTimeout(closeTimer);
          stt.stop();
          void translator.stop();
          client.close(1000, 'Stop requested');
        }
      } catch {
        // ignore malformed text messages
      }
    });

    client.on('close', () => {
      if (closeTimer) clearTimeout(closeTimer);
      ended = true;
      clientConns.delete(client);
      if (clientConns.size === 0) connectionsByClient.delete(clientKey);
      stt.stop();
      void translator.stop();
    });
  });
}

function randomUserId(): string {
  return 'user_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}
