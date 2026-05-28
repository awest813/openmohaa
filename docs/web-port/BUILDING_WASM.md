# Building OpenMoHAA for the Web (Emscripten / WASM)

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| **Emscripten SDK** | 3.1.50+ | Install via [emsdk](https://emscripten.org/docs/getting_started/downloads.html) |
| **CMake** | 3.25+ | |
| **Ninja** | any | Recommended generator |
| **Python 3** | 3.8+ | Required by Emscripten |
| **Flex / Bison** | any | Only if `BUILD_GAME_QVMS=ON` |

> **Note:** You do *not* need SDL2, OpenAL, or cURL installed on the host.
> Emscripten provides its own SDL2 port (`--use-port=sdl2`), and OpenAL /
> cURL are disabled for web builds.

## Quick Start

```bash
# 1. Activate the Emscripten environment
source /path/to/emsdk/emsdk_env.sh

# 2. Configure
emcmake cmake -S . -B build-web -G Ninja \
  -DCMAKE_BUILD_TYPE=RelWithDebInfo \
  -DBUILD_CLIENT=ON

# 3. Build
cmake --build build-web

# 4. Serve locally (Emscripten requires a proper HTTP server for WASM)
cd build-web/RelWithDebInfo
python3 -m http.server 8080

# 5. Open in browser
#    http://localhost:8080/omohaaded.html  (or whatever CLIENT_NAME is)
```

## What the CMake Platform File Does

`cmake/platforms/emscripten.cmake` automatically:

- Disables the dedicated server, dynamic renderer loading, GameSpy HTTP,
  OpenAL dlopen, and native game libraries.
- Keeps GL1 enabled by default (set `-DBUILD_RENDERER_GL2=ON` to switch
  to the GLSL-based renderer — recommended for WebGL2).
- Links IDBFS (`-lidbfs.js`) for persistent browser storage.
- Exports the Emscripten `FS` API and `callMain` for the JS loader.
- Copies `web/` shell files into the build output.

## Recommended Build Flags

### Minimal (first compile attempt)

```bash
emcmake cmake -S . -B build-web -G Ninja \
  -DCMAKE_BUILD_TYPE=RelWithDebInfo \
  -DBUILD_CLIENT=ON \
  -DBUILD_RENDERER_GL2=OFF \
  -DUSE_OPENAL=OFF \
  -DUSE_CODEC_VORBIS=OFF \
  -DUSE_CODEC_OPUS=OFF \
  -DUSE_CODEC_MAD=OFF
```

### With GL2 renderer (WebGL2)

```bash
emcmake cmake -S . -B build-web -G Ninja \
  -DCMAKE_BUILD_TYPE=RelWithDebInfo \
  -DBUILD_CLIENT=ON \
  -DBUILD_RENDERER_GL2=ON \
  -DUSE_OPENAL=OFF \
  -DUSE_CODEC_VORBIS=OFF \
  -DUSE_CODEC_OPUS=OFF \
  -DUSE_CODEC_MAD=OFF
```

## Build Output

After a successful build, the output directory contains:

| File | Purpose |
|------|---------|
| `<CLIENT_NAME>.html` | HTML launcher with asset-import UI |
| `<CLIENT_NAME>.js` | Emscripten glue code (ES6 module) |
| `<CLIENT_NAME>.wasm` | WebAssembly binary |
| `<CLIENT_NAME>-config.json` | Default engine arguments |
| `openmohaa-loader.js` | Asset import and engine bootstrap |
| `styles.css` | Launcher styling |
| `<CLIENT_NAME>.data` | *(only if `EMSCRIPTEN_PRELOAD_FILE=ON`)* |

## Serving

WASM files must be served with the correct MIME type
(`application/wasm`). Most modern HTTP servers handle this automatically.
If not, configure your server to return:

```
Content-Type: application/wasm
```

for `.wasm` files.

### Cross-Origin Isolation (SharedArrayBuffer)

If you later need `SharedArrayBuffer` (e.g. for threading), the server
must return these headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

## Troubleshooting

| Symptom | Likely Cause |
|---------|-------------|
| `RuntimeError: memory access out of bounds` | Increase `-sTOTAL_MEMORY` in `emscripten.cmake` |
| `LinkError: import … not found` | Missing Emscripten port or stub for a native API |
| Black screen, no errors | Check browser console for WebGL context errors; try a different `r_mode` |
| Assets not persisting | Verify IndexedDB is not blocked (private browsing may restrict it) |
