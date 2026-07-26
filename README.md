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

## The loop

1. **Plant** a seed in a plot — seed prices drift daily, so buy on sale
2. **Water** it — each drop advances one Fibonacci batch; watering a species
   during its preferred time of day (☀️/🌙, from your real clock) earns **care
   points** that set the harvest's ★–★★★ quality (×1 / ×1.3 / ×1.6 price)
3. **Squash aphids** — they roll in every so often and drink your water until tapped
4. **Harvest** before it wilts (ripe plants lose a star per day left standing);
   ~3% of harvests come up **✨ golden** and sell for 3× the ★★★ price
5. **Sell** at market — prices move with the day (0.75×–1.45×), the **weather**
   (heatwaves pay +25% but halve water refill; rain refills 2× fast), and the
   **season** (one week each; every season favours a different growth form)
6. **Deliver customer orders** — three standing requests for qty × species at a
   minimum quality, paying well over market, expiring in 4–12 hours
7. **Reinvest** — more plots (3→9), bigger cans (13→21→34→55→89 drops, all
   Fibonacci), compost (grows a stage without water, but earns no care)

When a garden has earned enough, **replant it**: everything resets except the
almanac, achievements and your **golden seeds** — each one raises all sale prices
by 6.18% (a hundredth of φ−1) forever, and each successive seed costs 15% more
run-earnings than the last.

Long-term goals: the **botanist's almanac** (best quality per species; all nine at
★★★ pays a golden seed) and eleven **achievements**.

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
