"""Render the Spellmaze design pictures with Edge headless (2x).

python art/kit/render.py [filter]   ->  art/out/<scene>.png
"""
import pathlib, subprocess, sys, time

KIT = pathlib.Path(__file__).resolve().parent
OUT = KIT.parent / "out"
OUT.mkdir(exist_ok=True)
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

MODS = ("home bounce pierce orbit return extra grow haste split swarm burn chill shock poison mark knock pull leech "
        "explode shrapnel gunner trail echo link follow charge ghost rune").split()
ENEMIES = "mite dart brute spitter splitter bomber crawler drifter shield nest elite hulk queen mirror".split()
STATUSES = "burn chill shock poison mark mixes".split()

SCENES = [(f"key:{s}", 896, 414) for s in "ABCD"]
SCENES += [(f"ui:{u}", 896, 414) for u in ("levelup", "chest", "build")]
SCENES += [("maze", 800, 800), ("icons", 900, 560), ("spell:arena", 600, 440), ("spell:pet", 640, 420)]
SCENES += [(f"enemy:{e}", 600, 420) for e in ENEMIES]
SCENES += [(f"status:{s}", 600, 380) for s in STATUSES]
SCENES += [(f"mod:{m}", 930, 625) for m in MODS]


def shoot(scene, w, h):
    name = scene.replace(":", "-")
    out = OUT / f"{name}.png"
    page = KIT / f"_page-{name}.html"
    page.write_text(
        f"<!doctype html><meta charset=utf-8><style>html,body{{margin:0;background:#05070f}}canvas{{display:block}}</style>"
        f"<canvas id=c width={w*2} height={h*2} style='width:{w}px;height:{h}px'></canvas>"
        f"<script>window.SCENE='{scene}';window.W={w};window.H={h};</script><script src='kit.js'></script>",
        encoding="utf-8")
    if out.exists():
        out.unlink()
    subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2",
                    "--virtual-time-budget=4000", f"--user-data-dir={KIT / '_profile'}", f"--window-size={w},{h}",
                    f"--screenshot={out}", page.resolve().as_uri()], check=True, capture_output=True)
    for _ in range(100):
        if out.exists() and out.stat().st_size > 0:
            time.sleep(0.3)
            break
        time.sleep(0.2)
    else:
        raise SystemExit(f"no screenshot for {scene}")
    page.unlink()
    print("ok", out.name)


if __name__ == "__main__":
    f = sys.argv[1] if len(sys.argv) > 1 else ""
    for s, w, h in SCENES:
        if f in s:
            shoot(s, w, h)
