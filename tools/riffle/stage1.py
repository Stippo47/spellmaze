"""Stage 1 decks: the playable build report, its questions, and a read-back of the first pack's answers.

python tools/riffle/stage1.py  ->  tools/riffle/decks/stage1-*.json, readback.json
Films and stills come from tools/film.mjs (folder films/).
"""
import json, pathlib

HERE = pathlib.Path(__file__).resolve().parent
DECKS = HERE / "decks"
F = "../../../films/"


def deck(id_, title, topic, order, cards, **kw):
    d = {"title": title, "topic": topic, "order": order, "cards": cards, **kw}
    (DECKS / f"{id_}.json").write_text(json.dumps(d, indent=1, ensure_ascii=False), encoding="utf-8")


def part(id_, title, text, images=None, videos=None):
    p = {"id": id_, "title": title, "text": text}
    if images: p["images"] = [F + i for i in images]
    if videos: p["videos"] = [F + v for v in videos]
    return p


# ---------------------------------------------------------------- the build
deck("stage1-build", "Stage 1: playable", "builds", 1, [
    {"id": "what", "kind": "report", "rarity": "rare", "title": "Stage 1 runs",
     "text": "Maze, sight, moving, three test weapons, the dash, Mites and waves. Films of a bot playing it.",
     "why": "This is the feel test before any spell system. Mark any part that's off.",
     "details": "A bot plays these films through the real touch controls, so the yellow dots are its thumbs.\n\n"
                "No level-up choices, chests, modules, summon or other enemies yet: those are stages 2 to 4. "
                "Levels count up but give nothing.\n\nThe pause button (top middle) holds every setting below, so you can "
                "try them on the phone once it's online.",
     "parts": [
         part("pistol", "Pistol", "Drag to aim, let go to fire one. A quick tap fires at the nearest enemy you can see. "
              "6 rounds round the fire stick, refilling one by one after a short pause.", videos=["pistol.mp4"]),
         part("smg", "SMG", "Hold and drag: keeps firing. Taps do nothing. 40 rounds, so the ring is one smooth bar "
              "instead of segments.", videos=["smg.mp4"]),
         part("auto", "Auto", "Fires at the nearest enemy you can see by itself. Drag to take over and aim.",
              videos=["auto.mp4"]),
         part("dash", "Dash", "Tap: dash where you're walking. Drag: aim it, let go. 2 charges. Can't be hit while "
              "dashing, and it shoves enemies aside.", videos=["dash.mp4"]),
         part("crowd", "Crowds hold you", "Enemies never overlap, and they push back on you a little, so a packed "
              "corridor holds you until you dash or shoot through.", videos=["dash.mp4"]),
         part("waves", "Mites and waves", "Mites come from out of sight along the paths, more each minute. On every "
              "minute a wave comes from all sides. Easy on purpose, since there are no upgrades yet."),
         part("look", "Flat and solid", "Your pick: flat fills, no glow. You are white, enemies red, XP green, the "
              "rounds gold.", images=["pistol.jpg"]),
     ]},
    {"id": "sight", "kind": "report", "rarity": "uncommon", "title": "Three kinds of sight",
     "text": "The three you asked to try, all in settings: remembered, see all, and dark.",
     "why": "Same moment, three settings. Mark the one you'd keep, or comment.",
     "parts": [
         part("remember", "Remembered", "What you've seen stays faint. Enemies out of sight are hidden; close ones "
              "show as a small red arrow beside you (you can turn the arrows off).", images=["sight-remember.png"]),
         part("all", "See all", "The whole maze and every enemy, always.", images=["sight-all.png"],
              videos=["seeall.mp4"]),
         part("dark", "Dark", "Nothing outside your sight, not even walls you've passed.", images=["sight-dark.png"],
              videos=["dark.mp4"]),
     ]},
])

# ---------------------------------------------------------------- questions
W = [("mixed", "Mixed", "Mostly 3 wide, 4-wide roads to the corners, 2-wide tunnels into dead ends. Your pick last time."),
     ("standard", "All 3 wide", "Every corridor three of you wide."),
     ("narrow", "All 2 wide", "Tight. A crowd fills a corridor."),
     ("wide", "All 4 wide", "Room to kite.")]
