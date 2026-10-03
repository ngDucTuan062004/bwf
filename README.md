# 🏸 BWF — Giải Cầu lông nội bộ (Badminton with Friends)

Trang web động theo dõi lịch thi đấu, bảng xếp hạng và kết quả giải cầu lông nội bộ Nhóm BWF.

## Tính năng

- **6 nội dung thi đấu**: Đơn nam, Đơn nữ (Nhóm 1 & 2), Đôi nam, Đôi nam nữ (Nhóm 1 & 2)
- **Bảng xếp hạng tự động**: tính từ kết quả (Thắng → Hiệu số séc → Hiệu số điểm)
- **Chế độ chỉnh sửa** (cần mật khẩu quản trị): thêm/xoá VĐV, thêm/xoá trận, nhập tỉ số
- **🎲 Bốc thăm chia bảng**: danh sách VĐV chờ bốc thăm → kéo-tên vào Bảng A/B
- **⚡ Tự sinh lịch vòng bảng**: mỗi cặp gặp nhau 1 lần (round-robin)
- **🏆 Sơ đồ Swiss 5 vòng**: khung thi đấu vẽ sẵn cho nội dung đôi, bấm ⚡ tự sinh cặp đấu từng vòng
- **Quản lý nội dung**: thêm/sửa/xoá nội dung, bảng, VĐV bằng form
- **Lưu dữ liệu trên server** (Supabase Postgres — gói free) — mọi người cùng thấy thay đổi ngay

## Cấu trúc

```
├── public/           # Frontend (static — Vercel serve từ thư mục này)
│   ├── index.html        # Cấu trúc trang
│   ├── styles.css        # Toàn bộ CSS
│   ├── app.js            # Toàn bộ logic frontend
│   ├── swiss-core.js     # Thuật toán Swiss stage (thuần, không DOM)
│   ├── custom-stage.js   # Sơ đồ cố định 8 đội + 6 đội A/B (thuần, không DOM)
│   └── data.json         # Dữ liệu mặc định (seed khi database chưa có dữ liệu)
├── tests/
│   └── run-all.js    # Toàn bộ test gộp (chạy: npm test)
├── server.js         # Local dev server (Node thuần — chỉ dùng khi chạy local)
├── api/
│   ├── data.js       # GET: đọc dữ liệu · PUT: lưu dữ liệu (cần mật khẩu)
│   └── auth.js       # POST: xác thực mật khẩu quản trị
├── supabase-setup.sql # SQL tạo bảng (chạy 1 lần trên Supabase)
├── seed-app-data.sql # SQL nạp dữ liệu giải vào bảng app_data (chạy 1 lần)
├── vercel.json       # Cấu hình Vercel
└── package.json      # Dependency @supabase/supabase-js
```

## Chạy local (không cần Vercel)

```bash
npm install
npm run dev
```

Mở `http://localhost:3000`. Server local tự serve tĩnh + API giả lập:
- Mật khẩu admin mặc định: `admin` (đổi bằng env `ADMIN_PASSWORD`)
- Dữ liệu chỉnh sửa được ghi vào `data-store.json` (đã ignore git) — không ảnh hưởng dữ liệu thật

## Chạy test

```bash
npm test
```

`tests/run-all.js` gộp toàn bộ test (reset dữ liệu, Swiss, custom-stage, bracket) — không cần server.

## Deploy lên Vercel

1. **Push code lên GitHub** rồi import vào Vercel (hoặc dùng CLI: `vercel`).

