# Task: 01-backend-api--vercel-serverless--kv

## Feature: bwf-dynamic-site

## Dependencies

_None_

## Plan Section

### 1. Backend API — Vercel serverless + KV
- **Depends on**: none
- **Files**:
  - Create `api/data.js`
  - Create `api/auth.js`
  - Create `vercel.json`
  - Create `package.json` (dependency `@vercel/kv`)
- **What**: 
  - `api/data.js`: `GET` → read `bwf:data` from KV, fallback to seed `data.json`; `PUT` → verify `Authorization: Bearer <ADMIN_PASSWORD>`, validate body object, save to KV.
  - `api/auth.js`: `POST` with `{ password }` → compare `process.env.ADMIN_PASSWORD`, return `{ ok: true }` or 401.
  - `vercel.json`: minimal config (clean URLs, api routes).
  - `package.json`: `"type": "module"`, dependency `@vercel/kv`.
- **Must NOT**: expose password in responses; allow unauthenticated writes.
- **References**: `docs/superpowers/specs/2026-09-17-bwf-dynamic-site-design.md`
- **Verify**: `node --check api/data.js` and `node --check api/auth.js` pass (syntax).
