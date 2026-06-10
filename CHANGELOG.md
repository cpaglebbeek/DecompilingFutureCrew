# Changelog

Codenamen = Future Crew leden.

## [0.8.3-Wildfire] — 2026-06-10

**Bugfix (code geel — logische architectuur: ontbrekende navigatielaag).** Gebruiker: "ik zie nog geen optie voor viewer versie en music.html opent een ander deel van de demo."

### Diagnose
De viewer-knop bestond wél, maar uitsluitend op de losse pagina `/glenz/`. De gebruiker komt binnen via de **hoofddemo** (`/`), die GLENZ als getimede scène afspeelt zonder knoppen én zonder link naar de viewer-pagina. `music.html` (`/glenz/music.html`) werkt alleen op het base-prefixte pad; zonder base → 404 → host valt terug op de hoofd-index = "een ander deel van de demo". Bewezen via curl (404 zonder base / 200 mét base op dev+preview) + 3 browser-screenshots.

### Root Cause Analysis
- **Functioneel:** Drie geïsoleerde pagina's (hoofddemo, GLENZ-standalone met Demo/Viewer, muziek-debug) zonder onderlinge links → viewer onvindbaar, music-link landt verkeerd.
- **Technisch:** Multi-page Vite + `base: /DecompilingFutureCrew/`; elke pagina alleen bereikbaar op het base-pad. Niets linkte hoofddemo → viewer → muziek.
- **Architectonisch:** Discoverability/navigatie tussen de eilanden was niet vastgelegd. Drie relatieve, base-veilige links toegevoegd (geen routing-herontwerp).

### Gewijzigd
- `index.html`: hoek-link rechtsboven `GLENZ · viewer & muziek →` → `glenz/`.
- `glenz/index.html`: derde knop `🎵 Muziek-debug` naast Demo/Viewer → `./music.html` (`.cta` nu ook op `<a>`).
- `public/glenz/music.html`: terug-links verduidelijkt → `← GLENZ (demo/viewer)` (`./index.html`) + `← hoofddemo` (`../`).

## [0.8.2-Wildfire] — 2026-06-10

**Bugfix (code geel).** Gebruiker: "fix viewer en music debug page."

### Viewer — objecten draaien nu samen
In viewer-mode counter-roteerde object B (rode schil) op 1/3-snelheid t.o.v. A (`3600 - vR/3`), overgenomen uit de demo-choreografie. Bij slepen draaiden binnen- en buitenobject dus uiteen — in strijd met de goedgekeurde "A+B objecten samen". Fix: `buildViewerB()` deelt nu A's oriëntatie (`rotX=vRx, rotY=vRy`), zodat het hele translucente samenstel als één star object draait. De demo-`buildStateB()` (met counter-rotatie) blijft ongemoeid. Headless geverifieerd: rotatie (sleep) + zoom (wheel) werken, geen JS-errors.

### Music-debug-pagina — permanent gemaakt
`music.html` leefde alleen in `dist/` en werd door elke `vite build` (`emptyOutDir`) gewist. Verplaatst naar **`public/glenz/music.html`** (bron, overleeft builds) en de debug-bronnen naar `public/audio/`:
- `glenz_loop_lossless.wav` (3.97 MB, MUSIC1.S3M orders 50–60 zonder Opus-compressie) — om de Opus-loop-naad ("hakkerig") te isoleren van de render zelf ("vertraagd").
- `ref_glenz.ogg` (619 KB, referentie-capture) — meetlat.

De pagina (A=productie-Opus-loop / A2=lossless WAV / REF=referentie) resolved bronnen relatief t.o.v. de pagina-URL, werkt dus op de Pages-base én via `file://`, en toont "bestand niet gevonden" als een debug-asset ontbreekt. Alleen `music.html` laadt deze assets; de hoofd-demo (`index.html`) raakt ze niet, dus geen impact op de demo-laadtijd.

### RCA (music-pagina)
- **Functioneel:** debug-tool verdween telkens → gebruiker kon audio niet A/B'en.
- **Technisch:** `emptyOutDir` wist dist-only bestanden; bron hoort in `public/`.
- **Architectonisch:** debug-artefacten horen onder versiebeheer (`public/`), niet in de wegwerp-`dist`. Vastlegging > stochastisch herstel.

### Gewijzigd
- `glenz/src/glenz_core.ts`: `buildViewerB()` star met A mee.
- `public/glenz/music.html` (nieuw, permanent).
- `public/audio/glenz_loop_lossless.wav` + `public/audio/ref_glenz.ogg` (nieuw, debug-assets).

## [0.8.1-Wildfire] — 2026-06-10

**Bugfix (code geel — logische architectuur: framing, geen physics-redesign).** Gebruiker (deep-dive beeld/physics): "bij het origineel deukt de polygoon echter in. in jouw versie explodeert hij een beetje, groeien en slinken." Akkoord op fix #1 (framing) vóór #2-#4.

### Diagnose (bron-vergelijking)
De squash-mechaniek (`MAIN.C:526-527`: `yscale=xscale=120+jello/30; zscale=120-jello/30`) is in `glenz_core.ts:227-228` een **regel-voor-regel faithful port**, inclusief integer-truncatie en de gedempte veer-oscillatie. Ook de transform-volgorde klopt: `rotateScale()` roteert eerst en schaalt daarna in scherm-assen (zoals `crotlist` rotatie → `crotlist` schaal-matrix). De impact-deformatie wérkt aantoonbaar (gerenderde reeks 640→660→680: rond → breed/plat → rond). Het verschil zat **niet in de physics-formule** maar in de **framing/zoom**.

### Root Cause Analysis
- **Functioneel:** Het object stond te groot/ingezoomd in beeld (vulde het frame). Het origineel toont het compact met zwarte marge (`ref_10`: blauw ~45%w, `ref_11`: rode schil ~75%w), waardoor dezelfde ±27% impact-squash als subtiele diepte-**deuk** leest; bij ons werd het een schermvullende **explosie** ("groeit/krimpt").
- **Technisch:** `Z_POS=7100` (eerder van 7500 teruggebracht) + objectschaal vulden het frame; elke pixel-uitslag van de squash werd uitvergroot. Fix: `Z_POS` naar **9500** — object zit nu compact met brede zwarte marge, exact matchend met `ref_10/11`. De ±27%-squash blijft identiek maar leest nu als deuk.
- **Architectonisch:** De squash-amplitude is correct (faithful); de waargenomen "explosie" was een projectie-/framing-keuze, niet een physics-fout. Les: een faithful-geporte beweging kan nog "fout" ogen door de camera-afstand — framing ijken tegen referentie-frames vóór de physics verdenken.

### Gewijzigd
- `glenz/src/glenz_core.ts`: `Z_POS` 7100 → 9500 (+ comment). Raakt demo-framing, fall/bounce-schaal én de viewer-default `vCamDist`.

### Nog open (akkoord-afhankelijk, NIET in deze bump)
- #2 diepte-collapse zichtbaarder, #3 eeuwige loop heroverwegen, #4 tick-levering gladstrijken (samenhangend met audio-issue). Eerst visuele bevestiging van #1.

### Codenaam
v0.8.x = **Wildfire** (Future Crew-lid).

## [0.8.0-Wildfire] — 2026-06-10

**Nieuwe feature (code oranje — design-impact, logische arch stabiel).** Keuze vóór het starten van GLENZ: **demo mode** (ongewijzigd: getimede choreografie, muziek-gelockt) of **viewer mode** (interactief — de glenz-objecten zelf met de muis draaien). Akkoord gebruiker: "al jou voorstellen" (alle voorgestelde defaults: muziek speelt door, A+B samen, drag=roteren + wheel=zoom).

