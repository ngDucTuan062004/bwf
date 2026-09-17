-- ============================================================
-- BWF — Giải Cầu lông nội bộ: tạo bảng lưu dữ liệu
-- Cách dùng: Supabase Dashboard → SQL Editor → paste → Run
-- ============================================================

-- Bảng lưu toàn bộ dữ liệu giải (1 dòng duy nhất, id = 1)
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
-- Bảng TEST (tuỳ chọn) — dùng để thử chỉnh sửa dữ liệu
-- không ảnh hưởng dữ liệu thật. Chuyển qua bảng test bằng cách
-- đặt env var SUPABASE_TABLE=app_data_test trên Vercel.
-- ============================================================
create table if not exists public.app_data_test (
  id integer primary key,
  data jsonb not null
);

alter table public.app_data_test enable row level security;

create policy "public read app_data_test"
  on public.app_data_test for select
  using (true);