# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"flymony" is a Turkish-language **song request management app**. The UI has four tabs: İstekler (Requests), Şarkılar (Songs), Sanatçılar (Artists), Misafirler (Guests).

## Commands

Frontend (run inside `frontend/`):
- `npm install` — install dependencies
- `npm run dev` — Vite dev server
- `npm run build` — production build to `frontend/dist`
- `npm run preview` — preview the build
- `npm run lint` — ESLint

Backend (run inside `backend/`):
- `npm install` — install dependencies
- `npm start` — Express server on port 5000
- `node bulk_insert.js` — seed the `Artists` SQLite table from `frontend/public/sanatcilar.txt`

There is no test suite.

## Architecture — three coexisting data layers

The most important thing to understand: there are **three parallel implementations** that share the same API shape but are wired differently.

1. **`frontend/` (the live app)** — React 18 + Vite SPA. `src/api.js` talks **directly to Firebase Firestore** (`firebase/firestore`). It does **NOT** call the Express backend. Firebase config is in `src/firebaseConfig.js` (project `flymony2026`); `src/firebase.js` initializes it. Each tab is a component in `src/components/` that calls the `api` object.

2. **`backend/` (parallel/legacy REST API)** — Express + `better-sqlite3` (`server.js`, port 5000) exposing `/api/artists|songs|guests|requests` with an **identical contract** to `src/api.js`. The React app never fetches it. `server.js` also serves the built SPA from `frontend/dist` and serves the legacy vanilla app at `/vanilla`. `database.js` owns the SQLite schema and runs in-code migrations on startup.

3. **Root `app.js` / `index.html` / `style.css`** — standalone vanilla-JS version (also served at `/vanilla` by the backend). It loads data from Firestore directly (`DB.loadFromFirestore()` in `app.js`). **This is what GitHub Pages publishes:** `https://tolgaosman.github.io` is served from this repo's root, so the vanilla app — NOT the React SPA — is what end users (incl. mobile) actually hit in production. Changes to the React `frontend/` do not appear there.

When changing data behavior or UI, decide which layer matters:
- **Production / what users see today = root vanilla app** (`index.html` / `style.css` / `app.js`), deployed via GitHub Pages from the repo root.
- **`frontend/` React SPA** is the in-development app on the Firebase path (`src/api.js`); it is not what GitHub Pages serves.
- The SQLite backend is kept contract-compatible but is not what users hit.

UI/data changes meant for the live mobile site must be applied to the **root vanilla files**, not (only) the React frontend.

## Data model

- **Artists** — `ArtistID`, `ArtistName`
- **Songs** — `SongID`, `SongTitle`, `Duration`; many-to-many with Artists (SQLite `Song_Artists` join table / Firestore `ArtistIDs` array on the song doc)
- **Guests** — `GuestID`, `FirstName`, `LastName`, `FullName` (derived), contact/birthday fields, `Photos` (JSON array)
- **Requests** — one Song, many-to-many with Guests (SQLite `Request_Guests` join table / Firestore `GuestIDs` array), plus `Status`

Field names are **PascalCase across both layers** (`SongID`, `ArtistName`, `FullName`, …) specifically so the Firestore and SQLite implementations stay drop-in compatible. Preserve these names when adding fields.

## Conventions

- **All user-facing strings are Turkish** (error messages, labels, statuses).
- **Turkish-locale aware** sorting and casing everywhere: `localeCompare(..., 'tr')` and `toLocaleLowerCase('tr-TR')`.
- **Deduplication** uses `TRIM(LOWER(...))` (SQLite) / trimmed lowercase comparison; names are matched case-insensitively.
- **Request status** defaults to `'Kayıtlı'`.

## UI / Design system

The frontend uses a **sidebar-shell layout** (`.app-shell` = `.sidebar` + `.app-main`) defined in [App.jsx](frontend/src/App.jsx); nav items are buttons that flip `activeTab` (logic unchanged from the original top-nav). On ≤768px the sidebar collapses into a horizontal top bar and tables become stacked cards (via `data-label`).

All styling is centralized in one file, [frontend/src/index.css](frontend/src/index.css) — there are no per-component stylesheets or CSS modules. Components share semantic class names (`.section-header`, `.filters-panel`, `.table-wrapper`, `.modal-overlay`/`.modal-content`, `.btn`/`.btn-primary`/`.btn-outline`/`.btn-danger`, `.status-badge` + `.status-*`, guest `.guest-avatar-*`/`.gallery-*`), so visual changes are made centrally against those names. Keep these class names stable when restyling.

Design language: light-blue ("açık mavi") palette, clean soft cards (no glassmorphism), soft shadows. Theme tokens are CSS variables in `:root` (`--primary`, `--primary-soft`, `--canvas`, `--surface`, `--border`, `--shadow-*`, `--radius*`) — change colors there, not inline. Font is **Plus Jakarta Sans** (loaded in [index.html](frontend/index.html)). Nav icons are inline SVGs in `App.jsx` (no icon library).

For the **root vanilla app** (`index.html` / `style.css`), the mobile layout utilizes a hamburger button (`#menuToggle`) and a side drawer (`nav#navMenu`). When adjusting mobile media queries, ensure `.nav-btn` elements maintain appropriate flexbox properties (avoiding `flex: 1 1 100%` inside the column drawer) so they do not stretch vertically and overlap the toggle button.
