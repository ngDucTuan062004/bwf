# BWF Dynamic Site — Design Spec

## Goal
Convert the static BWF badminton tournament page into a dynamic web app:
- Split the single `index.html` into `index.html` + `styles.css` + `app.js`
- Add a Vercel serverless backend with Vercel KV (Redis) storage
- Admin authentication via password (env var `ADMIN_PASSWORD`)
- Editable data saved server-side (everyone sees changes immediately)
- Auto-generate round-robin matches for group-format events
- Better content management (add/edit/delete events, groups, players)
- Faster score entry
- Seed with real player data from `aaa.txt` (no matches yet)

## Architecture

```
bwf/
├── index.html        ← structure
├── styles.css        ← all CSS (extracted from <style>)
├── app.js            ← all logic (extracted from <script>, rewritten)
├── data.json         ← seed/fallback data
├── api/
│   ├── data.js       ← GET read · PUT write (admin only)
│   └── auth.js       ← POST verify admin password
├── vercel.json       ← Vercel config
└── README.md         ← setup + deploy instructions
```

## Backend (Vercel serverless + Vercel KV)

- **Storage:** Vercel KV (Redis), single key `bwf:data` holding the whole tournament JSON.
- **Auth:** `ADMIN_PASSWORD` env var. `POST /api/auth` returns `{ ok: true }` on match.
- **Endpoints:**
  - `GET /api/data` — public, returns current data; falls back to `data.json` seed when KV is empty.
  - `PUT /api/data` — requires `Authorization: Bearer <ADMIN_PASSWORD>`; validates body is an object; saves to KV.
  - `POST /api/auth` — body `{ password }`; returns `{ ok: true }` or 401.
- **Dependencies:** `@vercel/kv` (npm).

## Frontend

- Keep the existing green/gold visual design.
- Load data from `/api/data`; fallback to `data.json` if API unavailable.
- Edit mode: click "✏️ Chỉnh sửa" → password prompt → `POST /api/auth` → enter edit mode.
- In edit mode all mutations call `PUT /api/data` (debounced/after each action).
- **Auto-generate round-robin:** button per group → creates all pairwise matches for the group's players (stage `Vòng bảng — <bảng>`), skipping existing pairs.
- **Content management:** forms to add/rename/delete events, add/delete groups, add/delete players (replaces `prompt()`-based flow).
- **Score entry:** per-match 3-set inputs, auto-save on change, standings recompute instantly.
- No localStorage draft flow anymore.

## Data Model (unchanged shape)

```json
{
  "event": { "dateRange": "...", "location": "..." },
  "contents": [
    {
      "id": "...", "label": "...", "format": "group" | "swiss",
      "scoringNote": "...",
      "groups": [{ "name": "...", "players": [...] }],   // group format
      "participants": [...],                              // swiss format
      "matches": [{ "stage": "...", "p1": "...", "p2": "...", "sets": null, "date": "...", "time": "...", "court": "...", "referee": "..." }]
    }
  ]
}
```

## Seed Data (from aaa.txt + tournament rules)

| Event | Players/Pairs | Split |
|-------|--------------|-------|
| Đơn nam | 8 | Bảng A (4) + Bảng B (4) |
| Đơn nữ Nhóm 1 | 6 | Bảng A (3) + Bảng B (3) |
| Đơn nữ Nhóm 2 | 6 | Bảng A (3) + Bảng B (3) |
| Đôi nam | 6 pairs | Swiss |
| Đôi nam nữ Nhóm 1 | 8 pairs | Swiss |
| Đôi nam nữ Nhóm 2 | 6 pairs | Swiss |

- Event: 30/9 – 04/10/2026 · Sân cầu lông Đồng Đội
- No matches seeded (tournament not started).

## Scoring Rules (from Kế hoạch)

- Đơn nam & Đôi: best of 3 sets; sets 1–2 to 21, set 3 to 15.
- Đơn nữ: best of 3 sets; each set to 15.
- Group events: round-robin → Nhất/Nhì each bảng → semifinal (Nhất A vs Nhì B, Nhất B vs Nhì A) → final.
- Swiss events: Swiss stage → winner/loser brackets → final.

## Verification

- `npm install` (adds `@vercel/kv`)
- Local: `vercel dev` to test API + frontend
- Deploy: `vercel` (link project, create KV store, set `ADMIN_PASSWORD`)