# Spellmaze — decisions

Rulings from the designer, newest first. The Riffle pack `spellmaze` holds the cards; this is the log.
"Mine" marks a call I made myself where they said idk or left it to me.

## 2026-11-17 — stage 3 answered (they played it); round 4 fixes built (v0.5.0)

Answers: chests good, rarity good, Explode small start good; duplicates and level-ups decent. Level-ups "too few. Seemed
too weak or simple. Too many choices not enough options." Build screen: "don't like the look". Rooms: "bigger, more room
shapes, rooms with fewer entrances". Deck notes: **balancing way off: way too many enemies from the get go, no way to
increase damage, enemies constant, not waves you can prepare for, from every direction. No dash i-frames. Don't like
the upgrade UI. The chest should look like something else, doesn't fit the theme. Duration upgrade (summon life,
projectile life, dash range). Summons slowly lose HP; lower base damage, higher HP, collide with each other.**
Questions: empty start → **pick 1 of 3**, plus "every x upgrades can offer a module, first one at the first upgrade".
Slots 3/2/2 between-run growth: go. Stage 4 (camps first, then enemies): go. **"I want destructible tiles. Some making
up walls."**

Built (round 4), my numbers:
- Crowd: 5 wanderers at the start, growing slowly. Waves at 0:30 then every 45 s, **warned 10 s ahead**: a red bar on
  each screen edge it comes from and "Wave N in 7" under pause. Wave 1 from 1 side, 2-3 from 2, then 2 or 3. Size
  8, 14, 20... arriving over ~3 s. Enemies that fall behind come back on their own side.
- Dash: untouchable for 0.35 s after it ends (a pale ring shows it), on top of the dash itself.
- New "you" cards: **Power** +15% damage from everything, **Duration** +15% bolt range, spawn life, dash length.
  Bigger steps: health +25, speed +8%, cooldowns 10%, pickup 1.5 cells.
- Level-ups: 3 cards, not 4; quicker (XP 5, 8, 11...). New-module cards at the first level-up and every 3rd after
  (levels 2, 5, 8...), each already on a cast with room, one tap. Runs start with a pick of 3 common modules.
- Spawn: 90 health (was 40), drains over its 16 s life so hits shorten it; contact 2 + speed×0.4 (was 4 + ×0.7);
  balls bump off each other.
- New card look (rarity band, icon, level pips) and build screen (a column per cast, slot squares, empty slots shown,
  "you" chips). Line icons in `js/ui.js`.
