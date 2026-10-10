"""Emit a local-only layer inspection page after build_site.py --render."""
from pathlib import Path

root = Path(__file__).resolve().parents[2]
site = root / '_site'
source = site / 'index.html'
if not source.exists():
    raise SystemExit('Build first: python .github/scripts/build_site.py --render')
controls = r'''
<style>
.layer-review {position:fixed;left:12px;top:12px;z-index:100;background:#171717ed;color:#fff;padding:12px;border:1px solid #aaa;font:12px/1.5 monospace;max-width:285px}
.layer-review summary{cursor:pointer}.layer-review label{display:block;margin:6px 0}.layer-review button{margin:3px;cursor:pointer;font:inherit}.layer-review p{margin:8px 0}
.scene.review-grid{background:repeating-conic-gradient(#333 0% 25%,#777 0% 50%) 0 0 / 24px 24px}
</style>
<details class="layer-review" open><summary>Scene layers — local review</summary>
<p>Toggle layers or isolate one. Changes affect only this preview.</p>
<div id="layer-switches"></div>
<button id="all-layers">Show all</button><button id="pause-layers">Pause motion</button>
<label><input type="checkbox" id="transparency-grid"> Transparency grid</label>
<label>Lighting <select id="lighting-mode"><option value="auto">Automatic lightning</option><option value="off">Night — hold</option><option value="lit">Light from left — hold</option></select></label>
<button id="flash-lightning">Preview flash</button>
<button id="preview-dragon">Preview dragon landing</button>
<a href="/" style="color:white">Return to entrance</a>
</details>
<script>
(() => {
 const scene = document.querySelector('[data-scene]');
 const layers = [...scene.querySelectorAll('[data-layer]')];
 const controls = document.querySelector('#layer-switches');
 const boxes = [];
 const update = () => layers.forEach((el,i) => el.style.visibility = boxes[i].checked ? '' : 'hidden');
 layers.forEach((layer,i) => {
   const row = document.createElement('label');
   const box = document.createElement('input'); box.type = 'checkbox'; box.checked = true; boxes.push(box);
   box.addEventListener('change',update);
   const solo = document.createElement('button'); solo.textContent = 'Solo'; solo.type = 'button';
   solo.setAttribute('aria-label','Solo ' + layer.dataset.layerName);
   solo.addEventListener('click',event => {event.preventDefault(); boxes.forEach((b,j) => b.checked = i === j); update();});
   row.append(box,` ${layer.dataset.layer}. ${layer.dataset.layerName} `,solo); controls.append(row);
 });
 document.querySelector('#all-layers').onclick = () => {boxes.forEach(b => b.checked = true); update();};
 document.querySelector('#pause-layers').onclick = event => {
   const paused = scene.toggleAttribute('data-review-paused');
   event.target.textContent = paused ? 'Resume motion' : 'Pause motion';
 };
 document.querySelector('#lighting-mode').onchange = event => scene.dataset.lightningReview = event.target.value;
 document.querySelector('#flash-lightning').onclick = () => scene.dispatchEvent(new Event('castle-lightning-preview'));
 document.querySelector('#preview-dragon').onclick = () => scene.dispatchEvent(new Event('castle-dragon-preview'));
 document.querySelector('#transparency-grid').onchange = event => scene.classList.toggle('review-grid',event.target.checked);
 // Inspection clicks should not enter the hall.
 scene.querySelector('.scene-enter').addEventListener('click', event => event.preventDefault());
})();
</script>
'''
destination = site / 'layer-review' / 'index.html'
destination.parent.mkdir(exist_ok=True)
destination.write_text(source.read_text().replace('</body>', controls + '</body>'))
print('Layer review ready at /layer-review/ on your local preview server.')
