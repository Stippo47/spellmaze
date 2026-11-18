# Spellmaze — design (draft 1, 2026-11-16)

Working title. A landscape phone game (PWA, like Delve) where you build your own attacks out of modules while
surviving endless waves in a dark square maze. Plain names throughout: fire is Burn, not anything fancier.
The neon look is there to keep the art simple, not as a theme.

Status: **stage 1 built (2026-11-17)**: maze, three sight modes, movement, fire stick with three test weapons, dash,
Mites and waves (`index.html`, `js/`). The first Riffle pack is answered; its rulings are in `docs/DECISIONS.md` and
**override this draft where they differ** (endless runs, no minimap, rounds ring, flat look, white player, no fallbacks,
more). Films: `node tools/film.mjs all` with the repo served on :8737.

Sources: the designer's brief (2026-11-16 chat) and the maze roguelike design doc
(`Dev/MazeRoguelike/docs/design-doc.md`): Wings, Lightning arena, the 21 pressure tests, the building-blocks spec
(section 9) and its rules (section 14). This game borrows that spec's atoms and rules and cuts them down to what a
phone survivor game can show.

---

## 1. The game in one minute

- You are a 2×2-cell glowing ring in a square labyrinth. You see only what's in your line of sight.
- Enemies pour in from the dark, more every minute (Vampire Survivors pacing). Kills drop XP.
- Dead ends hold **chests**. Each chest has one **module**: a part that changes an attack (Bounce, Burn, Split…).
- Each level-up shows **4 upgrades** for modules you already have (Bounce +1 bounce). Pick one.
- You have three **casts**: Weapon, Summon, Dash. Each is a **shape** with **module slots**. Any module works in
  any cast. That's the build.
- An exit opens at 10:00. Leave to bank your shards, or stay for more until you die.
- Shards buy permanent things between runs: more slots, more modules in the chest pool, new shapes, a practice room.

---

## 2. Controls (Brawl Stars style, landscape)

| Control | Where | Does |
|---|---|---|
| Move stick | anywhere on the left half (floats to your thumb) | move |
| Fire stick | bottom right, fixed | drag = aim line; release = fire; quick tap = fire at nearest visible enemy; keep holding while dragged = keep firing while ammo lasts |
| Summon stick | above-left of Fire | charges from damage you deal (like a Super) and slowly over time; drag to aim the throw, release to throw; tap = throw at nearest |
| Dash button | left of Fire | tap = dash where you're moving; drag = aim the dash. 2 charges |
| Pause / Build | top centre | opens the build screen (modules can be moved here) |
| Minimap | top right | explored maze, chests seen, exit |

- **Ammo:** 3 bars under the player, reloading one at a time (Brawl Stars). Holding fire spends them in a row.
  This gives every weapon shape the same rhythm and makes the Fire stick feel the same with a beam or a bomb.
- No aim assist beyond the tap-to-nearest (carried over from the maze roguelike ruling).
- iPhone 11 landscape is 896×414 points. The camera shows about 48×22 cells, so a cell is about 18 pt and the
  player about 37 pt. All buttons sit inside the safe area.

---

## 3. The spell system

### 3.1 Casts, shapes, modules

A **cast** is something you trigger: Weapon, Summon or Dash. Each cast is one **shape** plus **slots**.

**Shapes** (v1: five). They are the maze doc's atoms with a body:

| Shape | Maze-doc atom | Default behaviour |
|---|---|---|
| **Bolt** | Projectile | fast small shot, goes a set distance, dies on the first enemy or wall. 10 damage |
| **Beam** | Line | hold to channel a line up to 14 cells; stops at the first wall and first enemy; ticks 8/s |
| **Burst** | Zone (with a lobbed carrier) | a bomb lobbed to the aim point (up to 10 cells) that blasts a 3-cell circle; walls block the blast |
| **Ball** | Entity | thrown body with HP 40; hits by contact, harder the faster it goes; slows to a stop over ~1 s, sits, lasts 15 s; enemies attack it |
| **Self** | Movement | the dash: you move 6 cells in 0.15 s, can't be hit while dashing, shove enemies aside (no damage) |

