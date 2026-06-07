# Source-clone

De originele Second Reality source wordt **niet** in deze repo opgenomen.
We clonen hem read-only naast deze repo:

```
git clone https://github.com/mtuomi/SecondReality \
  /Users/christian/Documents/Gemini_Projects/SecondReality_source
```

Status: zie `git -C /Users/christian/Documents/Gemini_Projects/SecondReality_source log -1 --oneline` voor de exact gepinde commit.

## Waarom geen submodule

- Source verandert nooit meer (1993-archief, 2013-release, geen verdere commits verwacht)
- Submodule = extra cognitief gewicht in `git status` zonder voordeel
- Per scene noteren we in `decomp/<scene>/ASM_NOTES.md` welk pad in source we hebben gelezen

## Licentie source

Unlicense (public domain). Onze decomp-notes en port-code zijn AGPL-3.0.
