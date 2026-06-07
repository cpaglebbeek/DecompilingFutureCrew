# GLENZ — asm-notes

> Status: **stub** (v0.0.1-PSi). Eerste echte werk in fase 2 (v0.2.x-Trug).

## Wat is een "Glenz vector"

Translucent / additive blended 3D-vector object. Klassieker uit demoscene-jargon
(naam stamt uit Amiga-scene, ~1989). In Second Reality: gekleurde polygon-meshes
zonder depth-write, additief gemengd zodat overlappende faces lichter worden.

## Te onderzoeken in source/ (TODO bij fase 2)

- [ ] welke map bevat GLENZ — vermoedelijk `GLENZ/`
- [ ] hoe wordt het mesh ingeladen / hardcoded
- [ ] welke transformatie-pipeline (3×3 of 4×4 matrix? fixed-point?)
- [ ] welke blending in VGA mode 13h: palette-tricks (LUT) of true add?
- [ ] sortering: BSP, depth, of helemaal niet (additief = orderonafhankelijk)
- [ ] backface culling?

## Moderne port-strategie (geplande aanpak)

- Mesh hardcoded als `Float32Array` (positions + colors)
- Vertex shader: model-view-projection
- Fragment shader: emitterende constante kleur (geen lighting)
- Blending: `gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE)` (additief)
- Depth: `gl.depthMask(false); gl.disable(gl.DEPTH_TEST)`
- Achtergrond: zwart of subtiele scrolling-grid

## Open keuzes

- Welke mesh? Origineel? Of een passende eigen (icosahedron / dodecahedron als hommage)?
- Beweging: rotatie pitch+yaw+roll met smooth sinussen
