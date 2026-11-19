"""Architecture checks in the browser (Chromium, the same engine as Edge):

1. Fixed stage: a scene drawn at 1920x1080 and scaled up/down by a single factor
   keeps every piece in place at any window size.
2. Image processing without extra programs: the browser itself trims the transparent
   margins and writes WebP while keeping transparency.

Usage: python3 -I tests/architecture-checks/stage_and_canvas.py
"""
import base64, io, json, sys
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
VIEWPORTS = [(800, 600), (1024, 600), (1280, 720), (1280, 1024), (1366, 768), (1536, 864), (1920, 1080), (2560, 1440), (3440, 1440), (768, 1024)]

STAGE = """
<style>html,body{margin:0;height:100%;overflow:hidden;background:#123}
#stage{position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:0 0;background:#cde}
.crate{position:absolute;left:1180px;top:520px;width:560px;height:260px;background:#a66}
.slot{position:absolute;width:88px;height:88px;border-radius:50%;background:#733}
.fruit{position:absolute;width:96px;height:96px;border-radius:50%;background:#e33}</style>
<div id=stage><div class=crate id=crate></div></div>
<script>
const st=document.getElementById('stage');
// Positions in drawing coordinates (scene data), never as a function of the window.
const slots=[];for(let r=0;r<2;r++)for(let c=0;c<5;c++)slots.push({x:1180+34+c*102,y:520+30+r*108});
slots.forEach((s,i)=>{const d=document.createElement('div');d.className='slot';d.id='s'+i;d.style.left=s.x+'px';d.style.top=s.y+'px';st.appendChild(d);
  const f=document.createElement('div');f.className='fruit';f.id='f'+i;f.style.left=(s.x-4)+'px';f.style.top=(s.y-4)+'px';st.appendChild(f);});
function fit(){const k=Math.min(innerWidth/1920,innerHeight/1080);st.style.transform=`translate(${(innerWidth-1920*k)/2}px,${(innerHeight-1080*k)/2}px) scale(${k})`;return k}
addEventListener('resize',fit);fit();
window.measure=()=>{const k=fit();const R=id=>{const b=document.getElementById(id).getBoundingClientRect();return[b.left,b.top,b.right,b.bottom]};
  const S=R('stage');const n=b=>b.map((v,i)=>(v-S[i%2])/k); // back to drawing coordinates
  return{k,stage:S,crate:n(R('crate')),slots:slots.map((_,i)=>n(R('s'+i))),fruits:slots.map((_,i)=>n(R('f'+i)))}};
</script>
"""

CANVAS_JS = """
async (dataUrl) => {
  const img = new Image(); img.src = dataUrl; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const t = document.createElement('canvas'); t.width = w; t.height = h; t.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h);
  const blob = await new Promise(r => t.toBlob(r, 'image/webp', 0.9));
  const back = await createImageBitmap(blob);
  const v = document.createElement('canvas'); v.width = back.width; v.height = back.height; const vg = v.getContext('2d'); vg.drawImage(back, 0, 0);
  const corner = vg.getImageData(0, 0, 1, 1).data[3], center = vg.getImageData(back.width >> 1, back.height >> 1, 1, 1).data[3];
  return { src: [img.width, img.height], bbox: [x0, y0, x1, y1], out: [back.width, back.height], type: blob.type, bytes: blob.size, cornerAlpha: corner, centerAlpha: center };
}
"""

def main():
    fails = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()
        pg.set_content(STAGE)
        ref = None
        for w, h in VIEWPORTS:
            pg.set_viewport_size({'width': w, 'height': h}); m = pg.evaluate('measure()')
            geo = {k: m[k] for k in ('crate', 'slots', 'fruits')}
            if ref is None: ref = geo
            drift = max(abs(a - c) for key in geo for A, C in zip([geo[key]] if key == 'crate' else geo[key], [ref[key]] if key == 'crate' else ref[key]) for a, c in zip(A, C))
            cr = m['crate']; inside = all(f[0] >= cr[0] - .01 and f[1] >= cr[1] - .01 and f[2] <= cr[2] + .01 and f[3] <= cr[3] + .01 for f in m['fruits'])
            onscreen = m['stage'][0] >= -0.01 and m['stage'][1] >= -0.01 and m['stage'][2] <= w + .01 and m['stage'][3] <= h + .01
            ok = drift < 0.01 and inside and onscreen
            if not ok: fails.append((w, h))
            print(f"{'OK  ' if ok else 'FAIL'} | window {w}x{h} | factor {m['k']:.3f} | max drift {drift:.5f} drawing px | fruits inside the crate: {inside} | whole stage visible: {onscreen}")
        # 2) trim + WebP with transparency
        src = Image.open(ROOT / 'apps/game/public/art/red_apple.png').convert('RGBA')
        pad = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0)); pad.alpha_composite(src.resize((400, 400)), (330, 250))
        buf = io.BytesIO(); pad.save(buf, 'PNG'); png_bytes = len(buf.getvalue())
        r = pg.evaluate(CANVAS_JS, 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode())
        ok2 = r['type'] == 'image/webp' and r['cornerAlpha'] == 0 and r['centerAlpha'] == 255 and r['out'] == [r['bbox'][2] - r['bbox'][0] + 1, r['bbox'][3] - r['bbox'][1] + 1] and r['out'][0] <= 400 and r['out'][1] <= 400
        if not ok2: fails.append('canvas')
        print(f"{'OK  ' if ok2 else 'FAIL'} | trim in the browser: {r['src']} -> {r['out']} | format {r['type']} | {png_bytes} -> {r['bytes']} bytes | alpha corner={r['cornerAlpha']} center={r['centerAlpha']}")
        b.close()
    print('RESULT:', 'all good' if not fails else f'failures: {fails}')
    sys.exit(1 if fails else 0)

if __name__ == '__main__':
    main()
