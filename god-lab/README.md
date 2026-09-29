# God Lab

Play it: https://kbmikhael1.github.io/Fun-games/god-lab/

God Lab is a world simulator. Every creature carries 15 genes: size, speed,
sight, diet, fur, how much it lives in water, aggression, herding, fertility,
lifespan, disease resistance, intelligence and looks. Creatures eat, flee,
hunt, mate and die. Children inherit a mix of their parents' genes with small
mutations. When a group drifts far enough from its ancestors it becomes a new
species. Nothing is scripted.

## What you can do

- **Create**: design a species gene by gene, seed a primordial soup, plant
  forests, raise land or sea, rain down food.
- **Destroy**: meteors (with dust winters), volcanoes, plagues that mutate
  and jump species, wildfire, lightning, floods, droughts, ice ages and
  heatwaves, or erase a species completely.
- **Bless**: make one creature a giant, swift, immortal, an alpha, fertile or
  a genius. Heal, feed or make a species fertile. Give a species fire.
- **Speak**: send a messenger with a commandment (migrate, peace, multiply,
  war) and watch the belief spread.
- **Incarnate**: become any creature and live its life with W A S D. When you
  die, be reborn as one of your children.
- **Intelligence**: a clever, numerous species forms tribes that grow into
  villages and towns, farm, split, and build shrines to you.
- **Rewind** to any recent year, and read it all in the Chronicle, the Tree of
  Life and the census.

## Develop

```
src/sim.js      simulation (no browser code)
src/render.js   terrain, creatures, effects
src/ui.js       camera, powers, panels, incarnation, sound
src/style.css   UI styles
src/shell.html  page skeleton
```

```bash
python3 tools/build.py      # inline src/ into index.html
node tests/sim.test.js      # stability, natural selection, powers, tribes, rewind
```
