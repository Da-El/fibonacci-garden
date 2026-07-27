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

## The clock takes a plant halfway — you finish it

Every species grows one stage on a timer (5, 8, 13, 21 or 34 minutes — Fibonacci,
naturally), and it keeps growing while the app is closed. Growth runs faster in a
species' favourite hours, in rain and storms, and in its own season; heat slows it;
aphids stop it dead.

But the clock **stops at half grown**. From there the plant is stalled and thirsty,
and the rest is yours to pour. That's what makes water the real currency: the size of
your can decides how many plants you can finish, and the clock alone never earns a
single care point, so it can never sell you anything better than ★.

A thirsty plant tells you so without being asked — it leans in a slow, tired sway,
its leaves go pale, a droplet hangs over it, and it chimes once when it stalls. The
count rides in the tab title (`💧3 Fibonacci Garden`) and on the installed app's
badge, so you can see there's work waiting without opening anything.

**Watering skips a stage instantly**, and it's a skill shot. A droplet sweeps a bar —
tap to lock it:

- **Gold zone** → *perfect*: a care point, and your combo climbs
- **Green** → *good*: the stage still skips
- **Miss** → the drop **spills**, nothing grows, combo lost
- **Don't tap at all** → after 3.8s the bar closes and the drop goes back in the can

That last one used to lock the drop for you, and it was a hidden lottery. The marker is
deterministic, so 3.8 seconds lands on a fixed point of the bar for each species —
0.571 for aloe, 0.082 for chamomile — and whether that point fell inside the zone came
down to where the hash had put the zone. Swept across every zone the game can produce:
freezing at an aloe landed **96% perfects and never once spilled**, while freezing at a
chamomile spilled three drops in four. Doing nothing beat tapping blind on several
species and was hopeless on two, for no reason a player could ever discover.

The whole band also has to stay **on** the bar. The zone's centre used to be drawn from
a flat 25%–75% however wide the band around it was, so three pours in five had some of
their green hanging off the end — up to a quarter of it. The gold always fitted, so
nothing was unwinnable; it was just quietly unequal, and re-rollable for free by backing
out and tapping again. The centre is now placed so the band fits wherever it lands.

The difficulty is set in **milliseconds**, not as a width on the bar — the bar sweeps
almost twice as fast for the priciest species, so a fixed width meant a fixed *look*
and a wildly varying *ask*. Every pour on the shelf gives you between **150ms** (an
elm's first stage) and **75ms** (a pineapple's last): a real 2× gradient, all of it
landable. Miss and the game tells you whether you were early or late, because that's
the only thing you can act on. Combos pay out at Fibonacci counts (3, 5, 8, 13…),
and a combo of **13 triggers Fibonacci Fever** — 34 seconds where everything sells at
**×1.618**. Both numbers are Fibonacci and both come from measurement: it used to be a
combo of 8 for 90 seconds *and* it widened the gold zone, which made it a loop rather
than a bonus — more perfects, so more triggers, so more fever, without end. It was on
for 60–82% of every session no matter how well you played. Now it covers about a quarter
of a careless run and most of a precise one, which is what a reward for accuracy should
look like.

## The hour you keep

A drop is worth up to two care points and they come from different places: one for
landing in the gold, and one for watering in the species' **favourite hours**. Care
decides quality — ★★★ needs `ceil(stages × 2/3)` of them — and a plant the clock has
carried halfway only has enough drops left to get there if it earns both.

So the hour a gardener keeps is worth real money, and the evening is the worse shift.
Eight of the fifteen species are day-lovers, five prefer the night, two are easygoing,
and **both of the dearest plants on the shelf like the day**: at nine in the morning
five species are out of hours and the dearest of them lists at 182, while at nine at
night eight are and the dearest lists at 434. Simulated over a fortnight, the evening
gardener earns roughly **a tenth less** for playing exactly as well. (Roughly is the
honest word — four seeds put that gap at 18%, six at 8.6%, eight at 10.8%. The
deterministic count above is the finding; the simulation only says it is worth caring
about.)

Dawn and dusk (05:00–07:00 and 18:00–20:00) are the **golden hours** and suit
everything, which is the free answer. The 🏮 **lantern** is the bought one — it makes
the garden think it is always dusk, and it is consistently worth about twice as much to
the evening gardener as to the morning one. That asymmetry is the point: it is a fix for
the gardener whose life doesn't fit the shelf, not a bonus everybody has to buy.

The planter says which it is at the moment you choose — `☀️ now!`, `☀️ wait for daylight`,
`🌅 golden hour` — rather than lighting a badge up and leaving you to infer it. The words
are terse because that badge is `white-space: nowrap`: a 320px phone gives a planter row
222px of text, and the longer phrasing measured 223px, exactly where the view's hidden
overflow starts eating it. The icon already says which half of the day a plant wants.

