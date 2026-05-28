# OpenMoHAA Web Port — Roadmap

This document tracks the phased plan for bringing OpenMoHAA to the browser
via Emscripten / WebAssembly.

## Milestone 1 — Build Infrastructure (current)

- [x] Emscripten CMake platform file (`cmake/platforms/emscripten.cmake`)
- [x] HTML shell, asset-import UI, and loader JS (`web/`)
- [x] IndexedDB-backed asset persistence (no game files shipped in repo)
- [x] Documentation skeleton (`docs/web-port/`)
- [ ] First successful `emcmake cmake` configure (may require stub work)
- [ ] First successful `emmake make` link (expect renderer / networking errors)

## Milestone 2 — Compile Clean

- [ ] Stub or guard unsupported platform APIs (fork, exec, raw sockets, dlopen, etc.)
- [ ] Disable GameSpy networking for web builds
- [ ] Disable auto-updater, cURL downloads, Mumble link
- [ ] Resolve remaining linker errors

## Milestone 3 — Boot to Menu

- [ ] Get GL1 or GL2 renderer producing first pixels in WebGL / WebGL2
- [ ] Keyboard and mouse input working through SDL → Emscripten
- [ ] Console draws, basic UI renders
- [ ] Load `.pk3` assets from virtual FS

## Milestone 4 — Single-Player Map Load

- [ ] Load and render training or first SP map
- [ ] Basic entity / script system functional
- [ ] Player movement and collision

## Milestone 5 — Audio

- [ ] Implement SDL audio backend (WebAudio underneath via Emscripten SDL port)
- [ ] Sound effects and music playback
- [ ] Disable OpenAL-specific paths in favour of SDL audio

## Milestone 6 — Polish & Multiplayer (future)

- [ ] WebSocket-to-UDP proxy for multiplayer
- [ ] Server browser / direct connect via WebSocket
- [ ] Performance profiling and memory optimisation
- [ ] Mobile / touch input exploration

## Non-Goals (for now)

- Hosting original MOHAA assets (these are EA-owned)
- Full feature parity with native builds on day one
- Mobile-first UI (desktop browser is the primary target)
