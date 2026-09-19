# 🏃 Kimbia TZ — League of Tanzanian Running Clubs

A free, web-first league platform for Tanzanian running clubs. Clubs compete for **Club of the Month**, members track runs, and everything runs on Firebase's free tier — no payment API, no server costs.

**Live app:** https://newproject-fa93d.web.app

## Features

- **Club directory** — browse and search running clubs across Tanzania, see meeting points, schedules, and vibe tags
- **Join & manage** — runners request to join; club admins approve, promote, or remove members
- **GPS run tracking** — in-browser tracker with haversine distance, pace, and pause/resume; GPS runs count toward league scoring
- **Manual run logging** — personal stats for non-GPS runs
- **Events** — free events confirm instantly; paid events use a manual mobile-money flow (club shows its pay-to number, runner submits phone + transaction reference, club admin confirms — enforced by security rules, not UI trust)
- **League standings** — monthly scoring with podium; platform admin publishes standings with one click
- **Club admin console** — announcements, member approvals, event creation, payment confirmations
- **Platform console** — Pro subscription approvals, league rollup, demo seeding (admin-only)
- **Google Timeline import** — backfill running history, processed 100% in-browser
- **Recap Studio export** — turn GPS runs into a Timeline.json for video visualizers

## Tech Stack

- **Frontend:** vanilla JS ES modules, hash routing, no build step (`public/`)
- **Backend:** Firebase — Auth (email/password), Firestore, Hosting
- **Cloud Functions** (`functions/`, TypeScript): optional — auto-deploys require the Blaze plan; the app runs fully without them via client-side aggregation
- **Security:** Firestore rules enforce role-based access; runners can never confirm their own payments

## Scoring (Club of the Month)

| Component | Weight | What it measures |
|---|---|---|
| Avg km per active runner | 35 | Quality — capped at 60 km |
| Attendance | 30 | Share of members running vs 40% target |
| Total club km | 20 | Volume vs 500 km target |
| Engagement | 15 | Run consistency |

Weights are configurable in Firestore at `config/scoring`.

## Project Structure

```
├── firebase.json / firestore.rules / firestore.indexes.json / storage.rules
├── functions/src/        # scoring.ts · triggers.ts · league.ts · claims.ts
├── functions/scripts/    # admin tools (setAdmin, seed, admin-ops)
└── public/
    ├── index.html / styles.css
    └── js/
        ├── app.js · ui.js · stats.js · timeline.js · firebase-init.js
        └── views/        # login, home, clubs, events, track, admin, platform, ...
```

## Setup

1. Create a Firebase project → enable **Authentication (Email/Password)** and **Firestore**
2. Register a web app and paste its config into `public/js/firebase-init.js`
3. Deploy:

```bash
npm i -g firebase-tools
firebase login
firebase deploy --project <your-project-id>   # rules, indexes, hosting
```

4. Works on the free Spark plan. Cloud Functions (`functions/`) are optional and deploy only on Blaze.

## Honest Notes

| Area | Status |
|---|---|
| Auth, directory, GPS tracking, events, manual payments, consoles | ✅ Free-tier ready |
| Manual payments | ✅ Trust-based with full audit trail (txRef, confirmedBy, timestamps) |
| Club logo uploads | ⚠️ Requires Blaze (Firebase policy for new projects) — app degrades gracefully |
| SMS phone login | ⚠️ Code included, dormant — requires Blaze |
| Push notifications, Strava OAuth | Deferred |

---

Made for Tanzanian runners 🇹🇿