Starting kit: Weapon = Bolt, Summon = Ball, Dash = Self. Beam and Burst come from meta unlocks and from
**shape cards** found in chests (a shape card swaps a cast's shape and keeps its modules).

### 3.2 Channels: why any module works on any shape

Every shape answers the same seven questions. Modules are written against these, never against a shape:

| Channel | Bolt | Beam | Burst | Ball | Self (dash) |
|---|---|---|---|---|---|
| **Count** — how many per cast | bolts | beams | bombs | balls | dash charges |
| **Size** | bolt radius | beam width | blast radius | body radius, HP | dash body width, shove |
| **Speed** | flight speed + reload | tick rate + reach | throw speed + cooldown | throw speed + charge rate | dash length + recharge |
| **Path** — how it moves | flight | the line | the lob | throw, then drift | the dash line |
| **Contact** — touching an enemy | hit | each tick | everything in the blast | each collision | everyone passed or shoved |
| **Wall** — touching a wall | dies | stops | blast blocked | thuds to a stop | stops |
| **End** — when it's over | dies / runs out | released | blast fades | dies / expires | dash ends |

A module says what it does to one or more channels (Bounce = "at Wall: reflect"). Since every shape has every
channel, every module has an answer on every shape. Where the obvious answer is nothing, the module's card names
a **fallback** (written into section 4). No module is ever "does nothing here".

### 3.3 What children inherit (rule from the maze doc, section 14 rule 20)

Some modules make new things: Explode makes a blast, Gunner makes bolts, Swarm makes small copies.

- Children inherit the parent's **payload** modules (Burn, Chill, Shock, Poison, Mark, Knock, Pull, Leech).
  A Burning ball's Gunner shots burn; its death Explode is a fire blast.
- Children **don't** inherit path, count or spawner modules. That stops endless recursion and keeps it readable.
- Split children don't split again.
- Nested spawning has a depth limit: 2 in v1 (meta raises it to 3).

### 3.4 Runes: building spells inside spells

A **Rune** is an epic-or-better module with a trigger and an empty socket: "On wall: cast ___". You drop a shape
card into the socket, and the socket has 2 slots of its own for modules. The child shape fires from where the
trigger happened, inherits payloads as above, and counts toward the depth limit.

Triggers in v1: On hit, On wall, On end, Every 1 s, On kill. The trigger is fixed when the Rune drops (it's on the
card).

This is how your bigger spells get made. Fixed spawner modules (Explode, Shrapnel, Gunner, Trail, Swarm) are
pre-filled runes that cost one slot; a real Rune is the open-ended version.

### 3.5 Levels, rarity and slots

- **Numbers are shown** on module cards and upgrades ("Bounce 2 → 3"). This changes the maze doc's "hidden
  numbers" rule on purpose: survivor games live on reading the upgrade. Asked on a card.
- **Rarity caps levels:** Common 3, Rare 5, Epic 7, Legendary 9.
- Some modules only drop at a minimum rarity: Swarm rare+, Runes epic+, Ghost legendary.
- **Duplicates:** the same module at a higher rarity promotes yours (levels kept, cap raised). Same or lower
  rarity gives +1 level (up to the cap), or scrap it for XP.
- **Slots:** Weapon 3, Summon 2, Dash 2 at the start (7 modules). Meta adds up to Weapon 6, Summon 5, Dash 4.
- **When full:** a chest module can replace one you have (the old one is scrapped for XP) or be scrapped.
- **Moving modules:** on the build screen (pause) you can move any module between casts. Levels travel with it.
  Build experiments are the point, so this is free.
- **Level-up:** 4 cards, weighted to modules below their cap. When everything's capped, cards offer vitals (max
  HP, move speed, pickup range, +1 ammo). Meta buys rerolls and bans.

### 3.6 Maths

From the maze doc, unchanged: (base + flat) × (1 + sum of %) × each true multiplier. No caps; extreme builds are
inefficient, not blocked. Kinetic shapes (Ball, Dash with damage) deal more the faster they move. Extra fire rate
past one shot per frame becomes extra bolts.

---

## 4. Modules (v1: 28)

Each line: **Bolt | Beam | Burst | Ball | Dash**. Level growth in brackets.

