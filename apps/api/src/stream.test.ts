import { describe, expect, it, afterAll, beforeAll } from 'vitest';
import Fastify from 'fastify';
import websocketPlugin from '@fastify/websocket';
import WebSocket from 'ws';
import { registerStream } from './stream.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const FIXTURE_PATH = join(__dirname, '..', '..', '..', 'packages', 'providers', 'fixtures', 'test-audio.wav');

function pcm16Chunks(wavBuffer: Buffer, chunkSizeSamples: number): Buffer[] {
  const dataStart = 44;
  const data = wavBuffer.subarray(dataStart);
  const int16 = new Int16Array(data.buffer, data.byteOffset, Math.floor(data.length / 2));
  const chunks: Buffer[] = [];
  for (let i = 0; i < int16.length; i += chunkSizeSamples) {
    const slice = int16.subarray(i, i + chunkSizeSamples);
    const buf = Buffer.from(slice.buffer, slice.byteOffset, slice.byteLength);
    chunks.push(buf);
  }
  return chunks;
}

describe('WebSocket /v1/stream (integração com FakeSttProvider)', () => {
  let app: any;
  let wsUrl: string;
  let sessionToken: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = '01234567890123456789012345678901'; // 32 chars
    app = Fastify({ logger: false });
    await app.register(websocketPlugin);
    registerStream(app);
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address() as { port: number };
    wsUrl = `ws://127.0.0.1:${address.port}/v1/stream`;

    const res = await app.inject({
      method: 'POST',
      url: '/v1/session',
      body: {},
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { token: string; expires_in: number };
    sessionToken = body.token;
    expect(typeof sessionToken).toBe('string');
    expect(body.expires_in).toBe(300);
  });

  afterAll(async () => {
    await app.close();
  });

  it('envia .wav e recebe transcrições partial e final', async () => {
    const wavBuffer = await readFile(FIXTURE_PATH);
    const chunks = pcm16Chunks(wavBuffer, 1600);

    const ws = new WebSocket(`${wsUrl}?token=${sessionToken}`);

    const received: Array<{ type: string; text?: string; lang?: string; original?: string; translated?: string; sttLatency_ms?: number; translationLatency_ms?: number; totalLatency_ms?: number }> = [];
    let audioReady = false;

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'audio_ready') audioReady = true;
        if (msg.type === 'partial' || msg.type === 'final' || msg.type === 'translated') {
          received.push({
            type: msg.type,
            text: msg.text,
            lang: msg.lang,
            original: msg.original,
            translated: msg.translated,
            sttLatency_ms: msg.sttLatency_ms,
            translationLatency_ms: msg.translationLatency_ms,
            totalLatency_ms: msg.totalLatency_ms,
          });
        }
      });
    });

    await new Promise((r) => setTimeout(r, 200));
    expect(audioReady).toBe(true);

    for (const chunk of chunks) {
      ws.send(chunk);
      await new Promise((r) => setTimeout(r, 50));
    }

    await new Promise((r) => setTimeout(r, 800));

    ws.close();

    const finals = received.filter((m) => m.type === 'final');
    expect(finals.length).toBeGreaterThan(0);
    expect(finals.every((m) => typeof m.text === 'string' && m.text.length > 0)).toBe(true);
    expect(finals.every((m) => m.lang === 'pt-BR')).toBe(true);

    const translated = received.filter((m) => m.type === 'translated');
    expect(translated.length).toBeGreaterThan(0);
    expect(translated.every((m) => typeof m.translated === 'string' && m.translated.length > 0)).toBe(true);
    expect(translated.every((m) => typeof m.original === 'string' && m.original.length > 0)).toBe(true);
    expect(translated.every((m) => typeof m.sttLatency_ms === 'number' && m.sttLatency_ms >= 0)).toBe(true);
    expect(translated.every((m) => typeof m.translationLatency_ms === 'number' && m.translationLatency_ms >= 0)).toBe(true);
    expect(translated.every((m) => typeof m.totalLatency_ms === 'number' && m.totalLatency_ms >= 0)).toBe(true);
  });

  it('rejeita conexão sem token', async () => {
    const ws = new WebSocket(wsUrl);
    await new Promise<void>((resolve, reject) => {
      ws.on('error', reject);
      ws.on('close', (code) => {
        expect(code).toBe(1008);
        resolve();
      });
      ws.on('open', () => {
        ws.close(1008, 'Client closing after unexpected open');
      });
    });
  });

  it('rejeita token inválido', async () => {
    const ws = new WebSocket(`${wsUrl}?token=invalid-token`);
    await new Promise<void>((resolve, reject) => {
      ws.on('error', reject);
      ws.on('close', (code) => {
        expect(code).toBe(1008);
        resolve();
      });
      ws.on('open', () => {
        ws.close(1008, 'Client closing after unexpected open');
      });
    });
  });
});
