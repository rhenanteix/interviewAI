# Linguagens para próxima arquitetura

| Componente | Linguagem sugerida | Motivo | Condição de adoção |
|---|---|---|---|
| Landing/console/extension | TypeScript | Integração navegador, React, manutenção | Manter |
| API de negócio | TypeScript/Fastify | Coesão com modelos e integrações | Manter enquanto p95 atende |
| Gateway PCM/WebSocket | Go | Conexões simultâneas, memória e goroutines | Benchmark k6 com >500 sessões e perfil CPU/RAM |
| DSP/resampling e áudio nativo | Rust | Segurança de memória e processamento previsível | Medir overhead e necessidades nativas; protótipo em módulo isolado |
| Pesquisa diarização/ML | Python | Ecossistema ML | Fora do caminho crítico |

A latência ponta a ponta é dominada frequentemente por endpointing STT, RTT dos provedores e tempo até primeiro token do LLM. Antes de migrar, medir p50/p95 de captura→STT, STT→tradução e fim da fala→resposta. Não assumir que trocar TypeScript por Go/Rust por si só resolve.
