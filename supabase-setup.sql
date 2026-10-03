-- ============================================================
-- BWF — Giải Cầu lông nội bộ: tạo bảng lưu dữ liệu
-- Cách dùng: Supabase Dashboard → SQL Editor → paste → Run
-- ============================================================

-- Bảng lưu toàn bộ dữ liệu giải (1 dòng duy nhất, id = 1)
-- Đây là bảng DUY NHẤT dùng cho production. Mã nguồn đọc bảng này qua
-- env var SUPABASE_TABLE (mặc định 'app_data' — xem api/data.js).
-- Đặt SUPABASE_TABLE=app_data trên Vercel để chỉ định tường minh.
create table if not exists public.app_data (
  id integer primary key,
  data jsonb not null
);

-- Bật Row Level Security (service role key vẫn bypass được)
alter table public.app_data enable row level security;

-- Cho phép đọc công khai (phòng khi dùng anon key)
create policy "public read app_data"
  on public.app_data for select
  using (true);

-- ============================================================
-- Nạp dữ liệu
-- ============================================================
-- Sau khi tạo bảng, nạp dữ liệu giải bằng cách chạy `seed-app-data.sql`
-- (Supabase SQL Editor → paste → Run). File đó ghi đè dòng id = 1.
--
-- Lưu ý: `public/data.json` trong repo chỉ là SEED DỰ PHÒNG — API chỉ
-- đọc tới nó khi bảng này RỖNG (xem api/data.js). Sửa data.json rồi
-- deploy KHÔNG làm thay đổi dữ liệu đang chạy; phải cập nhật bảng.