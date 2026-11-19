"""Quick check of an app that is ALREADY RUNNING (via iniciar.bat, or the bundled server) on a COPY of the database.

Usage:  python tests/e2e/smoke_copy.py --base http://127.0.0.1:3001 --data C:\\path\\to\\copy

- Refuses to run if --data points to the project's real data\\ folder.
- Plays one round of each of the eight mini-games, answering right on the first try
  (the answer is read from the copy's database, only as the test oracle).
- Opens the parents' area and the «Art du jeu» tab.
- Saves screenshots in tests/e2e/output/smoke/.
"""
import argparse, json, os, re, sqlite3, sys, urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import _platform as plat

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'tests' / 'e2e' / 'output' / 'smoke'
results = []


def check(cond, msg):
    results.append((bool(cond), msg))
    print(('  ✔ ' if cond else '  ✘ ') + msg, flush=True)


def open_round(db_file, gid):
    """Open round of this game (the real database may have open rounds of other games)."""
    con = sqlite3.connect(f'file:{db_file}?mode=ro', uri=True)
    row = con.execute("SELECT snapshot_json FROM assignments WHERE input_mode = 'screen' AND exercise_id = ? AND status = 'presented' ORDER BY created_at DESC LIMIT 1", (f'game.{gid}',)).fetchone()
    con.close()
    return json.loads(row[0])


def locate(grid, word, dirs):
    n = len(grid)
    ls = list(word)
    for d in dirs:
        dr, dc = {'h': (0, 1), 'v': (1, 0), 'd': (1, 1)}[d]
        for r in range(n):
            for c in range(n):
                if all(0 <= r + dr * k < n and 0 <= c + dc * k < n and grid[r + dr * k][c + dc * k] == ls[k] for k in range(len(ls))):
                    return (r, c), (r + dr * (len(ls) - 1), c + dc * (len(ls) - 1))


def answer_text(ex):
    if ex['type'] == 'number':
        return str(ex['value'])
    if ex['type'] == 'word':
        return ex['value']
    return ex.get('display') or str(ex.get('value'))


def screen_attempts(db_file):
    con = sqlite3.connect(f'file:{db_file}?mode=ro', uri=True)
    n = con.execute("SELECT COUNT(*) FROM attempts WHERE input_mode = 'screen'").fetchone()[0]
    con.close()
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', default='http://127.0.0.1:3001')
    ap.add_argument('--data', required=True)
    args = ap.parse_args()
    data = Path(args.data).resolve()
    if data == (ROOT / 'data').resolve():
        sys.exit('Refused: --data points to the real data\\ folder. Use a copy.')
    db_file = str(data / 'melina.db')
    health = json.load(urllib.request.urlopen(f'{args.base}/api/health', timeout=5))
    check(health.get('ok'), 'server answered on /api/health')
    OUT.mkdir(parents=True, exist_ok=True)
    errors = []
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        browser = plat.launch_browser(pw)
        page = browser.new_page(viewport={'width': 1366, 'height': 768})
        page.on('console', lambda m: m.type == 'error' and errors.append(m.text))
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(args.base)
        page.get_by_role('button', name=re.compile('jardin de Lila')).wait_for()
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / '01-start.png'))

        games = [('apple-crates', 'Les caisses de pommes'), ('number-train', 'Le train des nombres'), ('frog-jump', 'Saute-grenouille'),
                 ('word-fishing', 'La pêche aux mots'), ('mystery-story', 'L’histoire mystère'), ('number-path', 'Le chemin des nombres'),
                 ('hidden-words', 'Les mots cachés'), ('dominoes', 'Les dominos des nombres')]
        check(page.locator('[data-game]').count() == len(games), f'home screen with the {len(games)} games')
        for gid, label in games:
            before = screen_attempts(db_file)
            page.locator(f'[data-game="game.{gid}"]').click()
            if gid == 'apple-crates':
                page.locator('.game[data-phase=pack]').wait_for()
                page.wait_for_timeout(250)
                for _ in range(int(page.locator('.game').get_attribute('data-remaining'))):
                    page.keyboard.press('Space'); page.wait_for_timeout(60)
            if gid == 'hidden-words':
                # search (not graded): tap the first and the last letter of each word
                page.locator('.game[data-phase=search]').wait_for()
                page.wait_for_timeout(500)
                g = open_round(db_file, gid)['game']
                for w in g['words']:
                    a, z = locate(g['grid'], w['word'], g['directions'])
                    for cell in (a, z):
                        page.locator(f'.letter[data-r="{cell[0]}"][data-c="{cell[1]}"]').click()
                    page.wait_for_timeout(150)
            page.locator('.game[data-phase=question]').wait_for()
            page.wait_for_timeout(1200)
            snap = open_round(db_file, gid)
            ex = snap['expected']
            right = answer_text(ex)
            if gid == 'number-path':
                for k, v in enumerate(ex['values']):
                    page.locator(f'[data-hole="{k}"]').click(force=True)
                    page.keyboard.type(str(v))
                page.keyboard.press('Enter')
            elif gid == 'hidden-words':
                fin = snap['game']['final']
                for k, i in enumerate([i for i, p in enumerate(fin['pattern']) if p is None]):
                    page.locator(f'[data-slot="{k}"]').click()
                    page.locator(f'[data-letter="{list(right)[i]}"]').click()
                page.locator('.letter-bank .key.ok').click()
            elif page.locator('[data-option]').count() == 0:
                page.keyboard.type(right); page.keyboard.press('Enter')
            else:
                options = page.locator('[data-option]').evaluate_all('els => els.map(e => e.dataset.option)')
                norm = lambda s: s.replace('.', '').strip().lower()
                good = [o for o in options if norm(o) == norm(right)] or [o for o in options if o == str(ex.get('value'))]
                page.locator(f'[data-option="{good[0]}"]').click(force=True)
            page.locator('.game[data-phase=result]').wait_for()
            page.wait_for_timeout(900)
            page.screenshot(path=str(OUT / f'10-{gid}.png'))
            stars = page.locator('.stars img.on').count()
            check(screen_attempts(db_file) == before + 1 and stars == 3, f'{label}: opened, round completed and graded by the server ({stars} stars)')
            page.locator('.hud-btn').first.click()
            page.locator('.card-game').first.wait_for()

        page.get_by_role('button', name=re.compile('Espace parents')).last.click()
        q = page.get_by_text(re.compile(r'Combien font \d × \d')).inner_text()
        a, b = map(int, re.findall(r'(\d) × (\d)', q)[0])
        page.get_by_label('Réponse', exact=True).fill(str(a * b))
        page.get_by_role('button', name='Entrer').click()
        page.get_by_role('button', name='Historique').wait_for()
        page.screenshot(path=str(OUT / '20-parent-area.png'))
        check(True, 'parent area opened')
        page.get_by_role('button', name='Art du jeu').click()
        page.locator('[data-testid^="art-spec-"]').first.wait_for(timeout=10000)
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / '21-game-art.png'))
        check(page.locator('[data-testid^="art-spec-"]').count() > 0, f'«Art du jeu» tab loaded {page.locator("[data-testid^=\'art-spec-\']").count()} spec cards')
        browser.close()

    relevant = [e for e in errors if 'favicon' not in e]
    for e in relevant:
        print('     ', e[:200])
    check(not relevant, f'no JavaScript errors in the console ({len(relevant)})')
    ok = all(r[0] for r in results)
    print('\nRESULT:', 'PASSED' if ok else 'FAILED', f'({sum(1 for r in results if r[0])}/{len(results)})')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
