# Thiết kế: Swiss Stage cho nội dung đôi (chia nhánh Thắng/Thua)

Ngày: 2026-09-18
Feature: swiss-stage-chia-nhanh-thang-thua

## Quyết định đã chốt với user

| Câu hỏi | Quyết định |
|---------|-----------|
| Số vòng Swiss | **5 vòng cố định** (cả 6 đội lẫn 8 đội) |
| Sau vòng cuối | **Xếp hạng Swiss là kết quả cuối** — không đá thêm bán kết/chung kết |
| Nhóm thành tích lẻ | **Float** đội cuối nhóm xuống nhóm gần nhất; hết cách → bye |
| Nhập kết quả | **Cả hai**: nhập tỉ số séc (tự suy thắng) HOẶC chọn đội thắng nhanh |
| Nhánh Thắng/Thua | **NHÁNH THẮNG** = W > L, **NHÁNH THUA** = W < L, đội cân bằng (W = L) hiện giữa |
| Vòng 1 | Ghép **tuần tự theo thứ tự nhập**: 1v2, 3v4, 5v6 (BTC nhập đội theo thứ tự mong muốn) |

## Dữ liệu

- Giữ nguyên `participants` (danh sách đội/cặp) + `matches`.
- Mỗi trận: `{ stage: "Vòng 1"…"Vòng 5", p1, p2, sets, winner?, date, time, court, referee }`.
- **`winner`** (mới): tên đội thắng khi BTC chọn nhanh, không nhập séc.
- **Thành tích (W-L)** và **lịch sử đối thủ**: tính tự động từ matches — không lưu riêng.
- `computeStandings` cập nhật: nếu trận có `winner` → đếm thắng/thua (không có hiệu số séc/điểm).

## Thuật toán ghép cặp (`swiss-core.js` — hàm thuần)

### Vòng 1
- Ghép tuần tự: `participants[0] vs [1]`, `[2] vs [3]`, ... Nếu lẻ → đội cuối bye.

### Vòng 2–5
1. Tính W-L từ các trận đã có kết quả.
2. Gom nhóm theo thành tích (VD: `1-0`, `0-1`, `1-1`...), nhóm sắp theo record giảm dần.
3. Trong nhóm: sắp theo thứ hạng (Thắng → Hiệu số séc → Hiệu số điểm), ghép cặp **tránh trùng đối thủ đã gặp**.
4. Nhóm lẻ: đội cuối (thứ hạng thấp nhất) **float xuống nhóm kế tiếp** (record thấp hơn).
5. Nếu float tới cuối vẫn không ghép được (đã gặp hết) → **bye** (nghỉ vòng, record giữ nguyên).
6. Tối đa 5 vòng — bấm ⚡ ở vòng 6 → báo "Đã đủ 5 vòng".

### Hàm chính
```
swissPairRound(participants, matches, roundNum) → { pairs: [[a,b],...], bye: [name,...] }
swissRecordOf(matches, name) → { w, l }        // tính từ các trận có kết quả
swissGroupByRecord(participants, matches) → [{ record, teams }]
```

## Giao diện

### Bảng xếp hạng (thay cho bảng cũ)
- Cột: Thứ hạng, Đội, **Thành tích (W-L)** nổi bật, Trận, Thắng, Thua, Séc, Điểm.
- Bấm vào tên đội → **modal lịch sử đối đầu**: danh sách trận (vòng, đối thủ, tỉ số, thắng/thua).

### Hai nhánh
- **NHÁNH THẮNG** (W > L) — nền xanh lá.
- **NHÁNH THUA** (W < L) — nền cam/đỏ nhạt.
- **CÂN BẰNG** (W = L) — hiện giữa, nền trung tính.
- Mỗi nhánh là 1 thẻ liệt kê đội + record.

### Sơ đồ 5 vòng
- Cột Vòng 1 → Vòng 5 (giữ khung 5 vòng sẵn có).
- **Match Card** hiển thị:
  - Tên 2 đội + tỉ số từng séc (VD: `21–15, 18–21, 15–10`)
  - Tổng séc thắng (VD: `2–1`)
  - Đội thắng ✓ (highlight)
  - **Thành tích mới mỗi đội** (VD: `1-0` / `0-1`) — tính sau trận
- Trận chưa đấu: hiện record hiện tại của 2 đội.

### Nhập kết quả (edit mode)
- Ô nhập séc 1–3 (như hiện tại) → tự suy thắng.
- **Nút chọn thắng nhanh**: bấm vào tên đội → set `winner`, xoá `sets`.
- Nút "Xoá kết quả" để sửa lại.

## Kiến trúc

- **`swiss-core.js`** (mới): hàm thuần, không DOM — dùng chung browser + Node (script tag + module export).
- **`app.js`**: gọi swiss-core, render UI (bảng xếp hạng, nhánh, sơ đồ, modal lịch sử).
- **`test-swiss.js`** (mới): test thuật toán — 6 đội, 8 đội, nhóm lẻ float, tránh trùng cặp, đủ 5 vòng, bye.
- **`styles.css`**: style nhánh Thắng/Thua, Match Card nâng cấp, record badge, modal lịch sử.

## Non-Goals

- KHÔNG có bán kết/chung kết sau Swiss (đã chốt: xếp hạng là kết quả cuối).
- KHÔNG tự động bốc thăm ngẫu nhiên — BTC nhập thứ tự đội, Vòng 1 ghép tuần tự.
- KHÔNG đổi backend/Supabase — chỉ frontend + swiss-core + test.
- KHÔNG đụng nội dung đơn (group) — module riêng.

## Ghost Diffs (đã cân nhắc, không chọn)

- **Bye tính thắng** (record +1): user chọn float, bye chỉ nghỉ vòng.
- **Sơ đồ nhánh Thắng/Thua kiểu knockout**: user chọn khung 5 vòng + xếp hạng cuối.
- **Lưu record riêng vào data**: dễ lệch dữ liệu — chọn tính tự động từ matches.
- **Sinh Vòng 1 tự động khi đủ đội**: dễ ghi đè dữ liệu bất ngờ — chọn bấm nút ⚡.