The **elm** is easygoing on purpose. It is the first thing on the shelf, and the first
plant a new gardener grows must not punish them for the hour they happen to open the app
— so the one species everybody starts with earns its care point at any time of day.
Measured: a beginner tapping 80ms wide of the gold, in the evening, reaches their first
bloom in 25 minutes and 4 taps, and it comes out ★★★.

## Water is the currency

A drop arrives every **13 minutes** — about 110 a day — and your can holds 13 to 89 of
them. So the day's regen is your budget and the can decides how much of it you can
carry into one visit. Checking in more often lets you spend it sooner; it doesn't
conjure more.

Every price in the game is set from one number: **net coins per drop**. It climbs
geometrically with each species you unlock, so a dearer seed always pays better per
drop — as long as you can afford to finish it. The daily market roll is deliberately
smaller than the gap between two tiers, so a bargain shuffles neighbours rather than
making level 1 as good as level 16.

## The loop

1. **Plant** a seed — seed prices drift daily, and the planter flags any species a
   customer is currently waiting on
2. **Let it grow to halfway**, then pour the rest — that's where quality comes from
3. **Squash aphids** (they drink your water and freeze growth) and **clear weeds**
   from empty plots — sometimes there's a worm underneath
4. **Harvest** before it wilts — a ripe bloom loses a star every **6 hours** it stands,
   which is what makes holding for a better price an actual gamble. Quality runs ★–★★★, plus two rare tiers:
   **✨ golden** (~3–11% chance, sells 3×) and **💎 pristine** — every stage
   perfect-poured with *not one drop spilled*, sells 2×
5. **Sell** at market, where price moves with the day, the weather, the season, fever
   and your golden seeds — or **gamble the whole barn** on the Speculator's wheel
   (×0 / ×1 / ×1.5 / ×2 / ×3 — **half the wheel is empty**, and it pays ×0.94 on average,
   so selling is the safe play and spinning is a choice)
6. **Deliver customer orders** — premium contracts with quality minimums. A customer
   only ever asks for something you can already grow, and the deadline is derived from
   how long that crop actually takes