### Path (cyan) — how it moves
- **Home** [turn strength, sight]: curves to the nearest enemy ahead | bends toward enemies near the line | steers
  in the air to land on an enemy near the aim point | hunts enemies, re-targets after each hit | dash curves into
  the nearest enemy ahead (a lunge).
- **Bounce** [+1 bounce]: reflects off walls | reflects off walls | bomb hops on landing, blasting at each hop (each
  smaller) | rebounds off walls without losing speed (pinball) | dash rebounds off walls and keeps going.
- **Pierce** [+1 pass]: passes through enemies | passes through enemies | blast reaches through one wall (maze doc
  rule 17: Piercing passes entities first, then walls) | passes through enemies at full speed | dash goes through
  enemies, hitting each (gives the dash 8 contact damage).
- **Orbit** [radius, turns]: circles you once, then flies out | sweeps a full circle around you | blasts go off in a
  ring around you | guards you, circling and blocking enemy shots | dash arcs around the nearest enemy.
- **Return** [distance, speed]: boomerangs back, hitting both ways | swings 60° out and back | the blast expands then
  collapses back to its centre, hitting twice and pulling in | flies back to your hand; catching it refunds half the
  summon charge | 1 s after the dash, you snap back to where you started.

### Form (white) — how many, how big
- **Extra** [+1]: +1 bolt, fanned | +1 beam, fanned | +1 bomb around the aim point | +1 ball | +1 dash charge.
- **Grow** [size]: bigger bolt (slightly more damage) | wider beam | bigger blast | bigger ball: more HP, harder,
  slower | wider dash that shoves more, longer can't-be-hit time.
- **Haste** [speed]: faster bolts and reload | faster ticks, longer reach | faster throw and cooldown | faster ball,
  faster summon charge | longer dash, faster recharge.
