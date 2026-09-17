# Task: 03-seed-data--datajson-t-aaatxt

## Feature: bwf-dynamic-site

## Dependencies

- **2. Frontend — tách 3 file + tính năng mới** (02-frontend--tch-3-file--tnh-nng-mi)

## Plan Section

### 3. Seed data — data.json từ aaa.txt
- **Depends on**: none
- **Files**:
  - Modify `data.json`
- **What**: Thay dữ liệu cũ bằng dữ liệu VĐV từ `aaa.txt`:
  - Đơn nam (8): Bảng A (Phan Văn Thịnh, Lâm Vĩ Phát, Trịnh Hoàng Trí, Nguyễn Hoàng Hải Đăng), Bảng B (Trần Hoàng Trung, Nguyễn Cao Kế, Nguyễn Minh Trường, Đỗ Thành Chung)
  - Đơn nữ Nhóm 1 (6): Bảng A (Bùi Tuệ San, Huỳnh Thị Thoại My, Trần Minh Thư), Bảng B (Lý Thanh Trúc, Nguyễn Thụy Thảo Vy, Trần Thu Trang)
  - Đơn nữ Nhóm 2 (6): Bảng A (Nguyễn Ngọc Hạnh, Phan Huỳnh Thanh Ngọc, Nguyễn Ngọc Yến Nhi), Bảng B (Mai Nguyễn Gia Nhi, Huỳnh Trần Khánh Băng, Lê Thị Hồng Phượng)
  - Đôi nam (6 cặp, Swiss): Trần Thái An - Nguyễn Cao Kế, Nguyễn Minh Trường - Nguyễn Đức Tuấn, Đỗ Thành Chung - Nguyễn Đình Triết, Nguyễn Trí Việt - Nguyễn Xuân Hoàng Khôi, Đỗ Anh Quân - Phan Văn Thịnh, Trịnh Hoàng Trí - Nguyễn Hoàng Hải Đăng
  - Đôi nam nữ Nhóm 1 (8 cặp, Swiss): (8 cặp từ aaa.txt)
  - Đôi nam nữ Nhóm 2 (6 cặp, Swiss): (6 cặp từ aaa.txt)
  - Event: dateRange "30/9 – 04/10/2026", location "Sân cầu lông Đồng Đội"
  - `matches: []` cho tất cả nội dung (giải chưa diễn ra)
  - scoringNote theo thể lệ (Đơn nam/Đôi: 2/3 séc, 21-21-15; Đơn nữ: 2/3 séc, 15 mỗi séc)
- **Must NOT**: thêm trận đấu giả; đổi id/label không khớp với aaa.txt.
- **Verify**: `Get-Content data.json | ConvertFrom-Json` parse thành công; đếm số VĐV khớp aaa.txt (8+6+6+12+16+12 = 60 người/cặp).
