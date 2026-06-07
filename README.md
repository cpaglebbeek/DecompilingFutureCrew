# DecompilingFutureCrew

Modern browser-reinterpretatie van **Second Reality** (Future Crew, 1993) — vanuit de originele x86 asm / C / POV-Ray source naar TypeScript + WebGL2 + WebAudio.

> Source-archief: https://github.com/mtuomi/SecondReality (Unlicense / public domain, 2013-release door Future Crew)

## Doel

1. **Decompile-luik** — per scene een leesbare reverse-engineering note (asm → moderne uitleg, met shader/code-port)
2. **Modern playable** — resolutie-onafhankelijk canvas, 60fps, mobile-friendly (touch + Z Fold 6), geen DOSBox
3. **Educatief** — codebase + decomp-notes leesbaar voor wie de demoscene-effecten van 1993 wil begrijpen

## Status

`v0.0.1-PSi` — skeleton. Timeline + renderer-stubs + placeholder scenes (START, ALKU). Eerste hero-decompile target: GLENZ (vector-met-blending).

Zie [BUILD_PLAN.md](BUILD_PLAN.md) voor roadmap per scene.

## Stack

- **TypeScript** strict mode
- **Vite** dev/build
- **WebGL2** pure (geen framework — past bij low-level demoscene-stijl)
- **WebAudio** (S3M-tracker player via libxmp-lite WASM, gepland voor v0.1.x)
- **GitHub Pages** + HC55 mirror voor hosting

## Run

```
npm install
npm run dev      # http://localhost:5173/DecompilingFutureCrew/
npm run build    # → dist/
```

## Hosting

- **Primary**: https://cpaglebbeek.github.io/DecompilingFutureCrew/ (GitHub Pages, auto-deploy via Actions)
- **Mirror**: https://horsecloud55.ddns.net/SecondReality/ (HC55, handmatige sync)

## Licentie

**AGPL-3.0** — code in deze repo.
Originele Second Reality source: Unlicense (public domain), zie `source/NOTE.md`.

## Codenamen

Versie-codenamen = Future Crew leden (naar beste vermogen, te verifiëren bij hervatten):
- v0.0.1 **PSi** (Sami Tammilehto, lead coder)
- v0.1.x **Marvel** (Petteri Kuittinen, coder)
- v0.2.x **Trug** (Mikko Tukiainen)
- v0.3.x **Pixel** (Tero Toropainen, graphics)
- v0.4.x **Skaven** (Vesa Norilo, music)
- v0.5.x **Purple Motion** (Jonne Valtonen, music)
- v0.6.x **Yodel** / v0.7.x **Yost** — namen te verifiëren

## Disclaimer

Niet officieel, geen affiliatie met Future Crew. Reinterpretatie + educatief. Originele demo blijft een meesterwerk; deze repo eert het door het uit te leggen.
