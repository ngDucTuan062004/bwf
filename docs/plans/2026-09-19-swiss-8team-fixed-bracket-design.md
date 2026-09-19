# Swiss 8-Team Fixed Bracket — Design (2026-09-19)

## Context

User không yên tâm về thuật toán ghép cặp động hiện tại (custom-stage.js `customPairNextRound`) — đã test một số kịch bản thấy không chính xác. Yêu cầu: vẽ **Swiss-system progression diagram** theo file `design/brakcket_8team.html`, người dùng **kéo thả tên VĐV vào ô seed**, đội tự chảy theo kết quả. Chỉ áp dụng cho nội dung 8 đội (doi-nam-nu-1); 6 đội giữ nguyên.

## Quyết định (đã brainstorm với user)

1. **Bracket seed cố định** — cấu trúc 14 trận cố định, không ghép cặp động.
2. **Kéo thả vào ô seed (1-8), tự chảy** theo kết quả (thắng nhánh trên, thua nhánh dưới).
3. **Chỉ 8 đội** (doi-nam-nu-1); 6 đội (doi-nam, doi-nam-nu-2) giữ Swiss 5 vòng hiện tại.
4. **Tất cả 14 trận đều BO3** (R1 không BO1, R7 không BO5).
5. **Bấm trận nhập séc, tự chảy**; bỏ nút ⚡ "Tự sinh vòng tiếp theo" cho nội dung 8 đội.

## Cấu trúc bracket cố định (14 trận, BO3)

| Vòng | Trận | Đội 1 | Đội 2 | Thua bị loại |
|------|------|-------|-------|--------------|
| R1 | 1.1 | Seed 1 | Seed 2 | — |
| R1 | 1.2 | Seed 3 | Seed 4 | — |
| R1 | 1.3 | Seed 5 | Seed 6 | — |
| R1 | 1.4 | Seed 7 | Seed 8 | — |
| R2 | 2.1 | W(1.1) | W(1.2) | — |
| R2 | 2.2 | W(1.3) | W(1.4) | — |
| R2 | 2.3 | L(1.1) | L(1.2) | Thua → Hạng 7-8 |
| R2 | 2.4 | L(1.3) | L(1.4) | Thua → Hạng 7-8 |
| R3 | 3.1 | L(2.1) | W(2.3) | Thua → Hạng 5-6 |
| R3 | 3.2 | L(2.2) | W(2.4) | Thua → Hạng 5-6 |
| R4 | 4.1 | W(3.1) | W(3.2) | Thua → Hạng 4 |
| R6 | 6.1 | W(2.1) | W(2.2) | Thua → xuống R5 |
| R5 | 5.1 | W(4.1) | L(6.1) | Thua → Hạng 3 |
| R7 | 7.1 | W(6.1) | W(5.1) | Thua → Hạng 2, Thắng → Hạng 1 |

**Kiểm chứng trace chuẩn** (seed 1,3,5,7 thắng R1): T1 Hạng 1 (4-0), T3 Hạng 2 (4-2), T5 Hạng 3 (2-2); loại T4/T8/T2/T6/T7 — khớp aaa.md.

## Engine (custom-stage.js)

- **Thay** `customCreateRound1` + `customPairNextRound` + `pairRoundrobin` bằng cấu trúc cố định:
  - `STRUCTURE`: 14 vị trí `{ id, round, feeds }` — feeds = nguồn đội từ trận trước (W/L).
  - `buildFixedBracket(participants, matches)`: resolve từng vị trí từ seed + kết quả trận trước; trả rounds + state.
- **Giữ**: `countSets`, `matchWinner`, `buildRecords`, `standingsSort`.
- **State**: records giữ nguyên; phase `complete` khi R7 có winner; eliminated theo vị trí bracket (R2 thua → 7-8, R3 thua → 5-6, R4 thua → 4, R5 thua → 3).
- **Bỏ vòng tròn ≤3 đội** (thay bằng R5/R6/R7 cố định).

## Data model

- **Seed order = `participants` array order** (participants[0] = Seed 1). Kéo thả đội vào ô seed N → đổi thứ tự participants. R1 = (0v1, 2v3, 4v5, 6v7).
- Mỗi match thêm field **`pos`** (VD `"R1.1"`, `"R2.3"`) định danh vị trí trong sơ đồ.
- Trận chưa đủ 2 đội → hiển thị ô "Chờ kết quả" mờ.
- Scoring note giữ nguyên: "Thắng 2/3 séc — séc 1 & 2 đến 21 điểm, séc 3 (nếu có) đến 15 điểm" (đã BO3).

## UI (renderCustomBracket redesign)

Bố cục theo `design/brakcket_8team.html`, 7 cột vòng đấu, cuộn ngang:
- **Legend**: mũi tên xanh = Thắng đi tiếp; đỏ đứt = Thua rơi nhánh dưới/bị loại; vàng = Chung kết. Quy chuẩn: ô trên = thắng, ô dưới = thua.
- **R1**: 4 thẻ trận, 2 ô Seed 1-8 mỗi thẻ (ô kéo thả khi edit mode).
- **R2**: 2 cụm — Nhánh Thắng (1-0) viền xanh, Nhánh Thua (0-1) viền đỏ; callout "ĐIỂM THOÁT HẠNG 7-8".
- **R3**: 2 trận sinh tử; callout "HẠNG 5-6".
- **R4**: 1 trận; callout "HẠNG 4".
- **R6 + R5**: R6 thắng → R7, thua → R5; R5 thắng → R7, thua → Huy chương Đồng.
- **R7**: Grand Final — Hạng 1 (Vô địch), Hạng 2 (Á quân).
- **SVG connectors** giữa cột: xanh (thắng), đỏ đứt (thua), vàng (chung kết).

**Theme** (light, theo app hiện tại — KHÔNG dùng dark Material 3 của design):
- Thẻ: `--panel` trắng, viền `--line`/`--line-strong`.
- Ô thắng: xanh nhạt + `--win`; ô thua/bị loại: `--danger`; nhánh thắng: `--court`; nhánh thua: `--danger`.
- Vô địch: `--gold` + `--gold-soft`; Hạng 2/3: xám nhạt.
- Font: Oswald (tiêu đề) + Inter (body).
- Badge "BO3" trên mọi trận.

## Tương tác

- **Edit mode**: pool 8 đội (từ participants) chip kéo được → kéo vào ô Seed 1-8; đổi seed = đổi thứ tự participants → R1 tự cập nhật.
- **Bấm thẻ trận** (đủ 2 đội) → nhập séc 21/15 như hiện tại → lưu → đội tự chảy + connectors cập nhật.
- **Bỏ nút ⚡** cho nội dung 8 đội.
- Trận chưa đủ đội → ô "Chờ kết quả" mờ.

## Non-Goals

- KHÔNG đổi 6 đội (doi-nam, doi-nam-nu-2) — giữ renderSwissBracket + swiss-core.js.
- KHÔNG đổi group contents (don-nam, don-nu-1, don-nu-2).
- KHÔNG đổi backend/auth/save-load.
- KHÔNG dùng dark theme của design file — chỉ lấy bố cục/cấu trúc, tô lại theo theme light app.