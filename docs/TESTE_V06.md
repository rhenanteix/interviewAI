# Teste da v0.6 (npm)

1. Revogue a chave Deepgram exposta no chat e gere outra no painel do provedor. Nunca compartilhe a nova chave.
2. `npm install`; copie `.env.example` para `.env` e configure `DEEPGRAM_API_KEY` e `ANTHROPIC_API_KEY` (opcional: sem Anthropic há mock).
3. Use Node 22+ e inicie API com `node --env-file=.env --import tsx apps/api/src/index.ts` e frontend com `npm run dev --workspace @interviewia/web` em outro terminal.
4. Abra http://localhost:5173, vá a Streaming Deepgram, escolha Aba/tela, PT-BR, Tradução + resposta, e compartilhe uma aba reproduzindo áudio inglês marcando Compartilhar áudio.
5. Observe transcrição, tradução e sugestão. Selecione Microfone para testar sua própria voz. Para testar a voz da outra pessoa em uma reunião, selecione a aba da reunião, não o microfone.
6. Ative leitura em voz alta para TTS local; evite usar na mesma aba capturada para não criar loop.
7. `npm run typecheck`, `npm test`, `npm run build`. Execute os testes com credenciais válidas e consentimento de participantes.

Limites: esta versão NÃO possui microfone virtual, autenticação de ticket de áudio vinculada a usuário, reconexão com retomada, AudioWorklet nem testes de latência certificados. Não exponha o backend publicamente. O WebSocket STT ainda tem proteção apenas por ticket e limite de bytes.
