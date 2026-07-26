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

1. **Plant** a seed in a plot, paying coins
2. **Water** it — each drop advances one Fibonacci batch
3. **Harvest** it at full size into the barn
4. **Sell** at market, where prices drift daily (0.75×–1.45×)
5. **Reinvest** in better seeds, more plots, a bigger watering can

Water is the time gate: one drop every 90 seconds up to your can's capacity, and it
accrues while the app is closed. Plants cost as many drops as they have growth stages,
so **profit per drop** is the real decision — an elm sprig returns ~2 coins per drop,
a sunflower ~9.

Watering-can capacities are Fibonacci numbers: 13 → 21 → 34 → 55 → 89.

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
