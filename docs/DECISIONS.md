# Spellmaze — decisions

Rulings from the designer, newest first. The Riffle pack `spellmaze` holds the cards; this is the log.
"Mine" marks a call I made myself where they said idk or left it to me.

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
