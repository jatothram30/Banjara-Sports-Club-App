# Banjara Sports Club — New App Foundation

Fresh React + TypeScript + Vite app connected to the existing Firebase project `banjara-sports-club`.

## Included in this first foundation
- Black & gold BSC responsive dashboard
- Google sign-in using Firebase Authentication
- Existing Firebase project configuration
- Public-facing module navigation placeholders
- No Firebase Storage usage (so no Blaze upgrade is needed for this foundation)

## Run locally
1. Install Node.js 20 or later.
2. Extract this ZIP.
3. Open a terminal in this folder.
4. Run:
   ```bash
   npm install
   npm run dev
   ```
5. Open the local URL printed by Vite.

## Important current status
This is **Milestone 1: app foundation**, not the finished cricket platform.
The feature cards are planned modules; they are not yet connected to Firestore.
Google sign-in requires the deployed domain to be enabled in Firebase Authentication > Settings > Authorized domains.
Firestore writes are intentionally not implemented until secure role-based rules are designed and tested.

## Existing Firebase
- Project ID: `banjara-sports-club`
- Auth: Firebase Authentication
- Database: Cloud Firestore
- Storage: not used yet; your current Spark plan is retained.

## Next milestones
1. Secure user profiles and role provisioning (BSC Super Admin, club/team admin, scorer, player, public viewer).
2. Club/team/player registration and squad management.
3. Ball-by-ball scoring engine and match scorecards.
4. Tournaments, standings, player statistics, achievements and live public score links.
5. Capacitor Android packaging and signed AAB for Google Play.

## Security note
Never put Firebase service-account JSON or Admin SDK credentials in this frontend repository. The Firebase Web API key is a public project identifier; security must be enforced with Firestore Rules and trusted backend functions.
