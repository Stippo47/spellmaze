"""Round 10 decks: kinematic knock, juice, playground, rail budget, clouds, shard; the loadout question.

python tools/riffle/round10.py  ->  tools/riffle/decks/round10-*.json
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


deck("round10-build", "Juice and a playground", "builds", 19, [
    {"id": "fixes", "kind": "report", "rarity": "rare", "title": "Your round 9 notes",
     "text": "Knock moves them for real, hits and kills burst, the screen shakes, and a playground to show abilities.",
     "why": "Everything from the last decks. Films are in the playground now, so you can see each thing.",
     "details": "Version 0.13.0. Close and reopen the app twice to get it. Pause → Playground: On to try it yourself.",
     "parts": [
         part("knock", "Knock is motion", "Knockback is a push of speed that slides them and dies off, not a jump. "
              "The Hulk shoves you the same way, and turns snappier.", videos=["p-knock.mp4"]),
         part("juice", "Hit effects", "Sparks in the enemy's colour on every hit, a burst and ring on every kill, "
              "rings on blasts and pickups, shake on big hits, a red flash when you're hurt.", videos=["p-hits.mp4"]),
         part("playground", "Playground", "One open room; groups of 4 walk in every 4 s, never more than 10. Build "
              "anything, like practice.", images=["playground.png"]),
         part("split", "Split", "The two halves skip the enemy that split them.", videos=["p-split.mp4", "p-dashsplit.mp4"]),
         part("rail", "Rail budget", "90 damage to spend: each enemy takes what it needs to die, the shot goes on "
              "with the rest.", videos=["p-rail.mp4"]),
         part("clouds", "Clouds", "Swell from a point, fade fast at the end, and pale motes drift up out of them.",
              videos=["p-poison.mp4"]),
         part("shard", "Shard", "Bigger under-star at a third of the speed. In this clip it's the gold star at the "
              "left (top left of the screen).", videos=["shard.mp4"]),
     ]},
])

deck("round10-questions", "Weapon and 2 abilities", "builds", 20, [
    {"id": "loadout", "kind": "options", "rarity": "rare", "title": "Picking your 2 abilities",
     "text": "You bring a weapon and 2 abilities: Spawn, Dash or Burst. When do you pick them?",
     "why": "Burst becomes an ability and Laser a weapon next; this decides how the third ability gets in.",
     "pick": "a",
     "options": [{"id": "a", "label": "Run start", "text": "Pick a weapon and 2 abilities before each run."},
                 {"id": "b", "label": "Settings", "text": "Chosen in the pause menu, like the weapon now."},
                 {"id": "c", "label": "Found in runs", "text": "Start with one; the second is found in a run."}]},
])
print("decks written")
