# Task: 04-readme--packagejson--verification

## Feature: bwf-dynamic-site

## Dependencies

- **3. Seed data — data.json từ aaa.txt** (03-seed-data--datajson-t-aaatxt)

## Plan Section

### 4. README + package.json + verification
- **Depends on**: 2, 3
- **Files**:
  - Modify `README.md`
  - Create `package.json` (nếu chưa có ở task 1)
- **What**:
  - README: hướng dẫn chạy local (`vercel dev`), deploy lên Vercel, tạo KV store, set `ADMIN_PASSWORD`.
  - Kiểm tra toàn bộ: syntax check JS, JSON hợp lệ, không còn inline `<style>`/`<script>` trong index.html.
- **Must NOT**: thêm dependency không cần thiết.
- **Verify**: `node --check app.js` pass; `Get-Content data.json | ConvertFrom-Json` pass; grep index.html không còn `<style>`/`<script>` inline.
