"""Alignment test of the fixed stage, in a real browser.

For each scenario (few crates, many crates, question about crates) and each window size,
it measures the pieces of the «Les caisses de pommes» game and checks, in drawing points (1920×1080):
  - the whole stage shows in the window, at the expected scale;
  - each loose fruit is on the blanket and none overlaps another;
  - each crate is in the crates zone and none overlaps another;
  - each slot and each packed fruit is inside its crate;
  - panels, labels, bar and speech bubble stay inside the stage and the panel does not cover the crates;
  - the positions are the same at every window size (only the scale changes).

Usage: python3 tests/e2e/layout_check.py [--quick]
"""
import json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
import _platform as plat

ROOT = Path(__file__).resolve().parents[2]
PORT = 3093
BASE = f'http://127.0.0.1:{PORT}'
VIEWPORTS = [(1366, 768), (800, 600), (1024, 600), (1280, 720), (1280, 1024), (1536, 864), (1920, 1080), (2560, 1440), (3440, 1440), (768, 1024)]
SCENARIOS = [
    ('few crates (total, level 1)', {'skillId': 'math.place-value', 'difficulty': 1}),
    ('many crates (total, level 3)', {'skillId': 'math.place-value', 'difficulty': 3}),
    ('question about crates (level 3)', {'skillId': 'math.grouping-tens', 'difficulty': 3}),
]

MEASURE = """
() => {
  const stage = document.querySelector('.stage');
  const S = stage.getBoundingClientRect();
  const k = S.width / 1920;
  const rect = (el) => { const b = el.getBoundingClientRect(); return [(b.left - S.left) / k, (b.top - S.top) / k, b.width / k, b.height / k]; };
  const all = (sel) => [...stage.querySelectorAll(sel)].map(rect);
  // loose fruit: the drawing square around its center (the fruit is rotated a few degrees; the rotation does not change its place)
  const square = (el) => { const r = rect(el); const s = el.offsetWidth; return [r[0] + r[2] / 2 - s / 2, r[1] + r[3] / 2 - s / 2, s, s]; };
  const crates = [...stage.querySelectorAll('.crate')].map((c) => ({ rect: rect(c), slots: [...c.querySelectorAll('.slot')].map(rect), fruits: [...c.querySelectorAll('.slot img')].map(rect), labels: [...c.querySelectorAll('.ten, .count, .count-label')].map(rect) }));
  return { k, stage: [S.left, S.top, S.width, S.height], win: [innerWidth, innerHeight], blanket: all('img.prop'), fruits: [...stage.querySelectorAll('.fruit:not(.gone)')].map(square), crates,
           panel: all('.panel'), hud: all('.hud-btn, .hud h1, .star-count, .round-dots'), bubble: all('.bubble'), lila: all('.guide .lila') };
}
"""

fails = []
count = 0


def check(ok, label):
    global count
    count += 1
    if not ok:
        fails.append(label)
        print('  ✘', label)


def inside(a, b, eps=0.6):
    return a[0] >= b[0] - eps and a[1] >= b[1] - eps and a[0] + a[2] <= b[0] + b[2] + eps and a[1] + a[3] <= b[1] + b[3] + eps


def overlap(a, b, eps=0.6):
    return a[0] < b[0] + b[2] - eps and b[0] < a[0] + a[2] - eps and a[1] < b[1] + b[3] - eps and b[1] < a[1] + a[3] - eps


def no_overlaps(rs):
    return not any(overlap(rs[i], rs[j]) for i in range(len(rs)) for j in range(i + 1, len(rs)))


def flat(m):
    out = []
    for key in ('blanket', 'fruits', 'panel', 'hud', 'bubble', 'lila'):
        out += [v for r in m[key] for v in r]
    for c in m['crates']:
        out += c['rect'] + [v for r in c['slots'] + c['fruits'] + c['labels'] for v in r]
    return out


def audit(m, where, scene):
    full = [0, 0, 1920, 1080]
    w, h = m['win']
    k = min(w / 1920, h / 1080)
    check(abs(m['k'] - k) < 0.002, f'{where}: scale {m["k"]:.4f} ≠ expected {k:.4f}')
    s = m['stage']
    check(s[0] >= -0.6 and s[1] >= -0.6 and s[0] + s[2] <= w + 0.6 and s[1] + s[3] <= h + 0.6, f'{where}: stage does not fit entirely in the window')
    blanket = [scene['props']['blanket'][c] for c in ('x', 'y', 'w', 'h')]
    zone = [scene['zones']['crates'][c] for c in ('x', 'y', 'w', 'h')]
    for i, f in enumerate(m['fruits']):
        check(inside(f, blanket), f'{where}: loose fruit {i} outside the blanket {f}')
    check(no_overlaps(m['fruits']), f'{where}: loose fruits overlapping')
    rects = [c['rect'] for c in m['crates']]
    for i, c in enumerate(m['crates']):
        check(inside(c['rect'], zone), f'{where}: crate {i} outside the crates zone {c["rect"]}')
        check(len(c['slots']) == 10, f'{where}: crate {i} with {len(c["slots"])} slots')
        for j, sl in enumerate(c['slots']):
            check(inside(sl, c['rect']), f'{where}: slot {j} outside crate {i}')
        check(no_overlaps(c['slots']), f'{where}: overlapping slots in crate {i}')
        for j, fr in enumerate(c['fruits']):
            check(inside(fr, c['rect']), f'{where}: packed fruit {j} outside crate {i} {fr}')
        for lb in c['labels']:
            check(inside(lb, full), f'{where}: label of crate {i} outside the stage {lb}')
    check(no_overlaps(rects), f'{where}: crates overlapping')
    for p in m['panel']:
        check(inside(p, full), f'{where}: panel outside the stage')
        if abs(p[2] - scene['zones']['panel']['w']) < 2:  # question or result panel (the end panel covers the center on purpose)
            check(not any(overlap(p, r) for r in rects), f'{where}: panel covers a crate')
        for bb in m['bubble']:
            check(not overlap(p, bb), f'{where}: speech bubble over the panel')
    for el in m['hud'] + m['bubble'] + m['lila']:
        check(inside(el, full), f'{where}: element outside the stage {el}')


