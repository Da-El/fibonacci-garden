# The suite

```bash
node tests/run.js
```

768 checks. Each one loads the game's inline `<script>` into a headless harness and
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
- Every **succulent** was drawn a sixth too large for its frame and clipped on all four
  sides. The one check that had ever looked at the drawing read raw coordinates and
  ignored the rotation that put the leaves there.
- The **market** drew a full botanical illustration into every 44-pixel row of your
  barn — up to eight rows per species, near a megabyte of markup, with a romanesco bud
  under half a pixel across.
- **One bed holding a lost cross** stopped the whole app from starting. Every hybrid is
  rebuilt at boot from the parents recorded against it; anything that could not be rebuilt
  left a bed pointing at nothing, and the game read its stages without looking. A whole
  garden gone rather than one plant.
- A journal chapter asked you to **clear weeds three times**. Weeds only sprout in an
  empty bed, so three weeks of tidy play turns up one — the chapter was unreachable for
  anyone who replants what they lift, and the simulation was zeroing the weed array
  directly rather than calling the function that counts.
- The **ladybird** paid a tenth of your barn in coins and left the stock alone, with no
  ceiling — so hoarding instead of selling turned one tap into 200,705 coins, thirteen
  hundred times the next best thing it can give you.
- The **daily gift** paid a golden seed every seventh day — the permanent bonus on every
  price in the game, worth twelve thousand coins by the only other route. A hundred days
  of opening the app paid fourteen of them against three for actually replanting, so two
  thirds of the permanent reward was an attendance record. Nothing had ever claimed one:
  it is a modal with a button, and nothing in this suite could press a button until
  iteration 70.
- **Fever** covered 67% of a precise player's pours across a hundred days. Thirteen
  pours takes about as long as fever lasts, so the next streak was assembled inside the
  current one and it never lapsed. Only the careless end had ever been bounded.
- **Winter** told you to grow evergreens for +18%. It gave evergreens +10% and
  succulents +18%. Every number in the blurb was a number the season really gives and
  every plant it named was one it really boosts, so a check on either alone passed.
- The **simulation** sold the whole barn and then looked in it for something to fill a
  customer order with, so three weeks of play reported zero deliveries. Every judgement
  ever made about the order board was made against a player who could not deliver one.
- The **score** went double-time the first time fever fired and stayed there for the
  rest of the session, because it was re-timed from one place — the moment fever starts
  — and there is no fever-*ending* code in the game at all.

Every one of those was a *measurement* gap, not a reasoning error. So the rule here is:
if you add a system, add the counter that proves it fires.

## The files

| file | what it holds the game to |
|---|---|
| `harness.js` | loads the game headless; preloads a save, records what is drawn and played, parses innerHTML into real elements, and lets a test step timers and press keys |
| `boon-check.js` | the ladybird and the compost: what the free things are really worth |
| `gift-check.js` | the daily gift and the streak: what it pays, what breaking it costs |
| `long-check.js` | a hundred days: big numbers, a level bar past the shelf, a save at scale |
| `prestige2-check.js` | a second and third run: what a replant costs, what it keeps, what it is worth |
| `keys-check.js` | the whole loop played by keyboard: plant, pour, take the shot, escape out |
| `chapter-check.js` | the journal walked against a real run: when each chapter actually falls |
| `broken-check.js` | a save that is perfectly well-formed and describes a garden the game cannot read |
| `words-check.js` | every figure the game states out loud, checked against the constant behind it |
| `ach-check.js` | every achievement: the counter it waits on is really written, it is reachable, and it pays once |
| `tutor-check.js` | the first five minutes walked step by step, each one advanced by the action it waits for |
| `budget-check.js` | what each screen hands the browser: DOM nodes, markup, wasted rebuilds |
| `draw-check.js` | the markup every plant renders to: bounds under rotation, growth, detail, distinctness |
| `score-check.js` | the generative score: mode by season, tempo by hour and fever, and whether it ever changes back |
| `shelf-check.js` | every species against every other — anything slower has to be richer |
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
| `quiet-check.js` | the mechanics that barely fire — each must be real or be removed |
| `postcard-check.js` | the postcard draws for every garden state and nothing runs off the card |
| `scene-check.js` | the garden's layout: inside its bounds, no overlaps, depth in the right order |
| `fever-check.js` | fever: how often it fires, what it is worth, and that it ends |
| `away-check.js` | coming back after a day, a month, a decade, or a clock corrected backwards |
| `sound-check.js` | every sound defined, triggered, and mixed within a sane range |
| `a11y-check.js` | colour, motion, screen readers, tap targets |
| `audit.js` | the sweep: which ledger events never fire, drawing weight, and every claim this project makes about itself — it reports a verdict now, so a claim cannot rot unnoticed |

Diagnostics rather than pass/fail: `progress.js` (the upgrade arc), `per-drop.js` (the
species ladder in coins per drop), `rank-check.js` and `hive-check.js` (is this purchase
worth it), `prestige-check.js` (the golden-seed curve).

## Cautions

**Bound both ends, not the one you were worried about.** Iteration 56 measured fever and
asserted a careless player is not living in it. Nothing ever asked the same of a precise
one, and fever quietly grew back to 67% of their pours over sixteen iterations behind a
green suite. A quantity that can be wrong in two directions needs two bounds.

**Guard the loops that run on a timer first.** A crash in a modal is one bad screen you
close. A crash in the once-a-second tick stops the heartbeat for the rest of the
session — no growth, no wages, no apprentice — until the app is reloaded. Calling all
147 zero-argument functions against a garden holding a plant that does not exist found
eight that threw, and the ones that mattered were the sweeps and the paint.

**A green suite only covers what it exercises.** The pour crash hid because nothing had
ever driven `startPour` → `lockPour` end to end, and `performance.now()` was frozen so
the minigame could never resolve.

**A stub that returns nothing makes the code above it untestable, silently.** The
harness handed the game a null `AudioContext` and a `setInterval` that dropped its
callback on the floor, so the entire score — forty iterations of it — existed in tests
only as source that could be read, never as behaviour that could be measured. The same
was true of `setTimeout`: every `coachDid()` in the game fires from one, so the four
interactive steps of the tutorial had never advanced once under test. The
moment both were made real, the first run found the tempo stuck in double time. If a
check can only inspect the source of a system, that is not a check on the system.

**A stub that is too generous invents bugs that are not there.** The mirror of the
above, and it cost a whole iteration. `getElementById` makes an element on demand and
never returns null, so `if ($('x'))` guards always pass; and writing `innerHTML` used
to leave the cached stubs alone, so a button a paint function had just written looked
identical to one leaking a handler per call. Twenty-one elements appeared to be
stacking listeners and a single tap appeared to spend 5050 coins. Not one of them was
real. Before reporting anything the harness tells you, ask what it is pretending
about — and check the finding against the game's actual markup.

**The harness fixes the clock.** The game reads `Date.now()`, so runs used to start at
whatever moment you happened to run them — shifting the day index, the weather, the
season, the dry spell and the Daily. Nothing was reproducible and every balance number
carried an uncontrolled variable. Runs now start from a fixed instant, and three
identical calls give three identical answers.

**Several "failures" here were the test's fault, not the game's** — a shared clock
drifting across species, a synthetic save missing `state.ach` so achievements paid out on
load, a regex mangled by a shell heredoc. Check which one is wrong before you fix
anything.