### Wat
- **Keuzescherm** (`glenz/index.html`): de start-overlay heeft nu twee knoppen — `▶ Demo` en `🖱 Viewer`. Beide leveren de vereiste user-gesture voor autoplay. Een willekeurige toets quick-start de demo-modus.
- **Viewer-tak** (`glenz/src/glenz_core.ts`): vlag `viewer`; choreografie bevroren op de settled pose (vol formaat A, ingefadede B, gecentreerd op `VIEWER_Y = -1300` = de settled demo-framing). `rotateBy(dx,dy)` zet de oriëntatie uit pointer-delta (6 graad-tienden/px), `zoomBy(dy)` schuift `camDist` (3800–13000), `resetViewer()` recentreert. Object B counter-roteert (`3600 - r/3`) concentrisch zoals in de demo.
- **Input** (`glenz/src/main.ts`): Pointer Events (muis/touch/pen, Z Fold 6) — sleep = roteren, wheel = zoom (`preventDefault`). In demo-mode ongewijzigd (tap = niets/pause via toets). `R` recentreert in viewer i.p.v. herstarten.
- **Muziek** speelt in viewer door als sfeer (de 0.7.0 OGG-loop); rotatie ontkoppeld van de muziekklok. `M` mute blijft.

### Waarom zo
Determinisme + scheiding van zorg: de viewer is een aparte render-tak die de getimede sim niet aanraakt, dus de golden-frame test (`renderAtFrame`) en het demo-pad blijven byte-identiek. Geen engine- of audio-architectuurwijziging.

### Gewijzigd
- `glenz/index.html`: twee-knops keuzescherm + styling.
- `glenz/src/glenz_core.ts`: viewer-state, `enableViewer/resetViewer/rotateBy/zoomBy/isViewer`, `buildViewerA/B`, `drawViewer`, render-branch.
- `glenz/src/main.ts`: `mode`-state, `startDemo(mode)`, pointer/wheel-handlers, viewer-HUD, `R`=recenter in viewer.

### Codenaam
v0.8.x = **Wildfire** (Future Crew-lid). BUILD_PLAN Fase 6-tabel toevoegen.

## [0.7.0-Yost] — 2026-06-10

**Audio-architectuurwijziging (code oranje — design-impact, logische arch stabiel).** Na vijf debug-loops op het líve afspeelpad (subsong-keuze) bleef de muziek "ruk". De conclusie van loop #5+: het probleem is niet *welke* subsong, maar dát we live met subsongs werken. MUSIC1.S3M is **één doorlopend nummer**; de demo-parts synchroniseren eraan via de DIS (Demo Interrupt Server), ze zetten de muziekpositie niet. libopenmpt leest de 15 +++-skip-markers in de orderlist als 55 "subsongs", waardoor elk live `selectSubsong()`/repeat-pad het nummer óf fragmenteert tot 1–6 s stingers óf part-muziek mét tussenliggende SFX aan elkaar rijgt ("een paar goede noten, dan fax").

### Doorbraak: bak de GLENZ-sectie offline, speel als statische OGG
De +++-gedelimiteerde secties van MUSIC1 zijn: [0,2],[4,13],[15,18],[20,24],[26,26],[28,37],[39,40],[42,45],[47,48],**[50,60]**,[62,66],[68,75],[77,86],[88,91],[93,96],[98,98]. De GLENZ-techno = **orders 50–60** (22.5 s). Eenmalig offline lineair gerenderd (orderlist-stitch via een `decodeLinear`-pad in de chiptune3-worklet over net die order-range) en geëncodeerd naar Opus-in-Ogg. Gemeten spectrale vlakheid **0.0178 ≈ referentie 0.0168** (chroma 0.968) → gemeten als muziek, niet ruis. A/B-auditie (`dist/glenz/audition.html`) door gebruiker akkoord bevonden. `glenz/src/audio_sync.ts` speelt nu `audio/glenz_loop.ogg` gelooped via een `AudioBufferSourceNode(loop=true)` op de gedeelde AudioContext — de chiptune3/libopenmpt-afhankelijkheid is uit het runtime-pad verdwenen, de klok (ctx.currentTime − epoch) blijft identiek werken.

### Root Cause Analysis
- **Functioneel:** de luisteraar hoorde herkenbare part-muziek omslaan in "fax" omdat elk live-pad onvermijdelijk de SFX-stingers of fragment-grenzen meenam; geen enkele subsong-keuze kon dit oplossen want de aanname (1 subsong = 1 part-track) was fout.
- **Technisch:** MUSIC1.S3M = 1 song met 15 +++-sync-markers; libopenmpt's subsong-splitsing is een artefact van die markers, niet van de muziekstructuur. Live `selectSubsong()` is daardoor principieel ongeschikt. Fix: render orders 50–60 één keer lineair offline → statische OGG → `AudioBufferSource(loop)`. Deterministisch, geen WASM-/worklet-timing meer in het runtime-pad.
- **Architectonisch:** het runtime-systeem ging stochastisch om met een deterministisch te bepalen artefact (de juiste sectie). Vastgelegde les: wanneer de bron één keer correct te renderen is, **bak het en ship audio, geen player** — verplaats de onzekerheid van runtime naar build-time. Dit beëindigt de debug-loop-reeks GELUID #1–#5.

### Gewijzigd
- **`glenz/src/audio_sync.ts`**: chiptune3/`selectSubsong`-pad volledig vervangen door fetch → `decodeAudioData` → `AudioBufferSourceNode(loop=true)` op `audio/glenz_loop.ogg`. API (`start/setPaused/restart/toggleMute/currentTime/isStarted/isMuted/contextState/debugPeak`) en de AudioClock ongewijzigd.
- **`public/audio/glenz_loop.ogg`** (nieuw): pre-rendered GLENZ-loop, MUSIC1.S3M orders 50–60, Opus-in-Ogg.

## [0.6.9-Yodel] — 2026-06-10

**Debug-loop GELUID #5 (code superrood — conceptueel: verkeerde meetlat).** Na "code superrood: muziek is nog steeds ruk" (subsong 50 uit 0.6.8 klonk nog steeds rommel). De fout zat niet in het afspeelpad maar in de **discriminator** waarmee ik de juiste subsong koos.

### Doorbraak: spectrale vlakheid ontmaskert ss50, wijst naar ss8
0.6.8 koos ss50 op basis van LTAS/chroma-**cosine**-similariteit. Maar cosine-similariteit scheidt muziek niet van ruis — twee brede spectra lijken altijd "op elkaar". De eerlijke maat is **spectrale vlakheid** (Wiener-entropie): tonale muziek is laag, fax/ruis is hoog. Gemeten:

| bron | duur | flatness | oordeel |
|--|--|--|--|
| **referentie (GLENZ-capture)** | 54 s | **0.0168** | echte muziek |
| **ss8** | 18.4 s | **0.0147** | matcht referentie |
| ss49 | 13.5 s | 0.0616 | ~4× ruiziger |
| ss48 | 22.1 s | 0.0654 | ~4× ruiziger |
| ss50 (0.6.8-keuze) | 20.0 s | 0.0733 | ~4× ruiziger → "ruk" |
| ss54 | 18.6 s | 0.371 | ~ruis |

Alleen **ss8** ligt in dezelfde orde als de referentie; ss50 is 4× ruiziger — exact waarom het rommel klonk. GLENZ speelt nu subsong 8.

### Root Cause Analysis
- **Functioneel:** subsong 50 was geen muziek maar een ruizig segment; de luisteraar hoorde "ruk" omdat de gekozen track spectraal 4× dichter bij witte ruis lag dan bij de referentie-muziek.
- **Technisch:** de selectie-metriek (LTAS-/chroma-cosine) was ongevoelig voor het muziek-vs-ruis-onderscheid. Vervangen door spectrale vlakheid (geometrisch/aritmetisch gemiddelde van het machtsspectrum, mediaan over frames) — een directe tonaliteits-maat. Default `GLENZ_SUBSONG` 50 → 8.
- **Architectonisch:** dit is dezelfde klasse fout als 0.6.6 (dichtheid/crest "bewees" muziek). **Les vastgelegd:** een similariteits-/dichtheids-statistiek mag nóóit dienen als "is-dit-muziek"-beslisser; gebruik een entropie-/vlakheids-maat tegen een referentie. Twee opeenvolgende loops faalden op precies deze verwarring — de meetlat, niet het afspeelpad.

### Gewijzigd
- **`glenz/src/audio_sync.ts`**: `GLENZ_SUBSONG` 50 → 8; doc-comment herschreven naar de flatness-onderbouwing.

