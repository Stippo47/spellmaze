"""Round 5 decks: bigger maze, breakable blocks, fixes; shard look board.

python tools/riffle/round5.py  ->  tools/riffle/decks/round5-*.json
"""
import json, pathlib

HERE = pathlib.Path(__file__).resolve().parent
DECKS = HERE / "decks"
FILMS = HERE.parent.parent / "films"
F = "../../../films/"


def deck(id_, title, topic, order, cards, **kw):
    d = {"title": title, "topic": topic, "order": order, "cards": cards, **kw}
    (DECKS / f"{id_}.json").write_text(json.dumps(d, indent=1, ensure_ascii=False), encoding="utf-8")


def part(id_, title, text, images=None, videos=None):
    p = {"id": id_, "title": title, "text": text}
    if images: p["images"] = [F + i for i in images]
    if videos: p["videos"] = [F + v for v in videos]
    return p


deck("round5-build", "Bigger maze, breakable blocks", "builds", 10, [
    {"id": "build", "kind": "report", "rarity": "rare", "title": "Twice the maze",
     "text": "Every cell is now 2x2, dead ends are short, and brown blocks can be broken. Plus your fixes.",
     "why": "Your notes from the fixes deck and the start of the stage 4 deck. Mark any part that's off.",
     "details": "Version 0.7.0. Close and reopen the app twice to get it.",
     "parts": [
         part("scale", "Maze 2x", "Corridors and walls twice as big; you're the same size. Same number of squares, "
              "so a run covers more ground.", images=["maze-overview.png"], videos=["pistol.mp4"]),
         part("deadends", "Short dead ends", "A dead end is at most 2 squares deep now; longer branches join "
              "back into the maze. No round rooms."),
         part("blocks", "Breakable blocks", "Brown blocks: arms off corridor walls (some reach across), crates "
              "you go round, and barriers between corridors. Shots chip them, dashes hit hard, brutes grind through.",
              videos=["blocks.mp4"]),
         part("dash", "Dash and spawn", "Dash 9 cells (was 6). A spawn is thrown softly and rolls about 4 cells."),
         part("dart", "Dart", "Sees you from 11 cells (was 16) and charges faster, for a shorter way.",
              videos=["enemies.mp4"]),
         part("camps", "Camps go home", "Leave a camp's room for 3 seconds and it goes back, heals and rests."),
         part("levels", "Level-up cards", "The first level-up offers new modules. After that any card can be a new "
              "module, more often every 3rd level. Bands say what kind: New module, Upgrade, You.",
              images=["card-level.png"]),
         part("drag", "Build: drag", "Drag a module onto another cast to move it. No buttons.", images=["build.png"]),
     ]},
])

looks = json.loads((FILMS / "shard-looks.json").read_text(encoding="utf-8"))
deck("round5-questions", "Shard look and a question", "builds", 11, [
    {"id": "shard", "kind": "board", "rarity": "uncommon", "title": "What a shard looks like",
     "text": "You marked the gold crystal a problem. Tick the looks you like for the module pickup.",
     "why": "It sits in dead ends and rooms and has to read as 'a spell part' from across the screen.",
     "pick": ["rune", "rarity"],
     "details": "The colour idea works with any of them: the pickup shows the rarity of what's inside.",
     "items": [{"id": k, "label": v["label"], "text": v["text"], "image": F + f"shard-{k}.png"} for k, v in looks.items()]},
    {"id": "after", "kind": "question", "rarity": "common", "title": "The after images",
     "text": "You said the enemy pictures had after images. Was that the films (trails behind moving things)?",
     "why": "If it's in the game itself I'll fix it there; if only the films, I'll film differently.",
     "pick": "I think it was the films: they're made from 30 snapshots a second, which smears fast darts."},
])
print("decks written")
