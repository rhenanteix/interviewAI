# InterviewIA v0.5 — execução e testes

## Preparação

Requisitos: Node.js 22+, npm 10+, Chrome ou Edge, conta Deepgram para STT real.

```bash
npm install
cp .env.example .env
```

No Windows PowerShell: `Copy-Item .env.example .env`.

Configure `DEEPGRAM_API_KEY` e `JWT_SECRET` em `.env`. O processo Node deve carregar o arquivo: 

Execute `npm run dev` na raiz (a API lê automaticamente o `.env` da raiz). Em sistemas em que o script paralelo não funcionar, use dois terminais: `npm run dev --workspace @interviewia/api` e `npm run dev --workspace @interviewia/web`.

Frontend http://localhost:5173; API http://localhost:3001; Swagger http://localhost:3001/docs.

## Testes de aceitação manuais

1. `GET /health` retorna 200.
2. Abra `Streaming Deepgram` e selecione Microfone; permita acesso; fale uma frase; espere o evento de transcrição.
3. Selecione Aba; ao compartilhar, marque **Compartilhar áudio**; confirme transcrição do áudio da aba.
4. Fale com duas pessoas alternadamente; veja se Deepgram fornece rótulos `Pessoa 1`, `Pessoa 2` (a acurácia varia; não é garantida).
5. Remova a chave Deepgram, reinicie a API; `POST /v1/audio-ticket` deve retornar 503.
6. Recuse permissão de microfone; a interface deve mostrar erro.
7. Pare a captura; confirme que o indicador de gravação do navegador desaparece.
8. No console do navegador, verifique que a chave Deepgram nunca é enviada ao cliente.
9. Execute `npm run typecheck`, `npm test`, `npm run build` após `npm install`.
10. Teste uma sessão de texto no painel `Ao vivo`, independentemente do STT.

## Limitações / segurança

A rota de tickets de áudio nesta versão ainda não está ligada ao login do usuário. **Não publique a API na internet**: qualquer cliente que acesse a rota pode consumir sua cota Deepgram. Exige autenticação, quotas por usuário, TLS, rate limit e testes antes da produção.

A implementação utiliza ScriptProcessorNode para compatibilidade inicial; substituir por AudioWorklet e resampling robusto em produção. O envio PCM16/16kHz funciona para a maioria das taxas comuns, mas o algoritmo atual não é um resampler com filtragem anti-aliasing.

O código **não implementa** voz sintetizada, tradução vocal nem driver de microfone virtual. Para roteamento a Discord/Zoom/Teams, é necessário um driver/dispositivo virtual do sistema operacional (por exemplo, VB-Cable no Windows ou BlackHole no macOS) e um pipeline TTS que envie o áudio sintetizado a esse dispositivo. Não há driver instalado ou distribuído neste ZIP.

## Latência

Instrumentar tempos de captura, STT parcial/final, tradução e TTS separadamente. Metas de p95 < 3 s não foram medidas nesta versão. Medir com 100+ amostras em rede e hardware representativos antes de afirmar SLO.