## [0.6.8-Yodel] — 2026-06-10

**Debug-loop GELUID #4 (code geel — logische architectuur).** Na "audio debug: nog steeds niet goed. er lijken een paar noten te kloppen maar al gauw weer een fax achtig geluid." De zin **"een paar noten kloppen, dan fax"** was beslissend: de module is goed (0.6.6 bevestigd MUSIC1.S3M = dichte muziek), maar het afspeelpad chaint te veel. Nieuwe invalshoek: meet níét de module-dichtheid (die maakt muziek en ruis niet onderscheidbaar — beide dicht/lage crest, de fout van 0.6.6) maar décodeer elke subsong apart en match spectraal tegen de referentie-audio.

### Doorbraak: MUSIC1.S3M is 55 subsongs, niet 1
De orderlist van "UnreaL ][ / PM" is door end/skip-markers in **55 subsongs** geknipt — één per demo-part plus tientallen 1–6 s stingers/SFX. De originele STMIK-speler springt per part naar een specifieke order; libopenmpt legt die segmenten als subsongs bloot. `selectSubsong(-1)` chaint **alle 55** (part-muziek + SFX) achter elkaar → "een paar goede noten, dan fax". Van de vijf lange muzikale subsongs (8, 48, 49, 50, 54) rankt spectrale match (LTAS + chroma + helderheid) tegen de GLENZ-referentie **#50 hoogst** (centroid 2395 vs ref 2311 Hz, score 0.907). GLENZ speelt nu subsong 50, gelooped via `setRepeatCount(-1)` — niet de -1-amalgaam.

### Root Cause Analysis
- **Functioneel:** de muziek begon herkenbaar (eerste subsong = echte part-muziek) en sloeg dan om in "fax" zodra de keten bij de korte SFX-stingers aankwam. De gebruiker hoorde precies de overgang part-muziek → SFX-amalgaam.
- **Technisch:** `selectSubsong(-1)` betekent in libopenmpt "speel ALLE subsongs in volgorde". Voor een module met 1 song is dat onschuldig; voor MUSIC1 (55 segmenten waarvan ~50 SFX) is het de bron van de ruis. Fix: `selectSubsong(GLENZ_SUBSONG=50)` + `?subsong=N`-override voor live-auditie zonder redeploy.
- **Architectonisch:** de 0.6.6-"bewijslijn" (dichtheid/crest toont muziek) was ongeldig — witte ruis/fax is óók dicht met lage crest, dus dichtheid onderscheidt muziek niet van ruis. Les: gebruik een **spectrale** vingerafdruk (LTAS/chroma/centroid) tegen een referentie, niet een amplitude-statistiek, om "is dit muziek" te beslissen. De juiste subsong blijft luister-grondwaarheid van de gebruiker (kandidaten 49/48/8/54 staan klaar via `?subsong=`).

### Gewijzigd
- **`glenz/src/audio_sync.ts`**: `const GLENZ_SUBSONG = 50`; `selectSubsong(-1)` → `selectSubsong(sub)` met `?subsong=N`-override + `console.info` van de gekozen subsong.

## [0.6.7-Yodel] — 2026-06-10

**Debug super-deep-dive GRAPHICS (code geel — logische architectuur) + AUDIO-bevestiging.** Na "kleuren komen nog niet helemaal overeen met origineel" + "graphics van origineel zijn kleiner en fijner. kleinere polygoon bal 'stuitert' echt in origineel, verkleint en vergoot nu alleen". Methode: gouden-frame-vergelijking via `?frame=N` (deterministische preview) tegen 17 referentieframes uit de YouTube-capture (1:44–2:34), met numerieke kleur-/bbox-histogrammen (PIL/numpy) i.p.v. op het oog.

### Audio — bevestigd correct, géén wijziging
De globale source nageslagen: `SecondReality_source/SCRIPT` regel 90 "(music) Teknomaista trackkiä" staat direct vóór regel 92 "PSI Glenz part" → GLENZ draait onder de **techno-track**. `MAIN/STARTMUS.C` toont `reality.fc` index 1 = `MUSIC1.S3M`, ingebedde naam "UnreaL ][ / PM" (Purple Motion). De 0.6.6-keuze (MUSIC1 + `selectSubsong(-1)`) is dus de juiste module. De per-positie DIS-sync (exacte order-marker per part) is zonder de order-tabel niet reproduceerbaar; `selectSubsong(-1)` blijft de getrouwe benadering. Conclusie: "iets anders maar niet veel beter" = correcte module, inherente sync-limiet — bewust niet verder aan het afspeelpad gedraaid.

### Graphics — drie meetbaar bevestigde afwijkingen, gecorrigeerd

| Aspect | Origineel (gemeten) | Was (0.6.6) | Nu (0.6.7) |
|--|--|--|--|
| Rode-schil-cluster | (121, 11, 2) diep | (151, 20, 17) te fel | (126, 23, 28) |
| Object-bbox breedte | 77–82% (zwarte marge) | rand-clip | 78–83% |
| Inner-blauw-cluster | (76, 57, 93) gedempt | (95, 73, 100) roze-uitwas | (85, 57, 87) |

### Root Cause Analysis
- **Functioneel:** (1) kleuren weken af → de inner-bal waste uit naar fel roze/wit i.p.v. gedempt blauw te blijven, en het rood was te licht/verzadigd; (2) "stuitert niet" → object B (rode schil) was in 0.6.6 vastgepind op het centrum van object A, waardoor de onafhankelijke off-center drift (de zichtbare "stuiter") wegviel; (3) "kleiner en fijner" → het object raakte de schermrand i.p.v. de zwarte marge van het origineel.
- **Technisch:** vier hefbomen. (a) **Per-driehoek twee-toon** hersteld via de bestaande `Tri.code & 2`-toggle (A = blauw/grijs-wit, B = rood/donkerrood) i.p.v. één vlakke tint per object; tint-groen verlaagd zodat de inner G≈57 matcht. (b) **Additive shade** verlaagd van `(0.38+0.22·facing)` → `(0.26+0.15·facing)` zodat 2–4 overlappende glas-facetten niet doorschieten naar wit (rood 151→126, dieper rood, minder uitwas). (c) **Onafhankelijke object-B-translatie** hersteld (`MAIN.C:633`: `oxb/oyb/ozb` sin1024-drift) zodat de binnenbal weer off-center zwerft. (d) **Z_POS** 7500→7100 (camera-pull) zodat de projectie 78–83% breed wordt met zwarte marge i.p.v. de rand te raken.
- **Architectonisch:** de eerdere "scale klopt al"-aanname kwam uit een **vervuilde meting** — de bbox-detector telde de vloer (volle breedte) als object. Les: meet het object geïsoleerd (sterk-gekleurde pixels, vloer-mauve uitsluiten) vóór een scale-conclusie. De resterende groen/blauw-bleed in het rood (23/28 vs 11/2) is het **inherente verschil tussen channel-additive blending en de originele palette-OR** — binnen het "modern reinterpretatie"-mandaat geaccepteerd; rood-niveau en objectgrootte matchen nu wel.

### Gewijzigd
- **`glenz/src/glenz_data.ts`**: twee-toon-tints per object (`TINT_A_BLUE/WHITE`, `TINT_B_RED/RED_DARK`), inner-groen verlaagd; vloer iets opgehelderd.
- **`glenz/src/glenz_renderer.ts`**: `ObjectState` heeft `tintPrimary`+`tintSecondary`; per-driehoek tint-selectie via `code & 2`; vlakkere/donkerdere additive shade.
- **`glenz/src/glenz_core.ts`**: object B gebruikt weer eigen `oxb/oyb/ozb`-translatie (off-center stuiter); `Z_POS` 7500→7100.

## [0.6.6-Yodel] — 2026-06-09

