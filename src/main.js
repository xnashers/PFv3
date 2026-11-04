import { isConfigured } from './firebase-config.js';
import { Game, SAVE_EPOCH } from './game.js';
import { loadSprites } from './sprites.js';
import { mountAuth, mountGame } from './ui.js';

const root = document.getElementById('app');
const SYNC_DELAY = 15000;           // batch cloud writes: at most 1 per 15 s while playing (Firestore free tier = 20k writes/day)
const PROFILE_EVERY = 60000;        // leaderboard profile is refreshed at most once a minute (or on level up)
let fb = null, current = null;

const readLocal = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };

/** Saves to localStorage instantly and to Firestore (debounced). */
function createSaver(game, localKey, cloud) {
  let timer = null, dirty = false, lastProfile = 0, lastLevel = game.player.level;
  const flush = async () => {
    clearTimeout(timer); timer = null;
    if (!dirty || !cloud) return;
    dirty = false;
    const withProfile = Date.now() - lastProfile > PROFILE_EVERY || game.player.level !== lastLevel;
    try {
      await cloud.push(game.snapshot(), withProfile ? game.leaderboardProfile : null);
      if (withProfile) { lastProfile = Date.now(); lastLevel = game.player.level; }
    } catch (e) { dirty = true; console.warn('Cloud save failed, will retry:', e); }
  };
  const off = game.on('change', () => {
    dirty = true;
    try { localStorage.setItem(localKey, JSON.stringify(game.snapshot())); } catch { /* storage full/blocked */ }
    if (cloud && !timer) timer = setTimeout(flush, SYNC_DELAY);
  });
  const retry = setInterval(flush, 45000);
  const onHide = () => { if (document.hidden) flush(); };
  document.addEventListener('visibilitychange', onHide); addEventListener('pagehide', flush);
  return { flush, stop() { off(); clearInterval(retry); clearTimeout(timer); document.removeEventListener('visibilitychange', onHide); removeEventListener('pagehide', flush); } };
}

function teardown() { current?.saver.stop(); current?.view.destroy(); current = null; }

function showAuth() {
  teardown();
  mountAuth(root, {
    configured: isConfigured,
    onSignIn: (u, p) => fb.signIn(u, p),
    onSignUp: (u, p) => fb.signUp(u, p),
    onGuest: () => startGame({ guest: true }),
  });
}

async function startGame({ guest = false, user = null }) {
  teardown();
  root.innerHTML = '<div class="panel" style="text-align:center;margin-top:30vh"><h2>Loading your farm…</h2></div>';
  const uid = user?.uid, key = `pf2_save_${guest ? 'guest' : uid}`;
  const game = new Game();
  let cloudData = null;
  if (user) { try { cloudData = await fb.loadCloud(uid); } catch (e) { console.warn('Could not reach cloud save, using local copy:', e); } }
  // newest save wins (covers "played offline, then reconnected")
  const best = [readLocal(key), cloudData].filter((d) => d && (d.epoch || 0) >= SAVE_EPOCH).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))[0];
  if (best) game.load(best); else { game.refreshStock(); game.tick(); }

  const username = user ? fb.usernameOf(user) : '';
  const saver = createSaver(game, key, user && { push: (data, profile) => fb.saveCloud(uid, data, profile, username) });
  saver.flush(); game.changed();   // mark dirty so a brand-new account gets its first cloud save + leaderboard entry
  const view = mountGame(root, game, {
    username, canSync: !!user,
    cloud: user && { uid, leaderboard: () => fb.fetchLeaderboard() },
    onSignOut: async () => { await saver.flush(); saver.stop(); if (user) await fb.signOutUser(); else showAuth(); },
  });
  current = { saver, view };
}

function showError(e) {
  console.error(e);
  root.innerHTML = `<div class="panel" style="margin-top:12vh"><h2>Something went wrong</h2>
    <p style="font-weight:600;user-select:text">${String(e?.message || e).replace(/</g, '&lt;')}</p>
    <p style="margin-bottom:0">Press F12 and open <b>Console</b> for details. Common causes: a typo in <b>src/firebase-config.js</b>, or opening the page without a local server.</p></div>`;
}
addEventListener('unhandledrejection', (e) => showError(e.reason));

(async function boot() {
  try {
    await loadSprites();
    if (!isConfigured) return showAuth();
    fb = await import('./firebase.js');
    fb.initFirebase();
    fb.onUser((user) => (user ? startGame({ user }) : showAuth()));
  } catch (e) { showError(e); }
})();
