# Minion Commander

A 2D town-building game for the browser. You are the last guiding satellite over
an abandoned Earth: assign minions to gather resources, craft materials and
build, so they can survive and grow.

The game is a **plain ES-module library with no build step** — every system is
its own module under `js/`, and `index.html` (at the repo root) just loads
`js/main.js`. This keeps the codebase easy to extend and deploy.

---

## Run locally

ES modules need to be served over HTTP (not opened via `file://`). From the repo
root, any static server works:

```bash
# Node
npx serve .

# or Python
python -m http.server 8080
```

Then open http://localhost:3000 (or the printed URL). You can also run
`npm run serve`.

## Deploy to GitHub Pages

1. Push this repository to GitHub.
2. Repo **Settings → Pages → Source: deploy from a branch** and pick `main` (or
   `master`) with the `/ (root)` folder.
3. The site is served from `index.html` at the root — nothing else to configure.

The `.nojekyll` file is included so GitHub Pages serves the `js/` and `css/`
folders verbatim.

## Controls

| Action | Keys |
| --- | --- |
| Move the view | `W` `A` `S` `D` (or arrows) |
| Rotate the world | `Q` / `E` |
| Pick a building | bottom hotbar |
| Rotate the ghost | `R` |
| Place building / drag paths | left click |
| Cancel selection | `Esc` or right click |
| Demolish building under cursor | `X` or `Del` |
| Inspect / manage a building | left click (no building selected) |
| Pause / play simulation | `Space` |
| Pause & save | `Esc` |

## Project structure

```
index.html                 # entry shell (root, required for GitHub Pages)
css/style.css              # UI shell (status bar, hotbar, menus)
js/
  main.js                  # boots the Game
  core/
    config.js              # every tunable constant
    EventBus.js            # tiny pub/sub
    GameTime.js            # in-game clock (1h = 15 real seconds)
    SaveManager.js         # localStorage persistence
    Game.js                # orchestrator: wires everything together
  data/
    resources.js           # item types + crafting recipes
    buildings.js           # building catalogue (definitions)
  world/
    Tile.js                # one grid cell
    World.js               # 100x100 grid + spatial queries
    WorldGenerator.js      # deterministic 4-phase generation
  entities/
    Minion.js              # minion state + movement (no game logic)
  buildings/
    Building.js            # one placed structure (rotation, footprint, door)
    BuildingManager.js     # placement, validation, demolition, queries
  systems/
    Pathfinding.js         # A* over the tile grid
    Inventory.js           # capacity-limited item buffer
    TaskSystem.js          # job generation + minion behaviour
  rendering/
    Camera.js              # viewport transform + 90-degree rotation
    Renderer.js            # draw loop
    Sprites.js             # procedural placeholder art
  input/
    Input.js               # keyboard + mouse
  ui/
    Menu.js                # main / pause / controls screens
    HUD.js                 # status bar, hotbar, toasts
scripts/
  check-syntax.mjs         # syntax-check every module (npm run check)
  smoke.mjs                # headless logic test (node scripts/smoke.mjs)
```

## Architecture

- **Data modules** (`data/`) describe *what* exists — item types, recipes and
  building definitions. Adding a new building or recipe is a data change.
- **`Game.js` is the only module that knows everyone.** It owns the world,
  buildings, minions, time, camera, renderer and UI, and runs the loop.
- **`TaskSystem.js` drives minions.** A task is a plain serialisable object
  (`{ type, step, ...data }`), so minions can be saved/loaded trivially. Minions
  themselves are just state + movement.
- **Rendering is fully procedural** in `Sprites.js` — swap in real sprites there
  later without touching game logic.
- **The world is regenerated from a seed on load**; the save stores the seed plus
  every runtime mutation (tiles, buildings, minions, time).

## What the vertical slice includes

- Main menu (New / Continue / Controls), pause menu, save & load (one slot).
- Deterministic 100×100 world: grass, stone ovals, rivers, forests, ore veins,
  loose materials, and a 5-minion starting area near a forest.
- Camera: WASD pan, Q/E 90° rotation, clamped to the world (no zoom).
- Building placement with ghost + `R` rotation, path dragging, and demolition
  with 50% refund.
- Building inspector: choose the stored item type for storages and the crafting
  recipe for factories/smelteries (click a finished building).
- Working buildings: **path, fast path, bridge, collecting station, woodcutting
  station, foresting station, recharge station, storage (S/M/L), factory,
  smeltery, drilling station, transport station, minion duplication station**.
- Minions with batteries (20 h), lifespan (10 days), path vs fast-path speeds,
  ore/ingot carry penalty, and A* pathfinding that prefers paths.
- Task loop: collect → storage/site, cut trees, replant, drill veins, fetch
  input → craft → deposit output, deliver to construction, recharge, transport
  (moves input/output between craft buildings and storage), and duplication
  (creates a new minion).
- Time: 1 in-game hour = 15 real seconds; autosave each day; tree growth
  (5 days); lost-minion warning.

## Not yet implemented (next steps)

- Keybind remapping (menu item reserved).
- Explicit "rescue" flow for lost minions (only a warning toast today).
- Gatherer workstation output buffers (gatherers deliver directly for now).
- Balancing of construction time and walking distances.

## Dev checks

```bash
npm run check          # syntax-check all ES modules
node scripts/smoke.mjs # headless logic test (world gen, pathfinding, sim, save round-trip)
```