**Debug-loop GELUID #3 (code rood + loop) — corrigeert 0.6.4 én 0.6.5.** Na "nog steeds exact dezelfde hakkerige, niet definieerbare pierige geluids effecten, geen determineerbar muziek". Het woord **"exact dezelfde"** (invariant onder élke wijziging: subsong 13 → geen subsong → plain play) was het beslissende signaal: de fout zit níét in subsong-selectie maar in de **gespeelde module zelf**. Nieuwe invalshoek (loop): stop met aan het afspeelpad draaien, meet de **inhoud** van beide Second Reality-modules naast elkaar met het throttle-immune `decodeAll`-grondwaarheidpad.

### Doorbraak: verkeerde module
Naast elkaar gemeten (offline `decodeAll`, `select_subsong(-1)` = alle subsongs continu, dichtheid over de hele track):

| Module | titel | duur | duty | crest-factor | oordeel |
|--|--|--|--|--|--|
| **MUSIC0.S3M** (was in gebruik) | "UnreaL ][ - The 2ND Reality" | 954 s | **19 %** | **33.9** | sparse transients + 141 s stilte — onbruikbaar |
| **MUSIC1.S3M** (nu in gebruik) | "UnreaL ][ / PM" (Purple Motion) | 211.9 s | **79 %** | 12.2 | dichte, doorlopende, herkenbare muziek |

MUSIC0's libopenmpt-default subsong is een **2,2 s stub** die plain `repeat=-1` eindeloos loopt → exact de gemelde "hakkerige pierige bleeps". Géén van de 17 subsongs van MUSIC0 is dicht (max RMS 0,039, crest ~27). MUSIC1 daarentegen geeft onder `selectSubsong(-1)` een coherente 3,5-minuten song (crest 12 = echte muziek).

### Root Cause Analysis
- **Functioneel:** de gebruiker hoorde bleeps i.p.v. muziek, onveranderlijk bij élke subsong-wijziging. Oorzaak: GLENZ speelde **MUSIC0.S3M**, een module die door libopenmpt als sparse transients/stilte wordt weergegeven, ongeacht subsong of afspeelmodus. De iconische, herkenbare Second Reality-track staat in **MUSIC1.S3M** (Purple Motion).
- **Technisch:** twee gekoppelde fouten. (1) Verkeerd bestand: `MUSIC0.S3M` → `MUSIC1.S3M`. (2) Een kale module-load speelt alleen **subsong 0** (een kort fragment van 2-5 s); de volledige song vereist `selectSubsong(-1)` ná het laden (= alle subsongs in volgorde, daarna loop met `repeatCount(-1)`). De 0.6.5-conclusie ("plain play = fix") was óók fout omdat hij subsong 0 van de verkeerde module bleef loopen.
- **Architectonisch:** de aanname "ASM2Web werkt met MUSIC0, dus MUSIC0 is goed" was een **niet-geverifieerde referentie** — ASM2Web's audio was nooit op het oor bevestigd; de byte-identieke vendoring bewijst alleen dat de decoder gelijk is, niet dat de geluidsinhoud klopt. Les: verifieer de referentie zélf (meet de inhoud) i.p.v. erop te vertrouwen. Het "modern reinterpretatie"-mandaat staat toe de herkenbare track (MUSIC1) te kiezen boven een sparse alternatief.

### Gewijzigd
- **`glenz/src/audio_sync.ts`**: module `MUSIC0.S3M` → **`MUSIC1.S3M`** (load + restart); `onMetadata` roept nu **`selectSubsong(-1)`** aan (alle subsongs continu) vóór het vrijgeven van de visuele klok; `selectSubsong(n)` aan de `ChiptunePlayer`-interface toegevoegd.
- **`public/audio/MUSIC1.S3M`**: toegevoegd (600 860 bytes, uit `SecondReality_source/MAIN/`, SHA256 `3393f848a484…`).

### Verificatie
- Throttle-immuun `decodeAll` naast-elkaar: MUSIC0 19 % duty / crest 34 vs MUSIC1 79 % duty / crest 12 (tabel hierboven).
- End-to-end op de echte GLENZ-pagina (live streaming-pad): **19/24 vensters hoorbaar**, doorlopend geluid, maxPeak 0,101, muziekklok loopt synchroon (11,6 s), géén resource-404's.
- Build groen + live deploy HC55.

## [0.6.5-Yodel] — 2026-06-09 *(ACHTERHAALD — zie 0.6.6: plain play loopte nog steeds subsong 0 van de verkeerde module MUSIC0)*

**Debug-loop GELUID #2 (code rood) — corrigeert 0.6.4.** De 0.6.4-theorie ("kies subsong 13") is met throttle-immune metingen **weerlegd**. Het selecteren van een subsong was niet de oplossing maar **de oorzaak** van de hardnekkige stilte. Dit verklaart "geen verbetering sinds eerste melding": elke eerdere poging draaide aan dezelfde knop (wélke subsong), terwijl het draaien zélf de breuk was.

### Doorbraak in meetmethode
Real-time browser-metingen (`AnalyserNode`-snapshot, `ScriptProcessorNode`, én `MediaRecorder`) zijn in headless Chrome **allemaal onbetrouwbaar**: zodra de pagina idle wordt throttelt de audio-thread → progressieve afname naar stilte (`[51,32,14,0,0,0]` over 60 s). Dat is een meet-artefact, geen module-inhoud. Alleen `decodeAll` (libopenmpt synchrone tight-loop decode, géén real-time scheduling) is **throttle-immuun grondwaarheid**.

### Root Cause Analysis
- **Functioneel:** de muziek bleef grotendeels stil. Niet door kapotte routing, maar doordat de player na laden naar **subsong 13** sprong — een gebied dat per `decodeAll`-grondwaarheid slechts **13% duty** heeft met een **aaneengesloten stilte van ~141 s**. De luisteraar hoorde dus vooral stilte.
- **Technisch:** `selectSubsong(n)` zet libopenmpt op de orderrange van één subsong. Grondwaarheid per subsong (offline `decodeAll`, langste stilte): `0`→0,7 s · `4`→1,5 s · `7`→6,2 s · `12`→14,2 s · `13`→**140,9 s**. Élke subsong in isolatie is sparse. De juiste weergave is **plain lineair afspelen met `repeatCount(-1)`**: libopenmpt speelt dan dwárs door de `0xFF`/`0xFE`-ordermarkers heen — de hele track continu, daarna loop. Dit is exact wat het wél-werkende zusterproject **ASM2Web** doet (`new ChiptuneJsPlayer({context, repeatCount:-1})` + `play(ab)`, géén `selectSubsong`).
- **Architectonisch:** een werkende referentie-implementatie (ASM2Web, zelfde `MUSIC0.S3M`, zelfde chiptune3) is sterker bewijs dan een afgeleide theorie. De fout was een **eigen toevoeging** (`selectSubsong`/`setPos`) bovenop een correcte basis. Determinisme-les: meet met een methode die immuun is voor de runtime-omgeving (offline decode), niet met real-time sampling dat door headless-throttling wordt vervuild.

### Gewijzigd
- **`glenz/src/audio_sync.ts`**: `selectSubsong(GLENZ_SUBSONG)` + `setPos(0)` **verwijderd**; `onMetadata` geeft nu enkel de visuele klok vrij. Plain afspelen met `setRepeatCount(-1)` zoals ASM2Web. `selectSubsong`/`setPos` uit de `ChiptunePlayer`-interface; `subsongSelected` → `clockReleased`.
- **`public/chiptune3/chiptune3.worklet.js`**: tijdelijk `decodeAll`-probe-patch (subsong-injectie t.b.v. grondwaarheid) **teruggedraaid** naar origineel.

### Verificatie
- Throttle-immuun `decodeAll` per subsong gaf de doorslaggevende duty/gap-tabel hierboven.
- Build groen + live deploy HC55 met plain-playback.

## [0.6.4-Yodel] — 2026-06-09 *(ACHTERHAALD — zie 0.6.5)*

**Debug-loop GELUID (code rood)** — na "deep dive op audio. geen verbetering sinds eerste melding". Al mijn eerdere audio-fixes betroffen de **routing** (gedeelde `AudioContext`, `gain.connect`) — maar het probleem zat in de **inhoud**. Empirisch ontrafeld met Playwright-probes die de `AnalyserNode`-peak over tijd bemonsteren én libopenmpt rechtstreeks bevragen.

