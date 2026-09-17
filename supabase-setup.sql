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