7. **Reinvest** — plots (3→9), Fibonacci watering cans (13→21→34→55→89 — the can is
   how much of a day's water you can hold at once, so this is the real upgrade), compost,
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
| ⛈️ storm | plants grow fast — but unprotected ones can be knocked back a stage |

Seasons rotate weekly and favour a different growth form each time, boosting both its
**price and its growth speed**. The boost is deliberately modest (+10% to +22%), because
the season is about what is worth *planting* — if it dominated the sale price too, you
would be obliged to hoard for it.

## Knowing when to sell

A ★★★ sunflower ranges 213 to 446 across a fortnight, so *when* you sell matters — and
that swing used to be invisible, which made it a tax on knowing rather than a decision.
The market now tells you both halves of it: whether **today** is a good day, measured
against the last ten days the game actually recorded, and whether the **next hour** will
beat it, read straight off the weather forecast. Selling at the peak beats an average
moment by about 42%, so patience pays — but the board says so out loud, and sell-all is
still one tap away.

**Nothing in the barn spoils.** Wilt is pressure to *harvest*, not to sell: once a bloom
is crated the clock stops, and a barn left ninety days is exactly the barn you left. So
the cost of holding is not decay, it's liquidity — every seed, plot, can and pane is
bought with coins you didn't hold. And patience has a ceiling: across a full year the
best day is only 53% over the average, which is less than a single **Fibonacci Fever**
(×1.618) earns for thirty-four seconds of accurate pouring. Waiting a year is worth less
than one good streak. That is deliberate — the game would rather reward the hand than
the calendar.

The board grades the day in five words, and two of them used to be unreachable: "a very
good day" wanted ×1.18 and "a poor day" ×0.85, while the ratio never leaves 0.895–1.156
across 1,198 measured days — because a ten-day window judges today against a mean that
already contains days like today. They're cut from the real distribution now, so all
five fire and "ordinary" stays the commonest thing to read.

## The glasshouse

From level 10 you can put **glass over a single bed**, and inside it one rule holds:
**nothing grows on its own.** The clock never advances a plant under glass, so every
stage is yours to pour.

That's a cost — a twelve-stage sunflower wants twelve drops instead of six — and it
works out to roughly the same coins per drop, because pouring every stage is what makes
a **💎 pristine** possible, and pristine sells for twice the ★★★ price. Out in the beds
the clock takes half the stages before you reach them, so a pristine means racing it
from the moment you sow. Under glass it's calm and deliberate instead: nothing is taken
from you, aphids can't get in, storms can't reach it, a ripe bloom won't wilt, and your
apprentice won't touch it. A single spilled drop is the only thing between you and the
best bloom in the game — and it halves what the bed pays.

Glass is permanent, and each further pane costs 90% more than the last.

## The dry spell

Weather turns over every twenty minutes, which is too quick to plan around. Twice a
week there's a **dry spell**: two days when a drop takes **twice as long** to arrive.

You always get a day's notice, and the notice is the whole mechanic. Fill a big can the
evening before and the spell costs you nothing; walk into one with an empty can and you
lose two days of watering. It's the reason to own the 89-drop can rather than the
13-drop one.

And because everyone's water is short, the market pays **15% more** — so a gardener who
saw it coming makes money out of a drought.

## Mastery

XP comes from everything you do, and a level costs **one Fibonacci step every two
levels** — φ at half rate. A full step per level climbed faster than income ever could:
the top of the shelf cost 27,912 XP against a committed three weeks earning about 6,700,
so four of the fifteen species could not be reached by anybody. Now a once-a-day gardener
ends three weeks around level 10 with a third of the shelf still ahead, and a committed
one reaches 15 — one unlock short of the last crop, which is where you want to be left.

**Levels 1–8 unlock the nine species**, and levels
3, 5, 7, 9, 12 and 15 each offer a permanent **choice of two perks**.

Each draft pits like against like, and the pairings are set from measurement rather than
taste. The one at level 7 is the draft that matters: **dawn dew** (water refills 25%
faster) against **rich soil** (the clock carries plants a stage further) — more water per
hour, or less water needed per plant. Over three weeks they measure +19,656 and +17,624,
within 11% of each other.

When a garden has earned enough, **replant it** for **golden seeds** — each raises all
sale prices by 6.18% (a hundredth of φ−1) forever. Coins, plots and upgrades reset;
the almanac, achievements, levels and perks stay.

The first seed costs **12,000 earned in a run** and each successive one 45% more, so
three seeds cost more than the entire upgrade tree — replanting is what you do once
you've run out of garden to buy, not instead of buying it. The running bonus shows on
the ✨ pill, because a permanent reward you can't see isn't much of a reward. And
**storms and aphids grow bolder with every replant** — mastery has to cost something.

The **botanist's journal** runs eleven chapters of concrete objectives, each one
introducing a system in the order you meet it — the first harvest, the steady hand,
reading the sky, the dry days, the swarm, fever, the mediant, hired hands and glass,
flawless, and the whole ladder. It pays 6,620 coins and 7 golden seeds across its length.

Long-term goals: the **botanist's almanac** (all nine species at ★★★ pays a golden
seed), **17 achievements**, and a daily-gift streak whose seventh day pays a golden seed.

The **Daily's** streak is separate, and it is now actually a streak. It was written in
one place and reset in none, so it was a lifetime win count wearing the word — three
months away and it came back untouched, sitting next to a `dailyWins` field that already
counted lifetime wins. It carries on from yesterday or it starts again, and it is
computed from the day it last advanced rather than swept, because there is no tick
running while the app is closed that could be trusted to notice the lapse.

## The almanac

Every species you have grown gets a card, and the card makes the case the game keeps
making. It gives the real divergence angle, how far that sits from the golden angle,
and — computed from the angle rather than written down — **the spiral arms you can
count on the picture**. A daisy shows 21 and 34, a sunflower 34 and 55, a pinecone 8
and 21. All Fibonacci, none of them chosen.

The low rungs are honest about being different: at 1/2 or 1/3 a turn the leaves stack
into 2 or 3 straight **columns**, not spirals, so the card says columns. Each card also
shows where its species sits on the ladder and which two rungs it is the mediant of —
which is the same rule the breeding bench uses.

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
| `tests/` | 1,202 automated checks — `node tests/run.js`. See [tests/README.md](tests/README.md). |
| `concepts-round-2.html` | Second pass — three concepts with one rule each. "Bloom" from this round became the game. |

The concept pages are kept because they're playable prototypes in their own right and
document how the design arrived where it did.

## The apprentice

Hire help and **the clock carries your plants further** — to 60%, and to 70% once
you promote her — so every plant costs you fewer drops and your can stretches over
more of the garden. She tends those stages properly, which is worth a few care
points, and she clears weeds, squashes aphids, lifts ripe blooms before they wilt and
sells the ★ and ★★ stock at the best price the day reached. A head gardener also
sows an emptied bed again with whatever you had there.

**She never takes a pour off you.** The last stages — the ones that set quality, feed
combos and mint a 💎 pristine — are always yours. She's paid a small retainer plus a
share of the takings, so she costs more in a good week than a quiet one.