### Root Cause Analysis
- **Functioneel:** de muziek stotterde — ~0,5 s geluid per ~2 s, rest stilte — en bleef onveranderd sinds de eerste melding. Het was geen kapotte routing maar een **2,12 s fragment dat eindeloos loopte**.
- **Technisch:** `MUSIC0.S3M` ("UnreaL ][ - The 2ND Reality") is een geldige ScreamTracker-3 module (80 orders, 77 patterns, 44 instrumenten), maar de orderlist gebruikt `0xFF`/`0xFE` end/skip-markers. libopenmpt splitst die in **17 subsongs**; de **default subsong 0 is slechts 2,12 s** (een sparse intro-stinger, ~halve stilte). De player speelde dus subsong 0 op repeat. Per-subsong duur gemeten (s): `[2.12, 0.8, 0.24, 0.12, 21.94, 5.28, 0.12, 35.46, 7.92, 15.36, 0.48, 7.84, 156.86, 639.72, 29.36, 15.36, 15.36]`. **Subsong 13 (≈639 s) = de volledige, continue track.** Tweede, losse fout: de vendored worklet forceerde **Amiga-resampler-emulatie** (`emulate_amiga=a1200`) op een PC-S3M — verkeerd voor dit formaat.
- **Architectonisch:** alle eerdere fixes zaten op de verkeerde laag (audio-graph-routing) terwijl de fout in de **module-positie/subsong-selectie** zat. Determinisme-les: meet de daadwerkelijke audio-output (peak over tijd) i.p.v. één snapshot — één snapshot ving toevallig een burst (peak 0.181) en gaf vals "werkt".

### Gewijzigd
- **`audio_sync.ts`**: na het laden van de module (`onMetadata`) wordt nu **subsong 13** geselecteerd (`selectSubsong(13)` + `setPos(0)`) i.p.v. de 2,12 s subsong 0; `selectSubsong`/`setPos`/`onMetadata` aan de `ChiptunePlayer`-interface toegevoegd; `restart()` reset de selectie zodat de juiste subsong opnieuw wordt gekozen. De visuele klok wordt nu pas vrijgegeven bij `onMetadata` (wanneer de echte track klinkt).
- **`public/chiptune3/chiptune3.worklet.js`**: **Amiga-resampler-emulatie verwijderd** (S3M ≠ Amiga MOD) → faithful PC-ST3-weergave.

### Verificatie
- Per-subsong duur + continuïteit gemeten via Playwright + libopenmpt: subsong 13 levert **continue** peak (samples 27–79 alle ≠ 0, steady 0,06–0,23) vs subsong 0's burst/stilte.
- Lokaal + live opnieuw gemeten na de fix; live deploy naar HC55 met byte-/marker-verificatie.

## [0.6.3-Yodel] — 2026-06-09

**Debug-loop GLENZ #2 (render-stijl)** — na "nog steeds exact dezelfde problemen" + de aangeleverde **`SECOND_W32.EXE` + `REALITY.FC`** ("win32 gaat wel goed"). Twee oorzaken vastgesteld: (a) de 0.6.2-fixes stonden **nog niet live** (`glenz/` untracked; HC55-mirror draaide op `dist-hc55` van 17:12, vóór de fixes), en (b) de render-**stijl** was alsnog fout. Beslissende vergelijking: huidige build deterministisch gescreenshot (`?frame=300/600/1000`) náást de echte video-frames (`/tmp/sr_f30/f40/f52.png`).

### Root Cause Analysis
- **Functioneel:** de objecten werden als plat **horregaas (50%-stippel)** getekend en het binnen-object waste weg naar **roze/wit** — terwijl de echte glenz **massieve, gefacetteerde glasvlakken** toont die additief overlappen (sr_f52: rode spike-kubus met losse driehoek-facetten + blauw/paars genest binnen-object). De vloer was bovendien te fel.
- **Technisch:** (1) per-object **checkerboard-dither** in `fillTriangle` maakte een screen-door-textuur i.p.v. solide spans — in strijd met `NEW.ASM`, dat solide spans vult en via `or ah,fs:[di]` (palette-OR) combineert; (2) `shade = (0.24+0.46·facing)·1.85` was te hoog → additieve overlap clipte naar wit; (3) `FLOOR_LIGHT/DARK` te helder.
- **Architectonisch:** de translucentie is een **eigenschap van de overlappende massieve facetten** (additieve kleur-som), geen aparte pixel-textuur. Door de stippel als "transparantie" te modelleren werd het verkeerde mechanisme nagebootst. Tevens: een fix die niet gedeployd is, is voor de gebruiker niet-bestaand — deploy hoort bij "klaar".

### Gewijzigd
- **`glenz_renderer.ts`**: `STIPPLE_BOOST` + de 50%-dither **verwijderd** — `fillTriangle` vult nu **solide additieve spans** (palette-OR-equivalent); `shade = (0.1 + 0.3·facing)·fade` zodat 2–4 overlappende facetten een rijke gradient opbouwen zonder naar wit te clippen; `stipplePhase` uit de `ObjectState`-interface
- **`glenz_data.ts`**: `FLOOR_DARK`/`FLOOR_LIGHT` gedimd ([24,18,30]/[54,44,64]) → subtiele donker-paarse vloerstrip i.p.v. felle checker
- **`glenz_core.ts`**: `stipplePhase`-velden uit `buildStateA`/`buildStateB`

### Verifieerd
- `tsc -b` + `vite build` groen
- **Visueel** (deterministisch, nieuwe build): frame 600 = gefacetteerd blauw glas boven subtiele vloer (≈ sr_f40); frame 1000 = rode spike-kubus met genest blauw/paars binnen-object, additieve facet-gradient, geen wit-clip (≈ sr_f52)
- **Audio** (headless, echte autoplay): `contextState=running`, `debugPeak=0.18`, MUSIC0.S3M + chiptune3.js → 200
- **Bron-grondwaarheid bevestigd** in `SecondReality_source/GLENZ/MAIN.C`: twee spike-kubussen (`points`/`epolys` genest in `pointsb`/`epolysb`), additieve OR-fill in `NEW.ASM`

## [0.6.2-Yodel] — 2026-06-09

**Debug-loop GLENZ (nieuwe invalshoek)** — na "kleuren kloppen nog niet, schaakbord is er nog niet, geluid is nog stuk" bleken de 0.6.1-fixes verkeerd geijkt. Grondwaarheid opnieuw bepaald: de YouTube-referentie (1:46–2:33) is geëxtraheerd tot frames (`/tmp/sr_f*.png`) en pixel-voor-pixel geïnspecteerd. **Loop-bugfix**: bron losgelaten als enige waarheid waar die afweek van het werkelijk gerenderde beeld.

### Root Cause Analysis
- **Functioneel:** (1) "schaakbord" = een **paars perspectief-grondvlak** (scene-achtergrond, frame 2:05), géén stipple óp de objecten — die had ik 0.6.1 verkeerd geïnterpreteerd; (2) kleuren = **rood buiten-object + blauw binnen-object** (frame 2:27), niet violet/wit glas; (3) geluid bleef stil; (4) nesting moest behouden blijven.
- **Technisch:** (1) géén vloer in de pijplijn → zwarte achtergrond; (2) per-`Tri` 2-tint blauw/wit i.p.v. per-**object** kleur; (3) **`chiptune3` maakte een eigen `AudioContext`** (`config.context=false`) die door de autoplay-policy *suspended* bleef en nooit hervat werd → stilte; de visuele klok-context werd wél hervat, wat de "klok loopt maar geen geluid"-illusie gaf; (4) object B gebruikte eigen `oxb/oyb/ozb`-drift → kon uit A lopen.
- **Architectonisch:** voor een *moderne reinterpretatie* is de gerenderde video de grondwaarheid waar de bron-`bgpic` (FC-logo zoomer) daarvan afwijkt; de scene-compositie (vloer → genest object-paar) hoort expliciet in de render-pijplijn, niet impliciet uit de bron afgeleid.

