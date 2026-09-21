/* smoke-trace.js — chạy: node smoke-trace.js (ESM vì package type:module)
   Mô phỏng syncFixedBracket (app.js) theo trace aaa.md, không DOM:
   - 8 participants, gán seed, tạo R1
   - Nhập kết quả từng vòng theo trace
   - Sau mỗi vòng gọi buildFixedBracket → resolve R2-R7
   - Xác nhận ranking cuối = T1, T3, T5; eliminated = T2,T4,T6,T7,T8 */
import "./custom-stage.js";
import assert from "node:assert";
const S = globalThis.CustomStage;

const teams8 = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"];

/* isSwissStage giống app.js */
function isSwissStage(stage) {
	return /^Vòng (Swiss )?\d+$/.test(stage || "");
}

/* syncFixedBracket — bản sao logic từ app.js (bỏ saveData/renderAll) */
function syncFixedBracket(content) {
	const participants = content.participants || [];
	const customMatches = content.matches.filter(function (m) { return isSwissStage(m.stage); });
	const bracket = S.buildFixedBracket(participants, customMatches);
	let changed = false;
	bracket.forEach(function (b) {
		if (b.round === 1) return; /* R1 do seed tạo */
		if (!b.match && b.teams[0] && b.teams[1]) {
			content.matches.push({ stage: "Vòng " + b.round, pos: b.pos, p1: b.teams[0], p2: b.teams[1], date: "", time: "", court: "", referee: "", sets: null });
			changed = true;
		} else if (b.match && b.teams[0] && b.teams[1] && (b.match.p1 !== b.teams[0] || b.match.p2 !== b.teams[1])) {
			b.match.p1 = b.teams[0]; b.match.p2 = b.teams[1]; changed = true;
		}
	});
	return changed;
}

/* ensureR1 — bản sao logic từ app.js */
function ensureR1(content) {
	const participants = content.participants || [];
	const hasR1 = (content.matches || []).some(function (m) { return m.pos && m.pos.indexOf("R1.") === 0; });
	if (participants.length === 8 && !hasR1) {
		[["R1.1", 0, 1], ["R1.2", 2, 3], ["R1.3", 4, 5], ["R1.4", 6, 7]].forEach(function (row) {
			content.matches.push({ stage: "Vòng 1", pos: row[0], p1: participants[row[1]], p2: participants[row[2]], date: "", time: "", court: "", referee: "", sets: null });
		});
	}
}

/* gán seed: đưa team vào vị trí seedNum (giống assignSeed, bỏ saveData/renderAll) */
function assignSeed(content, seedNum, team) {
	const participants = (content.participants || []).slice();
	const idx = participants.indexOf(team);
	if (idx !== -1) participants.splice(idx, 1);
	participants.splice(seedNum - 1, 0, team);
	content.participants = participants;
	ensureR1(content);
}

/* nhập kết quả trận theo trace */
function result(content, pos, winner) {
	const m = content.matches.find(function (x) { return x.pos === pos; });
	assert.ok(m, "trận " + pos + " phải tồn tại");
	m.winner = winner;
	m.sets = [[21, 15], [21, 18]];
}

function byPos(content) {
	const map = {};
	content.matches.forEach(function (m) { map[m.pos] = m; });
	return map;
}

/* ===== Bắt đầu mô phỏng ===== */
const content = { participants: teams8.slice(), matches: [] };

/* 1. Gán seed theo thứ tự mặc định (T1..T8) → R1 tự sinh */
ensureR1(content);
let mp = byPos(content);
assert.deepStrictEqual(["R1.1", "R1.2", "R1.3", "R1.4"].map(function (p) { return mp[p].p1 + "-" + mp[p].p2; }), ["T1-T2", "T3-T4", "T5-T6", "T7-T8"]);

/* 2. Nhập kết quả R1 (trace aaa.md: đội trái thắng) */
result(content, "R1.1", "T1"); result(content, "R1.2", "T3");
result(content, "R1.3", "T5"); result(content, "R1.4", "T7");
syncFixedBracket(content);
mp = byPos(content);
assert.deepStrictEqual(mp["R2.1"].p1 + "-" + mp["R2.1"].p2, "T1-T3");
assert.deepStrictEqual(mp["R2.2"].p1 + "-" + mp["R2.2"].p2, "T5-T7");
assert.deepStrictEqual(mp["R2.3"].p1 + "-" + mp["R2.3"].p2, "T2-T4");
assert.deepStrictEqual(mp["R2.4"].p1 + "-" + mp["R2.4"].p2, "T6-T8");

/* 3. Nhập kết quả R2 → R3 resolve */
result(content, "R2.1", "T1"); result(content, "R2.2", "T5");
result(content, "R2.3", "T2"); result(content, "R2.4", "T6");
syncFixedBracket(content);
mp = byPos(content);
assert.deepStrictEqual(mp["R3.1"].p1 + "-" + mp["R3.1"].p2, "T3-T2");
assert.deepStrictEqual(mp["R3.2"].p1 + "-" + mp["R3.2"].p2, "T7-T6");

/* 4. Nhập kết quả R3 → R4 + R6 resolve */
result(content, "R3.1", "T3"); result(content, "R3.2", "T7");
syncFixedBracket(content);
mp = byPos(content);
assert.deepStrictEqual(mp["R4.1"].p1 + "-" + mp["R4.1"].p2, "T3-T7");
assert.deepStrictEqual(mp["R6.1"].p1 + "-" + mp["R6.1"].p2, "T1-T5");

/* 5. Nhập kết quả R4 + R6 → R5 resolve (R7 chưa thể tạo vì cần winner R5) */
result(content, "R4.1", "T3"); result(content, "R6.1", "T1");
syncFixedBracket(content);
mp = byPos(content);
assert.deepStrictEqual(mp["R5.1"].p1 + "-" + mp["R5.1"].p2, "T3-T5");
assert.ok(!mp["R7.1"], "R7.1 chưa tạo khi R5.1 chưa có kết quả");

/* 6. Nhập kết quả R5 → R7 resolve */
result(content, "R5.1", "T3");
syncFixedBracket(content);
mp = byPos(content);
assert.deepStrictEqual(mp["R7.1"].p1 + "-" + mp["R7.1"].p2, "T1-T3");

/* 7. Nhập kết quả R7 → complete */
result(content, "R7.1", "T1");
syncFixedBracket(content);

/* 8. Xác nhận ranking cuối */
const st = S.computeFixedState(content.participants, content.matches);
assert.strictEqual(st.phase, "complete");
assert.deepStrictEqual(st.ranking.slice(0, 3), ["T1", "T3", "T5"]);
assert.deepStrictEqual(st.eliminated.slice().sort(), ["T2", "T4", "T6", "T7", "T8"].sort());

console.log("✅ Smoke trace (syncFixedBracket mô phỏng): R2-R7 resolve đúng, ranking cuối " + JSON.stringify(st.ranking.slice(0, 3)) + ", eliminated " + JSON.stringify(st.eliminated.slice().sort()) + " — PASS");