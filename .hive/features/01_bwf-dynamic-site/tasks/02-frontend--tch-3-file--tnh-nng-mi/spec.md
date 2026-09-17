# Task: 02-frontend--tch-3-file--tnh-nng-mi

## Feature: bwf-dynamic-site

## Dependencies

- **1. Backend API — Vercel serverless + KV** (01-backend-api--vercel-serverless--kv)

## Plan Section

### 2. Frontend — tách 3 file + tính năng mới
- **Depends on**: 1
- **Files**:
  - Create `styles.css` (extract from `index.html` `<style>`, giữ nguyên design)
  - Create `app.js` (extract + rewrite logic)
  - Modify `index.html` (bỏ `<style>`/`<script>` inline, link `styles.css` + `app.js`)
- **What**:
  - Load data từ `/api/data`, fallback `data.json`.
  - Edit mode: bấm "✏️ Chỉnh sửa" → nhập mật khẩu → `POST /api/auth` → vào chế độ sửa.
  - Mọi thay đổi trong edit mode gọi `PUT /api/data` (lưu server).
  - Tự sinh trận vòng bảng: nút mỗi bảng → sinh round-robin (mỗi cặp gặp nhau 1 lần, stage `Vòng bảng — <bảng>`), bỏ qua cặp đã có.
  - Quản lý nội dung: form thêm/sửa/xoá nội dung, thêm/xoá bảng, thêm/xoá VĐV.
  - Nhập kết quả: 3 ô séc mỗi trận, auto-save, bảng xếp hạng cập nhật ngay.
  - Bỏ localStorage draft flow.
- **Must NOT**: thay đổi giao diện tổng thể; phá vỡ hiển thị standings/matches hiện có.
- **References**: `index.html` (hiện tại), `docs/superpowers/specs/2026-09-17-bwf-dynamic-site-design.md`
- **Verify**: Mở `index.html` trong browser, kiểm tra render + edit mode hoạt động (API fallback khi không có server).