### Gewijzigd
- **`glenz_data.ts`**: `tintForCode`/`GLENZ_TINT_*` vervangen door per-object `TINT_INNER_BLUE`/`TINT_OUTER_RED`; nieuw `FLOOR_Y`/`FLOOR_TILE`/`FLOOR_DARK`/`FLOOR_LIGHT` voor het grondvlak
- **`glenz_renderer.ts`**: nieuwe `drawFloor()` — perspectief-schaakbord via ray-cast op wereldvlak `Y=FLOOR_Y` (twee mauve tinten, depth-fade naar de horizon); per-object 50%-stipple met **tegengestelde fase** (blauw vs rood interleaven → paars op overlap, niet wit); `drawTri` gebruikt `s.tint`
- **`vga.ts`**: `setPixel()` (opaque) voor de vloer-achtergrond, naast `addPixel()` (additief) voor de glenz
- **`glenz_core.ts`**: `buildStateA` tint blauw + `stipplePhase 0`; `buildStateB` tint rood + `stipplePhase 1` + **gedeeld centrum met A** (`oxp/oyp/ozp`) zodat blauw genest blijft binnen rood; `draw()` tekent vloer vóór objecten; nieuw `renderAtFrame()` voor deterministische golden-frame screenshots
- **`audio_sync.ts`**: **gedeelde, reeds-hervatte context** doorgegeven aan de player (`new Player({ context: this.ctx })`) + `gain.connect(ctx.destination)` → geluid stroomt écht; `debugPeak()`/`contextState` voor headless verificatie
- **`main.ts`**: `?frame=N` deterministische preview + `__audio`/`__core` debug-handles

### Verifieerd
- `tsc -b` schoon; `vite build` groen
- **Visueel** (deterministische `?frame`-screenshots vs. video-frames): frame 600 = blauw glenz boven schaakbord (≈ sr_f40); frame 1000 = rood buiten + genest binnen-object (≈ sr_f52); schaakbord-vloer in perspectief aanwezig op alle frames
- **Audio** (headless, echte autoplay-condities, géén override): `contextState=running`, **`debugPeak=0.18`** (echt gedecodeerd signaal, niet alleen de klok); live run `mframe 612 · 60 fps` = audio-gedreven sim loopt
- Resterende 404's komen uit libopenmpt's interne wasm-fallback-probe (valt terug op de embedded JS-build) — niet-fataal, audio decodeert

## [0.6.1-Yodel] — 2026-06-09

**Deep-debug GLENZ** — vier defecten t.o.v. het origineel (YouTube-referentie 1:46–2:33) verholpen. **Gele bugfix** (out-of-physical-box): de display-mapping-laag met fudge-constanten (`POS_DIV`/`CAM_BASE`/`OBJ_SCALE`/`SCALE_REF`/`Y_OFFSET`/`FX`/`FY`/`Z_MIN`) is vervangen door **faithful world-units + de echte projectie-constanten** — een logische-architectuur-correctie, geen fysiek lapje.

### Root Cause Analysis
- **Functioneel:** kleuren waren een RGB/CMY-regenboog; het schaakbord (glenz-transparantie) ontbrak; geluid liep vóór op de muziek; het 2e object dreef weg i.p.v. concentrisch genest te blijven.
- **Technisch:** (1) `GROUP_COLOR` regenboog i.p.v. de violette `backpal` + `test bp,2`-tintsplitsing uit `VEC.ASM demo_glz`; (2) additieve smooth-fill zonder de canonieke 50%-stipple; (3) visuele klok-epoch gezet bij `AudioContext`-creatie (vóór WASM-init + S3M-load) → visuals racen vooruit; (4) beide objecten genormaliseerd op kubus=1.0 + losse fudge-schalingen → echte grootteverhouding verbroken → drift.
- **Architectonisch:** de reconstructie projecteerde in een verzonnen view-ruimte i.p.v. de bron-coördinatenruimte; daardoor moest elke plaatsing met de hand bijgesteld worden en klopte de objectrelatie nooit structureel.

### Gewijzigd
- **`glenz_data.ts`**: `OBJECT_A = buildVerts(5000, 8500)`, `OBJECT_B = buildVerts(5940, 10395)` (echte world-units uit `MAIN.C` ZZZ=50/QQQ=99); per-`Tri` `code` (epolys `0x4002+2*i`, epolysb `0x4004/0x4002` tegenfase); `GROUP_COLOR`-regenboog vervangen door `GLENZ_TINT_BLUE`/`GLENZ_TINT_WHITE` + `tintForCode(code&2)` (violet glas vs witte highlight, conform `backpal`/`demo_glz`)
- **`glenz_renderer.ts`**: faithful projectie `sx = X*256/Z + 160`, `sy = Y*213/Z + 130`, Z-clamp 128 (constanten i.p.v. `FX`/`FY`/`Z_MIN`); tint per `code&2`; **50% screen-aligned schaakbord-stipple** `((x+parity)&1)` met helderheids-boost ×1.8
- **`glenz_core.ts`**: faithful transforms — `scale*64/32768` (`VEC.ASM rotlist`), translatie naar world `(oxp, ypos+1500+oyp, ozp)` met `camDist = 7500`; alle fudge-constanten verwijderd
- **`audio_sync.ts`**: visuele klok-epoch + `clockStarted` pas gezet in `onInitialized` (bij `load()`), niet bij `ctx`-creatie; `currentTime()` geeft 0 tot de module geladen is → visuals wachten op frame 0 tot de muziek echt klinkt (faithful aan `while(dis_musplus()<-19); dis_setmframe(0)`)

### Verifieerd
- `tsc -b` schoon; geen overgebleven verwijzingen naar verwijderde fudge-constanten
- **Headless Playwright (echte browser)**: 0 page-errors; geen 404 op assets (S3M + chiptune3 + libopenmpt 200); `mframe` loopt pas op ná worklet-init (audio-gate bewezen)
- **Visueel bevestigd** via screenshots: violet/wit glas met zichtbaar schaakbord (mframe 352/636); beide objecten concentrisch genest zonder drift, B omsluit A (mframe 1019)
- **Te bevestigen tegen video:** de schaakbord-interpretatie (canonieke glenz-transparantie-stipple) — headless niet met zekerheid te toetsen

## [0.6.0-Yodel] — 2026-06-09

Nieuw **standalone GLENZ-subsysteem** (`glenz/`): een browser-native *semantische* reconstructie van GLENZ.EXE — de translucente roterende glenz-vector die van bovenaf invalt en bij inslag squasht, op de echte `MUSIC0.S3M` (Skaven). Oranje bump (+0.1.0 — nieuw subsysteem met design-impact; bestaande WebGL-demo blijft ongemoeid).

### Waarom een apart subsysteem, geen scene in de WebGL-timeline
De gevraagde aanpak (YAML-spec: Canvas-2D software-rasteriser + indexed 320×200 framebuffer + DIS-shim + audio-locked clock) is een **semantische port van `MAIN.C`/`VEC.ASM`**, een andere stack dan de WebGL2-scenes. Daarom als losse Vite multi-page app onder `glenz/`, met eigen entry, naast de bestaande demo.

### Toegevoegd
- **`glenz/src/glenz_data.ts`**: object-verts/tris (kubus + 6 as-tip-piramides = spiked glenz, 24 tris in 6 kleurgroepen), `sin1024`-tabel (amplitude 256), projectie-constanten (213/256 VGA-aspect), R/G/B/Y/C/M groepskleuren, OBJECT_A/B
- **`glenz/src/vga.ts`**: mode-13h-model — indexed `Uint8Array(320×200)` + 6-bit palette + additieve RGBA-presentatie, nearest-neighbour pixelated blit
- **`glenz/src/glenz_renderer.ts`**: software-rasteriser — rotate/scale (R=Ry·Rx·Rz) + perspectief-projectie + additieve scanline triangle-fill, geen back-face cull (beide glaszijden tonen), facing-shading `|n·view|`
- **`glenz/src/dis_shim.ts`**: DIS-stand-in — music-frame uit de audio-clock, non-blocking `waitb`, copper-callback-slot
- **`glenz/src/audio_sync.ts`**: chiptune3 + libopenmpt playback; `AudioContext.currentTime` als master-clock (visuals audio-locked, nooit desync)
- **`glenz/src/glenz_core.ts`**: sim-port van `MAIN.C:273-648` — rotatie (rx+=32/ry+=7), drop/bounce/jello-fysica (ypos −9000 → bounce → settle −2800), scale-puls, tweede pointier glenz fade-in vanaf frame 800, secundaire beweging via `sin1024`, naadloze sequence-loop
- **`glenz/src/main.ts`**: wiring + rAF-loop + input (start/pause/restart/mute/HUD) + DPR-aware pixelated canvas
- **`glenz/index.html`** + **`glenz/README.md`** (run-instructies + lijst van geapproximeerde routines)

