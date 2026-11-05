// Firebase layer: Auth (username + password) and Firestore (private save + public leaderboard profile).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, writeBatch, collection, query, orderBy, limit, getDocs, serverTimestamp, addDoc, onSnapshot, Timestamp,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseConfig, isConfigured } from './firebase-config.js';

let auth = null, db = null;

// Players log in with a username. Firebase Auth needs an email, so we map username -> a fake email.
// (Trade-off: no "forgot password" emails. See FIREBASE_SETUP.md if you'd rather use real emails.)
const toEmail = (u) => `${u.trim().toLowerCase()}@pocketfarm.game`;
export const validUsername = (u) => /^[a-zA-Z0-9_]{3,20}$/.test(u);

export function initFirebase() {
  if (!isConfigured) return false;
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  // Offline cache: writes made offline are queued and synced when the connection returns.
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  return true;
}

export function onUser(cb) { return onAuthStateChanged(auth, cb); }
export const currentUser = () => auth?.currentUser || null;

const ERRORS = {
  'auth/email-already-in-use': 'That username is taken.',
  'auth/invalid-credential': 'Wrong username or password.',
  'auth/user-not-found': 'Wrong username or password.',
  'auth/wrong-password': 'Wrong username or password.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/too-many-requests': 'Too many tries. Wait a moment and try again.',
  'auth/network-request-failed': 'No connection. Check your internet.',
  'auth/operation-not-allowed': 'Email/Password sign-in is not enabled in Firebase (see setup guide).',
};
const fail = (e) => ({ ok: false, error: ERRORS[e.code] || e.message });

export async function signUp(username, password) {
  if (!validUsername(username)) return { ok: false, error: 'Username: 3-20 letters, numbers or _' };
  try { const c = await createUserWithEmailAndPassword(auth, toEmail(username), password); return { ok: true, user: c.user }; }
  catch (e) { return fail(e); }
}
export async function signIn(username, password) {
  try { const c = await signInWithEmailAndPassword(auth, toEmail(username), password); return { ok: true, user: c.user }; }
  catch (e) { return fail(e); }
}
export const signOutUser = () => signOut(auth);
export const usernameOf = (user) => (user?.email || '').split('@')[0];

// ---- Firestore ----
// saves/{uid}   -> private full game save   (only the owner can read/write)
// players/{uid} -> public profile for leaderboard (any signed-in user can read)
export async function loadCloud(uid) {
  const snap = await getDoc(doc(db, 'saves', uid));
  return snap.exists() ? snap.data().data : null;
}

// profile may be null: then only the private save is written (saves 1 write per sync).
export async function saveCloud(uid, data, profile, username) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'saves', uid), { data, updatedAt: serverTimestamp() });
  if (profile) batch.set(doc(db, 'players', uid), { username, ...profile, updatedAt: serverTimestamp() });
  await batch.commit();
}

// Boards: level (default), season (this month's earnings), mutations, peso (richest farm), bestSale (highest single crop sale).
const BOARD_FIELD = { level: 'score', season: 'seasonEarned', mutations: 'mutations', peso: 'peso', bestSale: 'bestSale' };
export async function fetchLeaderboard(type = 'level', seasonId = '', n = 20) {
  const field = BOARD_FIELD[type] || 'score';
  const q = query(collection(db, 'players'), orderBy(field, 'desc'), limit(type === 'season' ? 60 : n));   // single-field order = no composite index needed
  const snap = await getDocs(q);
  let rows = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  if (type === 'season') rows = rows.filter((r) => r.seasonId === seasonId && (r.seasonEarned || 0) > 0);   // ignore last month's stale entries
  return rows.slice(0, n).map((r, i) => ({ ...r, rank: i + 1, value: r[field] || 0 }));
}

// ---- World chat: chat/{id} = { uid, username, text, level, createdAt, expireAt } ----
// Messages auto-delete after CHAT_TTL_DAYS if you add a TTL policy on `expireAt` (see FIREBASE_SETUP.md).
const CHAT_TTL_DAYS = 3;
export function subscribeChat(cb, n = 50) {
  const q = query(collection(db, 'chat'), orderBy('createdAt', 'desc'), limit(n));
  return onSnapshot(q,
    (snap) => cb(snap.docs.map((d) => { const x = d.data({ serverTimestamps: 'estimate' }); return { id: d.id, ...x, at: x.createdAt?.toMillis?.() || Date.now() }; }).reverse()),
    (err) => cb(null, err));
}
export async function sendChat(uid, username, text, level) {
  try {
    await addDoc(collection(db, 'chat'), { uid, username, text, level, createdAt: serverTimestamp(), expireAt: Timestamp.fromMillis(Date.now() + CHAT_TTL_DAYS * 864e5) });
    return { ok: true };
  } catch (e) { return { ok: false, error: e.code === 'permission-denied' ? "Couldn't send. Publish the updated firestore.rules." : e.message }; }
}
