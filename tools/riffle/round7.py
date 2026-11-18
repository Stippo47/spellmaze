"""Round 7 decks: round 6 fixes, statuses, the Hulk.

python tools/riffle/round7.py  ->  tools/riffle/decks/round7-*.json
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


deck("round7-build", "Statuses and the Hulk", "builds", 14, [
    {"id": "fixes", "kind": "report", "rarity": "uncommon", "title": "Your round 6 notes",
     "text": "Dart dash 9, walls drawn whole in view, a double-star shard, one trait per stat card.",
     "why": "Small fixes from the last deck. Mark any part that's off.",
     "details": "Version 0.10.0. Close and reopen the app twice to get it.",
     "parts": [
         part("dart", "Dart dash 9", "Darts dash 9 cells; yours stays 5. Same Dash, different base length.",
              videos=["hulk.mp4"]),
         part("walls", "Wall artifacts", "Walls are 4 thick now but sight only lit their first row, and missed bits "
              "of walls seen at a slant. Now the whole wall lights up when you see it."),
         part("shard", "Shard", "A second, darker star underneath, turning the other way and pulsing a little."),
         part("stats", "One trait each", "Cooldowns split into Spawn cooldown, Dash recharge and Reload, each its own "
              "card. Power is one card: damage."),
     ]},
    {"id": "statuses", "kind": "report", "rarity": "rare", "title": "Four new statuses",
     "text": "Chill, Shock, Poison and Mark join Burn as modules for any cast, with three mixes.",
     "why": "Stage 4 part 2, from the design you approved. Numbers are first guesses.",
     "parts": [
         part("chill", "Chill", "Slows up to 60%. At 100 it freezes for 2 s; a hard hit on a frozen enemy shatters "
              "it and chills those near.", videos=["chill.mp4"]),
         part("shock", "Shock", "Each hit jumps to one more enemy. At 100 it stuns and jumps to three.",
              videos=["shockmark.mp4"]),
         part("poison", "Poison", "Slow damage. At 100 it rots 15% of their health. A poisoned enemy dies into a "
              "purple gas cloud that poisons others.", videos=["poison.mp4"]),
         part("mark", "Mark", "No damage; marked enemies take +25%. At 100 it detonates for 45. Pink pips show it."),
         part("mixes", "Mixes", "Burn on chill: both clear for a burst. Fire in a gas cloud: it explodes. Shock "
              "prefers marked enemies and jumps twice as far to them."),
     ]},
    {"id": "hulk", "kind": "report", "rarity": "epic", "title": "The Hulk",
     "text": "The first boss, at 5:00: a huge square rolling through the maze. Armoured in front, so hit it from behind.",
     "why": "Stage 4's boss. It shoves everything, grinds through tiles, and drops an epic shard.",
     "details": "2400 health, comes back every 5 minutes half as tough again. Its front (the light bar) takes a "
                "quarter damage. A health bar shows at the top while it's alive.",
     "videos": [F + "hulk.mp4"]},
    {"id": "door", "kind": "report", "rarity": "rare", "title": "Keys and the door",
     "text": "Three keepers in the farthest camps hold keys. Bring all 3 to the door for the next, harder floor.",
     "why": "The door idea you said go to. Last piece of stage 4.",
     "details": "Keepers are their camp's toughest enemy with +50% health and a gold ring. The door sits in the dead "
                "end farthest from the start. Through it: a new maze, enemies +25% health per floor, the wave timer "
                "starts again. Your build, level, health, time and boss timer carry over.",
     "images": [F + "keeper.png", F + "door.png"]},
])
print("decks written")
