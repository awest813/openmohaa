# Renderer Notes — WebGL Porting

This document catalogues known issues and areas of investigation for
getting the OpenMoHAA renderer working in WebGL / WebGL2 via Emscripten.

## Renderer Architecture

OpenMoHAA inherits ioquake3's dual-renderer setup:

| Renderer | CMake option | Pipeline | WebGL target |
|----------|-------------|----------|-------------|
| **GL1** (`renderergl1/`) | `BUILD_RENDERER_GL1` | Fixed-function + immediate mode | WebGL 1 (limited) |
| **GL2** (`renderergl2/`) | `BUILD_RENDERER_GL2` | GLSL shaders, FBOs, VBOs | WebGL 2 (preferred) |

For web builds, the Emscripten CMake file defaults to GL1 (since GL2 is
OFF upstream), but **GL2 is the recommended long-term path** because
WebGL2 maps closely to OpenGL ES 3.0 and the GL2 renderer already uses
GLSL shaders, VBOs, and FBOs.

## Key Differences: Desktop GL vs WebGL

### WebGL 1 (≈ OpenGL ES 2.0)

- No fixed-function pipeline (`glBegin`/`glEnd`, matrix stack, etc.)
- No `GL_QUADS` primitive
- No `glPolygonMode` line/point rendering
- Limited texture formats
- No `glTexImage2D` with `GL_BGR`/`GL_BGRA`
- Max texture size often 4096

### WebGL 2 (≈ OpenGL ES 3.0)

- Adds `glDrawElementsInstanced`, `glDrawArraysInstanced`
- Uniform buffer objects
- 3D textures, texture arrays
- Transform feedback
- `gl_VertexID` / `gl_InstanceID` in shaders
- Still **no** geometry shaders or tessellation

## GL1 Renderer — Problem Areas

These files contain desktop-GL calls that have no WebGL equivalent:

| File | Functions / Calls | Issue |
|------|------------------|-------|
| `tr_backend.c` | `glBegin`, `glEnd`, `glVertex*` | Immediate mode — must convert to VBOs |
| `tr_draw.c` | `glBegin`/`glEnd` for 2D drawing | Same |
| `tr_shade.c` | `glLockArraysEXT`, `glUnlockArraysEXT` | Extension not in WebGL |
| `tr_sky.c` | `glBegin`/`glEnd` for sky box | Convert to VBOs |
| `tr_shadows.c` | `glBegin`/`glEnd`, stencil tricks | Needs rewrite for ES |
| `tr_flares.c` | `glReadPixels` for occlusion | May work but is slow in WebGL |
| `tr_image.c` | `GL_BGR`, `GL_BGRA` internal formats | Use `GL_RGB`/`GL_RGBA` and swizzle |
| `tr_init.c` | `glGetString(GL_EXTENSIONS)` | Use `getExtension()` / feature detection |

## GL2 Renderer — Problem Areas

The GL2 renderer is closer to WebGL2 but still has issues:

| File | Issue |
|------|-------|
| `tr_extensions.c` | Loads GL extensions via `qglGetProcAddress` — many won't exist in WebGL2 |
| `tr_dsa.c` | Direct State Access (DSA) — not in WebGL2; needs compatibility shim |
| `tr_fbo.c` | Uses `GL_DEPTH24_STENCIL8` — available in WebGL2 but check format enums |
| `tr_glsl.c` | Shader `#version` directives need adjustment for GLSL ES 300 |
| `tr_init.c` | Gamma ramp via `SDL_SetWindowGammaRamp` — no-op in browser |
| `tr_image.c` | Same BGR/BGRA issues as GL1 |
| `tr_postprocess.c` | May use GL features not in ES 3.0 |

## Existing Emscripten Guards

The codebase already has some `#ifdef __EMSCRIPTEN__` guards:

- **`code/sys/sys_main.c`** — `emscripten_set_main_loop()` replaces `while(1)`
- **`code/sdl/sdl_glimp.c`** — WebGL2 context creation (ES 3.0 profile)
- **`code/renderergl2/tr_init.c`** — Default vsync on for Emscripten
- **`code/qcommon/q_platform.h`** — Platform strings, DLL extension

## Recommended Approach

1. **Start with GL1** to get first pixels — it compiles with fewer
   dependencies and the immediate-mode calls can be stubbed.
2. **Audit GL1 for `glBegin`/`glEnd`** — replace with vertex-array or
   VBO batches. ioquake3 Emscripten ports have patches for this.
3. **Move to GL2 + WebGL2** as the real target — the GLSL pipeline
   is far more compatible.
4. **Disable expensive/unsupported features early:**
   - `r_inGameVideo 0`
   - `r_drawSun 0`
   - `r_dynamiclight 0`
   - Gamma ramp → CSS filter fallback or skip
   - Cinematics → skip

## Useful References

- [ioquake3 source](https://github.com/ioquake/ioq3) — upstream
  Emscripten support and renderer patches
- [Q3JS](https://github.com/nicedone/nicedone.github.io) — working
  Quake 3 in browser, good reference for GL → WebGL translation
- [WebGL2 spec](https://registry.khronos.org/webgl/specs/latest/2.0/) —
  what is and isn't available
- [Emscripten OpenGL support](https://emscripten.org/docs/porting/multimedia_and_graphics/OpenGL-support.html) —
  Emscripten's GL emulation layer docs
