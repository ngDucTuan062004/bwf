/* ================================================================
   BWF — Local dev server (CHỈ dùng để test trên máy, KHÔNG dùng production)
   Serve tĩnh + API giả lập để chạy đầy đủ tính năng mà không cần Vercel.
   Chạy: npm run dev  →  http://localhost:3000
   Mật khẩu admin mặc định: admin (đổi bằng env ADMIN_PASSWORD)
   Dữ liệu chỉnh sửa được ghi vào data-store.json (đã ignore git)
   ================================================================ */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const STORE_FILE = join(__dirname, 'data-store.json');

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.png': 'image/png',
};

function readBody(req) {
	return new Promise((resolve, reject) => {
		let body = '';
		req.on('data', function (c) {
			body += c;
			if (body.length > 10 * 1024 * 1024) { req.destroy(); reject(new Error('Body quá lớn')); }
		});
		req.on('end', function () { resolve(body); });
		req.on('error', reject);
	});
}

function sendJson(res, status, obj) {
	const payload = JSON.stringify(obj);
	res.writeHead(status, {
		'Content-Type': 'application/json; charset=utf-8',
		'Access-Control-Allow-Origin': '*',
	});
	res.end(payload);
}

function loadData() {
	if (existsSync(STORE_FILE)) {
		try { return JSON.parse(readFileSync(STORE_FILE, 'utf8')); } catch (e) { /* rơi xuống seed */ }
	}
	return JSON.parse(readFileSync(join(__dirname, 'data.json'), 'utf8'));
}

const server = createServer(async function (req, res) {
	const url = new URL(req.url, 'http://localhost');
	const path = decodeURIComponent(url.pathname);

	if (req.method === 'OPTIONS') {
		res.writeHead(204, {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		});
		return res.end();
	}

	/* ---- API giả lập ---- */
	if (path === '/api/data' && req.method === 'GET') {
		return sendJson(res, 200, loadData());
	}
	if (path === '/api/data' && req.method === 'PUT') {
		const auth = req.headers.authorization || '';
		const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
		if (token !== ADMIN_PASSWORD) return sendJson(res, 401, { error: 'Không có quyền chỉnh sửa' });
		try {
			const body = JSON.parse(await readBody(req));
			writeFileSync(STORE_FILE, JSON.stringify(body, null, '\t'), 'utf8');
			return sendJson(res, 200, { ok: true });
		} catch (e) {
			return sendJson(res, 400, { error: 'Dữ liệu không hợp lệ' });
		}
	}
	if (path === '/api/auth' && req.method === 'POST') {
		try {
			const body = JSON.parse(await readBody(req));
			if (body.password === ADMIN_PASSWORD) return sendJson(res, 200, { ok: true });
			return sendJson(res, 401, { error: 'Sai mật khẩu' });
		} catch (e) {
			return sendJson(res, 400, { error: 'Dữ liệu không hợp lệ' });
		}
	}

	/* ---- Serve tĩnh ---- */
	let filePath = path === '/' ? '/index.html' : path;
	filePath = join(__dirname, filePath);
	const rel = relative(__dirname, filePath);
	if (rel.startsWith('..') || isAbsolute(rel)) {
		res.writeHead(403);
		return res.end('Forbidden');
	}
	if (!existsSync(filePath)) {
		res.writeHead(404);
		return res.end('Not found');
	}
	const ext = extname(filePath).toLowerCase();
	res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
	res.end(readFileSync(filePath));
});

server.listen(PORT, function () {
	console.log('🏸 BWF local dev server: http://localhost:' + PORT);
	console.log('   Mật khẩu admin mặc định: ' + ADMIN_PASSWORD + ' (đổi bằng env ADMIN_PASSWORD)');
});