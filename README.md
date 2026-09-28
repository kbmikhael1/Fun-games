# Daraja

*da·ra·ja* (Swahili, noun): a bridge.

Daraja is a bridge-building game set across eight real Ugandan crossings, from the
Nakivubo Channel in Kampala to the Source of the Nile at Jinja. You draw a
bridge on an engineering blueprint. Then the drawing becomes a golden-hour gorge,
and a real vehicle drives across. Members glow as they near their limit, then snap.

## Play

Open **`index.html`** in any modern browser (Chrome, Edge, Firefox or Safari).
That's it: one file, no install, no server, and it works offline. With an
internet connection it also loads its fonts; without one it falls back to
system fonts. Progress and designs are saved in the browser.

## How to build

1. Drag from an amber anchor, or from any joint, to draw a member. Members snap to a 0.5 m grid.
2. Lay a **road** deck from bank to bank. Only road carries wheels.
3. Brace it with triangles of **timber**, **steel** and **cable**.
4. Press **Test** (Space). Pass within budget to get the council's stamp and up to three stars.

| Key | Action |
|---|---|
| `1`–`4` | Road, timber, steel, cable |
| `E` / right-click | Erase |
| `Ctrl+Z` / `Ctrl+Y` | Undo / redo |
| `Space` | Test / back to the drawing |
| `S` / `F` / `R` | Slow motion / forces view / replay |
| `M` | Sound on or off |

## The engineering is real (simplified)

- The physics is XPBD (extended position-based dynamics) with 40 substeps per frame. Members are axial springs with real stiffness (EA/L), and every member reports its force in kN.
- Members fail in tension at their strength. In compression they fail at the lesser of crushing and buckling, where buckling capacity falls with 1/L², so long struts are weak.
- Cables only pull.
- Vehicles have damped suspension and load the deck through their wheels.
- `tests/levels.test.js` checks one force against a hand calculation (within 5%). It also proves every level can be crossed within budget with a reference design.

## Develop

The game is written in plain JavaScript with no dependencies.

```
src/engine.js    physics, materials, vehicles
src/levels.js    the eight crossings
src/game.js      renderer, input, audio, screens
src/style.css    UI styles
src/shell.html   page skeleton
```

```bash
python3 tools/build.py        # inline src/ into index.html
node tests/levels.test.js     # physics sanity + every level solvable
```
