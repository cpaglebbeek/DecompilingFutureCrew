# ARCHITECTURE — DecompilingFutureCrew

## Conceptueel

Doel: de scenes van Second Reality (1993, DOS, x86 asm) in een moderne browser opnieuw spelen, met per-scene reverse-engineering documentatie. Geen DOSBox — alles wordt geherinterpreteerd in TypeScript+WebGL2+WebAudio.

Twee outputs uit één repo:
1. **Playable demo** in de browser (`dist/`, gedeployd op GitHub Pages + HC55)
2. **Decompile-archief** — per scene een leesbare uitleg van het effect met asm→GLSL/TS mapping (`decomp/`)

## Logische componenten

```
            ┌──────────────────────────────────────────┐
            │                  main.ts                  │
            │  (boot: canvas → Renderer/Audio/Input →   │
            │   Timeline-config → requestAnimationFrame)│
            └──────────────────────────────────────────┘
                              │
        ┌─────────────┬───────┴───────┬─────────────┐
        ▼             ▼               ▼             ▼
   ┌─────────┐  ┌───────────┐  ┌────────────┐ ┌──────────┐
   │Timeline │  │ Renderer  │  │AudioEngine │ │  Input   │
   │         │  │ (WebGL2)  │  │ (WebAudio) │ │(kbd+touch)│
   └─────────┘  └───────────┘  └────────────┘ └──────────┘
        │
        ▼ (calls SceneFn per frame)
   ┌──────────────────────────────────────────────────────┐
   │           src/scenes/<name>.ts                       │
   │  (each implements (ctx) => void; uses ctx.renderer)  │
   └──────────────────────────────────────────────────────┘
        │
        ▼ (per scene een decomp-pakket)
   ┌──────────────────────────────────────────────────────┐
   │           decomp/<scene>/                            │
   │   ASM_NOTES.md + port.ts + port.vert + port.frag     │
   └──────────────────────────────────────────────────────┘
```

### Engine-laag (`src/engine/`)

| Module | Rol | Notities |
|--|--|--|
| `timeline.ts` | Sequencer over scenes. `update(dt)` advanceert tijd, switcht scene op duration-eind. `skip()` voor user-input. | Toekomst (fase 4): tijd-sync op tracker-positie i.p.v. wall clock. |
| `renderer.ts` | WebGL2-context, DPR-aware resize, viewport, basis `beginFrame` + `clearTo`. | Fase 1 uitbreiding: program/shader cache, VAO helpers, framebuffer ping-pong. |
| `audio.ts` | AudioContext lazy-init op user-gesture (browsers eisen dit). Master GainNode. | Fase 4: S3M-tracker player (libxmp-lite WASM of chiptune2.js). |
| `input.ts` | Keyboard + pointer. Vertaalt user-events naar engine-callbacks (`onActivate`, `onSkip`, `onPause`). | Fase 1 uitbreiding: long-press = pause, double-tap = previous. |

### Scenes-laag (`src/scenes/`)

Elke scene = pure functie `(ctx: SceneCtx) => void`. `ctx` bevat tijd (`t`, `tNorm`), `renderer` en `audio`. Geen scene-eigen state in v0.0.x; later mogelijk via closure-bound state als nodig (bv. mesh-buffers).

Huidige scenes (placeholders):
- `start.ts` — blauwe fade
- `alku.ts` — rode fade

### Decomp-laag (`decomp/<scene>/`)

Zelfstandige documentatie + port-stubs per scene. Niet automatisch gelinkt aan `src/scenes/` — bewuste scheiding zodat decomp-werk los kan staan van scene-integratie. Wanneer een scene ge-port is: dezelfde `port.ts/vert/frag` worden referenced/geïmporteerd vanuit `src/scenes/<scene>.ts`.

## Externe afhankelijkheden

| Afhankelijkheid | Doel | Status |
|--|--|--|
| `vite` | dev-server + build-tool | dev-dep |
| `typescript` | type-check + tsc | dev-dep |
| (toekomst) `libxmp-lite` of `chiptune2.js` | S3M tracker player | fase 4 |

Geen runtime dependencies — alles is pure web-platform (WebGL2 + WebAudio).

## Source-relatie

| Repo | Rol | Licentie | Locatie |
|--|--|--|--|
| `cpaglebbeek/DecompilingFutureCrew` (deze) | onze code + docs | AGPL-3.0 | `Documents/Gemini_Projects/DecompilingFutureCrew` |
| `mtuomi/SecondReality` | originele 1993 source (read-only referentie) | Unlicense | `Documents/Gemini_Projects/SecondReality_source` (clone los, geen submodule) |

## Hosting

| Omgeving | URL | Deploy-mechaniek |
|--|--|--|
| GitHub Pages (primary) | https://cpaglebbeek.github.io/DecompilingFutureCrew/ | `.github/workflows/pages.yml` op push naar `main` |
| HC55 mirror (planned) | https://icthorsecloud.nl/SecondReality/ | handmatige `rsync dist/` (nog niet opgezet — fase 1 of later) |

## Ecosysteem-relaties

`Retro_Computing` sub-master `Meta_Retro_Computing` definieert "taal-runtimes + decompilatie" als scope.

| Ander project | Relatie | Reden |
|--|--|--|
| QuickBasicEmulator (Meta + Core + Web + X86) | broertje | beide retro-runtimes, beide AGPL, beide PUBLIC |
| OrbitalEcho (Gaming) | aanpalend | overlap demoscene/8-16bit reverse-eng, andere scope (native game-engine) |
| AmigaHorse (Gaming) | aanpalend | retro-emulatie, hardware focus i.p.v. taal/code |
| LLMShapes | architectuur-zus | beide "deploy als statische webapp + showcase + AGPL public" |

## Niet-functionele eisen

- **Mobile-first** — werkt op Z Fold 6 (zowel cover als unfolded)
- **Cold-start budget** — `<150 KB` JS gzipped voor de boot, lazy-load scene-modules later
- **60 fps target** op desktop / `≥30 fps` op midrange mobile
- **GPU-fallback** — geen WebGPU-only; alles WebGL2

## Conformance aan Meta_Master Expliciete Vastlegging Principe

| Vereiste | Bestand |
|--|--|
| Architectuur | dit document |
| Componenten + relaties | dit document + `decomp/README.md` + `BUILD_PLAN.md` |
| Sessies | `prompts/<NNN>_<onderwerp>.md` met frontmatter |
| Build/CI | `.github/workflows/pages.yml` + `package.json` scripts |
| Conventies | `CLAUDE.md` |
| Roadmap | `BUILD_PLAN.md` |
| Decomp-aanpak | `decomp/README.md` + `decomp/<scene>/ASM_NOTES.md` |

`docs/DESIGN_TOKENS.md`, `docs/PRINCIPLES.md`, `docs/DEPENDENCIES.md` worden toegevoegd zodra de demo een UI/visuele identiteit krijgt buiten de scenes zelf (waarschijnlijk fase 1 met FPS-overlay + scene-titel).