- **Split** [children's strength]: splits in two on hit or at its end | forks into two partway along | throws two
  small bombs outward after the blast | splits into two small balls on death | two echo dashes at ±35° that carry
  the dash's contact effects.
- **Swarm** (rare+) [+1 member]: becomes 6 tiny homing bolts | frays into 6 thin homing threads at its end | becomes
  6 homing bomblets | becomes 6 small homing balls that hit by contact (the designer's swarm) | the dash sheds 6
  homing sparks along its path.

### Payload (element colours) — what a touch does
Every shape applies these through Contact. Beams apply them per tick at a lower strength (proc scale); blasts to
everything inside; dashes to everyone passed or shoved.
- **Burn** (orange) [build-up per hit]. **Chill** (ice blue). **Shock** (yellow). **Poison** (green).
  **Mark** (pink). See section 5.
- **Knock** [force]: hits push enemies far | pushes along the beam | hurls outward | hit enemies go flying and hurt
  what they hit (bowling) | dash shoves become a shockwave.
- **Pull** [strength]: drags nearby enemies toward its flight line | drags enemies toward you (tractor) | sucks
  enemies in before it blasts | becomes a magnet that gathers enemies around it | enemies near your path are pulled
  to where you land.
- **Leech** [heal %]: hits heal you a little. Ball: its hits heal it and you. Dash: each enemy passed heals you.

### Spawners (yellow) — make something at a moment
- **Explode** [blast size]: blast where it hits or ends | blast at the beam's far end every 0.5 s | a second blast
  after a beat | blast on death (the designer's explosive summon) | blast where the dash ends.
- **Shrapnel** [+2 bolts]: a ring of small bolts at its end, for every shape.
- **Gunner** [fire rate]: fires tiny side-shots at enemies while it flies (Wings' side streams) | sparks jump from
  the beam to enemies near it | the blast area stays for 2 s and drops strikes inside it (Lightning arena's sky
  strikes) | shoots at nearby enemies (turret pet) | for 2 s after a dash you auto-fire at the nearest enemy.
- **Trail** [length, life]: leaves a lingering strip that carries its payloads (Burn makes a fire trail) | leaves a
  scar where it swept | leaves a pool | the ball leaves a trail | the dash leaves a strip along its path.
- **Echo** [+1 repeat]: the whole cast repeats 0.4 s later from where it was cast | same | same | a ghost ball (half
  HP) | a ghost of you dashes the same line again.

### Rules (magenta) — bend a rule
- **Link** [line damage]: bolts from one volley are joined by a damaging line; a lone bolt links to you (a whip
  line) | beam ends link | the blast's edge becomes a ring of linked points, and enemies that touch the ring join it
  (the Lightning arena) | balls link to each other; a lone ball links to you (a flail) | a line from dash start to
  end hurts for 1 s (tripwire).
- **Follow** [range]: bolts hover beside you, then fire themselves at the next enemy that comes near | the beam
  locks onto the enemy it hits and stays on it as you move | the blast becomes an aura that moves with you | follows
  you through the maze and stays close (the designer's navigation module; Follow + Gunner = a pet that shoots) |
  the dash goes to your ball (swaps places with it at level 3).
- **Charge** [charge speed]: hold to charge before release; bigger and stronger with no cap but diminishing returns
  | thickens the longer it's held | lobs farther, blasts bigger | thrown harder and bigger | dashes farther.
- **Ghost** (legendary) [walls]: passes through walls | through walls | the blast ignores walls | flies through
  walls | dashes through one wall if the far side is open. Breaks the maze, so it's legendary only.

### Runes (gold, epic+) — open sockets
- **Rune: On hit / On wall / On end / Every 1 s / On kill**: cast the shape in its socket, with 2 slots of its own.

---

## 5. Status effects (v1)

Same model as Delve: each hit adds build-up; at 100 something bigger happens, then a short immunity.

| Status | Colour | Builds | At 100 |
|---|---|---|---|
| **Burn** | orange | damage over time, stronger with more build-up | **Flare**: burn drops to 20, a big hit and a small fire blast that burns those nearby |
| **Chill** | ice blue | slows, up to 60% | **Freeze** for 2 s; a hard hit on a frozen enemy **shatters** it into icicles that chill others |
| **Shock** | yellow | each hit arcs a small jump to one nearby enemy | **Overload**: stunned 0.6 s, arcs to 3 nearby |
| **Poison** | green | slow damage over time | **Rot**: loses 15% of max HP at once; dies leaving a gas cloud that poisons |
| **Mark** | pink | no damage; marked enemies take +25% from your hits | **Detonate**: at 5 marks it pops for heavy damage |

Mixes (v1, three): **Thaw** — Burn on a chilled or frozen enemy clears both for a burst of damage. **Ignite** —
fire in a gas cloud explodes. **Conduct** — Shock arcs prefer marked enemies and jump twice as far between them.

Hard effects (not build-up): knockback, stun (from Freeze and Overload), slow (from Chill).

Player-side: can't-be-hit (dash), hurt flash with 0.5 s grace, Haste (from vitals), Shield (from one meta perk).

---

## 6. Enemies (v1)

Each is one simple neon shape; the shape says what it does (maze doc: most enemies share a shape and differ by
behaviour). Size = HP, colour = what it carries, a ring = an elite module.

| Enemy | Shape | Does | Counters |
|---|---|---|---|
| **Mite** | small red circle | swarms toward you | anything; the fodder |
| **Dart** | thin triangle | when it sees you: flashes, then charges in a straight line until a wall | dash sideways; bounce shots |
| **Brute** | big square | slow, tanky, shoves smaller enemies along, hard to knock | Pierce, Mark, Burn |
| **Spitter** | diamond | keeps its distance, needs line of sight, lobs slow orbs | break line of sight, Home |
| **Splitter** | hexagon | splits into 2, then 4 small ones | blasts, Pierce |
| **Bomber** | circle with a fuse ring | runs at you and blows up after a swell; the blast hurts enemies too | kill it in a crowd |
| **Crawler** | half-circle on a wall | slides along a wall and fires across the corridor | Bounce, Ghost |
| **Drifter** | faded outline | floats through walls slowly; can only be hit while solid (flickers in and out) | timing, Follow beams |
| **Shield** | square with a front bar | its front blocks shots; turns slowly | flank, Bounce, Orbit, blasts |
| **Nest** | spiky star, still | sits in a dead end making Mites; drops a chest when killed | go in and kill it |

**Elites** use the player's modules. An elite Spitter with Burn throws fire; an elite Splitter with Swarm splits into
homing mites. Their ring shows the module's colour, and a killed elite drops that module. Same system both ways,
fewer parts.

**Bosses** (every 5 minutes):
- **Hulk** (5:00): a square as wide as a corridor that rolls through the maze. You can't get past it, so you route
  around and hit it from behind.
- **Queen** (10:00): sits in a hall, spawning waves, with a ring of shields that open in turn.
- **Mirror** (15:00): a copy of you built from your own casts and modules. Your build fights you.

---

## 7. The maze and a run

- **Grid:** square labyrinth. Corridors 6 cells wide (three player widths), walls 2 cells thick. One maze square =
  8 cells. The maze is 24×24 squares (192×192 cells). The camera shows about 6×3 squares.
- **Layout:** a perfect maze (many dead ends) with 15% of walls knocked out to make loops, so you can't be trapped
  forever, plus 4–6 halls (2×2 or 3×3 squares opened up) for big fights and bosses.
- **Line of sight:** simple, from your centre. Outside it is dark; walls you've seen stay drawn faintly. Enemies
  outside line of sight are hidden, but close ones show a small edge tick. Enemies need line of sight to shoot.
- **Chests:** one at most dead ends. **The deeper the dead end, the better the chest.** Chests glow faintly through
  the dark within about 12 cells, so you notice side tunnels worth checking. Opening is instant: the module card
  comes up and the game pauses.
- **Waves:** enemies spawn out of sight, 20–35 cells away by path, never in your line of sight. Every minute adds
  more and new kinds. Hordes come down one corridor at set times: a moment for beams and Pierce.
- **Exit:** opens at 10:00 somewhere far away, shown on the minimap. Leaving banks all shards. Staying keeps the
  exit open and raises a shard multiplier, with a boss every 5 minutes. Dying banks half.
- **Friendly fire:** enemy blasts (Bombers) hurt enemies. Your own blasts never hurt you.

---

## 8. Between runs

**Shards** come from kills, chests and the time you survive.

- **Slots:** +1 slot to a cast.
- **Pool:** unlock modules into the chest pool. The run starts with 14 of the 28 in the pool. Some unlock by
  shards; some by doing (kill 300 burning enemies → Ignite-friendly modules turn up).
- **Shapes:** Beam and Burst as starting weapons, and as chest drops.
- **Start kit:** begin a run with one module you've found before, at common.
- **Depth:** +1 rune depth.
- **Rerolls and bans** for level-ups.
- **A few vitals:** small max HP, pickup range. Kept small: upgrades should be mechanical.
- **Codex:** every module you've seen, with its picture on all five shapes. This is where the system is learned.
- **Practice room** (early unlock): any module you've found, free to build with, on dummies and spawnable enemies.
  This is where Wings-sized spells get made and tried without a run's limits.

---

## 9. Your spells, mapped

### Lightning arena — 4 modules, v1
Burst + **Link** (edge becomes a ring of points; enemies that touch it join) + **Shock** (the ring shocks) +
**Gunner** (strikes drop inside) + **Knock** (pushes back the way they came). All four are v1 modules. The parts the
maze doc wanted that v1 doesn't do exactly: the ring keeping 6 even anchors while re-sorting by angle (v1 joins
captured enemies at their touch point).

### Wings — the big test
Weapon = **Bolt** (big, slow) +
- **Charge** — the orb grows while you hold. ✔ v1
- **Gunner** on the Weapon cast while charging — side streams. ✔ v1 (Gunner on a held bolt)
- **Home**, **Bounce** (3), **Pierce**, **Pull** — the released orb. ✔ v1
- **Trail** — small orbs left behind. ✔ v1 (trail of bolts needs a Rune: Every 1 s → Bolt; close enough)
- **Rune: On wall → Bolt + Extra ×19** — the 20-shot wall. Partly: the "perpendicular row, each slower than the
  last" pattern isn't a v1 module. Needs a later **Row** pattern module.
- **Rune: On hit → Bolt + Shrapnel** — 12 radial. ✔ v1
- **Rune: On kill → Ball + Follow + Gunner** — the spirit summon. ✔ v1, except healing allies (no allies in v1).
- **Rune: On end → Burst + Grow + Rune: Every 1 s → Burst (lobbed stars)** — the death blast and aura. ✔ at depth 3.
- **The charge-stage laser that forks.** Needs a later **Stage** trigger (On charge level → Beam + Split). Not v1.

Count: about 14 modules on one cast. v1's Weapon cast tops out at 6 slots, so the full Wings lives in the practice
room, and in a run you build a small Wings. That's the honest scope: the engine holds Wings; a run holds a third
of it.

### The 21 pressure tests (maze doc section 11)
| Test | Covered by |
|---|---|
| Fire tornado that ejects fire summons | Burst + Follow (moves with you) + Burn + Rune Every 1 s → Ball. ✔ |
| Homing bomb on a chain that tugs you | Ball + Home + Link (lone → links to you) + Explode. ✔ (the tug needs a Link pull option) |
| Held lightning that jumps, splits, scales down the chain | Beam + Shock + Split. Chain scaling: later |
| Laser that splits head-on and merges | Beam + Bounce. Head-on split and merging: later |
| Turn projectiles in sight homing, steal enemy shots, grab and throw enemies | later (needs capture) |
| Figure-eight boomerang that deflects shots | Return; figure eight and deflect: later |
| Crossbow faster per marked enemy | Mark + later scaling module |
| Hammer slam with lunge, shockwave, backflip, spike chains | Dash + Home + Explode + Knock, roughly; backflip and spike chains later |
| Arrow rain at a flare | Burst + Rune Every 1 s → Bolt aimed in; flare targeting later |
| Curse/bless/immortal ability | later (no allies in v1) |
| Grab ray that freezes and throws | later (capture) |
| Helix ladder with linked pairs, entity transform | Bolt + Extra + Link; helix and transform later |
| Smart sticky, detonate on action | later (sticky + remote trigger) |
| Stomp | Dash + Explode + Knock. ✔ |
| Rapier lunge with kickback | Dash + Home + Pierce. ✔ (kickback later) |
| Water wave of pillars | later (formations) |
| Bouncing orb pet you smack | Ball + Bounce + Explode + Return. ✔ (smack-to-launch later) |
| Rocket boots with bomb drops and airstrike | Dash + Trail + Rune Every 1 s → Burst. Partly |
| Spinning black hole with spiral lasers that wraps walls | Bolt + Pull + Gunner + Ghost. Partly |
| Projectile from cursor at you | later (origin modules) |
| Teleport knife | Dash + Follow-style swap; later as its own module |

About a third are complete in v1, another third partly. The rest need four later systems, in this order of value:
**capture/throw**, **origin** (fire from the aim point or a mark), **pattern** (row, helix, figure eight, formations),
**stage triggers** (charge levels, speed thresholds). All fit the channel model without changing it.

---

## 10. Look

- Near-black blue background, a faint cell grid on floors, walls as glowing double lines with a dark fill.
- Line + soft fill (style C on the board) is my pick: shapes read at a glance, glow stays cheap.
- Colour has one job each: **player** cyan/white, **enemies** red/magenta, **enemy shots** red and always drawn on
  top, **XP** green, **chests and gold** yellow, **statuses** in their colours. Size = HP. Rings and particles =
  modules.
- Module families have colours: Path cyan, Form white, Payload by element, Spawner yellow, Rules magenta, Runes gold.
- Rarity: Common white, Rare blue, Epic purple, Legendary gold.

## 11. Tech

Same setup as Delve: plain HTML + ES modules, no build step, a `sw.js` cache with a VERSION bump, GitHub Pages,
landscape only. Rendering in **WebGL2** with additive blending and pre-made glow sprites, because canvas 2D blur
on hundreds of glowing things will drop an iPhone 11 below 60. Fixed-step simulation, separate from drawing. The
module system is data: shapes, channels and modules are JSON, so new modules don't need new code paths.

## 12. Build order (once you say go)

1. Maze, line of sight, movement, the three sticks, Bolt, Mite. Get the feel right on the phone.
2. Ball and Dash, five modules (Bounce, Burn, Extra, Explode, Home) on all three casts. Proves the channel model.
3. Chests, level-ups, rarity, the build screen.
4. All enemies, statuses, waves, exit, the first boss.
5. The rest of the modules, Runes, meta and the practice room.
