/* Test SSE local: mở /api/events → PUT /api/data → nhận event: data-updated.
   KHÔNG phá data-store.json: GET trước, PUT lại đúng data đó. */
import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3999;
const BASE = 'http://localhost:' + PORT;

const server = spawn(process.execPath, ['server.js'], {
	env: { ...process.env, PORT: String(PORT), ADMIN_PASSWORD: 'admin' },
	stdio: ['ignore', 'pipe', 'pipe'],
	cwd: __dirname,
});

function waitForServer() {
	return new Promise(function (resolve, reject) {
		const t0 = Date.now();
		(function poll() {
			fetch(BASE + '/api/data').then(function (r) { if (r.ok) return resolve(); }).catch(function () {});
			if (Date.now() - t0 > 5000) return reject(new Error('Server không lên trong 5s'));
			setTimeout(poll, 200);
		})();
	});
}

function openSse() {
	return new Promise(function (resolve, reject) {
		let done = false;
		const timer = setTimeout(function () {
			if (!done) { done = true; req.destroy(); reject(new Error('SSE timeout 5s — không nhận data-updated')); }
		}, 5000);
		const req = http.get(BASE + '/api/events', function (res) {
			if (res.statusCode !== 200) {
				if (!done) { done = true; clearTimeout(timer); reject(new Error('SSE status ' + res.statusCode)); }
				return;
			}
			let buf = '';
			res.on('data', function (c) {
				buf += c;
				if (!done && buf.indexOf('data-updated') !== -1) {
					done = true;
					clearTimeout(timer);
					resolve(buf);
					req.destroy();
				}
			});
		});
		req.on('error', function () {
			if (!done) { done = true; clearTimeout(timer); reject(new Error('SSE connection error')); }
		});
	});
}

async function putData() {
	/* GET data hiện có → PUT lại NGUYÊN VẸN (không phá data-store.json) */
	const getRes = await fetch(BASE + '/api/data');
	if (!getRes.ok) throw new Error('GET fail ' + getRes.status);
	const current = await getRes.json();
	const res = await fetch(BASE + '/api/data', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer admin' },
		body: JSON.stringify(current),
	});
	if (!res.ok) throw new Error('PUT fail ' + res.status);
}

try {
	await waitForServer();
	const ssePromise = openSse();
	await new Promise(function (r) { setTimeout(r, 300); });
	await putData();
	const sseBuf = await ssePromise;
	if (sseBuf.indexOf('data-updated') === -1) throw new Error('Không nhận event data-updated');
	console.log('✅ SSE local: PUT /api/data → client nhận event: data-updated — PASS');
} finally {
	server.kill();
}