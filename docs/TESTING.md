# Testing with npm

Requirements: Node.js 22+, npm 10+.

1. `npm install` in repository root.
2. `cp .env.example .env` (set JWT_SECRET to a random secret; `DATA_FILE=./data/local.json`).
3. `npm run dev` then open http://localhost:5173 and http://localhost:3001/docs.
4. `npm test`, `npm run typecheck`, `npm run build`.
5. Swagger: POST `/api/v1/auth/register` with email/name/password (10+ characters). Copy `accessToken`. In Swagger Authorize, paste the token (if security configured) or use curl header `Authorization: Bearer TOKEN`.
6. GET `/api/v1/me`; POST `/api/v1/profiles`; GET `/api/v1/profiles`; POST multipart `/api/v1/documents` with TXT/PDF/DOCX; POST `/api/v1/retrieve` with `{"query":"typescript"}`; POST `/api/v1/sessions`; GET `/api/v1/export`; DELETE account only in disposable test user.
7. Test `/api/v1/billing/checkout` without Stripe key: response must explicitly be mock. With a Stripe test key and valid test price ID, verify redirect in Stripe test mode. No webhook fulfillment is implemented.
8. Test `/api/v1/capabilities`: verify mock/real flags. Browser live mode is text-based; binary audio is not supported by current WebSocket.
9. Electron: `npm run dev --workspace @interviewia/desktop` after starting web. Desktop screen capture depends on OS permissions.

## Chrome Extension (MV3)

### Instalação

1. `npm run build --workspace @interviewia/extension`
2. `chrome://extensions/` → Modo do desenvolvedor → Carregar sem compactação → `apps/extension/dist`
3. Abra o painel lateral da extensão.

### Casos de teste da extensão

**a. Consentimento obrigatório no primeiro uso**
- Abra o painel lateral pela primeira vez (ou após limpar o storage).
- O modal de consentimento deve aparecer, cobrindo a UI do app.
- O app deve ficar oculto (`display: none`) até o usuário clicar "Aceitar e continuar".
- Após aceitar, o consentimento é gravado em `chrome.storage.local` (`interviewia_consent_v1`).
- Reabrir o painel não deve mostrar o modal novamente.

**b. Indicador visível "Capturando áudio da aba"**
- Clique "Iniciar captura de aba" após conceder permissão de `tabCapture`.
- O banner vermelho com pulsação "Capturando áudio da aba" deve aparecer abaixo da toolbar.
- O chip de estado deve passar para "Conectando" e depois "Ouvindo".
- Clique "Parar": o banner deve sumir e o chip voltar a "Desconectado".

**c. Medidor de nível de áudio**
- Com uma aba tocando áudio/vídeo, o medidor deve se mexer conforme o som.
- O áudio da aba continua saindo pelos alto-falantes (não fica mudo).

**d. Legendas e tradução**
- Fale ou deixe o vídeo tocar: legendas parciais aparecem em tempo real (linha itálica) e finais são adicionadas ao histórico da esquerda.
- A tradução aparece no painel da direita.
- O cartão de latência exibe STT, Tradução e Total em ms, atualizado a cada segmento final.

**e. Apagar dados locais**
- Clique "Apagar dados locais" no painel lateral.
- O status deve exibir "Dados locais apagados.".
- `chrome.storage.local` deve ser limpo (incluindo o consentimento).
- Reabrir o painel deve mostrar novamente o modal de consentimento (primeiro uso).

**f. Falha e reconexão da API**
- Pare o servidor da API: o chip passa para "Erro" e a extensão tenta reconectar com backoff exponencial.
- Suba a API novamente: a extensão reconecta automaticamente e o chip volta a "Ouvindo".

**g. Nada é persistido por padrão**
- Nenhum áudio nem transcrição é gravado em disco pela extensão.
- Apenas o consentimento e as configurações (apiUrl, sourceLang, targetLang) são salvos em `chrome.storage.local` via a página de opções.
- O botão "Apagar dados locais" remove tudo.

**h. STT real**
- Deepgram: defina `DEEPGRAM_API_KEY` no `.env` e reinicie a API.
- Whisper local: `docker compose --profile local up whisper`, defina `WHISPER_URL=http://localhost:8080/inference` no `.env`, reinicie a API e repita os passos b–k. A latência será maior (VAD + janelas) mas não requer chave externa.

**i. Tradutor real (Anthropic)**
- Defina `ANTHROPIC_API_KEY` no `.env` e reinicie a API; o tradutor fake é usado por padrão.

Do not use this build with real confidential meetings or customer data: auth lacks hardening, local JSON is not encrypted, and the service is not production-ready.
