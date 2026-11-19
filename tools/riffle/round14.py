"""Round 14 deck: Auto is movement only; laser aim line.

python tools/riffle/round14.py  ->  tools/riffle/decks/round14-build.json
"""
import json, pathlib

HERE = pathlib.Path(__file__).resolve().parent
F = "../../../films/"
deck = {"title": "Auto: just movement", "topic": "builds", "order": 24, "cards": [
    {"id": "build", "kind": "report", "rarity": "uncommon", "title": "Your round 13 notes",
     "text": "Auto is only movement now: touch anywhere to move. The Laser's aim line stops where the beam stops.",
     "why": "Both notes from the last deck. Mark either if it's off.",
     "details": "Version 0.17.0. Close and reopen the app twice to get it.",
     "parts": [
         {"id": "auto", "title": "Auto", "text": "No fire stick or ability buttons. Any touch is the move stick. Three "
          "small gauges bottom right show rounds and cooldowns; they can't be touched.", "images": [F + "auto-hud.png"]},
         {"id": "laser", "title": "Laser aim line", "text": "With Auto off, the aim line stops at the first enemy the "
          "beam can't burn through.", "images": [F + "laser-aim.png"]},
     ]},
]}
(HERE / "decks" / "round14-build.json").write_text(json.dumps(deck, indent=1, ensure_ascii=False), encoding="utf-8")
print("deck written")
