# Thiết kế: Bảng kéo-thả đánh số cặp đôi (Swiss)

Ngày: 2026-09-18 · Feature: `swiss-doubles-pair-order`

## Vấn đề

Nội dung đôi (format `swiss`) có `content.participants` là mảng tên cặp (VD: `"Trần Thái An - Nguyễn Cao Kế"`). Thứ tự mảng quyết định ghép Vòng 1 (1v2, 3v4, 5v6). Hiện tại:
- Cặp được nhập từng cái bằng ô text → thêm thẳng vào `participants`
- **Không có cách sắp xếp lại thứ tự** sau khi nhập → khó đánh số cặp

## Giải pháp

Thêm bảng kéo-thả đánh số cặp, tương tự nội dung đơn (group): pool chip kéo được + bảng ô số dropzone.

## Quyết định đã chốt (brainstorming với user)

| Câu hỏi | Quyết định |
|---------|-----------|
| Kiểu kéo-thả | **Pool + ô số** (giống đơn nhất): pool cặp chưa xếp + bảng ô số Cặp 1, Cặp 2... |
| Thời điểm cho phép | **Chỉ khi chưa có trận nào** (trước khi sinh Vòng 1) |
| Kéo đổi chỗ giữa các ô | **Không** — chỉ kéo từ pool vào ô; ô đã điền có nút ↩ đưa về pool |
| Hiển thị số thứ tự | **Có** — bảng xếp hạng + sơ đồ thi đấu hiện số (VD: `1. Trần Thái An - Nguyễn Cao Kế`) |

## Kiến trúc

### Dữ liệu
- `content.participants` — giữ nguyên, là mảng có thứ tự (ô số 1..N), nguồn quyết định ghép cặp
- `content.unassignedPairs` — **mảng mới**: các cặp chưa xếp vào ô (pool). Code phải xử lý data cũ thiếu field (mặc định `[]`)

### UI — chế độ chỉnh sửa, khi CHƯA có trận (nhánh swiss của `renderStandingsSection`)
1. **Pool**: chip kéo được cho từng cặp trong `unassignedPairs` (giống `pool-chips` của đơn), mỗi chip có nút × xoá hẳn
2. **Bảng ô số**: mỗi dòng là dropzone — `Cặp 1`, `Cặp 2`, ... tương ứng `participants[i]`. Kéo chip từ pool vào ô:
   - Ô trống → cặp vào vị trí đó (`splice`)
   - Ô đã có cặp → cặp cũ trả về pool, cặp mới vào vị trí
   - Dòng cuối có ô trống `+ Cặp N+1` → thêm vào cuối (`push`)
   - Mỗi ô đã điền có nút ↩ đưa cặp về pool
3. Ô nhập "Tên cặp đấu mới" → thêm vào **pool** (không vào thẳng participants)
4. Nút "⚡ Tự sinh vòng tiếp theo" giữ nguyên

### Khi ĐÃ có trận
- Ẩn bảng kéo-thả + pool (không cho đổi thứ tự nữa)
- Bảng xếp hạng: tên cặp có số thứ tự (prefix `N. `)
- Sơ đồ thi đấu: tên cặp trong match card có số thứ tự

## Phạm vi
- `app.js` — nhánh swiss `renderStandingsSection` (thêm pool + bảng ô số), `buildStandingsTable` (prefix số cho swiss), `renderSwissBracket` (prefix số)
- `styles.css` — style pool cặp + bảng ô số (thêm cuối file)
- KHÔNG đụng `swiss-core.js`, KHÔNG đổi backend/Supabase

## Verify
- `node --check app.js` — sạch
- `node test-swiss.js` — 12 nhóm test vẫn PASS (core không đổi)
- Test tay trên browser: thêm cặp vào pool → kéo vào ô số → sinh Vòng 1 → xác nhận thứ tự ghép 1v2, 3v4, 5v6