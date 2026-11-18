"""Round 4 decks: the fixes from playing stage 3, and the destructible-walls question.

python tools/riffle/stage3b.py  ->  tools/riffle/decks/stage3b-*.json
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


deck("stage3b-build", "Fixes from your play", "builds", 7, [
    {"id": "fixes", "kind": "report", "rarity": "rare", "title": "Your notes, fixed",
     "text": "Fewer enemies, waves you see coming, dash safety, Power and Duration, new cards, shards, new rooms.",
     "why": "Everything from your stage 3 notes except breakable walls, which come with camps. Mark any part that's off.",
     "details": "Version 0.5.0. Close and reopen the app twice to get it.\n\nAll numbers are first guesses; "
                "say 'more' or 'less' on any part.",
     "parts": [
         part("crowd", "Crowd and waves", "5 enemies at the start, a few more each minute. Waves at 0:30, then every 45 s, "
              "warned 10 s ahead by a red bar on the screen edge they come from and a countdown. Wave 1 from one side, "
              "then two, later sometimes three.", images=["wave-warn.png"], videos=["wave.mp4"]),
         part("dash", "Dash safety", "Nothing can touch you during a dash or for 0.35 s after it. A pale ring shows "
              "while you're safe."),
         part("power", "Power and Duration", "New cards for you: Power is +15% damage from everything. Duration is "
              "+15% bolt range, spawn life and dash length."),
         part("levels", "Level-ups", "3 cards, not 4, coming quicker. Bigger steps: health +25, speed +8%, "
              "cooldowns 10%.", images=["card-level.png"]),
         part("modules", "New modules", "Runs start with a pick of 3. The first level-up and every 3rd after "
              "(levels 2, 5, 8) offer new modules, each already on a cast.", images=["card-start.png", "card-modules.png"]),
         part("spawns", "Spawns", "90 health (was 40), draining over 16 s so hits shorten their life. They hit "
              "softer and bump off each other.", videos=["spawns.mp4"]),
         part("look", "Cards and build", "New look: a rarity band, an icon, level pips. The build shows a column per "
              "cast with empty slots.", images=["card-shard.png", "build.png"]),
         part("shard", "Shards", "Chests are now shards: a gold crystal standing in dead ends and rooms. Same as "
              "before inside.", images=["wave-warn.png"]),
         part("rooms", "Rooms", "8 rooms, bigger: square, round, L, cross and pillared. Most have 2 ways in, big ones 3. "
              "Rooms tinted, shards gold, you white.", images=["maze-overview.png"]),
     ]},
])

deck("stage3b-questions", "Breakable walls", "builds", 8, [
    {"id": "walls", "kind": "options", "rarity": "rare", "title": "Breakable walls",
     "text": "You asked for destructible tiles making up some walls. Which walls, and what breaks them?",
     "why": "Breaking walls opens shortcuts and new ways into rooms, for you and for enemies.",
     "pick": "a",
     "options": [{"id": "a", "label": "Cracked blocks", "text": "Some thin walls are cracked blocks. Any hit chips them; blasts break them fast."},
                 {"id": "b", "label": "Blasts only", "text": "Cracked blocks, but only blasts and dashes break them."},
                 {"id": "c", "label": "Room walls", "text": "Rooms' sealed sides are cracked, so you can make your own way in."},
                 {"id": "d", "label": "Every wall", "text": "All walls can break, thin ones fast, thick ones slowly."}]},
    {"id": "enemies", "kind": "question", "rarity": "uncommon", "title": "Enemies breaking walls",
     "text": "Should some enemies break cracked walls too?",
     "why": "A wall you hid behind stops being safe, and the maze slowly opens up during a run.",
     "pick": "Later: one heavy enemy type breaks them when it comes. Mites don't."},
])
print("decks written")
