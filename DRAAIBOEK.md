# DRAAIBOEK — onderdeel naar afgesproken resultaat

Gedestilleerd uit het GLENZ-traject (referentie-onderdeel, `glenz/`). Elk
demo-onderdeel doorloopt dezelfde 8 stappen. **Per onderdeel testen; pas
verder bij functionele tevredenheid van de gebruiker (test-gate in stap 8).**
De viewer-optie zit in stap 4 — meteen meepakken, niet achteraf.

## De 8 stappen

| # | Stap | Wat het inhoudt | Artefact |
|---|------|-----------------|----------|
| 1 | **Bron-analyse** | `source/`-clone lezen, de routines van dít deel identificeren, met `file:line`-citaten | `decomp/<deel>/ASM_NOTES.md` |
| 2 | **Semantische port** | CPU-deel + render-deel porten; faithful-vs-benadering expliciet maken (approximations-lijst) | `decomp/<deel>/port.ts` + `.vert/.frag` of software-raster |
| 3 | **Standalone pagina + modi** | Eigen `index.html` met start-overlay + knoppen **Demo / Viewer / (debug)**; `main.ts` met rAF-loop, input, HUD | `<deel>/index.html` + `<deel>/src/*` |
| 4 | **Viewer-optie (meteen)** | Gizmo: sleep=draaien · shift=object draaien · ctrl=verplaatsen · scroll=grootte · ctrl+scroll=zoom · R=recenter; Pointer Events (muis/touch/pen, Z Fold 6) | viewer-mode in core + `main.ts` |
| 5 | **Audio/timing-sync** | Correcte-tempo bron; loop bakken indien nodig met reproduceerbaar recept; audioklok = master clock | `tools/bake_<deel>.mjs` + asset |
| 6 | **Determinisme + test-harness** | `?frame=N` deterministische preview; headless Playwright smoke (`_<deel>_*.mjs`): viewer actief, HUD, geen console-errors | smoke-scripts |
| 7 | **Versie + docs** | `package.json` + `CHANGELOG.md` bump (kleurcode + Future-Crew-codenaam); README counterpart-tabel + approximations; `decomp/README.md` scene-index | versie-bump + docs |
| 8 | **Deploy + test-gate** | Build → (GitHub Pages bij push) → HC55-mirror deploy met shared-infra-checks (`nginx -t`, alle snippets intact) → **functionele test door gebruiker → akkoord vóór volgend onderdeel** | live mirror |

## Viewer-optie — vaste specificatie

| Input | Actie |
|-------|-------|
| sleep (drag) | hele assembly draaien |
| shift + sleep | binnen-object draaien |
| ctrl + sleep | binnen-object x/y verplaatsen |
| scroll | binnen-object grootte |
| ctrl + scroll | camera-zoom |
| R | recenter / reset viewer |
| M | mute |

Implementatie via Pointer Events (muis + touch + pen). Viewer is een aparte
modus naast Demo; de getimede choreografie blijft intact.

## Onderdelen + volgorde

Volgorde: "warm-eerst" (bestaande bron-analyse + manipuleerbaar object).
Authoritatieve demo-volgorde wordt ingevoegd zodra de Sanglard-deep-dive klaar is.

| # | Onderdeel | Bron-status | Standalone+viewer |
|---|-----------|-------------|-------------------|
| 0 | GLENZ | ✓ ge-port | ✅ referentie (klaar) |
| 1 | DOTS | ✓ decomp + scene (fase 1+2) | 🧪 gebouwd (fase 1-4) — test-gate open |
| 2 | TUNNELI | ✓ decomp + scene (pipe-snake) | ☐ |
| 3 | WATER | ✓ tribute-shader + scene | ☐ |
| 4 | STARFIELD | scene only | ☐ |
| 5 | ALKU (intro) | placeholder | ☐ |
| 6+ | 3DS · LENS · GRID · TWIST · TECHNO · DDSTARS · ENDPIC · CREDITS | tbd | ☐ |

## Werkwijze met agents

- **Stap 1 (bron-analyse)** → delegeren aan research-agent (leest source-bulk,
  levert compacte bouw-spec) — bespaart hoofd-context.
- **Onafhankelijke deeltaken** (smoke-scripts schrijven, docs opstellen) →
  parallel via agents waar geen onderlinge afhankelijkheid bestaat.
- **Samenhangende bouw** (core + viewer + main) → hoofdsessie coördineert.
- Per onderdeel: één versie-bump + Future-Crew-codenaam (zie `CLAUDE.md`).

## Test-gate

Een onderdeel is pas "klaar" als de gebruiker het functioneel heeft getest en
akkoord geeft. Geen stochastische invulling van bron-gaten: een gat wordt als
gat gerapporteerd, niet geraden (sanitycheck-eerlijkheid).
