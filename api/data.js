import { Redis } from '@upstash/redis';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_KEY = 'bwf:data';

// Đọc env UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (Vercel Marketplace tự set)
const redis = Redis.fromEnv();

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
      const data = await redis.get(DATA_KEY);
      if (data) return res.status(200).json(data);
    } catch (e) {
      // Redis chưa cấu hình (chạy local) → fallback seed
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
    const data = req.body;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
    }
    try {
      await redis.set(DATA_KEY, data);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Lưu thất bại: ' + e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}