**Don't linger at the first rank.** Measured net of her wages over three weeks and six
seeds, an apprentice alone is a *loss* for a gardener who opens the app once or twice a
day — −4.3% and −7.8% — and only a gain for someone playing four sessions. Her reach is
why: every stage the clock takes is a pour you don't make, and pours are where combos
and fever come from, so for the player who pours a lot per session she is trading away
the best part of their income. A head gardener is a clear gain at every visit rate
(+3.7% to +11.6%), because the chores she adds — re-sowing, minding the stall — pay for
the reach. So hire *and promote*; the first rank is a step on the way, not a place to
stop. (This section used to say "hiring pays for itself". It does not, and nothing had
checked.)

## Bees

Buy a hive and bees work the garden for you: each sortie pollinates a growing plant
for a free care point, and a 🍯 pollinated bloom sells for a premium. They **favour
flowers over sprigs**, so what you keep in the ground decides how much they help.
Upgrading the hive adds bees and raises the honey bonus (+15% a level on a honeyed
bloom). Measured over three weeks a hive returns +2,300 to +19,200 against its 650
coins, at every visit rate.

## Crossbreeding

Cross two plants you have grown and the child's divergence angle is the **mediant** of
its parents' fractions — `a/b ⊕ c/d = (a+c)/(b+d)`. That is not a rule invented for the
game; it is how the real phyllotactic ladder is built, and it is the same relationship
the almanac names on every card.

The bench shows what a pair would produce before you commit — the fraction, the angle,
what the child would sell for, what its seed costs, how many stages it takes, and **what
that comes to per drop**, which is the unit the whole shelf is priced on. It also says
whether the cross lands on a rung of the real ladder or between them.

Those figures used to appear only when *both* parents had a Fibonacci fraction. Cross two
golden-angle plants and you got a sentence about angles and no numbers at all — and
romanesco and pineapple are both golden, so the two dearest crosses in the game were
precisely the ones you could not price. Below that is **your ladder**: which of the seven rungs you hold, and for
the ones you do not, which pair would make them. So the mediant is something to aim at
rather than a lever you pull to see what happens.

Each cross costs 35% more than the last, and a child's price is damped by generation and
hard-capped, because crossing hybrids with hybrids used to compound into a money printer
— an early simulation reached 3.6 million coins in three weeks.

**A cross is a bigger ticket, not a better rate.** The price cap bounds what one bloom
sells for, but the thing that decides whether a crop is worth growing is coins per drop,
and that survived the cap: a hybrid's seed cost was a flat 38% of its price, while the
wild shelf tightens deliberately from 21% on an elm to 54% on a pineapple. That widening
is the whole reason the ladder doesn't run away — so a top-tier price on a mid-shelf seed
made romanesco × pineapple pay **64.4 a drop against the best wild plant's 41.7**, and
breeding was simply a better crop than anything you could buy. A cross is now seeded to
sit level with its dearer parent per drop. Two thirds of them still sell for more than
either parent, which is what a customer order pays against — the vigour is visible, it
just isn't free.

## Sound

Every sound is **synthesized at runtime** with the Web Audio API — there isn't a
single audio file. The perfect-pour chime climbs in pitch with your combo, fever
sweeps, the wheel ratchets and slows, and the garden has birdsong by day, crickets at
night and rainfall when it rains. Sound, ambience, vibration and motion each have
their own switch behind the ⚙ gear — and the motion switch really does stop every
looping animation, not just some of them. The system-level `prefers-reduced-motion`
setting is honoured too, so you should not have to find our switch if you have already
asked your phone.

## Moving your garden between computers

The game saves to `localStorage`, so a garden lives on one browser. To move it:
**⚙ → move garden** exports a `FIBGDN1…` code you can copy or download, and paste
into the game on another machine. Codes are checksummed, so a truncated paste is
refused rather than half-loaded over a real save.

**⚙ → postcard** renders your actual garden — real phyllotaxis, your level and best
blooms — as a PNG worth sharing.

Every large number the game says is abbreviated the same way — exact under 10,000, then
`34.5k`, `3.71M`, `9.00B` — because the XP curve is geometric and a long-lived garden
reaches figures nobody reads digit by digit. Level 30 already needs 35,386 XP and level
45 needs 1.3 million; the level strip used to print those raw, next to coins that were
formatted.

## Before shipping this for real

- The **Shop** tab has a clearly-marked *prototype tools* box (`skip 30 min`,
  `skip a day`, `reset save`) so the time-gated loop can be evaluated without waiting.
  Delete that box.
- There's no audio.
- Balance is tuned from headless 21-day simulations at three visit rates and four
  pour-accuracy levels, not from real players. The suite also audits for *dead*
  mechanics — wilting fired zero times in three weeks for thirty iterations, and
  customer orders were being drawn from species the player couldn't unlock — so if
  you add a system, add the counter that proves it fires.
- The worst-case garden is ~248KB of SVG markup for nine fully-grown plants.
