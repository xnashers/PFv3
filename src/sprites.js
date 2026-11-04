// Sprite helpers: turn a cell of a sprite sheet into an <span class="spr"> (static or animated with CSS steps()).
let M = null;
export async function loadSprites() {
  M = await (await fetch('assets/sprites.json')).json();
  // CSS custom properties resolve url() relative to the stylesheet, so make sheet paths absolute
  for (const k of ['crops', 'items']) M[k].sheet = new URL(M[k].sheet, document.baseURI).href;
  await Promise.all([M.crops.sheet, M.items.sheet].map((src) => new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = src; })));
}
const itemRows = () => Object.keys(M.items.rows).length;
function html({ img, cols, rows, row, col, frames = 1, dur = 0.8, size = 64, anim = false, fluid = false, cls = '' }) {
  const s = fluid ? '' : `--s:${size}px;`;
  return `<span class="spr ${fluid ? 'fluid' : ''} ${anim ? 'anim' : ''} ${cls}" style="--img:url(${img});--cols:${cols};--rows:${rows};--row:${row};--col:${col};--frames:${frames};--dur:${dur}s;${s}"></span>`;
}
/** Crop art. stage: 0 seed, 1 sprout, 2 growing, 3 ripe, or null = bouncing harvested item (animated). */
export function cropSprite(id, { size = 64, stage = null, fluid = false, anim = true } = {}) {
  const row = M.crops.order.indexOf(id);
  const base = { img: M.crops.sheet, cols: M.cols, rows: M.crops.rows, row: Math.max(0, row), size, fluid };
  return stage === null ? html({ ...base, col: 4, frames: 4, dur: 0.8, anim }) : html({ ...base, col: stage });
}
/** Item art: coin, star, sprinkler1-3, fertilizer, crate, burst (8-frame loops). */
export function itemSprite(name, { size = 64, anim = true, dur = 0.9, cls = '' } = {}) {
  return html({ img: M.items.sheet, cols: M.cols, rows: itemRows(), row: M.items.rows[name], col: 0, frames: 8, dur, size, anim, cls });
}
/** Soil tile for a plot: empty | tilled | wet | sparkle (animated, used for "ready"). */
export function soilSprite(kind) {
  const base = { img: M.items.sheet, cols: M.cols, rows: itemRows(), row: M.items.rows.soil, fluid: true, cls: 'soil' };
  const s = M.items.soil;
  return kind === 'sparkle' ? html({ ...base, col: s.sparkle[0], frames: 4, dur: 0.9, anim: true }) : html({ ...base, col: s[kind] });
}
export function icon(name, size = 46) {
  const col = M.items.icons.indexOf(name);
  return html({ img: M.items.sheet, cols: M.cols, rows: itemRows(), row: M.items.rows.icons, col, size });
}
