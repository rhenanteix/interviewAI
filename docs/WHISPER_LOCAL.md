# Whisper Local (diferente de latência)

## Arquitetura

O Whisper não é nativamente streaming: ele consome um arquivo de áudio completo e devolve a transcrição inteira. Para usar no InterviewIA em modo "ao vivo", adotamos **VAD + janelas curtas**:

1. **VAD (Voice Activity Detection)**: energia RMS a cada frame de 20 ms no áudio PCM16 16 kHz mono. Acima do limiar (`SPEECH_THRESHOLD = 0.015`) conta como fala; abaixo, conta como silêncio.
2. **Janelas curtas**: enquanto houver fala, acumulamos amostras no buffer. Quando detectamos silêncio por `SILENCE_TIMEOUT_MS = 600 ms` (ou atingimos `MAX_SEGMENT_MS = 15000 ms`), enviamos o segmento para o Whisper via HTTP (`POST /inference`).
3. **Segmento mínimo**: apenas segmentos com `MIN_SPEECH_MS = 300 ms` de fala são enviados, evitando ruído.

## Diferença de latência

| Provedor | Modelo | Latência típica | Notas |
|----------|--------|-----------------|-------|
| Deepgram (streaming) | Nova-2 streaming | ~300–600 ms | Parciais em tempo real, finais imediatos |
| Whisper local (VAD + janelas) | base/tiny | ~1.5–3 s por segmento | Espera silêncio de 600 ms + tempo de inferência |

A latência do Whisper é maior porque:
- Não há parciais: só emite após detectar fim de fala (silêncio de 600 ms).
- Cada segmento precisa ser enviado como arquivo WAV e processado inteiro pelo modelo.
- A inferência do modelo base roda localmente (CPU/GPU do container) e depende do hardware.

## Como usar

### Via Docker Compose (sem chave externa de STT)

```bash
docker compose --profile local up whisper
```

A API então deve ser iniciada com `WHISPER_URL=http://localhost:8080/inference` no `.env`:

```bash
WHISPER_URL=http://localhost:8080/inference
npm run dev -w @interviewia/api
```

Com `WHISPER_URL` definido, a API seleciona automaticamente `WhisperSttProvider` em vez do `FakeSttProvider`.

### Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `WHISPER_URL` | `http://localhost:8080/inference` | URL do servidor Whisper (whisper.cpp server) |
| `ANTHROPIC_API_KEY` | (vazio) | Se definido, usa tradutor Anthropic; senão, usa tradutor fake |
| `JWT_SECRET` | obrigatório | Mínimo 32 caracteres |

## Teste manual

1. `docker compose --profile local up whisper` (aguardar o healthcheck passar)
2. `cp .env.example .env` e definir `WHISPER_URL=http://localhost:8080/inference` e `JWT_SECRET`
3. `npm run dev -w @interviewia/api`
4. Carregar `apps/extension/dist` como extensão descompactada no Chrome
5. Abrir side panel, clicar "Iniciar captura de aba" em uma aba com áudio
6. Verificar legendas originais e traduzidas aparecendo com latência exibida

## Limpeza

```bash
docker compose --profile local down
```
