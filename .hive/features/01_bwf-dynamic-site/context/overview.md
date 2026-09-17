## At a Glance

Chuyển trang tĩnh BWF (badminton tournament) thành web động:
- Tách `index.html` → `index.html` + `styles.css` + `app.js`
- Backend Vercel serverless (`api/data.js`, `api/auth.js`) + **Upstash Redis** (thay Vercel KV đã sunset)
- Admin auth bằng mật khẩu (`ADMIN_PASSWORD`)
- Tính năng mới: tự sinh trận vòng bảng, quản lý nội dung bằng form, nhập kết quả nhanh
- Seed dữ liệu VĐV từ `aaa.txt` (chưa có trận đấu)

## Workstreams

1. **Backend API** — api/data.js (GET/PUT), api/auth.js (POST), vercel.json, package.json
2. **Frontend** — tách 3 file + tính năng mới (login admin, auto round-robin, content management, score entry)
3. **Seed data** — data.json từ aaa.txt (6 nội dung, ~40 VĐV/cặp)
4. **Docs + verify** — README hướng dẫn deploy, kiểm tra toàn bộ

## Revision History

- 2026-09-17: Tạo feature, plan 4 tasks. User đã duyệt thiết kế (backend+KV, admin password, giữ cấu trúc cũ, seed từ aaa.txt). User yêu cầu triển khai code trước, feedback sau.
- 2026-09-17: **Phát hiện Vercel KV đã sunset (12/2024)** — user không tìm thấy KV trên dashboard. Đã chuyển từ `@vercel/kv` sang `@upstash/redis` (Redis.fromEnv, env UPSTASH_REDIS_REST_URL/TOKEN). README cập nhật hướng dẫn tạo Upstash Redis qua Vercel Marketplace.