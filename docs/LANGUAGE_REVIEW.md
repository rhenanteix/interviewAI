# Language review

**Keep TypeScript** for UI, extension, Electron and API contracts: shared types, single npm workspace, rapid iteration, ecosystem for WebSockets and providers.

**Python** is a good optional isolated worker for offline speech evaluation, diarization and ML experiments, but not required for the first real-time orchestration API.

**Go** may improve CPU/memory footprint and predictable concurrent streaming for a dedicated audio gateway at high concurrency, but adds cross-language maintenance. Benchmark before migrating.

**Rust** suits low-level capture, audio DSP, native plugins, and constrained latency, at higher development cost.

Recommendation: TypeScript-first modular monolith; add a Go/Rust audio service only after measuring a real bottleneck.
