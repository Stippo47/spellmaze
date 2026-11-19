"""Round 11 deck: loadout, Burst, Laser, launched deaths, softer motes, shard glow.

python tools/riffle/round11.py  ->  tools/riffle/decks/round11-*.json
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


deck("round11-build", "Loadout, Burst, Laser", "builds", 21, [
    {"id": "loadout", "kind": "report", "rarity": "rare", "title": "Weapon and 2 abilities",
     "text": "Each run starts with a pick: a weapon, and 2 of Spawn, Dash and Burst. Then the first module.",
     "why": "Your rule: 3 actions in. Mark any part that's off.",
     "details": "Version 0.14.0. Close and reopen the app twice to get it.\n\nDash, if you bring it, is on the button; "
                "the other ability takes the stick. Your last pick is remembered.",
     "parts": [
         part("screen", "The pick", "Tap a weapon, tap 2 abilities (a third swaps out the older one), Go.",
              images=["loadout-picked.png"]),
         part("controls", "Controls", "Without Dash, Burst takes the button: a tap throws at the nearest enemy, a "
              "drag aims it.", images=["burst-still.png"]),
     ]},
    {"id": "burst", "kind": "report", "rarity": "rare", "title": "Burst",
     "text": "A thrown bomb: drag to aim (further drag, further throw), let go; it blasts where it lands.",
     "why": "The new ability. Every module works on it.",
     "details": "12 cells at most, stops short of walls, 3-cell blast for 30, back in 5 s.\n\nModules: Extra = more "
                "bombs round the aim, Bounce = hops on smaller, Home = steers onto an enemy near the aim, Pierce = "
                "blasts through walls, Grow = bigger, Haste = sooner, Split = two small bombs after, Knock = hurls "
                "everyone out, Explode = a second blast, Duration = further, and the statuses hit everyone in it.",
     "parts": [part("plain", "Plain", "No modules.", videos=["p-burst.mp4"]),
               part("mods", "With modules", "Extra, Bounce, Split, Chill.", videos=["p-burst-mods.mp4"])]},
    {"id": "laser", "kind": "report", "rarity": "rare", "title": "Laser",
     "text": "Hold to fire a burning beam. It drains a charge and refills when you let go.",
     "why": "The new weapon. Every module works on the beam.",
     "details": "18 cells, 42 damage a second. Pierce burns through enemies, Bounce reflects off walls, Extra fans "
                "more beams, Split forks it partway, Home bends it onto a nearby enemy, Explode blasts at its end, "
                "statuses build a little each instant.",
     "parts": [part("plain", "Plain", "No modules.", videos=["p-laser.mp4"]),
               part("mods", "With modules", "Split, Burn, Extra.", videos=["p-laser-mods.mp4"])]},
    {"id": "polish", "kind": "report", "rarity": "uncommon", "title": "Polish",
     "text": "Bodies fly off the way they were hit, softer cloud motes, a glow under the shard.",
     "why": "Your notes from the juice deck. More polish keeps coming.",
     "parts": [part("deaths", "Deaths", "The body spins off the way the killing blow went and shrinks away; its "
                    "sparks go that way too.", videos=["p-hits.mp4"]),
               part("motes", "Motes", "Fewer, round, small, fading in and out.", videos=["p-poison.mp4"]),
               part("shard", "Shard glow", "A soft gold glow under the stars.", videos=["shard.mp4"])]},
])
print("decks written")
