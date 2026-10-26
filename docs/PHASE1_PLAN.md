# Plano — Fase 1 (MVP): Extensão Chrome com legendas ao vivo

> Projeto: InterviewIA — extensão Chrome (MV3) que captura áudio da aba atual,
> envia para STT em streaming e exibe legenda original + tradução ao vivo
> em um side panel.

## 1. Diagrama de fluxo (Mermaid)

```mermaid
flowchart LR
    subgraph Aba["Aba do navegador (entrevista)"]
        A[Áudio da aba / sistema]
    end

    subgraph SW["Service Worker (background)"]
        B[chrome.tabCapture.getMediaStreamId]
        C[Roteador de mensagens Zod]
        D[Provedor STT (demo local)]
        E[Provedor Tradução (demo local)]
    end

    subgraph OD["Offscreen Document"]
        F[navigator.mediaDevices.getUserMedia(chromeMediaSourceId)]
        G[AudioContext → destination]
        H[AudioWorkletNode]
    end

    subgraph AW["AudioWorklet (processador de áudio)"]
        I[Downmix mono]
        J[Resample 16 kHz]
        K[Float32 → PCM16 Int16]
        L[Quadros 1 s → service worker]
    end

    subgraph API["API Fastify (opcional, via WebSocket)"]
        M[/v1/audio-stream]
        N[STT provedor externo]
        O[Tradução provedor externo]
    end

    subgraph SP["Side Panel (chrome.sidePanel)"]
        P[Controles iniciar/parar]
        Q[Legenda original]
        R[Tradução ao vivo]
    end

    A -->|1| B
    B -->|2 streamId| F
    F -->|3 MediaStream| G
    G -->|4 reenvia áudio| H
    H -->|5 PCM16 16 kHz| I
    I --> J
    J --> K
    K -->|6| L
    L -->|7| C
    C -->|8| D
    C -->|9| E
    C -->|10| SP
    D -.|11 opcional via API| M
    M -.|12| N
    N -.|13| O
    O -->|14| SP
    P -->|15| C
    Q -->|16| SP
    R -->|17| SP

    style SW fill:#e1f5fe
    style OD fill:#fff3e0
    style SP fill:#f3e5f5
```

**Fluxo resumido:**
1. Usuário clica "Iniciar captura" no side panel.
2. Service worker solicita `tabCapture.getMediaStreamId` para a aba ativa.
3. Service worker cria um Offscreen Document (`reasons: ["AUDIO_PLAYBACK"]`).
4. Offscreen abre o stream com `getUserMedia({audio:{mandatory:{chromeMediaSourceId: streamId}}})`.
5. O áudio é reencaminhado para `AudioContext.destination` (aba não fica muda).
6. Um `AudioWorkletNode` processa: downmix mono → resample 16 kHz → PCM16 Int16.
7. Quadros de 1 s são enviados ao service worker como `audio.pcm`.
8. Service worker alimenta o `SttProvider`; segmentos de transcrição e tradução são broadcast para o side panel.
9. Side panel renderiza legenda original + tradução ao vivo.

## 2. Estrutura de pastas proposta

### apps/extension

```
apps/extension/
├── manifest.json              # MV3: side_panel, background (module), permissions
├── build.mjs                  # esbuild + cópia de assets estáticos
├── tsconfig.json              # strict, lib dom, noEmit (dev) / emit (build)
├── chrome-ambient.d.ts        # tipos ambiente do Chrome (não há @types/chrome)
├── popup.html                 # popup da action (informativo)
├── popup.js
├── sidepanel.html             # UI do side panel (legenda + tradução)
├── offscreen.html             # documento offscreen sem UI visível
└── src/
    ├── background.ts          # service worker: tabCapture, offscreen, roteamento
    ├── offscreen.ts           # getUserMedia, AudioContext, AudioWorkletNode
    ├── audio-worklet.ts       # downmix, resample 16 kHz, PCM16, postMessage
    ├── audio-worklet.test.ts  # testes puros do pipeline de áudio
    └── sidepanel.ts           # controles, render de legendas, mensagens Zod
```

### packages/providers

```
packages/providers/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts               # exportações públicas
    ├── interfaces.ts          # SttProvider, TranslationProvider, opções
    ├── demo-stt.ts            # provedor de STT simulado (sem chave, sem rede)
    ├── demo-stt.test.ts
    ├── demo-translation.ts    # provedor de tradução simulado (dicionário)
    ├── demo-translation.test.ts
    └── providers.ts           # factory que escolhe provedor real vs demo por env
```

### packages/shared (atual)

```
packages/shared/
├── src/
│   ├── index.ts               # re-exporta contratos existentes + extension.ts
│   ├── extension.ts           # contratos de mensagem da extensão (Zod)
│   └── extension.test.ts
```

## 3. Contratos Zod das mensagens

### Entre service worker ↔ offscreen (canal interno da extensão)

