# InterviewIA — HaloVoice-inspired feature plan and acceptance checklist

## Implemented in v0.4
- Responsive, original InterviewIA marketing landing, feature cards, integrations overview, steps, CTA into console.
- Audio Studio: browser mic permission, input selection after permission, browser noise suppression, echo cancellation, high-pass filter, compressor and live RMS meter.
- Existing text WebSocket pipeline, browser speech recognition (where supported), and optional Anthropic integration retained.

## NOT implemented (must not advertise as working)
- End-to-end low-latency voice-to-voice translation. Current microphone recognition depends on browser speech APIs; translation is text-based.
- Virtual microphone installation and routing to Discord, OBS, Zoom, Slack or Teams. These need platform-specific native audio device/driver or user-installed virtual audio cable and a real PCM output pipeline.
- System/meeting audio capture, Deepgram streaming, TTS playback, production-grade noise suppression (RNNoise/WebRTC APM), production billing, security audit.

## Proposed architecture
1. Audio capture: desktop native loopback or explicit browser tab capture; PCM16 16 kHz; frame sequence and timestamps.
2. STT: provider adapter with Deepgram streaming; partial/final transcript events and diarization.
3. Translate: provider-backed streaming, interruption and stable-prefix handling.
4. TTS: stream synthesized audio in target language; jitter buffer; optional virtual microphone routing.
5. Desktop: signed Electron builds plus native virtual audio routing integration, documented per OS. Do not claim a virtual microphone exists until device enumeration verifies it.
6. Observability: latency metrics p50/p95, per-stage errors and audio packet loss.

## Manual acceptance
- Visit landing from left sidebar; CTA opens live console; anchors scroll to sections.
- Visit Audio Studio; allow mic; verify meter responds to speech; stop and verify indicator resets and capture track stops.
- Toggle echo/noise controls, restart and compare; browsers may ignore constraints depending on device.
- Deny mic and verify visible error.
- Run existing text demo from Live console and verify translation/answer labels are marked simulated where appropriate.
