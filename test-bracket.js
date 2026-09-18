/* test-bracket.js — chạy: node test-bracket.js */
import "./swiss-core.js";
import assert from "node:assert";
const S = globalThis.SwissCore;

/* mk: stage mặc định "Vòng 1", truyền stage để tạo trận vòng khác */
function mk(p1, p2, sets, winner, stage) {
	const m = { stage: stage || "Vòng 1", p1: p1, p2: p2, sets: sets || null };
	if (winner) m.winner = winner;
	return m;
}

/* 1. Vòng 1, 6 đội chưa có kết quả: 1 nhóm "0-0", 3 trận theo thứ tự participants */
const m0 = [
	mk("T1","T2"), mk("T3","T4"), mk("T5","T6")
];
let b = S.buildSwissBracket(["T1","T2","T3","T4","T5","T6"], m0, 5);
assert.strictEqual(b.length, 5);
assert.strictEqual(b[0].groups.length, 1);
assert.strictEqual(b[0].groups[0].record, "0-0");
assert.strictEqual(b[0].groups[0].matches.length, 3);
assert.deepStrictEqual(b[0].groups[0].matches.map(function (m) { return m.p1; }), ["T1","T3","T5"]);

/* 2. Sau vòng 1 (T1,T3,T5 thắng) + vòng 2 (T1|T5, T2|T4, T3|T6):
      vòng 2 gom nhóm 1-0 / 0-1, đội thắng lên nhánh thắng */
const m1 = [
	mk("T1","T2",[[21,15],[21,18]]), mk("T3","T4",[[21,10],[18,21],[15,12]]), mk("T5","T6",[[21,19],[21,17]])
];
const m2 = [
	mk("T1","T5", null, null, "Vòng 2"), mk("T2","T4", null, null, "Vòng 2"), mk("T3","T6", null, null, "Vòng 2")
];
b = S.buildSwissBracket(["T1","T2","T3","T4","T5","T6"], m1.concat(m2), 5);
assert.deepStrictEqual(b[1].groups.map(function (g) { return g.record; }), ["1-0", "0-1"]);
/* T1|T5 (cả 2 1-0) + T3|T6 (top T3 1-0) → nhóm 1-0; T2|T4 (cả 2 0-1) → nhóm 0-1 */
assert.strictEqual(b[1].groups[0].matches.length, 2);
assert.strictEqual(b[1].groups[1].matches.length, 1);

/* 3. Bye: 5 đội, vòng 1 có T5 bye (không trận vòng 1, có trận vòng 2) */
const mBye = [
	mk("T1","T2",[[21,15],[21,18]]), mk("T3","T4",[[21,10],[21,12]]),
	mk("T1","T5", null, null, "Vòng 2"), mk("T2","T3", null, null, "Vòng 2")
];
b = S.buildSwissBracket(["T1","T2","T3","T4","T5"], mBye, 2);
assert.deepStrictEqual(b[0].bye, ["T5"]);

/* 4. Không có trận nào: 5 vòng đều rỗng */
b = S.buildSwissBracket(["A","B"], [], 5);
assert.strictEqual(b.length, 5);
assert.ok(b.every(function (r) { return r.groups.length === 0 && r.bye.length === 0; }));

/* 5. Không làm hỏng API cũ */
assert.strictEqual(typeof S.pairRound, "function");
assert.strictEqual(typeof S.computeStandings, "function");

console.log("✅ Tất cả test bracket đều PASS");