- **Chest → Shard**: a standing gold crystal. Code still calls them chests.
- Rooms: 8 per medium maze, shapes rect, round, L, cross, pillared; 2 ways in (3 for big rooms), never cutting the maze
  off. Roads are now shortest paths (trimmed entrances can't reopen).
- Destructible walls go with camps in stage 4.

## 2026-11-17 — stage 2 answered; stage 3 built

Answers: every module on every cast good. Build screen: decent (no comment). Explode: "should start out very weak/
small" (now 1.7 cells, 8 at level 1). Homing needs "more big rooms" (9 halls, up to 4x4). Spawn cast good.
Chests: **1 in 4 dead ends plus halls, and from camps; camps in halls.** **Door and keys: go.** **Level-ups next: go.**

Stage 3 (v0.4.0), my calls inside the agreed plan: runs start with no modules; chests offer one module of a rolled
rarity (rarer each minute), placed in a cast you choose or scrapped for XP; duplicates promote or level; full casts ask
what to replace. Level-ups: 4 cards from modules below their cap (weighted 3) and vitals (health +20, speed +7%,
cooldowns 8% faster, pickup +1 cell). Rarity caps Common 3, Uncommon 4, Rare 5, Epic 7, Legendary 9. Slots 3/2/2.
Practice build is a setting (off by default): free build, no chests or level-ups.

## 2026-11-17 — stage 2 built (my calls, to be reviewed in the stage 2 decks)

- Five modules (Extra, Bounce, Home, Burn, Explode) on all three casts, levels 0-5, numbers in `js/modules.js`.
  Modules act at shared moments (contact, wall, end); a module with nothing to do on a shape won't be allowed there.
- Spawn cast: a thrown Ball on a 7 s cooldown, stick above-left of fire; enemies near it go for it; solid to enemies.
- Every dash now does a small hit (3) to everyone passed, so payloads have something to ride on.
- Burn: build-up per hit, damage over time grows with build-up, fades 2 s after the last hit; at 100 it Flares (25 and a
  small fire blast that burns others).
- Build screen in the pause menu: free levels for testing until chests and level-ups (stage 3).
- Waves now come from 2 or 3 sides.

## 2026-11-17 (later) — stage 1 decks and read-back answered

- Stage 1 build: good on every part (pistol, SMG, auto, dash, crowds hold you, waves, flat look).
- **Sight: Remembered**, and it **fades out very slowly**. **No enemy arrows.** Built: memory fades over 2 minutes,
  arrows off by default (still a setting).
- **Camera: Far** (28 cells top to bottom). Default now.
- **Corridors: Mixed**, go.
- **Sizes: wall thickness** (and camera). "Should have tunnel sized walls some places." Built: about a third of maze rows
  and columns sit 4 cells further apart, so some walls are as thick as a tunnel.
- **Rounds: each weapon picks.** Built: Pistol and Auto trickle back; SMG does a full reload (1.4 s) when empty or
  after a pause, shown as a white sweep inside the ring. Firing cancels a reload.
- **Firing lives on the weapon** (a weapon = shape + trigger + rounds); modules can change it. Go.
- **Crowds hold you:** go.
- Read-back: all good. Notes:
  - Endless, but maybe **a door to the next level**: harder, wave timer resets, needs **x keys spread through the
    maze** to open. Idea, not yet decided.
  - **Waves come from some sides, not every side.**
  - Chests: the problem was **too many chests in dead ends**. Not every dead end; they can also be in the halls.
  - Generic terms vs my channels: "Idk. I liked ur system as well. Just need to test and see." So the module system
    gets built and tested rather than designed further on paper.

## 2026-11-17 — first pack answered (11 decks, read in full)

### Start
- **Start building: GO.** Stage 1 begins (maze, sight, movement, sticks, Bolt, Mite).
- Working title Spellmaze: go.
- **Endless.** No exit. The run is over when you die. (The exit part was marked PROBLEM: "No. Endless.";
  the run-end card was workshopped.) How shards bank on death is open again.

### The maze and the run
- **Corridor width: Mixed** (mostly 3 player widths, some 2-wide tunnels, 4-wide main roads).
- Maze **sizes: PROBLEM**, no comment. Which size is off is unknown, so stage 1 makes corridor set, maze size and
  camera zoom settings to try on the phone, and a card asks.
- **No minimap.**
- **Line of sight: try three levels** — remembered (current: seen walls stay faint), see everything, and dark
  (nothing outside sight, not even the maze outline). Stage 1 has all three in settings.
- Hide unseen enemies: workshop, no comment. Stage 1 has the edge ticks as a setting; asked again with the game.
- Chest glow: workshop, no comment. Asked again once chests exist (stage 3).
- **Chests random**, not deeper-is-better; maybe better with time.
- **Camps**: the maze is full of camps spread through the map, different enemy tiers in each. **Every minute or
  so a wave of one tier comes from every direction.**
- **Most enemies 2×2** like the player. **Enemies don't overlap** (for the most part).
- Your blasts never hurt you; enemy blasts hit everything: go.

### Controls and screen
- **Firing is per weapon.** Some hold to auto-fire, some drag and release, some ignore taps. Some can auto-attack
  and you take over to aim. A basic pistol: drag and release, or tap to fire at the nearest enemy.
- **Ammo: not Brawl Stars bars.** "A mix of rounds ammo model", changed per weapon. Shown as a **radial segmented
  ring around the fire stick**; past a high count, or for a continuous weapon, a continuous fill instead.
- Melee could be its own weapon/ability (tap was a melee idea; fine as it is).
- **Summon: charges over time, a cooldown** (not from damage dealt). Base summon reads as "spawn", not a summon.
- **You can have more casts** than three.
- **Dash is upgradeable into other things**, and **as a base it deletes enemy bullets you dash through.**
- No aim assist: go.

### Look
- **Style: solid and flat** (none of the four boards liked; "look too similar"). Stage 1 is flat fills, no glow.
- **Player white** instead of cyan.
- Enemies: red and magenta is too few colours. Open.
- **Poison purple.** **Rarity gains Uncommon, green.**
- Size = health, statuses in their colours, green/gold loot: good.

### Spells and modules
- Channels model: good. Fallbacks: PROBLEM — "unless we don't allow it in the first place". So a module that has
  no real answer on a shape **isn't allowed there**, instead of getting a weak fallback.
- **Generic terms that combine** (their big note): Capacity on a gun = more bullets, on Bounce = more bounces, on
  Burn = longer. Speed on a gun = fire rate, on Bounce = faster after bounce, on Burn = faster ticks. Some things
  don't combine (Burn on Home has nowhere to go). **Needs a formula: events/triggers, and modules combine only
  with some events or deliverables.** Goal: build Wings from parts.
- **Augments**: things that change how a module works, hooking its trigger. E.g. Bounce retargets (max angle,
  distance); each bounce +35% speed but −20% knockback and size; on bounce explode / split / summon a homing orb.
  Often with a drawback (cooldown, strength). Some improve some modules and worsen others.
- **Player upgrades too:** HP, move speed, cooldown multiplier, resistances, reactive passives (summon 3 spawns
  when badly hurt).
- Inherit: payloads pass down (decent). **Link can split into a split.** **Depth is capped by the count of
  modules, not a hard number.**
- Rarity caps 3/5/7/9: go. Their aside: maybe rarity also sets starting level, or no cap and rarity boosts each
  level's gain with diminishing returns. Open.
- Duplicates promote, move modules freely, numbers shown, runes in v1, shape cards in chests: go.
- **Extra on the Dash = dashes in a row**, not extra charges.
- Payloads on the Dash: go, small damage.
- Laser (Beam) with Orbit and Return feels off. Shock on a Beam may become a zigzag lightning bolt.
- Ghost in a maze: go. Modules you want: go.
- How deep spells nest: idk → **mine:** follows their note, depth is capped by module count, no separate cap.
- Lightning arena, Wings: decent. Wings "too big for a run": PROBLEM (they want it reachable).

### Enemies and statuses
- Ten enemies: good, "More." Elites/Hulk/Queen/Mirror good; the Mirror boss: go.
- Elites drop modules: idk → **mine:** yes, an elite drops the module it carries (same system both ways).
- Five statuses and three mixes: good. Beams build slower: go. Enemies use statuses: go.

### Between runs
- Unlock by doing, codex, practice room: go. Start kit and rerolls/bans: yes.
- Slots, pool, shapes, depth, vitals as shard buys: idk. Left for when meta is built (stage 5).