```ts
// service worker → offscreen
export const offscreenStart = z.object({
  type: z.literal('offscreen.start'),
  streamId: z.string(),
  tabId: z.number().int().positive(),
});
export const offscreenStop = z.object({ type: z.literal('offscreen.stop') });

// offscreen → service worker
export const audioPcm = z.object({
  type: z.literal('audio.pcm'),
  tabId: z.number().int().positive(),
  pcm16: z.instanceof(Int16Array),   // validado em tempo de execução como array buffer
  sampleRate: z.literal(16000),
});
```

### Entre service worker ↔ side panel (canal de mensagens da extensão)

```ts
export const captureStart = z.object({
  type: z.literal('capture.start'),
  tabId: z.number().int().positive(),
});
export const captureStop = z.object({ type: z.literal('capture.stop') });
export const setTargetLang = z.object({
  type: z.literal('setTargetLang'),
  targetLang: z.enum(['pt-BR', 'en', 'es']),
});
export const transcript = z.object({
  type: z.literal('transcript'),
  text: z.string().min(1).max(100000),
  isFinal: z.boolean().default(false),
  language: z.string().min(1).max(8).optional(),
});
export const translation = z.object({
  type: z.literal('translation'),
  text: z.string().min(1).max(100000),
  targetLang: z.enum(['pt-BR', 'en', 'es']),
  sourceLang: z.enum(['pt-BR', 'en', 'es']).optional(),
});
export const extensionError = z.object({
  type: z.literal('extension.error'),
  message: z.string().min(1).max(1000),
  fatal: z.boolean().default(false),
});
export const extensionMessage = z.discriminatedUnion('type', [
  captureStart, captureStop, setTargetLang, transcript, translation, extensionError,
]);
```

### Entre extensão e API (via WebSocket, se escolhido o caminho pela API)

```ts
export const wsAudioFrame = z.object({
  type: z.literal('audio.frame'),
  sessionId: z.string().uuid(),
  sequence: z.number().int().nonnegative(),
  pcm16: z.instanceof(Int16Array),
  sampleRate: z.literal(16000),
  timestamp: z.number().int().nonnegative(),
});
export const wsSttResult = z.object({
  type: z.literal('stt.result'),
  sessionId: z.string().uuid(),
  text: z.string(),
  isFinal: z.boolean(),
  language: z.string().optional(),
});
export const wsTranslationResult = z.object({
  type: z.literal('translation.result'),
  sessionId: z.string().uuid(),
  text: z.string(),
  targetLang: z.enum(['pt-BR', 'en', 'es']),
  sourceLang: z.enum(['pt-BR', 'en', 'es']).optional(),
});
```

> Nota: `Int16Array` não é serializável diretamente em `postMessage`/`WebSocket` sem `Transferable` (ArrayBuffer). No plano, o `pcm16` viaja como `ArrayBuffer` dentro do `postMessage` (transferível) e como `base64` ou buffer binário no WebSocket. A validação Zod ocorre nos metadados; o payload binário é tratado à parte.

## 4. Decisão: STT direto (token efêmero) vs via API (WebSocket)

### Opção A — Extensão fala direto com o provedor de STT (token efúmero/BYOK)

**Prós:**
- Latência mínima (sem salto extra pela API local).
- Menos carga na API Fastify; a extensão é autossuficiente para áudio.
- Simplifica o MVP: não depende da API estar rodando para o core das legendas.
- Alinha à regra "nunca colocar API keys no bundle": token efêmero obtido via BYOK local ou endpoint da API apenas para emissão de token.

**Contras:**
- Chave/token do STT precisa residir na extensão (memória, never no bundle); rota de emissão de token ainda precisa da API.
- Mais complexo de auditar (rede direta da extensão para provedor externo).
- Dificulta adicionar autenticação/rate limit por usuário no STT.
- Tradução ainda precisa de um provedor separado (ou da API).

### Opção B — Extensão passa pela nossa API via WebSocket

**Prós:**
- Ponto único de controle: autenticação, rate limiting, consumo de quota, logs de erro.
- Chaves de provedor (Deepgram, Anthropic) ficam apenas na API, nunca na extensão.
- Facilita modo demo: a API pode retornar transcrição simulada sem chave externa.
- Mais fácil de evoluir para sessões autenticadas e persistência posterior.

**Contras:**
- Salto extra de rede (extensão → localhost:3001 → provedor), aumenta latência.
- Requer a API rodando localmente para a extensão funcionar.
- Mais código na API (proxy de áudio, gerenciamento de sessões WebSocket).

### Recomendação

**Recomendado para a Fase 1 (MVP): Opção B (via API WebSocket).**

Justificativa: o repositório já possui a API Fastify com endpoint `/v1/audio-stream` (PCM16 → Deepgram) e WebSocket `/v1/realtime`. Aproveitar essa infraestrutura existente evita duplicar lógica de provedor, mantém chaves fora da extensão (conforme regra de segurança) e deixa a extensão focada em captura de áudio e UI. O modo demo da API já funciona sem chaves, então o MVP é verificável imediatamente. A latência extra de localhost é aceitável para legendas ao vivo.

Se, em fases futuras, a latência se tornar crítica, avaliar a Opção A com token efêmero emitido pela API apenas para o canal de áudio.

## 5. Tarefas pequenas (cada uma com critério de aceite testável)

