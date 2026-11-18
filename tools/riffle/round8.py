"""Round 8 decks: keys, Hulk on axis lines, slower statuses, clouds; and what stage 5 should be.

python tools/riffle/round8.py  ->  tools/riffle/decks/round8-*.json
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


deck("round8-build", "Keys, Hulk, statuses", "builds", 15, [
    {"id": "fixes", "kind": "report", "rarity": "uncommon", "title": "Your round 7 notes",
     "text": "4 keys and no door, the Hulk on straight lines, slower statuses, merged gas clouds.",
     "why": "Everything from the last deck. Mark any part that's off.",
     "details": "Version 0.11.0. Close and reopen the app twice to get it.",
     "parts": [
         part("keys", "4 keys", "No door. Four random camps have a gold-ringed keeper with a key. The 4th key clears "
              "the floor and you move on.", images=["keeper.png"]),
         part("hulk", "Hulk", "Rolls only along straight lines, turning 90 degrees at a time on a cooldown. It "
              "arrives in the biggest room you can't see.", videos=["hulk.mp4"]),
         part("statuses", "Statuses", "Build-up about half as fast, and after a burst (freeze, rot...) that enemy "
              "can't burst from it again for 5 s."),
         part("clouds", "Gas clouds", "Drawn on the floor under walls and everything, overlapping clouds as one "
              "shape.", videos=["poison.mp4"]),
         part("shard", "Shard", "Here it is: the double star, close up.", images=["shard-star-game.png"]),
     ]},
])

deck("round8-questions", "Stage 5", "builds", 16, [
    {"id": "next", "kind": "options", "rarity": "rare", "title": "What stage 5 is",
     "text": "Stage 4 is done. What comes first?",
     "why": "The build order says all of these come next; it's a lot, so it goes a piece at a time.",
     "pick": "a",
     "details": "More modules: Pierce, Orbit, Return, Grow, Haste, Split, Knock, Pull, Leech, Shrapnel, Trail, Echo... "
                "from the design list, a few at a time, each on all three casts.\n\nRunes: modules that cast another "
                "spell on hit, on wall, on end, every second or on kill.\n\nBetween runs: what you keep (slots, "
                "unlocks) after a run.",
     "options": [{"id": "a", "label": "More modules", "text": "The design's modules, a few at a time, on all three casts."},
                 {"id": "b", "label": "Runes", "text": "Spells inside spells: on hit, on wall, on end, every 1 s, on kill."},
                 {"id": "c", "label": "Between runs", "text": "What you keep after a run: slots, unlocks."},
                 {"id": "d", "label": "Weapons, casts", "text": "More weapons and a fourth cast."}]},
    {"id": "arena", "kind": "question", "rarity": "uncommon", "title": "Where bosses fight",
     "text": "The Hulk now arrives in the biggest room. Should a boss lock you into its room until one of you wins?",
     "why": "A locked arena makes the fight a set piece with room to move; an open one lets you run and use the maze.",
     "pick": "No lock. It starts in the biggest room and roams; the maze is part of the fight."},
])
print("decks written")
