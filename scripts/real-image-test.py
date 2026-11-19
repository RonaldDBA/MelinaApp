"""REAL test call to the image provider configured in .env (incurs a small cost).

Usage:  .venv\\Scripts\\python scripts\\real-image-test.py [--spec fruit.red_apple] [--quality low]

- Starts the app's bundled server with a TEMPORARY data folder (never uses data\\).
- The server reads IMAGE_PROVIDER, IMAGE_API_KEY and IMAGE_MODEL from .env. This script never reads or
  prints keys.
- Enables generation only in that temporary folder, requests 1 image of the chosen spec and shows the technical
  check (including whether the background really came out transparent) and, if there is a Claude key, Claude's review.
- Saves the received image to tests\\e2e\\output\\real-<spec>.png for the parents to look at.
- The request carries only the spec text (no child data).
"""
import argparse, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tests' / 'e2e'))
import _platform as plat

ROOT = Path(__file__).resolve().parents[1]
PORT = 3031
BASE = f'http://127.0.0.1:{PORT}'
H = {'content-type': 'application/json', 'x-melina-client': '1', 'Origin': BASE}


def call(method, path, body=None):
    req = urllib.request.Request(BASE + path, data=None if body is None else json.dumps(body).encode(), method=method, headers=H)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b'{}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--spec', default='fruit.red_apple')
    ap.add_argument('--quality', default='low')
    args = ap.parse_args()
    data = tempfile.mkdtemp(prefix='melina-real-img-')
    env = {k: v for k, v in os.environ.items() if k not in ('MELINA_SKIP_ENV_FILE', 'IMAGE_API_KEY', 'ANTHROPIC_API_KEY')}
    env.update(DATA_DIR=data, PACKS_DIR=os.path.join(data, 'packs'), PORT=str(PORT), IMAGE_QUALITY=args.quality)
    srv = subprocess.Popen([plat.node_exe(), '--disable-warning=ExperimentalWarning', str(ROOT / 'apps/server/dist/server.mjs')], env=env, cwd=tempfile.gettempdir(),
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, **plat.popen_kwargs())
    try:
        for _ in range(60):
            try:
                urllib.request.urlopen(BASE + '/api/health', timeout=1)
                break
            except Exception:
                time.sleep(0.25)
        _, studio = call('GET', '/api/art/studio')
        p = studio.get('provider')
        print('Provider:', p and p['label'], '| key configured:', p and p['keyConfigured'], '| Claude review:', studio.get('claudeAvailable'))
        if not p or not p['keyConfigured']:
            sys.exit('IMAGE_PROVIDER=openai and IMAGE_API_KEY are missing from .env.')
        call('PATCH', '/api/settings', {'art.enabled': True, 'art.consent': True})
        st, r = call('POST', f'/api/art/specs/{args.spec}/generate', {'n': 1})
        if st != 200:
            sys.exit(f'Generation refused by the app ({st}): {r}')
        t0 = time.time()
        while True:
            _, studio = call('GET', '/api/art/studio')
            spec = next(s for s in studio['specs'] if s['id'] == args.spec)
            job = spec['job']
            if job and job['status'] != 'running':
                break
            if time.time() - t0 > 300:
                sys.exit('Timed out (5 min).')
            time.sleep(3)
        print(f'Request: {job["status"]} in {time.time() - t0:.0f} s | model {job["model"]} | images received {job["received"]}')
        if job['status'] != 'done':
            print('Error:', job['errorCode'], '-', job['errorMessage'])
            sys.exit(1)
        # Claude's review runs after generation; wait a little for it
        for _ in range(40):
            _, studio = call('GET', '/api/art/studio')
            spec = next(s for s in studio['specs'] if s['id'] == args.spec)
            c = spec['candidates'][0]
            if c['reviewVerdict'] is not None or not studio['claudeAvailable']:
                break
            time.sleep(3)
        print(f'Image: {c["width"]}×{c["height"]} | technical check: {"ok" if c["techOk"] else "FAILED"}')
        for k in c['tech']['checks']:
            print(f'   {"✔" if k["ok"] else ("?" if k["ok"] is None else "✘")} {k["label"]} — {k["detail"]}')
        if c['review']:
            print('Claude:', c['reviewVerdict'], '|', '; '.join(c['review'].get('problems') or []) or 'no problems reported')
        out = ROOT / 'tests' / 'e2e' / 'output'
        out.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(BASE + c['url']) as r, open(out / f'real-{args.spec}.png', 'wb') as f:
            f.write(r.read())
        print('Image saved to', out / f'real-{args.spec}.png')
    finally:
        plat.stop_process(srv)
        shutil.rmtree(data, ignore_errors=True)


if __name__ == '__main__':
    main()
