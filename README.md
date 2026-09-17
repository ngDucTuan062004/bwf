# 🏸 BWF — Giải Cầu lông nội bộ (Badminton with Friends)

Trang web động theo dõi lịch thi đấu, bảng xếp hạng và kết quả giải cầu lông nội bộ Nhóm BWF.

## Tính năng

- **6 nội dung thi đấu**: Đơn nam, Đơn nữ (Nhóm 1 & 2), Đôi nam, Đôi nam nữ (Nhóm 1 & 2)
- **Bảng xếp hạng tự động**: tính từ kết quả (Thắng → Hiệu số séc → Hiệu số điểm)
- **Chế độ chỉnh sửa** (cần mật khẩu quản trị): thêm/xoá VĐV, thêm/xoá trận, nhập tỉ số
- **⚡ Tự sinh lịch vòng bảng**: mỗi cặp gặp nhau 1 lần (round-robin)
- **Quản lý nội dung**: thêm/sửa/xoá nội dung, bảng, VĐV bằng form
- **Lưu dữ liệu trên server** (Supabase Postgres — gói free) — mọi người cùng thấy thay đổi ngay

## Cấu trúc

```
├── index.html        # Cấu trúc trang
├── styles.css        # Toàn bộ CSS
├── app.js            # Toàn bộ logic frontend
├── data.json         # Dữ liệu mặc định (seed khi database chưa có dữ liệu)
├── api/
│   ├── data.js       # GET: đọc dữ liệu · PUT: lưu dữ liệu (cần mật khẩu)
│   └── auth.js       # POST: xác thực mật khẩu quản trị
├── supabase-setup.sql # SQL tạo bảng (chạy 1 lần trên Supabase)
├── vercel.json       # Cấu hình Vercel
└── package.json      # Dependency @supabase/supabase-js
```

## Chạy local

```bash
npm install
vercel dev
```

Mở `http://localhost:3000`. Khi chưa cấu hình Supabase, API trả dữ liệu từ `data.json` (chế độ đọc — chưa lưu được).

## Deploy lên Vercel

1. **Push code lên GitHub** rồi import vào Vercel (hoặc dùng CLI: `vercel`).

2. **Tạo Supabase project** (https://supabase.com — gói Free $0):
   - New project → đặt tên + mật khẩu database → tạo.
   - Mở **SQL Editor** → paste toàn bộ nội dung `supabase-setup.sql` → **Run** (tạo bảng `app_data`).

3. **Lấy thông tin kết nối** (Project Settings → **API**):
   - `Project URL` → chính là `SUPABASE_URL`
   - `service_role` key (⚠️ giữ bí mật, chỉ dùng server-side) → chính là `SUPABASE_SERVICE_ROLE_KEY`

4. **Đặt biến môi trường trên Vercel** (Project → Settings → Environment Variables):
   - `SUPABASE_URL` = Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role key
   - `ADMIN_PASSWORD` = mật khẩu quản trị bạn muốn (VD: `bwf2026`)
   - Redeploy để áp dụng.

5. **Mở trang** — dữ liệu ban đầu lấy từ `data.json`. Khi admin chỉnh sửa lần đầu, dữ liệu được lưu vào Supabase và từ đó mọi người đọc từ database.

## Cách sử dụng

1. Bấm **✏️ Chỉnh sửa** → nhập mật khẩu quản trị.
2. Thêm VĐV vào bảng → bấm **⚡ Tự sinh lịch thi đấu** để tạo lịch vòng bảng.
3. Nhập tỉ số từng séc → bảng xếp hạng tự cập nhật.
4. Bấm **✅ Xong** để thoát chế độ chỉnh sửa.

## Thể lệ (tóm tắt)

- **Đơn nam / Đơn nữ**: chia 2 bảng vòng tròn → Nhất/Nhì mỗi bảng vào bán kết → chung kết.
- **Đôi nam / Đôi nam nữ**: thể thức Swiss → chia nhánh Thắng/Thua → chung kết.
- **Cách tính điểm**: Đơn nam & Đôi: 3 séc, thắng 2; séc 1&2 đến 21, séc 3 đến 15. Đơn nữ: 3 séc, mỗi séc đến 15, thắng 2 séc.