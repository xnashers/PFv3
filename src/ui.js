// All DOM rendering. Game logic lives in game.js, cloud calls come in through the `cloud` object.
import { CROPS, CROP_CATEGORIES } from '../data/crops.js';
import { SPRINKLERS } from '../data/gear.js';
import { FERTILIZER_COST, getCrop, getPet } from './game.js';
import { GENETICS_TIERS } from '../data/genetics.js';
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, TITLE_DISPLAY, rewardLabel } from '../data/achievements.js';
import { PETS, PET_MAX_LEVEL, BONUS_LABEL, getPetFeedCost } from '../data/pets.js';
import { cropSprite, itemSprite, soilSprite, icon } from './sprites.js';
import { sfx, music } from './audio.js';
import { LOGIN_REWARDS, DAILY_BONUS } from '../data/quests.js';
import { AUTO_HARVEST_TIERS, MUTLUCK_MAX, MUTLUCK_PER_LEVEL, SLOT2_COST, TICKET_COST, TREAT_COST, LEGEND_COST, BOOST_COST, EVOLVE_TREATS, COSMETICS } from '../data/tokenshop.js';
import { WEATHER_TYPES } from '../data/weather.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.floor(n).toLocaleString('en-US');
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

const EVENT_TAG = { parade: 'the Pet Parade' };
const span = (ms) => { const m = Math.max(0, Math.floor(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60); return d ? `${d}d ${h}h` : h ? `${h}h ${m % 60}m` : `${m}m`; };
const ago = (t) => { const s = Math.max(0, Math.floor((Date.now() - t) / 1000)); return s < 60 ? 'now' : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d`; };
const RICON = { peso: '💰', tokens: '🪙', fertilizer: '💩', sprinkler: '💦', premium_seed_pack: '🌟', weather_ticket: '🎫', cosmetic: '🏮' };
const shortReward = (r) => `<i>${RICON[r.type] || '🎁'}${r.amount ? fmt(r.amount) : ''}</i>`;
// light client-side chat filter (a few common English/Tagalog insults). Real moderation needs a server, see FIREBASE_SETUP.md.
const BAD = /(f+u+c+k+|sh[i1]+t+|b[i1]tch|put[a4]+(ng)?\s?ina|tangina|gag[o0]|ulol|tarantado|bobo)/gi;
const cleanText = (t) => t.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(BAD, (m) => '*'.repeat(m.length)).slice(0, 140);

// ---------- toasts, floating text, modals ----------
function toast(msg, kind = '') {
  let box = $('.toasts') || document.body.appendChild(Object.assign(document.createElement('div'), { className: 'toasts' }));
  const t = Object.assign(document.createElement('div'), { className: `toast ${kind}`, textContent: msg });
  box.appendChild(t); setTimeout(() => t.remove(), 2700);
}
function flyText(el, text) {
  const r = el.getBoundingClientRect();
  const f = Object.assign(document.createElement('div'), { className: 'fly', textContent: text });
  f.style.left = `${r.left + r.width / 2 - 30}px`; f.style.top = `${r.top + r.height / 3}px`;
  document.body.appendChild(f); setTimeout(() => f.remove(), 1000);
}
function burst(el) {
  const r = el.getBoundingClientRect(), d = document.createElement('div');
  d.className = 'burst-fx'; d.style.left = `${r.left + r.width / 2 - 70}px`; d.style.top = `${r.top + r.height / 2 - 70}px`;
  d.innerHTML = itemSprite('burst', { size: 140, dur: 0.6, cls: 'once' });
  document.body.appendChild(d); setTimeout(() => d.remove(), 650);
}
function modal(inner, { dismiss = true } = {}) {
  const s = Object.assign(document.createElement('div'), { className: 'scrim' });
  s.innerHTML = `<div class="panel modal">${inner}</div>`;
  if (dismiss) s.addEventListener('pointerdown', (e) => { if (e.target === s) s.remove(); });
  document.body.appendChild(s); return s;
}

// =====================================================================
//  AUTH SCREEN
// =====================================================================
export function mountAuth(root, { configured, onSignIn, onSignUp, onGuest }) {
  const logoCrops = ['kamatis', 'mais', 'kalabasa', 'sitaw', 'talong'].map((c) => cropSprite(c, { size: 64 })).join('');
  root.innerHTML = `
    <div class="auth">
      <h1 class="logo">Pocket<br>Farm</h1>
      <div class="logo-sprites">${logoCrops}</div>
      <div class="panel">
        ${configured ? '' : `<p style="margin-top:0;font-weight:600">🔧 Firebase isn't connected yet - paste your config into <b>src/firebase-config.js</b>. You can still try the game as a guest.</p>`}
        <input class="field" id="u" placeholder="Username" maxlength="20" autocomplete="username" autocapitalize="none">
        <input class="field" id="p" type="password" placeholder="Password (6+ characters)" autocomplete="current-password">
        <div class="err" id="err"></div>
        <div class="btn-row">
          <button class="btn yellow" id="login" ${configured ? '' : 'disabled'}>Log in</button>
          <button class="btn" id="signup" ${configured ? '' : 'disabled'}>Create account</button>
        </div>
        ${configured ? '' : '<button class="btn blue block" id="guest" style="margin-top:14px">Play as guest</button>'}
      </div>
    </div>`;
  const err = $('#err', root);
  const run = (fn) => async () => {
    err.textContent = ''; const btns = root.querySelectorAll('.btn'); btns.forEach((b) => (b.disabled = true));
    const r = await fn($('#u', root).value, $('#p', root).value);
    if (r && !r.ok) { err.textContent = r.error; btns.forEach((b) => (b.disabled = false)); }
  };
  $('#login', root).onclick = run(onSignIn); $('#signup', root).onclick = run(onSignUp);
  $('#p', root).addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#login', root).click(); });
  if ($('#guest', root)) $('#guest', root).onclick = onGuest;
}

// =====================================================================
//  GAME SCREEN
// =====================================================================
export function mountGame(root, game, { username, canSync, cloud, onSignOut }) {
  const ui = { view: 'farm', tool: null, board: null, labTab: 'genetics', awardTab: 'daily', shopTab: 'seeds', ranksTab: 'boards', boardType: 'level', chat: null, chatErr: null, chatLast: 0 };
  let chatUnsub = null;
  const taps = { titles: [], achievements: [] };   // hidden cheat: 5 quick taps on a sub-tab (same trick as v1)
  root.innerHTML = `<div id="hud"></div><main id="main"></main>
    <div class="dock"><div class="tray" id="tray"></div><nav class="tabs" id="tabs"></nav></div>`;

  // ---------- HUD ----------
  let lastPeso = game.player.peso;
  function renderHUD() {
    const p = game.player, xp = game.xpProgress;
    $('#hud').innerHTML = `<div class="hud" data-frame="${game.meta.skins.frame || ''}">
      <div class="farm" data-act="menu" style="cursor:pointer">
        <div class="lvl">${itemSprite('star', { size: 54, anim: false })}<b>${p.level}</b></div>
        <div class="info"><div class="name">${game.activePet ? game.activePet.emoji + ' ' : ''}${esc(p.farmName || 'My Farm')}</div><div class="title">${esc(game.titles.active && TITLE_DISPLAY[game.titles.active] ? TITLE_DISPLAY[game.titles.active].emoji + ' ' + TITLE_DISPLAY[game.titles.active].name : game.levelTitle)}</div>
          <div class="bar"><i style="width:${Math.min(100, Math.max(0, xp.pct * 100))}%"></i></div></div>
      </div>
      <div class="coins ${p.peso > lastPeso ? 'bump' : ''}">${itemSprite('coin', { size: 40, dur: 1 })}<span>${fmt(p.peso)}</span></div></div>`;
    lastPeso = p.peso;
  }

  // ---------- tabs ----------
  const TABS = [['farm', 'farm', 'Farm'], ['shop', 'shop', 'Shop'], ['market', 'market', 'Sell'], ['lab', 'lab', 'Lab'], ['pets', '🐾', 'Pets'], ['awards', 'quest', 'Awards'], ['ranks', 'trophy', 'Ranks']];
  function renderTabs() {
    const n = game.claimableCount;
    $('#tabs').innerHTML = TABS.map(([id, ic, label]) => `<button class="tab ${ui.view === id ? 'on' : ''}" data-act="tab" data-id="${id}">${ic === '🐾' ? '<span class="emoji-ic">🐾</span>' : icon(ic, 46)}<span>${label}</span>${id === 'awards' && n ? `<i class="badge">${n > 9 ? '9+' : n}</i>` : ''}</button>`).join('');
  }

  // ---------- tool tray (farm only) ----------
  function renderTray() {
    const tray = $('#tray'); tray.style.display = ui.view === 'farm' ? '' : 'none';
    if (ui.view !== 'farm') return;
    const chips = [];
    for (const [id, n] of Object.entries(game.seeds)) {
      const c = getCrop(id); if (!c || n <= 0) continue;
      chips.push(`<button class="tool ${ui.tool?.type === 'seed' && ui.tool.id === id ? 'sel' : ''}" data-act="tool" data-type="seed" data-id="${id}">${cropSprite(id, { size: 52 })}<span class="n">${n}</span><div>${esc(c.name.slice(0, 8))}</div></button>`);
    }
    chips.push(`<button class="tool ${game.gear.fertilizer ? '' : 'empty'} ${ui.tool?.type === 'fert' ? 'sel' : ''}" data-act="tool" data-type="fert">${itemSprite('fertilizer', { size: 52 })}<span class="n">${game.gear.fertilizer}</span><div>Fertilizer</div></button>`);
    for (const s of SPRINKLERS) {
      const n = game.gear.sprinklers[s.tier]; if (!n) continue;
      chips.push(`<button class="tool ${ui.tool?.type === 'sprinkler' && ui.tool.tier === s.tier ? 'sel' : ''}" data-act="tool" data-type="sprinkler" data-tier="${s.tier}">${itemSprite('sprinkler' + s.tier, { size: 52 })}<span class="n">${n}</span><div>Tier ${s.tier}</div></button>`);
    }
    if (!Object.keys(game.seeds).length) chips.unshift('<div class="hint">No seeds - visit the Shop 🛒</div>');
    tray.innerHTML = chips.join('');
  }

  // ---------- farm view ----------
  function plotHTML(p, i) {
    const st = game.stage(p), c = p.cropId && getCrop(p.cropId), ready = p.status === 'ready';
    const soil = ready ? soilSprite('sparkle') : p.status === 'empty' ? soilSprite('empty') : soilSprite(p.doubleChance > 0 ? 'wet' : 'tilled');
    const muts = p.mutations.slice(0, 4).map((m) => m.emoji).join('');
    return `<button class="plot ${ready ? 'ready' : ''} ${p.mutations.length ? 'mutated' : ''}" data-act="plot" data-i="${i}">
      ${soil}${c ? `<div class="crop">${cropSprite(c.id, { stage: st, fluid: true })}</div>` : ''}
      ${p.fertilized ? '<span class="fz">💩</span>' : ''}${muts ? `<span class="muts">${muts}</span>` : ''}
      ${c ? `<span class="timer" data-timer="${i}">${ready ? 'Harvest!' : mmss(p.harvestAt - Date.now())}</span>` : ''}</button>`;
  }
  function farmHTML() {
    const w = game.currentWeather, e = game.activeEvent, ready = game.readyCount, sel = ui.tool?.type === 'seed' ? ui.tool.id : null;
    const auto = game.meta.autoHarvest ? AUTO_HARVEST_TIERS[game.meta.autoHarvest - 1].label : null;
    return `<div class="event" data-act="goevents" style="cursor:pointer"><span class="em">${e.emoji}</span><div>${esc(e.name)}<small>${esc(e.tag)} event</small></div><span class="t">${span(e.endsAt - Date.now())}</span></div>
      ${w ? `<div class="weather"><span class="em">${w.emoji}</span><div>${esc(w.name)}<small>${w.mutationEmoji} ${esc(w.mutation)} crops +₱${w.priceBonus}</small></div><span class="t" id="wt">${mmss(game.weatherSecondsLeft * 1000)}</span></div>` : ''}
      <div class="toolbar"><button class="btn small yellow" data-act="harvestall" ${ready ? '' : 'disabled'}>🧺 Harvest all (${ready})</button>
        <button class="btn small blue" data-act="plantall" ${sel ? '' : 'disabled'} title="Pick a seed in the tray first">🌱 Plant all${sel ? ' ' + esc(getCrop(sel).name) : ''}</button>
        ${auto ? `<span class="pill green">🤖 Auto: ${esc(auto)}</span>` : ''}</div>
      <div class="plots ${game.meta.skins.plot ? 'skin-' + game.meta.skins.plot : ''}">${game.plots.map(plotHTML).join('')}
        <button class="plot buy" data-act="buyplot"><div>➕ New plot<br>₱${fmt(game.plotPrice)}</div></button></div>`;
  }

  // ---------- shop view ----------
  function seedsShopHTML() {
    const cats = CROP_CATEGORIES.map((cat) => {
      const cards = CROPS.filter((c) => c.category === cat.id).map((c) => {
        const locked = !game.isUnlocked(c.id), stock = game.stockOf(c.id);
        return `<div class="card ${locked ? 'locked' : ''} ${!locked && !stock ? 'soldout' : ''}">
          ${cropSprite(c.id, { size: 72 })}<h3>${esc(c.name)}</h3>
          <div class="sub">${locked ? `Level ${c.unlockLevel}` : `${c.growTime}s · sells ₱${c.sellPrice}/kg`}</div>
          <div class="row"><span class="pill gold">₱${c.seedCost}</span><span class="pill">${locked ? '🔒' : `Stock ${stock}`}</span></div>
          <div class="row"><button class="btn small" data-act="buyseed" data-id="${c.id}" data-n="1" ${locked || !stock ? 'disabled' : ''}>Buy</button>
          <button class="btn small yellow" data-act="buyseed" data-id="${c.id}" data-n="5" ${locked || !stock ? 'disabled' : ''}>×5</button></div></div>`;
      }).join('');
      return `<div class="panel"><h2>${esc(cat.name)}</h2><div class="grid2">${cards}</div></div>`;
    }).join('');
    const gear = `<div class="panel"><h2>Gear</h2><div class="grid2">
      <div class="card">${itemSprite('fertilizer', { size: 72 })}<h3>Fertilizer</h3><div class="sub">+20-50% crop weight</div><div class="row"><span class="pill gold">₱${FERTILIZER_COST}</span></div>
        <div class="row"><button class="btn small" data-act="buyfert" data-n="1">Buy</button><button class="btn small yellow" data-act="buyfert" data-n="5">×5</button></div></div>
      ${SPRINKLERS.map((s) => `<div class="card">${itemSprite('sprinkler' + s.tier, { size: 72 })}<h3>${esc(s.name)}</h3><div class="sub">${esc(s.description)}</div><div class="row"><span class="pill gold">₱${s.cost}</span></div>
        <div class="row"><button class="btn small" data-act="buyspr" data-tier="${s.tier}">Buy</button></div></div>`).join('')}</div></div>`;
    return `<div class="panel" style="text-align:center">Seed stock refreshes in <b id="stockt">${mmss(game.stock.expiresAt - Date.now())}</b></div>${gear}${cats}`;
  }

  function shopHTML() {
    const tabs = seg([['seeds', '🛒 Seeds & Gear'], ['tokens', '🪙 Token Shop']], ui.shopTab, 'shoptab');
    return tabs + (ui.shopTab === 'tokens' ? tokensHTML() : seedsShopHTML());
  }
  function tokensHTML() {
    const m = game.meta, ac = game.autoHarvestCost(), ml = game.mutLuckCost(), tk = game.tokens;
    const buy = (act, cost, attrs = '') => `<button class="btn small yellow" data-act="${act}" ${attrs} ${tk < cost ? 'disabled' : ''}>🪙 ${fmt(cost)}</button>`;
    const card = (em, name, desc, status, btn) => `<div class="card"><div class="pet-em">${em}</div><h3>${name}</h3><div class="sub">${desc}</div><div class="row"><span class="pill gold">${status}</span></div><div class="row">${btn}</div></div>`;
    const max = '<span class="pill green">MAX</span>';
    const cards = [
      card('🤖', 'Auto-Harvester', m.autoHarvest ? `Collects: ${esc(AUTO_HARVEST_TIERS[m.autoHarvest - 1].label)}${ac === null ? '' : `<br>Next: ${esc(AUTO_HARVEST_TIERS[m.autoHarvest].label)}`}` : 'Collects ripe crops for you (after their mutation roll).', `Lv ${m.autoHarvest}/${AUTO_HARVEST_TIERS.length}`, ac === null ? max : buy('buyauto', ac)),
      card('🧬', 'Mutation Luck', `+${MUTLUCK_PER_LEVEL}% mutation chance per level (now +${game.mutLuckPct()}%).`, `Lv ${m.mutLuck}/${MUTLUCK_MAX}`, ml === null ? max : buy('buyluck', ml)),
      card('🐾', '2nd Pet Slot', 'Run two pets at once. Different jobs = +15% synergy.', m.slot2 ? 'Unlocked' : 'Locked', m.slot2 ? max : buy('buyslot2', SLOT2_COST)),
      card('🎫', 'Weather Ticket', 'Pick the weather yourself (see Weather control below).', `Have ${game.weatherTickets}`, buy('buyticket', TICKET_COST)),
      card('🦴', 'Pet Treat', `Free pet level-up, or ${EVOLVE_TREATS} to evolve a max pet (x1.5 bonus).`, `Have ${m.treats}`, buy('buytreat', TREAT_COST)),
      card('🎰', 'Legendary Genetics', 'Random crop gets +1 genetics tier (75%), else 2 premium seed packs.', 'Roll', buy('legend', LEGEND_COST)),
      card('⚡', 'Event Boost', '30 min of x2 XP and +25% sell price. Stacks time.', game.boostActive ? `On · ${mmss(m.boostUntil - Date.now())}` : 'Off', buy('buyboost', BOOST_COST)),
    ].join('');
    const weather = WEATHER_TYPES.map((w) => { const c = game.weatherTicketCost(w); return `<button class="btn small ${c > 1 ? 'purple' : 'blue'}" data-act="useweather" data-id="${w.id}" ${game.weatherTickets < c ? 'disabled' : ''}>${w.emoji} ${esc(w.name)} · ${c}🎫</button>`; }).join('');
    const cos = (slot, title) => `<div class="panel"><h2>${title}</h2><div class="list">${COSMETICS.filter((c) => c.slot === slot).map((c) => {
      const own = game.ownsCosmetic(c.id), on = m.skins[slot] === c.id;
      const act = own ? `<button class="btn small ${on ? 'blue' : ''}" data-act="equipcos" data-id="${on ? '' : c.id}" data-slot="${slot}">${on ? '★ On' : 'Equip'}</button>` : c.cost == null ? `<span class="pill">${esc(c.note)}</span>` : buy('buycos', c.cost, `data-id="${c.id}"`);
      return `<div class="item"><span style="font-size:34px">${c.emoji}</span><div class="grow"><h3>${esc(c.name)}</h3></div>${act}</div>`; }).join('')}</div></div>`;
    return `<div class="panel" style="display:flex;justify-content:space-between;font-weight:700"><span>🪙 ${fmt(tk)} tokens</span><span>🎫 ${game.weatherTickets} · 🦴 ${m.treats}</span></div>
      <div class="panel"><h2>Upgrades</h2><div class="grid2">${cards}</div></div>
      <div class="panel"><h2>Weather control</h2><p style="margin-top:0;font-weight:600">Spend tickets to change the weather right now. Rare weather costs 3.</p><div class="chips">${weather}</div></div>
      ${cos('plot', '🌸 Plot skins')}${cos('frame', '🖼️ UI frames')}
      <div class="panel" style="text-align:center;font-weight:600">Earn tokens from daily quests, login streaks and achievements.</div>`;
  }

  // ---------- market view ----------
  function marketHTML() {
    const ids = Object.keys(game.inventory);
    if (!ids.length) return `<div class="panel empty-state">${itemSprite('crate', { size: 96 })}<p>Your basket is empty.<br>Harvest crops on the farm, then sell them here!</p></div>`;
    const total = ids.reduce((s, id) => s + game.inventoryValue(id), 0);
    const rows = ids.map((id) => {
      const c = getCrop(id), list = game.inventory[id], best = list.reduce((m, it) => Math.max(m, it.weight), 0);
      const muts = [...new Set(list.flatMap((it) => it.mutations.map((m) => m.emoji)))].join('');
      return `<div class="item">${cropSprite(id, { size: 56 })}<div class="grow"><h3>${esc(c.name)} ×${list.length} ${muts}</h3><div class="sub">Best ${best}kg · worth ₱${fmt(game.inventoryValue(id))}</div></div>
        <button class="btn small yellow" data-act="sell" data-id="${id}" data-mode="heaviest">Best</button><button class="btn small" data-act="sell" data-id="${id}" data-mode="all">All</button></div>`;
    }).join('');
    return `<div class="panel"><h2>Your basket</h2><div class="list">${rows}</div></div>
      <button class="btn yellow block" data-act="sellall">Sell everything · ₱${fmt(total)}</button>
      <div class="panel" style="margin-top:14px"><h2>Bulk sell</h2><div class="chips">
        <button class="btn small" data-act="sellf" data-m="plain">Plain only (keep mutated)</button><button class="btn small purple" data-act="sellf" data-m="mut">Mutated only</button>
        ${CROP_CATEGORIES.map((c) => `<button class="btn small blue" data-act="sellf" data-cat="${c.id}">${esc(c.name)}</button>`).join('')}</div></div>`;
  }

  // ---------- leaderboard view ----------
  const BOARDS = [['level', '⭐ Level'], ['season', '📆 Season'], ['mutations', '🧬 Mutations'], ['peso', '💰 Richest'], ['bestSale', '💎 Best sale']];
  function ranksHTML() {
    const tabs = seg([['boards', '🏆 Boards'], ['chat', '💬 World Chat']], ui.ranksTab, 'ranktab');
    if (!canSync) return `${tabs}<div class="panel empty-state"><p>Leaderboards and chat need an online account.</p></div>`;
    return tabs + (ui.ranksTab === 'chat' ? chatHTML() : boardsHTML());
  }
  function boardsHTML() {
    const t = ui.boardType, tabs = seg(BOARDS, t, 'boardtype');
    const note = t === 'season' ? `<div class="panel" style="text-align:center;font-weight:600">Season ${esc(game.season.id)} · resets every month · your earnings: ₱${fmt(game.season.earned)}</div>` : '';
    if (!ui.board) return `${tabs}<div class="panel empty-state">Loading…</div>`;
    if (ui.board.error) return `${tabs}<div class="panel empty-state">Couldn't load the leaderboard.<br><small>${esc(ui.board.error)}</small></div>`;
    if (!ui.board.length) return `${tabs}${note}<div class="panel empty-state">Nobody here yet. Be the first!</div>`;
    const me = cloud.uid;
    const sub = (r) => ({ level: `@${esc(r.username)} · ₱${fmt(r.peso || 0)}` }[t] || `@${esc(r.username)} · Lv ${r.level}`);
    const pill = (r) => ({ level: `Lv ${r.level}`, mutations: `🧬 ${fmt(r.value)}` }[t] || `₱${fmt(r.value)}`);
    return `${tabs}${note}<div class="panel"><h2>${esc(BOARDS.find((b) => b[0] === t)[1])}</h2><div class="list">${ui.board.map((r) => `<div class="item ${r.uid === me ? 'me' : ''}">
      <div class="rank ${r.rank <= 3 ? 'r' + r.rank : ''}">${r.rank}</div>
      <div class="grow"><h3>${esc(r.farmName)}</h3><div class="sub">${sub(r)}</div></div><span class="pill gold">${pill(r)}</span></div>`).join('')}</div></div>`;
  }
  function chatListHTML() {
    if (ui.chatErr) return `<p style="text-align:center">Chat unavailable.<br><small>${esc(ui.chatErr)}</small></p>`;
    if (!ui.chat) return '<p style="text-align:center">Loading…</p>';
    if (!ui.chat.length) return '<p style="text-align:center">No messages yet. Say hi! 👋</p>';
    return ui.chat.map((m) => `<div class="msg ${m.uid === cloud.uid ? 'me' : ''}"><b>${esc(m.username)}</b> <small>Lv ${esc(m.level)} · ${ago(m.at)}</small><div>${esc(m.text)}</div></div>`).join('');
  }
  function chatHTML() {
    return `<div class="panel chat"><div id="chatlist" class="chatlist">${chatListHTML()}</div>
      <div class="chatbar"><input class="field" id="chatin" maxlength="140" placeholder="Say hi to the farmers…" autocomplete="off" autocapitalize="sentences" style="margin:0"><button class="btn small yellow" data-act="chatsend">Send</button></div></div>`;
  }
  function updateChatList() {
    const el = $('#chatlist'); if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 70;
    el.innerHTML = chatListHTML(); if (near) el.scrollTop = el.scrollHeight;
  }
  function syncChat() {   // listen to the chat only while the chat screen is open (saves Firestore reads)
    const want = canSync && ui.view === 'ranks' && ui.ranksTab === 'chat';
    if (want && !chatUnsub) chatUnsub = cloud.chat.subscribe((list, err) => { ui.chat = list; ui.chatErr = err ? err.message : null; updateChatList(); });
    if (!want && chatUnsub) { chatUnsub(); chatUnsub = null; ui.chat = null; }
  }
  async function sendChat() {
    const inp = $('#chatin'); if (!inp) return;
    const raw = inp.value.trim(); if (!raw) return;
    if (Date.now() - ui.chatLast < 3000) return toast('Slow down a little 🐢', 'err');
    ui.chatLast = Date.now(); inp.value = '';
    const r = await cloud.chat.send(cleanText(raw), game.player.level);
    if (!r.ok) { toast(r.error, 'err'); inp.value = raw; }
  }

  // ---------- lab view (genetics + mastery) ----------
  const seg = (items, cur, act) => `<div class="seg">${items.map(([id, label]) => `<button class="${cur === id ? 'on' : ''}" data-act="${act}" data-id="${id}">${label}</button>`).join('')}</div>`;
  function labHTML() {
    const tabs = seg([['genetics', '🧬 Genetics'], ['mastery', '🎓 Mastery']], ui.labTab, 'labtab');
    const intro = ui.labTab === 'genetics'
      ? `Upgrade crop tiers for a permanent sell-price multiplier. Max ×${GENETICS_TIERS[GENETICS_TIERS.length - 1].priceMultiplier.toFixed(1)}.`
      : 'Master a crop: +0.5% weight and +0.5% sell price per level (max 100).';
    const sections = CROP_CATEGORIES.map((cat) => {
      const rows = CROPS.filter((c) => c.category === cat.id).map((c) => {
        let name, bar, line, cost, btn;
        if (ui.labTab === 'genetics') {
          const t = game.geneticsTier(c.id), max = t >= GENETICS_TIERS.length; cost = game.geneticsCost(c.id);
          name = t ? `${GENETICS_TIERS[t - 1].emoji} ${GENETICS_TIERS[t - 1].name}` : 'Normal';
          bar = GENETICS_TIERS.map((_, i) => `<i class="${i < t ? 'on' : ''}"></i>`).join('');
          line = `×${game.geneticsMult(c.id).toFixed(2)} sell price${max ? '' : ` → ×${GENETICS_TIERS[t].priceMultiplier.toFixed(2)}`}`;
        } else {
          const l = game.masteryLevel(c.id), max = l >= 100; cost = game.masteryCost(c.id);
          name = `Level ${l}`; bar = `<i class="fill" style="width:${l}%"></i>`;
          line = `+${(l * 0.5).toFixed(1)}% weight & price${max ? '' : ` → +${((l + 1) * 0.5).toFixed(1)}%`}`;
        }
        return `<div class="item">${cropSprite(c.id, { size: 56 })}<div class="grow"><h3>${esc(c.name)} <small>${name}</small></h3>
          <div class="meter ${ui.labTab === 'mastery' ? 'one' : ''}">${bar}</div><div class="sub">${line}</div></div>
          ${cost === null ? '<span class="pill green">MAX</span>' : `<button class="btn small yellow" data-act="${ui.labTab === 'genetics' ? 'gen' : 'mast'}" data-id="${c.id}" ${game.player.peso < cost ? 'disabled' : ''}>₱${fmt(cost)}</button>`}</div>`;
      }).join('');
      return `<div class="panel"><h2>${esc(cat.name)}</h2><div class="list">${rows}</div></div>`;
    }).join('');
    return `${tabs}<div class="panel" style="text-align:center;font-weight:600">${intro}</div>${sections}`;
  }

  // ---------- pets view ----------
  function petsHTML() {
    const ev = game.activeEvent;
    const cards = PETS.map((p) => {
      const lvl = game.petLevel(p.id), owned = lvl > 0, a1 = game.pets.active === p.id, a2 = game.meta.slot2 && game.pets.active2 === p.id, evolved = !!game.pets.evolved[p.id];
      const eventLocked = !owned && p.eventOnly && ev.id !== p.eventOnly, locked = !owned && (eventLocked || game.player.level < p.unlockLevel);
      const k = evolved ? 1.5 : 1, now = p.perLevel * Math.max(lvl, 1) * k, nxt = p.perLevel * Math.min(lvl + 1, PET_MAX_LEVEL) * k, fmtB = (n) => Math.round(n * 100) / 100;
      const bonus = `+${fmtB(now)}% ${BONUS_LABEL[p.bonus]}${owned && lvl < PET_MAX_LEVEL ? ` → +${fmtB(nxt)}%` : ''}`;
      let btns;
      if (!owned) btns = `<button class="btn small yellow" data-act="adopt" data-id="${p.id}" ${locked || game.player.peso < p.cost ? 'disabled' : ''}>Adopt ₱${fmt(p.cost)}</button>`;
      else {
        const feed = lvl < PET_MAX_LEVEL ? `<button class="btn small yellow" data-act="feed" data-id="${p.id}" ${game.player.peso < getPetFeedCost(p, lvl) ? 'disabled' : ''}>Feed ₱${fmt(getPetFeedCost(p, lvl))}</button>` : '';
        const treat = lvl < PET_MAX_LEVEL && game.meta.treats > 0 ? `<button class="btn small purple" data-act="treat" data-id="${p.id}">🦴 Treat</button>` : '';
        const evo = lvl >= PET_MAX_LEVEL ? (evolved ? '<span class="pill green">✨ Evolved</span>' : `<button class="btn small purple" data-act="evolve" data-id="${p.id}" ${game.meta.treats < EVOLVE_TREATS ? 'disabled' : ''}>✨ Evolve (${EVOLVE_TREATS}🦴)</button>`) : '';
        btns = `<div class="chips"><button class="btn small ${a1 ? 'blue' : ''}" data-act="activepet" data-id="${p.id}">${a1 ? '★ Slot 1' : 'Slot 1'}</button>${game.meta.slot2 ? `<button class="btn small ${a2 ? 'blue' : ''}" data-act="slot2pet" data-id="${a2 ? '' : p.id}">${a2 ? '★ Slot 2' : 'Slot 2'}</button>` : ''}${feed}${treat}${evo}</div>`;
      }
      return `<div class="card pet ${locked ? 'locked' : ''} ${a1 || a2 ? 'active' : ''}"><div class="pet-em">${p.emoji}</div><h3>${evolved ? '✨ ' : ''}${esc(p.name)}</h3>
        <div class="sub">${eventLocked ? `Only during ${esc(EVENT_TAG[p.eventOnly] || 'its event')} 🎊` : locked ? `Unlocks at level ${p.unlockLevel}` : esc(p.desc)}</div>
        <div class="row"><span class="pill gold">${owned ? `Lv ${lvl}/${PET_MAX_LEVEL}` : 'Not adopted'}</span></div><div class="sub"><b>${bonus}</b></div><div class="row">${btns}</div></div>`;
    }).join('');
    const intro = game.meta.slot2 ? 'Two pets work at once. Different jobs give +15% synergy.' : 'One pet works on your farm at a time. Unlock a 2nd slot in the Token Shop.';
    return `<div class="panel" style="text-align:center;font-weight:600">${intro} Feed pets (₱ or 🦴 treats) to level them; max-level pets can evolve.${ev.id === 'parade' ? '<br><b>🎊 Pet Parade: all pet bonuses x2!</b>' : ''}</div><div class="panel"><h2>Pets</h2><div class="grid2">${cards}</div></div>`;
  }

  // ---------- daily view: login streak, events, daily + weekly quests ----------
  function questRows(period) {
    const set = game[period]; if (!set) return '';
    return set.list.map((q) => {
      const def = game.questDef(period, q.id), prog = game.questProgress(period, q), done = prog >= q.target, claimed = set.claimed[q.id];
      const action = claimed ? '<span class="pill green">✓ Done</span>' : done ? `<button class="btn small yellow" data-act="claimq" data-period="${period}" data-id="${q.id}">Claim</button>` : `<span class="pill">${fmt(prog)}/${fmt(q.target)}</span>`;
      return `<div class="item ${done && !claimed ? 'me' : ''}"><span style="font-size:34px">${def.emoji}</span><div class="grow"><h3>${esc(def.text.replace('{n}', fmt(q.target)))}</h3>
        <div class="bar"><i style="width:${(prog / q.target) * 100}%"></i></div><div class="sub"><b>${esc(rewardLabel(def.reward))}</b></div></div>${action}</div>`;
    }).join('');
  }
  function bonusRow(period, label) {
    const set = game[period]; if (!set) return '';
    const act = set.bonusClaimed ? '<span class="pill green">✓ Done</span>' : game.questBonusReady(period) ? `<button class="btn small yellow" data-act="claimbonus" data-period="${period}">Claim</button>` : '<span class="pill">🔒</span>';
    return `<div class="item"><span style="font-size:34px">🎁</span><div class="grow"><h3>Finish all ${set.list.length}</h3><div class="sub"><b>${esc(label)}</b></div></div>${act}</div>`;
  }
  function dailyHTML() {
    const L = game.loginState, e = game.activeEvent, now = new Date();
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (((8 - now.getDay()) % 7) || 7));
    const cells = LOGIN_REWARDS.map((d, i) => { const day = i + 1, done = L.claimed ? day <= L.day : day < L.day, today = day === L.day && !L.claimed;
      return `<div class="day ${done ? 'done' : ''} ${today ? 'today' : ''} ${d.big ? 'big' : ''}"><b>Day ${day}</b><span>${d.rewards.map(shortReward).join('')}</span>${done ? '<em>✓</em>' : ''}</div>`; }).join('');
    const boost = game.boostActive ? `<div class="panel" style="text-align:center;font-weight:700">⚡ Boost active: x2 XP · +25% sell · ${mmss(game.meta.boostUntil - Date.now())}</div>` : '';
    return `<div class="panel"><h2>Login streak</h2><div class="streak">${cells}</div>
        <p style="text-align:center;font-weight:600;margin:10px 0">🔥 ${L.count}-day streak · miss a day and it restarts</p>
        <button class="btn yellow block" data-act="claimlogin" ${L.claimed ? 'disabled' : ''}>${L.claimed ? 'Come back tomorrow' : `Claim Day ${L.day} reward`}</button></div>
      <div class="panel"><h2>Events</h2><div class="item"><span style="font-size:38px">${e.emoji}</span><div class="grow"><h3>${esc(e.name)} <small>${esc(e.tag)}</small></h3>
        <div class="sub">${esc(e.desc)}</div><div class="sub"><b>Ends in ${span(e.endsAt - Date.now())}</b> · Next: ${e.next.emoji} ${esc(e.next.name)}</div></div></div></div>${boost}
      <div class="panel"><h2>Daily quests</h2><div class="list">${questRows('daily')}${bonusRow('daily', rewardLabel(DAILY_BONUS))}</div><p style="text-align:center;margin:10px 0 0;font-size:14px;opacity:.75">Resets in ${span(dayEnd - now)}</p></div>
      <div class="panel"><h2>Weekly challenges</h2><div class="list">${questRows('weekly')}${bonusRow('weekly', '🏮 Limited Bayanihan UI frame')}</div><p style="text-align:center;margin:10px 0 0;font-size:14px;opacity:.75">Resets in ${span(weekEnd - now)}</p></div>`;
  }

  // ---------- awards view (achievements + titles) ----------
  function awardsHTML() {
    const tabs = seg([['daily', '📅 Daily'], ['achievements', '🏆 Awards'], ['titles', '👑 Titles']], ui.awardTab, 'awardtab');
    const head = `<div class="panel" style="display:flex;justify-content:space-between;font-weight:700"><span>🪙 ${fmt(game.tokens)} tokens</span><span>🎫 ${fmt(game.weatherTickets)} weather tickets</span></div>`;
    if (ui.awardTab === 'daily') return `${tabs}${head}${dailyHTML()}`;
    if (ui.awardTab === 'titles') {
      const owned = game.titles.owned;
      const rows = owned.length ? owned.map((id) => { const t = TITLE_DISPLAY[id] || { name: id, emoji: '🏷️' }, on = game.titles.active === id;
        return `<div class="item"><span style="font-size:34px">${t.emoji}</span><div class="grow"><h3>${esc(t.name)}</h3></div><button class="btn small ${on ? 'blue' : ''}" data-act="title" data-id="${id}">${on ? '★ Active' : 'Use'}</button></div>`; }).join('')
        : '<p style="text-align:center;margin:8px 0">No titles yet. Claim achievements that award one!</p>';
      return `${tabs}${head}<div class="panel"><h2>Titles</h2><div class="list">${rows}</div>${game.titles.active ? '<button class="btn small block" data-act="title" data-id="" style="margin-top:10px">Remove title</button>' : ''}</div>`;
    }
    const n = game.unclaimedAchievements.length, done = ACHIEVEMENTS.filter((a) => game.achievements[a.id]).length;
    const sections = ACHIEVEMENT_CATEGORIES.map((cat) => {
      const rows = ACHIEVEMENTS.filter((a) => a.cat === cat.id).map((a) => {
        const e = game.achievements[a.id], t = a.title && TITLE_DISPLAY[a.title];
        const action = !e ? '<span class="pill">🔒</span>' : e.claimed ? '<span class="pill green">✓ Done</span>' : `<button class="btn small yellow" data-act="claim" data-id="${a.id}">Claim</button>`;
        return `<div class="item ${e && !e.claimed ? 'me' : ''}" style="${e ? '' : 'opacity:.65'}"><span style="font-size:34px">${a.emoji}</span><div class="grow"><h3>${esc(a.name)}</h3>
          <div class="sub">${esc(a.desc)}</div><div class="sub"><b>${esc(rewardLabel(a.reward))}</b>${t ? ` · title ${t.emoji} ${esc(t.name)}` : ''}</div></div>${action}</div>`;
      }).join('');
      return `<div class="panel"><h2>${esc(cat.name)}</h2><div class="list">${rows}</div></div>`;
    }).join('');
    return `${tabs}${head}<div class="panel" style="text-align:center"><b>${done}/${ACHIEVEMENTS.length}</b> unlocked${n ? `<button class="btn yellow block" data-act="claimall" style="margin-top:10px">Claim all (${n})</button>` : ''}</div>${sections}`;
  }

  // ---------- render orchestration ----------
  function renderMain() {
    $('#main').innerHTML = { farm: farmHTML, shop: shopHTML, market: marketHTML, lab: labHTML, pets: petsHTML, awards: awardsHTML, ranks: ranksHTML }[ui.view]();
  }
  let queued = false;
  function renderAll() {
    if (queued) return; queued = true;
    requestAnimationFrame(() => { queued = false; renderHUD(); renderTabs(); renderTray(); if (!($('#chatin') && ui.view === 'ranks')) renderMain(); });   // don't wipe a half-typed chat message
  }
  game.on('change', renderAll);

  async function loadBoard() {
    if (!cloud) return;
    const type = ui.boardType; ui.board = null; renderMain();
    try { const rows = await cloud.leaderboard(type, game.season.id); if (type !== ui.boardType) return; ui.board = rows; } catch (e) { ui.board = { error: e.message }; }
    if (ui.view === 'ranks' && ui.ranksTab === 'boards') renderMain();
  }

  // ---------- 1-second timers (no full re-render) ----------
  const timerLoop = setInterval(() => {
    game.tick();
    if (ui.view === 'farm') {
      document.querySelectorAll('[data-timer]').forEach((el) => {
        const p = game.plots[el.dataset.timer]; if (p?.status === 'growing') el.textContent = mmss(p.harvestAt - Date.now());
      });
      const wt = $('#wt'); if (wt) wt.textContent = mmss(game.weatherSecondsLeft * 1000);
    }
    const st = $('#stockt'); if (st) st.textContent = mmss(game.stock.expiresAt - Date.now());
  }, 1000);

  // ---------- events ----------
  game.on('levelup', ({ level, reward }) => {
    sfx('level');
    const r = reward && getCrop(reward.cropId);
    modal(`${itemSprite('star', { size: 110 })}<h2>Level ${level}!</h2><p style="font-weight:600;margin-top:0">${esc(game.levelTitle)}<br>+2 plots${r ? ` · +${reward.quantity} ${esc(r.name)} seeds` : ''}</p><button class="btn yellow block" data-close>Yay!</button>`)
      .addEventListener('click', (e) => { if (e.target.closest('[data-close]')) e.currentTarget.remove(); });
  });
  game.on('achievement', (a) => { sfx('level'); toast(`🏆 ${a.name} unlocked! Claim it in Awards`, 'gold'); });
  game.on('auto', (n) => toast(`🤖 Auto-harvested ${n} crop${n > 1 ? 's' : ''}`));
  game.on('season', (se) => toast(`📆 Season ${se.id} ended! +10 🪙 for playing`, 'gold'));
  game.on('weather', (w) => toast(`${w.emoji} ${w.name}! ${w.mutationEmoji} ${w.mutation} crops +₱${w.priceBonus}`));

  const result = (r, okMsg) => { if (!r.ok) { sfx('no'); toast(r.error, 'err'); } else if (okMsg) toast(okMsg); return r; };

  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const d = el.dataset;
    switch (d.act) {
      case 'tab': ui.view = d.id; if (d.id === 'ranks' && ui.ranksTab === 'boards') loadBoard(); renderAll(); syncChat(); sfx('tap'); break;
      case 'goevents': ui.view = 'awards'; ui.awardTab = 'daily'; renderAll(); sfx('tap'); break;
      case 'shoptab': ui.shopTab = d.id; renderMain(); break;
      case 'ranktab': ui.ranksTab = d.id; if (d.id === 'boards') loadBoard(); else renderMain(); syncChat(); break;
      case 'boardtype': ui.boardType = d.id; loadBoard(); break;
      case 'chatsend': sendChat(); break;
      case 'harvestall': {
        document.querySelectorAll('.plot.ready').forEach((pl, k) => { if (k < 12) burst(pl); });
        const r = result(game.harvestAll()); if (r.ok) { sfx('harvest'); flyText(el, `+${r.count} crops`); toast(`🧺 Harvested ${r.count} crops`, 'gold'); } break;
      }
      case 'plantall': { if (ui.tool?.type !== 'seed') { toast('Pick a seed from the tray first 🌱'); break; } const r = result(game.plantAll(ui.tool.id)); if (r.ok) { sfx('plant'); toast(`🌱 Planted ${r.count}`); if (!game.seeds[ui.tool.id]) ui.tool = null; } break; }
      case 'sellf': {
        const f = d.cat ? { category: d.cat } : d.m === 'mut' ? { mutated: true } : { mutated: false };
        const r = result(game.sellFilter(f)); if (r.ok) { sfx('coin'); flyText(el, `+₱${fmt(r.total)}`); toast(`Sold ${r.count} for ₱${fmt(r.total)}`, 'gold'); } break;
      }
      case 'buyauto': { const r = result(game.buyAutoHarvest()); if (r.ok) { sfx('level'); toast('🤖 Auto-Harvester upgraded!', 'gold'); } break; }
      case 'buyluck': { const r = result(game.buyMutLuck()); if (r.ok) { sfx('level'); toast(`🧬 Mutation Luck ${r.level}`, 'gold'); } break; }
      case 'buyslot2': if (result(game.buySlot2()).ok) { sfx('level'); toast('🐾 2nd pet slot unlocked!', 'gold'); } break;
      case 'buyticket': if (result(game.buyWeatherTicket()).ok) { sfx('coin'); toast('🎫 +1 weather ticket'); } break;
      case 'buytreat': if (result(game.buyTreat()).ok) { sfx('coin'); toast('🦴 +1 pet treat'); } break;
      case 'buyboost': if (result(game.buyBoost()).ok) { sfx('level'); toast('⚡ Boost active for 30 minutes!', 'gold'); } break;
      case 'legend': { const r = result(game.legendaryRoll()); if (r.ok) { sfx('level'); toast(r.kind === 'genetics' ? `🎰 ${r.crop.name} → ${GENETICS_TIERS[r.tier - 1].name}!` : '🎰 2 premium seed packs!', 'gold'); } break; }
      case 'useweather': { const r = result(game.useWeatherTicket(d.id)); if (r.ok) { sfx('level'); toast(`${r.weather.emoji} Weather set to ${r.weather.name}`, 'gold'); } break; }
      case 'buycos': if (result(game.buyCosmetic(d.id)).ok) { sfx('level'); toast('✨ Unlocked and equipped!', 'gold'); } break;
      case 'equipcos': result(game.equipCosmetic(d.id || null, d.slot)); break;
      case 'claimlogin': { const r = result(game.claimLogin()); if (r.ok) { sfx('level'); toast(`🎁 Day ${r.day}: ${r.rewards.map(rewardLabel).join(' + ')}`, 'gold'); } break; }
      case 'claimq': { const r = result(game.claimQuest(d.period, d.id)); if (r.ok) { sfx('coin'); toast(`Reward: ${rewardLabel(r.reward)}`, 'gold'); } break; }
      case 'claimbonus': { const r = result(game.claimQuestBonus(d.period)); if (r.ok) { sfx('level'); toast(`🎁 Bonus: ${rewardLabel(r.reward)}`, 'gold'); } break; }
      case 'slot2pet': result(game.setPetSlot2(d.id || null)); break;
      case 'treat': { const r = result(game.treatPet(d.id)); if (r.ok) { sfx('coin'); toast(`🦴 ${getPet(d.id).name} is level ${r.level}!`, 'gold'); } break; }
      case 'evolve': if (result(game.evolvePet(d.id)).ok) { sfx('level'); toast(`✨ ${getPet(d.id).name} evolved!`, 'gold'); } break;
      case 'tool': {
        const same = ui.tool && ui.tool.type === d.type && ui.tool.id === d.id && ui.tool.tier === Number(d.tier);
        ui.tool = same ? null : { type: d.type, id: d.id, tier: Number(d.tier) }; sfx('tap'); renderAll(); break;
      }
      case 'plot': {
        const i = Number(d.i), p = game.plots[i];
        if (p.status === 'ready') {
          const r = game.harvest(i); if (!r.ok) return result(r);
          sfx('harvest'); burst(el);
          if (r.items.some((x) => x.mutations.length >= 2)) { document.body.classList.add('rumble'); setTimeout(() => document.body.classList.remove('rumble'), 350); }
          const it = r.items[0]; flyText(el, `+${it.weight}kg${r.items.length > 1 ? ' ×2!' : ''}`);
          toast(`${r.crop.name} ${it.weight}kg ${it.mutations.map((m) => m.emoji).join('')}`);
          return;
        }
        if (!ui.tool) { if (p.status === 'empty') toast('Pick a seed from the tray first 🌱'); return; }
        let r;
        if (ui.tool.type === 'seed') r = game.plant(i, ui.tool.id);
        else if (ui.tool.type === 'fert') r = game.fertilize(i);
        else r = game.sprinkle(i, ui.tool.tier);
        if (!r.ok) { el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 300); result(r); }
        else { sfx('plant'); if (ui.tool.type === 'seed' && !game.seeds[ui.tool.id]) ui.tool = null; if (ui.tool?.type === 'fert' && !game.gear.fertilizer) ui.tool = null; }
        break;
      }
      case 'buyplot': if (result(game.buyPlot()).ok) { sfx('coin'); toast('New plot unlocked!', 'gold'); } break;
      case 'buyseed': { const r = result(game.buySeed(d.id, Number(d.n))); if (r.ok) sfx('coin'); break; }
      case 'buyfert': if (result(game.buyFertilizer(Number(d.n))).ok) sfx('coin'); break;
      case 'buyspr': if (result(game.buySprinkler(Number(d.tier))).ok) sfx('coin'); break;
      case 'sell': { const r = result(game.sell(d.id, d.mode)); if (r.ok) { sfx('coin'); flyText(el, `+₱${fmt(r.total)}`); toast(`Sold ${r.count} for ₱${fmt(r.total)}`, 'gold'); } break; }
      case 'sellall': { const r = result(game.sellEverything()); if (r.ok) { sfx('coin'); flyText(el, `+₱${fmt(r.total)}`); toast(`Sold ${r.count} items for ₱${fmt(r.total)}!`, 'gold'); } break; }
      case 'labtab': ui.labTab = d.id; renderMain(); break;
      case 'gen': { const r = result(game.upgradeGenetics(d.id)); if (r.ok) { sfx('coin'); toast(`🧬 ${getCrop(d.id).name} → ${GENETICS_TIERS[r.tier - 1].name}!`, 'gold'); } break; }
      case 'mast': { const r = result(game.upgradeMastery(d.id)); if (r.ok) { sfx('coin'); toast(`🎓 ${getCrop(d.id).name} mastery ${r.level}`, 'gold'); } break; }
      case 'adopt': { const r = result(game.adoptPet(d.id)); if (r.ok) { sfx('level'); toast(`${getPet(d.id).emoji} ${getPet(d.id).name} joined your farm!`, 'gold'); } break; }
      case 'feed': { const r = result(game.feedPet(d.id)); if (r.ok) { sfx('coin'); toast(`${getPet(d.id).emoji} Level ${r.level}!`, 'gold'); } break; }
      case 'activepet': result(game.setActivePet(game.pets.active === d.id ? null : d.id)); break;
      case 'awardtab': {
        ui.awardTab = d.id; renderMain();
        // hidden cheats from v1: 5 taps within 2 s on "Titles" -> hesoyam, on "Achievements" -> growall
        const key = d.id, now = Date.now(); if (!taps[key]) break;
        taps[key] = [...taps[key].filter((t) => now - t < 2000), now];
        if (taps[key].length >= 5) { taps[key] = []; runCheat(key === 'titles' ? 'hesoyam' : 'growall'); }
        break;
      }
      case 'claim': { const r = result(game.claimAchievement(d.id)); if (r.ok) { sfx('coin'); toast(`Reward: ${rewardLabel(r.reward)}`, 'gold'); } break; }
      case 'claimall': { const r = result(game.claimAllAchievements()); if (r.ok) { sfx('coin'); toast(`Claimed ${r.count} rewards!`, 'gold'); } break; }
      case 'title': result(game.setActiveTitle(d.id || null)); break;
      case 'menu': openMenu(); break;
    }
  });

  root.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'chatin') sendChat(); });

  function runCheat(code) {
    const r = game.applyCheatCode(code);
    if (r.ok) { sfx('level'); toast(r.message, 'gold'); } else { sfx('no'); toast(r.error, 'err'); }
    return r;
  }

  function openMenu() {
    const s = modal(`<h2>${esc(game.player.farmName)}</h2>
      <p style="margin-top:0;font-weight:600">${username ? `@${esc(username)}` : 'Guest (saved on this device only)'}</p>
      <div style="display:flex;gap:8px;margin-bottom:12px"><input class="field" id="m-cheat" placeholder="Cheat code" autocapitalize="none" autocomplete="off" style="margin:0"><button class="btn small" id="m-cheat-go">Apply</button></div>
      <button class="btn blue block" id="m-music" style="margin-bottom:12px">Music: ${music.enabled ? 'On' : 'Off'}</button>
      <button class="btn red block" id="m-out">${username ? 'Log out' : 'Back to title'}</button>`);
    $('#m-music', s).onclick = (e) => { music.toggle(); e.target.textContent = `Music: ${music.enabled ? 'On' : 'Off'}`; };
    const cheat = () => { const r = runCheat($('#m-cheat', s).value); if (r.ok) $('#m-cheat', s).value = ''; };
    $('#m-cheat-go', s).onclick = cheat; $('#m-cheat', s).addEventListener('keydown', (e) => e.key === 'Enter' && cheat());
    $('#m-out', s).onclick = () => { s.remove(); onSignOut(); };
  }

  // first-run: ask for a farm name
  if (!game.player.farmName) {
    const s = modal(`${cropSprite('kalabasa', { size: 96 })}<h2>Name your farm</h2>
      <input class="field" id="fn" maxlength="24" placeholder="e.g. Sunny Acres" style="text-align:center"><div class="err" id="fe"></div>
      <button class="btn yellow block" id="fgo">Let's grow!</button>`, { dismiss: false });
    const go = () => { const r = game.setFarmName($('#fn', s).value); if (r.ok) { s.remove(); sfx('level'); } else $('#fe', s).textContent = r.error; };
    $('#fgo', s).onclick = go; $('#fn', s).addEventListener('keydown', (e) => e.key === 'Enter' && go());
  }

  renderAll();
  if (game.player.farmName && !game.loginState.claimed) setTimeout(() => toast('🎁 Daily login reward ready in Awards → Daily', 'gold'), 600);
  return { destroy() { clearInterval(timerLoop); chatUnsub?.(); chatUnsub = null; } };
}