1. **Adicionar contratos Zod da extensão em `packages/shared/src/extension.ts`**
   - Critério: `npm run typecheck -w @interviewia/shared` passa; `z.parse` aceita mensagens válidas e rejeita inválidas (coberto por teste existente).

2. **Criar `packages/providers` com interfaces e provedores demo**
   - Critério: `npm run typecheck -w @interviewia/providers` e `npm test -w @interviewia/providers` passam; provedores funcionam sem chave de API e sem rede.

3. **Configurar `apps/extension` como workspace TypeScript (package.json, tsconfig, build.mjs, manifest MV3 com side_panel)**
   - Critério: `npm run typecheck -w @interviewia/extension` passa; `npm run build -w @interviewia/extension` gera `dist/` com `manifest.json`, `sidepanel.html`, `offscreen.html` e bundles JS.

4. **Implementar service worker: `tabCapture.getMediaStreamId`, criação de offscreen, roteamento de mensagens**
   - Critério: typecheck passa; service worker não captura nem processa áudio (somente orquestra).

5. **Implementar offscreen document: `getUserMedia(chromeMediaSourceId)`, `AudioContext`, reconexão a `destination`, carregamento do AudioWorklet**
   - Critério: typecheck passa; offscreen não exibe UI visível.

6. **Implementar AudioWorklet: downmix mono, resample 16 kHz, Float32 → PCM16, postMessage de quadros de 1 s**
   - Critério: `audio-worklet.test.ts` passa (taxa 16 kHz, downmix, resample, saturação PCM16).

7. **Implementar side panel: legenda original + tradução ao vivo, controles iniciar/parar, seletor de idioma alvo**
   - Critério: typecheck passa; build gera `sidepanel.html` e `sidepanel.js` no `dist/`.

8. **Conectar provedores demo ao fluxo service worker → side panel**
   - Critério: testes de integração unitária (vitest) simulam `postMessage` e validam que `transcript` e `translation` são emitidos a partir de áudio PCM16.

9. **Executar `npm run typecheck && npm test && npm run build` na raiz**
   - Critério: todos os workspaces passam sem erros.

10. **Documentar teste manual e limpeza (nomes @interviewia/*, READMEs)**
    - Critério: este plano lista ponto de limpeza; nenhuma API key no bundle.

## 6. Riscos técnicos e mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| `tabCapture.getMediaStreamId` exige permissão do usuário e aba com áudio ativo | Captura não inicia | Exibir erro claro no side panel; orientar usuário a reproduzir áudio na aba antes de iniciar. |
| Chrome restringe `chromeMediaSourceId: 'tab'` a origens seguras/extensões com permissão | Falha no `getUserMedia` | Declarar `tabCapture` e `offscreen` no manifest; testar em ambiente real (não dá para automatizar sem navegador). |
| AudioWorklet não suportado em todos os canais do Chrome | Extensão quebra em versões antigas | MV3 exige Chrome recente; manter fallback documentado e testar na versão estável alvo. |
| Áudio da aba fica muda se não reencaminhado para `destination` | Experiência ruim para o usuário | Garantir `origem.connect(contexto.destination)` no offscreen (regras MV3). |
| PCM16 serialização via `postMessage`/WebSocket (Int16Array não é transferível direto) | Erro de clonagem de dados | Usar `ArrayBuffer` com transferência em `postMessage`; base64 ou buffer binário no WebSocket. |
| API keys no bundle da extensão | Vazamento de segredos | Nunca armazenar chaves no bundle; usar BYOK local ou token efêmero da API (regra do projeto). |
| Persistência acidental de áudio/transcrição | Violação de privacidade/LGPD | Não persistir áudio nem transcrição por padrão; provedores demo não gravam nada. |
| Latência do salto via API (localhost) | Legendas atrasadas | Medir em teste manual; se crítico, avaliar caminho direto com token efêmero na próxima fase. |
| Nome de pacote `@interviewia/*` diverge do projeto "InterviewIA" | Confusão de marca/imports | Listado como ponto de limpeza (ver abaixo). |

## Pontos de limpeza (conflitos com o repositório atual)

1. **Nomes de pacote `@interviewia/*`**: o root `package.json` se chama `interviewia`, o README é "InterviewIA", mas os workspaces usam `@interviewia/api`, `@interviewia/web`, `@interviewia/landing`, `@interviewia/shared`, `@interviewia/providers`, `@interviewia/extension`. Recomendado padronizar para `@interviewia/*` (ou manter `@interviewia/*` e atualizar o README) antes de publicar.
2. **README único**: existe apenas um `README.md` na raiz (não há "três READMEs" atualmente). Se forem criados READMEs por workspace, manter a documentação centralizada na raiz para evitar divergência.
3. **Manifest atual desatualizado**: `apps/extension/manifest.json` ainda declara `action.default_popup` e `background.service_worker` (não module) sem `side_panel`. Substituir pelo manifest MV3 do plano.
4. **Sem `AGENTS.md`**: não existe instruções de agente na raiz; considerar criar para padronizar comandos de verificação (`typecheck`, `test`, `build`).
