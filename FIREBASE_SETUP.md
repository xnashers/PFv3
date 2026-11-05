# Connecting Pocket Farm to Firebase (step by step)

Takes about 10 minutes. Everything below is on the free **Spark** plan.

## 1. Create the project
1. Go to <https://console.firebase.google.com> and sign in with Google.
2. **Add project** → name it (e.g. `pocketfarm`) → turn Google Analytics **off** → **Create project**.

## 2. Register the web app and copy the config
1. On the project home, click the **`</>` Web** icon → nickname `pocketfarm-web` → **Register app** (skip Hosting for now).
2. Firebase shows a `firebaseConfig = { ... }` object. Copy the values into **`src/firebase-config.js`**.
   These values only identify your project; they are not secret. Your security rules protect the data.

## 3. Turn on login
1. **Build → Authentication → Get started**.
2. **Sign-in method → Email/Password → Enable** (leave "Email link" off) → **Save**.

> Players log in with a *username*. The game quietly turns `sam` into `sam@pocketfarm.game` for Firebase.
> Trade-off: there is no "forgot password" email. If you want real emails, change `toEmail()` in `src/firebase.js`
> and add an email field on the login screen, then use `sendPasswordResetEmail`.

## 4. Create the database
1. **Build → Firestore Database → Create database**.
2. Location: pick one close to your players (e.g. `asia-southeast1` Singapore for the Philippines). It can't be changed later.
3. Choose **Production mode** → **Create**.

## 5. Publish the security rules (important)
1. Firestore → **Rules** tab → delete everything → paste the contents of **`firestore.rules`** → **Publish**.
2. What they do:
   - `saves/{uid}`: only that player can read or write their own save.
   - `players/{uid}`: any logged-in player can read (for the leaderboard); only the owner can write their own entry, with validated fields.

Without this step you'll see `permission-denied` in the browser console.

## 6. Run it locally
ES modules don't work from `file://`, so serve the folder:
```bash
cd pocketfarm-v2
python3 -m http.server 8080      # then open http://localhost:8080
```
`localhost` is already an authorized domain. Create an account, plant something, wait ~15 s, then check
**Firestore → Data**: you should see `saves/<uid>` and `players/<uid>`.

## 7. Put it online
**Option A: Firebase Hosting (easiest, same project)**
```bash
npm i -g firebase-tools
firebase login
firebase use --add            # pick your project
firebase deploy               # deploys hosting + rules (config is in firebase.json)
```
**Option B: Vercel / Netlify / GitHub Pages**: upload the folder as a static site (no build step).
Then add the domain in **Authentication → Settings → Authorized domains**, otherwise login fails with `auth/unauthorized-domain`.

## How the data is stored
| Path | Who can read | Contents |
|---|---|---|
| `saves/{uid}` | owner only | `{ data: <whole game save>, updatedAt }` |
| `players/{uid}` | any logged-in player | `{ username, farmName, level, xp, peso, score, updatedAt }` for the leaderboard |

- The game saves to `localStorage` instantly and to Firestore at most once every 15 s (and when the tab is hidden/closed).
- Firestore offline cache is on: if the connection drops, saves queue up and sync later. On login the **newest** of local vs cloud wins.
- Free tier: 20,000 writes/day and 50,000 reads/day. One save = 1-2 writes, so one player-hour of constant play is roughly 240-480 writes.

## Known limits / next steps
- **Client-authoritative:** the game logic runs in the browser, so a determined player can edit their own save or leaderboard score with dev tools.
  Fine for a friendly game. To harden it: enable **App Check**, and move `sell` / `harvest` to **Cloud Functions** (requires the Blaze plan, which still has a free allowance).
- Old Supabase saves can be imported: the field names (`player`, `plots`, `seeds`, `inventory`) were kept compatible; ask if you want an import button.

## Troubleshooting
| Message | Fix |
|---|---|
| `auth/operation-not-allowed` | Enable Email/Password (step 3) |
| `permission-denied` | Publish the rules (step 5) |
| `auth/unauthorized-domain` | Add your domain under Authorized domains (step 7) |
| Blank page | Open via `http://`, not by double-clicking `index.html` |
| Leaderboard empty | Players appear after their first save (about 15 s after login) |

## Wiping all progress (fresh start for everyone)
**Quick way:** in `src/game.js` raise `SAVE_EPOCH` (e.g. `1` → `2`) and redeploy. Every player's old save (local and cloud) is ignored on next login and they start a new farm; their cloud save is overwritten on their first sync.
**Tidy the database too:** Firestore → Data → `players` → ⋮ → *Delete collection* (clears old leaderboard entries of players who never return), and the same for `saves`.
**Remove accounts as well (optional):** Authentication → Users → select all → Delete. Players would then have to sign up again.

## v2.2: World Chat + new leaderboards (re-publish rules!)
1. **Publish the new `firestore.rules`** (Firestore → Rules). They add the `chat` collection and extra leaderboard fields. Without this, chat shows "Couldn't send" and the new boards stay empty.
2. **Auto-delete old chat (recommended):** Firestore → **TTL** → *Create policy* → collection group `chat`, field `expireAt`. Messages then vanish ~3 days after posting, which keeps storage and reads small.
3. Leaderboard boards (Level, Season, Mutations, Richest, Best sale) each sort on one field, so Firestore creates the indexes automatically. No composite index needed.
4. **Cost note:** chat uses a live listener only while a player has *Ranks → World Chat* open. Each new message is 1 read per viewer; 50 messages load on open. Fine for the free tier at small scale; watch the 50k reads/day limit if chat gets busy.
5. **Moderation limits:** the client masks a few bad words and limits sending to 1 message / 3 s, but a determined user can bypass client code. For real moderation use App Check + a Cloud Function (rate limit, filter) and delete abusive messages from the Firestore console.
6. **Seasons** are calendar months. At rollover each player's season stats reset and they get 10 tokens for taking part. Rank-based prizes (top 10 etc.) need a server/Cloud Function because the game is client-authoritative.