### Gewijzigd
- `vite.config.ts`: rollup multi-page input (`main` + `glenz`)
- `tsconfig.json`: include `glenz/src`

### Verifieerd
- `tsc -b` schoon; `npm run build` groen (28 modules, `glenz` chunk 9.61 KB / 4.13 KB gzip)
- **Headless Playwright smoke-test (echte browser)**: 0 console/page-errors; HUD telt `mframe` op exact 70 Hz uit de audio-clock (audio-locked bewezen); ~31% niet-zwarte pixels met `maxLum 765` (verzadigde additieve overlap = glenz-translucentie werkt); 60 fps
- **Visueel bevestigd** via screenshots: drop-in van bovenaf (mframe 125) + gecentreerde gesettelde spiked glenz (mframe 768) met doorkijk door beide glasschillen, alle 6 as-piramides zichtbaar
- `Y_OFFSET` live-getuned (1500→2300) zodat gesettelde object centreert

### Buiten scope (fase 2)
FC-logo intro (`zoomer`/`zoomer2`), DOS palette-fades, music-cue-sync — achtergrond blijft zwart.

## [0.5.1-PurpleMotion] — 2026-06-07

Vijfde scene: **WATER** (tribute via fragment-shader). Patch-level bump (Groen — alleen toevoegen, geen design-impact).

### Waarom dit een tribute is, geen exacte decompile
Origineel WATER (`SecondReality_source/WATER/`) is **pre-rendered POV-Ray** (1.x/2.x) + Pascal playback. De `.POV` scripts (AA, KK, FISH13) renderden vooraf alle scene-frames als bitmaps; Pascal deed dan water-bump op die plaatjes. Een runtime-procedureel original bestaat niet — daarom een fragment-shader hommage in de geest van het effect.

### Toegevoegd
- **`decomp/water/ASM_NOTES.md`**: source-stack-overzicht (Pascal + POV-Ray + LBM + asm routines), POV-Ray-snippet uit `AA.POV`, expliciete "tribute"-rationale, mapping naar moderne fragment-shader
- **`decomp/water/port.vert/frag`** + **`port.ts`** stub
- **`src/scenes/water.ts`**: fullscreen-quad fragment-shader met fbm-noise, caustic-light (`pow(sin(...), 4.0)`), onderwater-blauw mix, sin-glint specula, vignet
- `src/main.ts`: timeline = ... TUNNELI → **WATER (10s)** → ALKU

### Verifieerd
- `npx tsc --noEmit` schoon
- `npm run build`: 19 modules, **20.59 KB JS / 7.26 KB gzip**
- **Visuele verificatie pending**: bewegende onderwater-blauwe scene met heldere caustic-lichtbundels en spiculae

## [0.5.0-PurpleMotion] — 2026-06-07

Vierde scene: **TUNNELI** (pipe-snake). Begin van fase 5 scene-uitbreiding.

### Correctie op BUILD_PLAN.md
TUNNELI is **niet** een first-person tunnel-fly-through. Source-vondst in `TUNNELI/TUN10.PAS` toont een **3D pipe-snake** ("putki" = Fins voor pipe): 103 ringen langs een Lissajous-pad, elk met 64 punten, in Turbo Pascal + inline x86 asm (heel ander stack dan de C/asm van GLENZ/DOTS). Onze port reproduceert het pipe-snake-idee, niet de first-person-tunnel.

### Toegevoegd
- **`decomp/tunneli/ASM_NOTES.md`**: source-vondst, datastructuren (`putki`, `pcalc`, `sade`), palette-init (grayscale + neon-groene leading edge), render-pipeline van inline asm, mapping-tabel
- **`decomp/tunneli/port.ts`**: `buildTunneliVertices()` — 80 ringen × 64 punten = 5120 vertices (single VBO), elke vertex bevat alleen `(ringIdx, pointIdx)`
- **`decomp/tunneli/port.vert/frag`**: vertex-shader berekent path-positie (Lissajous-center + sin-modulated radius), fragment-shader doet grayscale + groene leading-edge fade
- **`src/scenes/tunneli.ts`**: single draw-call `gl.POINTS` van 5120 vertices, additive blending, depth-test off

### Gewijzigd
- `src/main.ts`: timeline = STARFIELD → GLENZ → DOTS → **TUNNELI (12s)** → ALKU
- `index.html`: HUD-versie-string v0.5.0-PurpleMotion

### Verifieerd
- `npx tsc --noEmit` schoon
- `npm run build`: 18 modules, **18.76 KB JS / 6.78 KB gzip** (cold-start budget 150 KB)
- `npm run dev`: `src/scenes/tunneli.ts` + `decomp/tunneli/port.ts` 200
- **Visuele verificatie pending**: golvende grayscale pipe met groene "kop" die door 3D-ruimte beweegt

### Volgende — fase 5 vervolg
- v0.5.1: WATER (tribute, want origineel = pre-rendered POV-Ray)
- v0.5.2: LENS (lens-zoom / fisheye)
- v0.5.3: TWIST (twist-warp)
- v0.5.4: GRID (grid-warp)

## [0.4.0-Skaven] — 2026-06-07

Fase 4 — **audio is live**. De originele Second Reality soundtrack speelt nu in de browser.

### Toegevoegd
- **`public/audio/MUSIC0.S3M`** (382 KB) — originele tracker-module "UnreaL ][ - The 2ND Reality" door **Skaven** (Vesa Norilo) en **Purple Motion** (Jonne Valtonen), uit `SecondReality_source/MAIN/`. Licentie: Unlicense (public domain via SecondReality repo).
- **`public/chiptune3/`** (chiptune3.js + chiptune3.worklet.js + libopenmpt.worklet.js + LICENSE) — chiptune3 v0.8.7 wrapper rond libopenmpt voor S3M-playback via AudioWorklet. chiptune3 = MIT, libopenmpt = BSD. Bestanden los in `public/` zodat de browser de worklet's relative `import './libopenmpt.worklet.js'` zelf kan resolven (Vite bundelt geen AudioWorklet-modules recursief).
- **`src/engine/audio.ts`** volledig herschreven: `resume()` doet lazy dynamic `import()` van chiptune3 (BASE_URL-aware), op `onInitialized` zet repeat-count -1 + volume 0.45 + start playback van MUSIC0.S3M
- **`src/engine/input.ts`**: `M` toggle mute (kbd only voor v0.4.0; touch-toggle volgt later)
- **`src/engine/hud.ts`**: `♪` indicator + `♪ muted` als mute aan
- **`src/main.ts`**: audio pause/unpause synct met timeline pause
- **`src/vite-env.d.ts`**: types voor `import.meta.env.BASE_URL`

### Niet (parkeren voor v0.4.x)
- Per-channel events naar shader-uniforms (drum-hit triggert scene-flash)
- Timeline-sync op tracker-positie i.p.v. wall clock
- Volume-slider in HUD (alleen mute-toggle voor nu)
- MUSIC1.S3M alternatief / track-switcher