2. **Tạo Supabase project** (https://supabase.com — gói Free $0):
   - New project → đặt tên + mật khẩu database → tạo.
   - Mở **SQL Editor** → paste toàn bộ nội dung `supabase-setup.sql` → **Run** (tạo bảng `app_data`).
   - Nạp dữ liệu giải: SQL Editor → paste `seed-app-data.sql` → **Run** (ghi dòng `id = 1`).

3. **Lấy thông tin kết nối** (dashboard mới 2026):
   - Cách nhanh: bấm nút **Connect** (góc phải trên trang project) → chọn ngôn ngữ → thấy `URL` + key ngay trong hộp thoại.
   - Hoặc vào **Project Settings → API Keys**:
     - `Project URL` (dạng `https://xxxx.supabase.co`) → chính là `SUPABASE_URL`
     - **Secret key** (`sb_secret_...`, ⚠️ giữ bí mật, chỉ dùng server-side) → chính là `SUPABASE_SECRET_KEY`
     - (Nếu project cũ chỉ có `service_role` key dạng `eyJ...` thì dùng nó cho `SUPABASE_SERVICE_ROLE_KEY` — code hỗ trợ cả hai)

4. **Đặt biến môi trường trên Vercel** (Project → Settings → Environment Variables):
   - `SUPABASE_URL` = Project URL
   - `SUPABASE_SECRET_KEY` = secret key (hoặc `SUPABASE_SERVICE_ROLE_KEY` = service_role key nếu project cũ)
   - `SUPABASE_TABLE` = `app_data` (bảng dữ liệu thật — đặt tường minh để khỏi nhầm với bảng test)
   - `ADMIN_PASSWORD` = mật khẩu quản trị bạn muốn (VD: `bwf2026`)
   - Tick cả 3 môi trường (Production, Preview, Development) → Save → **Redeploy** để áp dụng.

5. **Mở trang** — dữ liệu lấy từ bảng `app_data` trên Supabase. Mọi thay đổi ở chế độ admin được ghi vào đó và mọi người cùng thấy.

## Dữ liệu: seed vs database (quan trọng)

`public/data.json` là **seed dự phòng**, KHÔNG phải nguồn dữ liệu đang chạy.

- API luôn đọc bảng `app_data` trên Supabase trước (`api/data.js`).
- `public/data.json` **chỉ** được đọc tới khi bảng đó **rỗng**.
- Sửa `data.json` rồi push/deploy **không** làm thay đổi dữ liệu đang chạy. Muốn nạp dữ liệu mới phải chạy `seed-app-data.sql` trong SQL Editor.

**Reset về seed:** xoá dòng `id=1` trong Table Editor của `app_data` → trang tự rơi về `public/data.json`.

**Test thử mà không đụng dữ liệu thật:** tạo bảng riêng rồi trỏ `SUPABASE_TABLE` sang nó.

```sql
create table if not exists public.app_data_test (
  id integer primary key,
  data jsonb not null
);
alter table public.app_data_test enable row level security;
create policy "public read app_data_test"
  on public.app_data_test for select using (true);
```

Trên Vercel đặt `SUPABASE_TABLE = app_data_test` → Redeploy → mọi thay đổi chỉ nằm trong bảng test.
Test xong đặt lại `SUPABASE_TABLE = app_data` → Redeploy → trang về dữ liệu thật.

## Cách sử dụng

1. Bấm **✏️ Chỉnh sửa** → nhập mật khẩu quản trị.
2. Thêm VĐV vào bảng → bấm **⚡ Tự sinh lịch thi đấu** để tạo lịch vòng bảng.
3. Nhập tỉ số từng séc → bảng xếp hạng tự cập nhật.
4. Bấm **✅ Xong** để thoát chế độ chỉnh sửa.

## Thể lệ (tóm tắt)

- **Đơn nam / Đơn nữ**: chia 2 bảng vòng tròn → Nhất/Nhì mỗi bảng vào bán kết → chung kết.
- **Đôi nam / Đôi nam nữ**: thể thức Swiss → chia nhánh Thắng/Thua → chung kết.
- **Cách tính điểm**: Đơn nam & Đôi: 3 séc, thắng 2; séc 1&2 đến 21, séc 3 đến 15. Đơn nữ: 3 séc, mỗi séc đến 15, thắng 2 séc.