deck("stage1-questions", "Stage 1: questions", "builds", 2, [
    {"id": "sizes", "kind": "options", "rarity": "rare", "title": "Which size was off?",
     "text": "You marked the maze sizes as a problem with no comment. Which one?",
     "why": "I can't tell which number bothered you. Each is now a setting, so whichever it was can be tried both ways.",
     "pick": "c",
     "options": [{"id": "a", "label": "Corridor width", "text": "How wide the corridors are."},
                 {"id": "b", "label": "Wall thickness", "text": "Walls 2 cells thick (one of you)."},
                 {"id": "c", "label": "The whole maze", "text": "24×24 squares: a long way to walk."},
                 {"id": "d", "label": "Camera distance", "text": "How much of the maze fits on screen."}],
     "details": "My guess is the whole maze: 24×24 squares is about 240 cells across, and with endless runs you'd "
                "rarely see most of it. Settings now have Small (16), Medium (24) and Large (32)."},
    {"id": "corridors", "kind": "board", "rarity": "uncommon", "title": "Corridor sets",
     "text": "The four corridor sets, from above with see-all on. Tick the ones to keep.",
     "why": "Width decides whether a horde is a wall or something you run round.",
     "pick": ["mixed"],
     "items": [{"id": k, "label": l, "text": t, "image": F + f"widths-{k}.png"} for k, l, t in W]},
    {"id": "camera", "kind": "board", "rarity": "uncommon", "title": "Camera distance",
     "text": "How far out the camera sits. Tick the ones to keep.",
     "why": "Closer looks bigger and reads better on a phone; farther shows what's coming.",
     "pick": ["22"],
     "items": [{"id": str(v), "label": l, "text": f"{v} cells top to bottom.", "image": F + f"view-{v}.png"}
               for v, l in [(16, "Close"), (22, "Normal"), (28, "Far"), (36, "Farther")]]},
    {"id": "rounds", "kind": "options", "rarity": "rare", "title": "How rounds come back",
     "text": "How should a weapon get its rounds back?",
     "why": "You wanted rounds that differ per weapon. Trickle-back means you never quite run dry; a full reload means a gap to plan for.",
     "pick": "c",
     "options": [{"id": "a", "label": "One by one", "text": "Rounds trickle back after a short pause (all three now)."},
                 {"id": "b", "label": "Full reload", "text": "Empty the magazine, then a reload refills it all."},
                 {"id": "c", "label": "Each weapon picks", "text": "Pistol trickles, SMG reloads all at once, and so on."},
                 {"id": "d", "label": "Something else", "text": "Add a comment."}]},
    {"id": "trigger", "kind": "question", "rarity": "epic", "title": "Where firing lives",
     "text": "Is how a weapon fires (let go, hold, auto) part of the weapon, so modules can change it?",
     "why": "If it's part of the weapon, a pistol and an SMG are different weapons with the same Bolt shape. "
            "If it's a module, any cast could be made hold-to-fire, which is more freedom but one more slot spent.",
     "pick": "Part of the weapon. Some modules change it: Charge turns let-go into hold-to-charge.",
     "details": "Same goes for the summon (cooldown) and the dash (charges): each cast has a trigger and its own "
                "way of getting uses back, and modules can bend both. This decides how the next stage's "
                "Spawn and Dash casts are built."},
    {"id": "crowd", "kind": "question", "rarity": "uncommon", "title": "Crowds hold you",
     "text": "Enemies push back on you, so a packed corridor holds you until you dash or shoot through?",
     "why": "Without it you walk through any crowd and the maze isn't dangerous. With it, dead ends are real traps.",
     "pick": "Yes. Dash shoves through."},
])

# ---------------------------------------------------------------- read-back
deck("readback-1", "What I took from your answers", "start", 3, [
    {"id": "run", "kind": "report", "rarity": "rare", "title": "Runs, maze and look",
     "text": "Your answers to the first pack, as I understood them. Mark anything I've got wrong.",
     "why": "These now steer the build. Better to catch a misreading here than in code.",
     "parts": [
         part("endless", "Endless", "No exit. The run ends when you die. How shards are kept on death is open again."),
         part("camps", "Camps and waves", "Camps of different enemy tiers spread through the maze. About every "
              "minute a wave of one tier comes from every side."),
         part("chests", "Chests random", "Chests anywhere, not better in deeper dead ends. Maybe better as time goes on."),
         part("size", "2×2 enemies", "Most enemies the same size as you, and they don't overlap."),
         part("hud", "Screen", "No minimap. Rounds as a ring round the fire stick. Summon on a cooldown. "
              "Dash deletes bullets you dash through."),
         part("look", "Look", "Flat and solid. You white, Poison purple, Uncommon green as a new rarity. Enemies "
              "need more colours than red and magenta."),
     ]},
    {"id": "spells", "kind": "report", "rarity": "epic", "title": "Spells, as I read them",
     "text": "Your notes on how modules combine. Mark anything I've got wrong before I design the formula.",
     "why": "The next design deck turns this into the rules for what combines with what.",
     "parts": [
         part("terms", "Generic terms", "A few shared terms that mean something on anything: Capacity is more "
              "bullets on a gun, more bounces on Bounce, longer on Burn. Speed is fire rate, faster after bounce, "
              "faster ticks."),
         part("events", "Events, not fallbacks", "A module that has nothing to do on a shape isn't allowed there, "
              "instead of getting a weak stand-in. Modules hook into events (hit, bounce, end...) and only combine "
              "where an event fits."),
         part("augments", "Augments", "Change how one module works by hooking its event: Bounce that retargets, "
              "speeds up each bounce but shrinks, or explodes, splits or spawns on each bounce. Often with a drawback."),
         part("depth", "Depth by count", "No fixed nesting limit: how deep a spell goes is capped by how many "
              "modules it holds. Link can feed a Split."),
         part("player", "Player upgrades", "Upgrades for you too: health, speed, cooldowns, resistances, and "
              "reactive ones (3 spawns when you're badly hurt)."),
         part("casts", "More casts", "More than three casts is allowed. The Summon starts as a plain Spawn."),
         part("elites", "My call: elites", "You weren't sure if elites drop modules. I've said yes, they drop the "
              "one they carry, so it's one system both ways."),
     ]},
])
print("decks written")