def main():
    quick = '--quick' in sys.argv
    viewports = VIEWPORTS[:3] if quick else VIEWPORTS
    scene = json.loads((ROOT / 'content/scenes/apple-crates.json').read_text(encoding='utf-8'))
    data = tempfile.mkdtemp(prefix='melina-layout-')
    env = {**os.environ, 'MELINA_SKIP_ENV_FILE': '1', 'DATA_DIR': data, 'PORT': str(PORT)}
    server = subprocess.Popen([plat.node_exe(), '--disable-warning=ExperimentalWarning', str(ROOT / 'apps/server/dist/server.mjs')], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, **plat.popen_kwargs())
    try:
        for _ in range(50):
            try:
                urllib.request.urlopen(BASE + '/api/health', timeout=1)
                break
            except Exception:
                time.sleep(0.2)
        with sync_playwright() as p:
            browser = plat.launch_browser(p)
            for name, choice in SCENARIOS:
                req = urllib.request.Request(BASE + '/api/settings', data=json.dumps({'parent.nextChoice': choice}).encode(), method='PATCH', headers={'content-type': 'application/json', 'x-melina-client': '1', 'Origin': BASE})
                urllib.request.urlopen(req)
                page = browser.new_page(viewport={'width': viewports[0][0], 'height': viewports[0][1]}, reduced_motion='reduce')
                page.goto(BASE)
                page.locator('[data-game="game.apple-crates"]').click()
                page.locator('.game[data-phase=pack]').wait_for()
                n = int(page.locator('.game').get_attribute('data-remaining'))
                reference = {}

                def sweep(phase):
                    for w, h in viewports:
                        page.set_viewport_size({'width': w, 'height': h})
                        page.mouse.move(1, 1)  # away from the fruits: hovering over a fruit enlarges it on purpose
                        try:  # the stage adjusts right after the window; wait for the new scale (up to 3 s)
                            page.locator(f'.stage[data-stage-scale="{min(w / 1920, h / 1080):.4f}"]').wait_for(timeout=3000)
                        except Exception:
                            pass  # the scale check below reports the problem
                        page.wait_for_timeout(60)
                        m = page.evaluate(MEASURE)
                        audit(m, f'{name} | {phase} | {w}×{h}', scene)
                        ref = reference.setdefault(phase, flat(m))
                        cur = flat(m)
                        drift = max((abs(a - b) for a, b in zip(cur, ref)), default=0) if len(cur) == len(ref) else 999
                        check(drift < 0.6, f'{name} | {phase} | {w}×{h}: positions changed with the window (drift {drift:.2f})')

                sweep('start')
                for _ in range(n // 2):
                    page.keyboard.press('Space')
                    page.wait_for_timeout(40)
                page.locator(f'.game[data-remaining="{n - n // 2}"]').wait_for()
                sweep('packing')
                for _ in range(n - n // 2):
                    page.keyboard.press('Space')
                    page.wait_for_timeout(40)
                page.locator('.game[data-phase=question]').wait_for()
                page.wait_for_timeout(300)
                sweep('question')
                for _ in range(2):  # two errors: the count appears over the crates
                    page.keyboard.type('999')
                    page.keyboard.press('Enter')
                    page.wait_for_timeout(700)
                page.locator('.count-label').first.wait_for()
                page.wait_for_timeout(600)
                sweep('hint with count')
                page.keyboard.type('999')
                page.keyboard.press('Enter')
                page.locator('.game[data-phase=result]').wait_for()
                page.wait_for_timeout(400)
                sweep('result')
                crates = page.evaluate(MEASURE)['crates']
                print(f'  {name}: {n} loose fruits, {len(crates)} crates, checked at {len(viewports)} window sizes')
                page.close()
            browser.close()
    finally:
        plat.stop_process(server)
        shutil.rmtree(data, ignore_errors=True)
    print(f'RESULT: {"PASSED" if not fails else "FAILED"} ({count - len(fails)}/{count} checks)')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
