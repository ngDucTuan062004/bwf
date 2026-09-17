# 🏸 BWF — Giải Cầu lông nội bộ (Badminton with Friends)

Trang web động theo dõi lịch thi đấu, bảng xếp hạng và kết quả giải cầu lông nội bộ Nhóm BWF.

## Tính năng

- **6 nội dung thi đấu**: Đơn nam, Đơn nữ (Nhóm 1 & 2), Đôi nam, Đôi nam nữ (Nhóm 1 & 2)
- **Bảng xếp hạng tự động**: tính từ kết quả (Thắng → Hiệu số séc → Hiệu số điểm)
- **Chế độ chỉnh sửa** (cần mật khẩu quản trị): thêm/xoá VĐV, thêm/xoá trận, nhập tỉ số
- **⚡ Tự sinh lịch vòng bảng**: mỗi cặp gặp nhau 1 lần (round-robin)
- **Quản lý nội dung**: thêm/sửa/xoá nội dung, bảng, VĐV bằng form
- **Lưu dữ liệu trên server** (Upstash Redis qua Vercel Marketplace) — mọi người cùng thấy thay đổi ngay

## Cấu trúc

```
├── index.html        # Cấu trúc trang
├── styles.css        # Toàn bộ CSS
├── app.js            # Toàn bộ logic frontend
├── data.json         # Dữ liệu mặc định (seed khi KV chưa có dữ liệu)
├── api/
│   ├── data.js       # GET: đọc dữ liệu · PUT: lưu dữ liệu (cần mật khẩu)
│   └── auth.js       # POST: xác thực mật khẩu quản trị
├── vercel.json       # Cấu hình Vercel
└── package.json      # Dependency @upstash/redis
```

## Chạy local

```bash
npm install
vercel dev
```

Mở `http://localhost:3000`. Khi chưa cấu hình Redis, API trả dữ liệu từ `data.json` (chế độ đọc — chưa lưu được).

## Deploy lên Vercel

1. **Push code lên GitHub** rồi import vào Vercel (hoặc dùng CLI: `vercel`).

2. **Tạo Upstash Redis** (Vercel Dashboard → Storage → Create Database → **Upstash Redis**):
   - Kết nối database với project. Vercel tự thêm các biến môi trường `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (và `UPSTASH_REDIS_REST_READ_ONLY_TOKEN`).
   - > Lưu ý: Vercel KV cũ đã bị ngừng (sunset 12/2024). Dùng **Upstash Redis** từ Vercel Marketplace — đây là dịch vụ thay thế chính thức.

3. **Đặt mật khẩu quản trị**:
   - Vercel Dashboard → Project → Settings → Environment Variables
   - Thêm biến `ADMIN_PASSWORD` với giá trị mật khẩu bạn muốn (VD: `bwf2026`)
   - Redeploy để áp dụng.

4. **Mở trang** — dữ liệu ban đầu lấy từ `data.json`. Khi admin chỉnh sửa lần đầu, dữ liệu được lưu vào Redis và từ đó mọi người đọc từ Redis.

## Cách sử dụng

1. Bấm **✏️ Chỉnh sửa** → nhập mật khẩu quản trị.
2. Thêm VĐV vào bảng → bấm **⚡ Tự sinh lịch thi đấu** để tạo lịch vòng bảng.
3. Nhập tỉ số từng séc → bảng xếp hạng tự cập nhật.
4. Bấm **✅ Xong** để thoát chế độ chỉnh sửa.

## Thể lệ (tóm tắt)

- **Đơn nam / Đơn nữ**: chia 2 bảng vòng tròn → Nhất/Nhì mỗi bảng vào bán kết → chung kết.
- **Đôi nam / Đôi nam nữ**: thể thức Swiss → chia nhánh Thắng/Thua → chung kết.
- **Cách tính điểm**: Đơn nam & Đôi: 3 séc, thắng 2; séc 1&2 đến 21, séc 3 đến 15. Đơn nữ: 3 séc, mỗi séc đến 15, thắng 2 séc.