### Verifieerd
- `npx tsc --noEmit` schoon
- `npm run build`: 16 modules, **16.40 KB JS / 6.26 KB gzip** (worklet + S3M lazy-loaded, niet in cold-start budget)
- `npm run dev`: alle endpoints 200 (chiptune3/*, audio/MUSIC0.S3M)
- **Visuele/auditieve verificatie pending — gebruiker:** browser openen, tap canvas → S3M speelt af in loop; HUD toont `♪` na metadata-load; `M`-toets toggleert mute → `♪ muted`; pause via long-press of Esc pauzeert ook tracker.

### Credits
- **Skaven** (Vesa Norilo) & **Purple Motion** (Jonne Valtonen) — muziek (1993)
- **Future Crew** — origineel, Unlicense
- **chiptune3** door DrSnuggles + **libopenmpt** door OpenMPT-team — playback (MIT/BSD)

## [0.3.0-Pixel] — 2026-06-07

Tweede hero-decompile: **DOTS** (fase 1+2 — Lissajous + cirkel-met-gravity).

### Toegevoegd
- **`decomp/dots/ASM_NOTES.md`**: source-vondst in `MAIN.C`, alle 4 fases beschreven met formules, teal-cyan palet-init uitgelegd, `depthtable1-4[]` LUT mapping naar fragment-shader
- **`decomp/dots/port.ts`**: `DotState` (x,y,z,yadd), `initDots()` (512 dots), `emitLissajous()` + `emitCircleWithGravity()` emitters, `stepDots()` physics, `syncPositionBuffer()` voor instance-buffer
- **`decomp/dots/port.vert`** + **`port.frag`**: instanced point-sprite shader met perspective-correcte `gl_PointSize` en depth-shading
- **`src/scenes/dots.ts`**: VAO met instance-attribuut `a_dotPos` (DYNAMIC) + `a_colorBucket` (STATIC), 1 `drawArraysInstanced(POINTS, 0, 1, 512)` call per frame, langzame y-rotatie voor parallax
- Teal-cyan kleur-palet uit `cols[]` in `MAIN.C:72-76` letterlijk overgenomen (4 buckets: zwart/donker-teal/medium-teal/helder-teal)

### Gewijzigd
- `src/main.ts`: timeline = STARFIELD (8s) → GLENZ (10s) → **DOTS (12s)** → ALKU (3s)
- `index.html`: HUD-versie-string v0.3.0-Pixel

### Verifieerd
- `npx tsc --noEmit` schoon
- `npm run build`: 15 modules, **14.55 KB JS / 5.46 KB gzip** (cold-start budget 150 KB ruim onder)
- `npm run dev`: `src/scenes/dots.ts`, `decomp/dots/port.ts`, `src/main.ts` allen 200
- **Visuele verificatie pending**: 512 teal-cyan dots in Lissajous 3D-figuur (5s) → cirkel-formatie met opwaartse impuls en gravity-val (7s)

### Niet (parkeren voor v0.3.x)
- Fase 3 (spiraal, frame 900-1700)
- Fase 4 (random scatter, frame 1700-2360)
- Trails (per dot 4 vorige posities, vereist 4 extra instance-attribs + 4 extra draws)
- Palet-fade tussenscenes (overgang via timeline-fade is genoeg)
- Background-image compositing

## [0.2.0-Trug] — 2026-06-07

Eerste echte decompile-port: **GLENZ**.

### Toegevoegd
- **`decomp/glenz/ASM_NOTES.md`** (volledig): source-vondst in `SecondReality_source/GLENZ/MAINTRAN.C`, mesh-data (8v/12e/6f), palet-XOR-translucentie-truc uitgelegd, 1993→2026 mapping-tabel
- **`decomp/glenz/port.ts`**: vertex-data + GLENZ_FACES (6 faces met RGB+CMY kleuren letterlijk uit `0x04/08/10/20/40/80` palet-bit-codes) + mat4-helpers (perspective/translate/rotateX/Y/Z/multiply, geen extern dep)
- **`decomp/glenz/port.vert`** + **`port.frag`**: MVP + emissive `u_color × u_alpha`
- **`src/scenes/glenz.ts`**: VAO + indexed draw, 6 draw-calls (één per face-kleur), additive blending `gl.blendFunc(ONE, ONE)`, depth-test uit
- Rotatie: `ry≈0.855 rad/s, rz≈1.344 rad/s` — herrekening van 1993 `ry+=7, rz+=11` per frame @ 70Hz in tenths-of-degree

### Gewijzigd
- `src/main.ts`: GLENZ-scene tussen STARFIELD en ALKU; ALKU verkort van 4s naar 3s
- `index.html`: HUD-tekst versie-string `v0.2.0-Trug`

### Verifieerd
- `npx tsc --noEmit` schoon
- `npm run build`: 13 modules, **11.13 KB JS / 4.47 KB gzip** (cold-start budget 150 KB)
- `npm run dev`: `src/scenes/glenz.ts`, `decomp/glenz/port.ts`, `src/main.ts` allen 200
- **Visuele verificatie pending**: kleurige roterende kubus met additieve face-mixing (gebruiker checkt)

### Niet (uit scope v0.2.0)
- Pixel-perfect VGA palet-OR reproduceren (modern reinterpretatie via echte WebGL2 blending)
- Mode-X 320×240 non-square pixels
- Hidden-edge tracking (volgt eventueel in 0.2.x als wireframe-overlay)

## [0.1.0-Marvel] — 2026-06-07

Renderer-fundamenten + eerste echte scene. Bumpt naar 0.1.0 (Oranje — design-impact: scene-API stabiliseert rondom program-cache + fullscreen-quad helper).

### Toegevoegd
- **Renderer-wrapper:** program/shader-cache (key-based), `drawFullscreen()` met cached fullscreen-triangle VAO, `Framebuffer` helper voor toekomstige post-processing
- **HUD** (`src/engine/hud.ts`): DOM-overlay met FPS-teller + actieve scene-naam + paused-indicator, toggle met `H`
- **Input upgrade:** long-press (≥500ms) = pause, double-tap (≤280ms) = vorige scene, `Esc`/`Space` = pause, `→`/`Enter` = skip, `←` = back, `H` = HUD toggle
- **Timeline:** `paused` state + `back()` + `togglePause()`, scene-naam exposed via `currentName`
- **STARFIELD scene** (`src/scenes/starfield.ts`): procedural fragment-shader, drie parallax-lagen sterren met twinkle + vignet — vervangt placeholder `start.ts`
- **package-lock.json** + 11 deps geïnstalleerd (vite 5.4.21, typescript 5.6, esbuild, rollup, ...)

### Gewijzigd
- `main.ts`: registreert HUD, koppelt nieuwe input-callbacks aan timeline
- `src/scenes/start.ts` verwijderd (vervangen door STARFIELD)

### Verifieerd
- `npx tsc --noEmit` schoon
- `npm run build` slaagt — 11 modules, **8.34 KB JS / 3.49 KB gzip** (ruim onder 150 KB cold-start-budget)
- `npm run dev` op http://localhost:5173/DecompilingFutureCrew/ serveert HTML + alle module-endpoints met 200
- **Visuele verificatie pending**: GLSL-shader-correctheid niet getest in echte browser — actie voor gebruiker

## [0.0.1-PSi] — 2026-06-07

Skeleton.

### Toegevoegd
- Vite + TypeScript + WebGL2 project-skeleton
- Timeline-stub (`src/engine/timeline.ts`) die scenes sequentieel afspeelt
- Renderer-stub (`src/engine/renderer.ts`) — WebGL2 context, clear-color, DPR-aware resize
- Audio-stub (`src/engine/audio.ts`) — AudioContext placeholder (geen tracker yet)
- Input-stub (`src/engine/input.ts`) — keyboard + touch
- Placeholder scenes: `start`, `alku` (gekleurde fades)
- Decomp-doc structuur: `decomp/<scene>/ASM_NOTES.md` + `port.ts` + `port.vert/frag`
- Eerste decomp-target stub: `decomp/glenz/` (leeg, fase 2)
- GitHub Pages workflow (`.github/workflows/pages.yml`)
- AGPL-3.0 LICENSE (volledige GNU-tekst, te toe te voegen bij volgende commit)
- Source-clone instructies in `source/NOTE.md`
- Sessie-transcriptie `prompts/000_whatif.md` (deze WhatIf-rondes)

### Bekend / open
- LICENSE bevat nu placeholder — volledige AGPL-3.0 tekst nog niet ingeplakt (todo eerste fase 1 commit)
- Codenamen Yodel / Yost te verifiëren tegen Future Crew bronnen
