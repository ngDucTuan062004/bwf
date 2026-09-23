import { createClient } from '@supabase/supabase-js';

const TABLE = process.env.SUPABASE_TABLE || 'app_data';
const supabase = createClient(
  process.env.SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-key'
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  res.write(': connected\n\n');

  /* event '*' — api/data.js dùng upsert, lần đầu là INSERT (không phải UPDATE) */
  const channel = supabase
    .channel('bwf-events')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, function () {
      res.write('event: data-updated\ndata: {}\n\n');
    })
    .subscribe();

  const heartbeat = setInterval(function () {
    try { res.write(': ping\n\n'); } catch (e) { /* stream đã đóng */ }
  }, 15000);
  req.on('close', function () {
    clearInterval(heartbeat);
    supabase.removeChannel(channel).catch(function () {});
    try { res.end(); } catch (e) { /* đã đóng */ }
  });
}