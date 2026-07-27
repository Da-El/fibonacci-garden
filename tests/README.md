# The suite

```bash
node tests/run.js
```

237 checks. Each one loads the game's inline `<script>` into a headless harness and
drives the **real functions** — nothing is reimplemented, so a check that passes is a
statement about the game rather than about a model of it.

## Why it exists

The wilt penalty sat dead in this game for thirty iterations. Ripe plants were supposed
to lose a star a day; measured across three weeks at every visit rate, it fired **zero
times**. Nothing had ever counted.

That turned out to be the pattern, not the exception:

- The **apprentice** drank from your shared can, so hiring her was strictly worse than
  not hiring her — she traded your care points for stage skips the timer gave away free,
  and charged a wage.
- **Customer orders** were drawn from species you couldn't unlock yet, on deadlines
  shorter than the crop takes to grow. 0–4% were ever delivered.
- The **beehive** was shown the garden before the clock had grown it, so the bees found
  nothing to visit — 13 pollinations in three weeks, for a hive costing 650.
- The **pour minigame** — the one interaction the whole game rests on — threw on every
  single tap for two releases, because the early/late feedback read an object that had
  just been nulled.

Every one of those was a *measurement* gap, not a reasoning error. So the rule here is:
if you add a system, add the counter that proves it fires.

## The files

| file | what it holds the game to |
|---|---|
| `harness.js` | loads the game headless; can preload a save so migration is testable |
| `sim.js` | a 21-day simulated player at three visit rates and any pour accuracy |
| `regress.js` | the clock ceiling, quality, the apprentice, orders, the economy, prestige |
| `pour-check.js` | timing windows in milliseconds, the difficulty curve, and that a pour resolves |
| `save-check.js` | old saves, corrupt saves, export codes, a failing localStorage |
| `botany-check.js` | the Fibonacci claims, checked against what the renderer actually draws |
| `glass-check.js` | the glasshouse: the clock stopping, its protections, its economics |
| `dry-check.js` | the dry spell: frequency, warning, effect size, whether preparing pays |
| `thirsty-check.js` | the stalled plant: counting, announcing, the tab title |
| `onboard-check.js` | the first five minutes, and every number the tutorial quotes |
| `journal-check.js` | every objective reachable by a gardener who has done everything |
| `market-check.js` | the price spread, and whether the market explains it |
| `daily-check.js` | a year of Dailies: every one winnable, fair, and worth winning |
| `breed-check.js` | the mediant is really the mediant, the price cap holds, every rung is reachable |
| `wheel-check.js` | the gamble's expected value, its odds, and that losing cannot kill a save |
| `perk-check.js` | every perk draft measured at two visit rates — neither side may dominate |
| `level-check.js` | the XP curve against three weeks of real play, and how much shelf is reachable |
| `sound-check.js` | every sound defined, triggered, and mixed within a sane range |
| `a11y-check.js` | colour, motion, screen readers, tap targets |
| `audit.js` | the sweep: which ledger events never fire, stated-vs-actual, drawing weight |

Diagnostics rather than pass/fail: `progress.js` (the upgrade arc), `per-drop.js` (the
species ladder in coins per drop), `rank-check.js` and `hive-check.js` (is this purchase
worth it), `prestige-check.js` (the golden-seed curve).

## Two cautions

**A green suite only covers what it exercises.** The pour crash hid because nothing had
ever driven `startPour` → `lockPour` end to end, and `performance.now()` was frozen so
the minigame could never resolve.

**The harness fixes the clock.** The game reads `Date.now()`, so runs used to start at
whatever moment you happened to run them — shifting the day index, the weather, the
season, the dry spell and the Daily. Nothing was reproducible and every balance number
carried an uncontrolled variable. Runs now start from a fixed instant, and three
identical calls give three identical answers.

**Several "failures" here were the test's fault, not the game's** — a shared clock
drifting across species, a synthetic save missing `state.ach` so achievements paid out on
load, a regex mangled by a shell heredoc. Check which one is wrong before you fix
anything.
