# Fibonacci Garden

A mobile idle-farming game where the Fibonacci sequence isn't decoration — it's the
mechanic, and it's also the reason the plants look right.

**▶ Play: https://da-el.github.io/fibonacci-garden/**

No install, no build step. Every file is self-contained HTML with inline CSS and JS.

---

## The idea

Real plants advance each new leaf by a fraction of a full turn, and that fraction is
always one Fibonacci number over another:

```
1/2  ·  1/3  ·  2/5  ·  3/8  ·  5/13  ·  8/21  …  →  137.507°
```

That limit is the **golden angle**. Every species in the game uses its own real
phyllotactic fraction, so each one genuinely looks different for a botanical reason —
elm leaves alternate left and right (1/2), beech stacks into three columns (1/3), and
a sunflower's 376 seeds interlock into spiral arms you can count.

Growth uses the sequence too: each watering adds the *next* Fibonacci number of
leaves or seeds — 1, 1, 2, 3, 5, 8, 13, 21… so a plant looks like almost nothing for
the first several taps and then visibly explodes.

## Plants grow on their own — watering is the boost

Every species grows one stage on a timer (5, 8, 13, 21 or 34 minutes — Fibonacci,
naturally), and it keeps growing while the app is closed. Growth runs faster in a
species' favourite hours, in rain and storms, and in its own season; heat slows it;
aphids stop it dead.

**Watering skips a stage instantly**, and it's a skill shot. A droplet sweeps a bar —
tap to lock it:

- **Gold zone** → *perfect*: a care point, and your combo climbs
- **Green** → *good*: the stage still skips
- **Miss** → the drop **spills**, nothing grows, combo lost

The gold zone shrinks as a plant matures and pricier species sweep faster, so late
pours on a sunflower take real aim. Combos pay out at Fibonacci counts (3, 5, 8, 13…),
and a combo of **8 triggers Fibonacci Fever** — 90 seconds where everything sells at
**×1.618** and the gold zones widen, so a hot streak feeds itself.

## The loop

1. **Plant** a seed — seed prices drift daily, and the planter flags any species a
   customer is currently waiting on
2. **Let it grow**, or spend water to skip stages and earn quality
3. **Squash aphids** (they drink your water and freeze growth) and **clear weeds**
   from empty plots — sometimes there's a worm underneath
4. **Harvest** before it wilts. Quality runs ★–★★★, plus two rare tiers:
   **✨ golden** (~3–11% chance, sells 3×) and **💎 pristine** — every stage
   perfect-poured with *not one drop spilled*, sells 2×
5. **Sell** at market, where price moves with the day, the weather, the season, fever
   and your golden seeds — or **gamble the whole barn** on the Speculator's wheel
   (×0 / ×1 / ×1.5 / ×2 / ×3, and one slice in four takes everything)
6. **Deliver customer orders** — premium contracts with quality minimums and 4–12h
   deadlines
7. **Reinvest** — plots (3→9), Fibonacci watering cans (13→21→34→55→89), compost,
   and **trellises** that shield a plot from storms

## Weather, seasons and the sky

The sky tracks your real clock — sun and moon sweep across it, stars come out, and
at **dawn and dusk it's the golden hour**, when *every* plant earns care regardless
of preference. Weather changes every 20 minutes with a 3-slot forecast so you can
plan:

| | effect |
|---|---|
| ☀️ sunny | prices +5%, aphids bolder |
| ☁️ overcast | aphids stay away |
| 🌧️ rain | water refills 2× fast, plants grow 1.5× |
| 🔥 heatwave | prices +25%, but slow refill and slow growth |
| ⛈️ storm | plants grow fast — but unprotected ones can be damaged |

Seasons rotate weekly and favour a different growth form each time, boosting both
its **price and its growth speed**.

## Mastery

XP comes from everything you do. **Levels 1–8 unlock the nine species**, and levels
3, 5, 7, 9, 12 and 15 each offer a permanent **choice of two perks** — green thumb,
deep well, storm sense, rich soil, golden touch, long fever, steady hand, connoisseur
and more.

When a garden has earned enough, **replant it** for **golden seeds** — each raises all
sale prices by 6.18% (a hundredth of φ−1) forever. Coins, plots and upgrades reset;
the almanac, achievements, levels and perks stay. Each successive seed costs 45% more,
and **storms and aphids grow bolder with every replant** — mastery has to cost
something.

Long-term goals: the **botanist's almanac** (all nine species at ★★★ pays a golden
seed), **15 achievements**, and a daily-gift streak whose seventh day pays a golden seed.

## Species

| Plant | Form | Fraction | Angle |
|---|---|---|---|
| Elm Sprig | leaves up a twig | 1/2 | 180° |
| Beech Sprig | leaves up a twig | 1/3 | 120° |
| Pear Sprig | leaves up a twig | 3/8 | 135° |
| Sedum | rosette | 2/5 | 144° |
| Houseleek | rosette | 5/13 | 138.46° |
| Pinecone | cone | 8/21 | 137.14° |
| Common Daisy | seed disc | golden | 137.507° |
| Chamomile | seed disc | golden | 137.507° |
| Sunflower | seed disc | golden | 137.507° |

## Files

| File | What it is |
|---|---|
| `index.html` | **The game.** |
| `concepts-round-1.html` | First design pass — four concepts (merge puzzle, Zeckendorf, rhythm, rabbit sim), each playable. Too maths-heavy. |
| `concepts-round-2.html` | Second pass — three concepts with one rule each. "Bloom" from this round became the game. |

The concept pages are kept because they're playable prototypes in their own right and
document how the design arrived where it did.

## Progress is saved locally

The game stores your garden in `localStorage`, per browser. It is **not** synced
between devices — playing on a laptop and a phone gives you two separate gardens.

## Before shipping this for real

- The **Shop** tab has a clearly-marked *prototype tools* box (`skip 30 min`,
  `skip a day`, `reset save`) so the time-gated loop can be evaluated without waiting.
  Delete that box.
- There's no audio.
- Balance is tuned from a simulated 14-session run, not from real players.
