import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TABLE = 'app_data';
const ROW_ID = 1;

// SUPABASE_URL + key server-side — chỉ dùng trong Vercel env vars (không lộ ra frontend)
// Key mới (2026): SUPABASE_SECRET_KEY (sb_secret_...) — fallback key cũ: SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(
  process.env.SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-key'
);

function loadSeed() {
  try {
    const raw = readFileSync(join(__dirname, '..', 'data.json'), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // GET: đọc dữ liệu (công khai)
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('data')
        .eq('id', ROW_ID)
        .single();
      if (!error && data && data.data) return res.status(200).json(data.data);
    } catch (e) {
      // Supabase chưa cấu hình (chạy local) → fallback seed
    }
    const seed = loadSeed();
    if (seed) return res.status(200).json(seed);
    return res.status(500).json({ error: 'Không có dữ liệu' });
  }

  // PUT: lưu dữ liệu (chỉ admin)
  if (req.method === 'PUT') {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!process.env.ADMIN_PASSWORD || token !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Không có quyền chỉnh sửa' });
    }
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
    }
    try {
      const { error } = await supabase.from(TABLE).upsert({ id: ROW_ID, data: body });
      if (error) throw error;
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Lưu thất bại: ' + e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}