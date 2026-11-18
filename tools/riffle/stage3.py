"""Stage 3 decks: chests, level-ups, rarity, practice switch; and what's next.

python tools/riffle/stage3.py  ->  tools/riffle/decks/stage3-*.json
"""
import json, pathlib

HERE = pathlib.Path(__file__).resolve().parent
DECKS = HERE / "decks"
F = "../../../films/"


def deck(id_, title, topic, order, cards, **kw):
    d = {"title": title, "topic": topic, "order": order, "cards": cards, **kw}
    (DECKS / f"{id_}.json").write_text(json.dumps(d, indent=1, ensure_ascii=False), encoding="utf-8")


def part(id_, title, text, images=None):
    p = {"id": id_, "title": title, "text": text}
    if images: p["images"] = [F + i for i in images]
    return p


deck("stage3-build", "Stage 3: chests and levels", "builds", 5, [
    {"id": "run", "kind": "report", "rarity": "rare", "title": "You earn your build now",
     "text": "Runs start with no modules. Chests give them, level-ups level them, rarity caps how far.",
     "why": "First time the game is a run rather than a test bench. Mark any part that's off.",
     "details": "Version 0.4.0. Close and reopen the app twice to get it.\n\nThe free build is still there: "
                "Pause → Practice build: On. That turns off chests and level-ups for that run.",
     "parts": [
         part("chests", "Chests", "Gold boxes in a quarter of dead ends and one in every hall, as you picked. "
              "Walk in to open: the game waits while you choose which cast gets the module, or scrap it for XP.",
              images=["offer-chest.png"]),
         part("dupes", "Duplicates", "The same module in the same cast: a rarer one promotes yours (level kept, "
              "cap raised); same or lower gives +1 level. A full cast asks which module to replace."),
         part("levels", "Level-ups", "4 cards: +1 level to modules you have (below their cap), or you: health, "
              "speed, cooldowns, pickup range.", images=["offer-level.png"]),
         part("rarity", "Rarity", "Common 3, Uncommon 4 (green), Rare 5, Epic 7, Legendary 9: the level each can "
              "reach. Chests get rarer as the run goes on."),
         part("build", "Your build", "Pause → Build shows the run's modules and lets you move one to another cast; "
              "it keeps its level. Slots: Weapon 3, Spawn 2, Dash 2.", images=["run-build.png"]),
         part("halls", "More big rooms", "Your note: homing needs room. 9 halls now, up to 4×4 squares.",
              images=["maze-overview.png"]),
         part("explode", "Explode starts small", "Level 1 is a small, weak pop (1.7 cells, 8 damage); level 5 is "
              "3.5 cells, 28."),
     ]},
])

deck("stage3-questions", "Stage 3: questions", "builds", 6, [
    {"id": "start", "kind": "options", "rarity": "rare", "title": "The empty first minutes",
     "text": "Runs start with no modules, so early level-ups only offer health, speed and the like. Fix it how?",
     "why": "The first chest can be two minutes away. Until then the build part of the game hasn't started.",
     "pick": "a",
     "options": [{"id": "a", "label": "Pick 1 of 3", "text": "Each run starts by choosing one of 3 common modules."},
                 {"id": "b", "label": "Level-ups give some", "text": "While you have free slots, level-ups can offer a new module."},
                 {"id": "c", "label": "A chest near start", "text": "One chest always sits a short walk away."},
                 {"id": "d", "label": "Leave it", "text": "The plain start is fine."}]},
    {"id": "slots", "kind": "question", "rarity": "uncommon", "title": "Slots",
     "text": "Weapon 3 slots, Spawn 2, Dash 2 at the start, more bought between runs?",
     "why": "Few slots make every chest a real choice. Many let builds stack up faster.",
     "pick": "Yes, as it is."},
    {"id": "next", "kind": "question", "rarity": "rare", "title": "Stage 4 next",
     "text": "Next: the other enemies, camps in halls guarding their chests, statuses, and the first boss.",
     "why": "Mites alone don't test the modules. Camps in halls also give the door-and-keys idea its keys later.",
     "pick": "Yes. Camps first, so halls have something in them, then enemies two or three at a time.",
     "details": "You said camps go in halls. Each camp would be a tier of enemies sitting in a hall around its "
                "chest, waking when you come near. The door and keys come after, once camps exist."},
])
print("decks written")
