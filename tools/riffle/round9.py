"""Round 9 decks: Hulk, clouds; stage 5 batch 1 (five modules, two weapons); the shard question; the fourth cast.

python tools/riffle/round9.py  ->  tools/riffle/decks/round9-*.json
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


deck("round9-build", "Five modules, two weapons", "builds", 17, [
    {"id": "fixes", "kind": "report", "rarity": "uncommon", "title": "Hulk and clouds",
     "text": "The Hulk is fast, commits to a direction, turns smoothly, and is always drawn. Clouds give off motes.",
     "why": "Your round 8 notes. Mark any part that's off.",
     "details": "Version 0.12.0. Close and reopen the app twice to get it. In Settings, Weapon has Shotgun and Rail.",
     "parts": [
         part("hulk", "Hulk", "Faster than you (11 vs 8.5). Keeps a direction for 1 to 2.5 s, then turns toward "
              "you; turns at once if blocked. The turn swings over a little and settles. Seen through walls.",
              videos=["hulk.mp4"]),
         part("clouds", "Cloud motes", "Slow purple specks drift up out of gas clouds.", videos=["poison.mp4"]),
     ]},
    {"id": "modules", "kind": "report", "rarity": "rare", "title": "Five new modules",
     "text": "Pierce, Grow, Haste, Split and Knock, each on all three casts. They come in shards and level-ups.",
     "why": "Stage 5, first batch, from the design list. Numbers are first guesses.",
     "parts": [
         part("pierce", "Pierce", "Bolts pass through enemies. A ball rolls through them at full speed. A dash "
              "hits harder going through.", videos=["m5-pierce.mp4"]),
         part("grow", "Grow", "Bigger and stronger. A ball gets more health but is slower. A dash is wider and "
              "keeps you safe longer.", videos=["m5-grow.mp4"]),
         part("haste", "Haste", "Faster bolts and reload; a ball thrown harder and back sooner; a dash longer and "
              "back sooner."),
         part("split", "Split", "A bolt forks in two when it hits or ends. A ball splits in two when it dies. A dash "
              "sends two echo dashes out at an angle.", videos=["m5-split.mp4", "m5-dashsplit.mp4"]),
         part("knock", "Knock", "Hits push enemies far. On a dash, its shoves become a shockwave.",
              videos=["m5-knock.mp4"]),
     ]},
    {"id": "weapons", "kind": "report", "rarity": "uncommon", "title": "Shotgun and Rail",
     "text": "Shotgun: 5 pellets, 2 shots then a reload. Rail: one slow, hard shot that goes through 4 enemies.",
     "why": "More weapons, as you picked. Choose them in Settings for now.",
     "parts": [part("shotgun", "Shotgun", "Short range, 5 pellets fanned, 2 shots, then a full reload.", videos=["shotgun.mp4"]),
               part("rail", "Rail", "One round, 45 damage, very fast and long, through 4 enemies. Slow to come back.",
                    videos=["rail.mp4"])]},
])

deck("round9-questions", "Shard and the next cast", "builds", 18, [
    {"id": "shard", "kind": "options", "rarity": "uncommon", "title": "The shard",
     "text": "You marked the shard a problem: 'Uh huh. Sure...'. What's wrong with it?",
     "why": "I can't tell if you don't see it in your game, or you see it and don't like it.",
     "pick": "a", "videos": [F + "shard.mp4"],
     "details": "The clip is the game now: the gold star with a darker one turning the other way underneath. Shards "
                "aren't placed when Practice build is on, which could be why it never showed.",
     "options": [{"id": "a", "label": "Never see it", "text": "It doesn't show up in my game."},
                 {"id": "b", "label": "Still ugly", "text": "I see it and the look is still wrong."},
                 {"id": "c", "label": "Too small", "text": "It's there but easy to miss."},
                 {"id": "d", "label": "Fine now", "text": "This clip looks fine."}]},
    {"id": "cast", "kind": "options", "rarity": "rare", "title": "A fourth cast",
     "text": "The design has two more shapes. Which becomes the fourth cast, with its own button?",
     "why": "Every module then needs an answer on that shape too, so it's a big piece of work.",
     "pick": "a",
     "options": [{"id": "a", "label": "Burst", "text": "A thrown bomb that blasts where it lands."},
                 {"id": "b", "label": "Beam", "text": "A held beam that sweeps and burns through."},
                 {"id": "c", "label": "Neither yet", "text": "More modules first."}]},
])
print("decks written")
