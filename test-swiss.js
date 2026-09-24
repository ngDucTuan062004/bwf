/* test-swiss.js — chạy: node test-swiss.js (ESM vì package type:module) */
import "./swiss-core.js";
import assert from "node:assert";
const S = globalThis.SwissCore;

function mk(p1, p2, sets, winner) {
	const m = { stage: "Vòng 1", p1: p1, p2: p2, sets: sets || null };
	if (winner) m.winner = winner;
	return m;
}
/* QUAN TRỌNG: sort từng cặp TRƯỚC khi so sánh (thứ tự [a,b] không cố định) */
function names(pairs) { return pairs.map(function (p) { return p.slice().sort().join("|"); }).sort(); }

/* 1. Vòng 1 ghép tuần tự 6 đội */
let r = S.pairRound(["T1","T2","T3","T4","T5","T6"], [], 1);
assert.deepStrictEqual(names(r.pairs), ["T1|T2", "T3|T4", "T5|T6"]);
assert.deepStrictEqual(r.bye, []);

/* 2. Vòng 1 với 5 đội → 1 đội bye */
r = S.pairRound(["T1","T2","T3","T4","T5"], [], 1);
assert.deepStrictEqual(names(r.pairs), ["T1|T2", "T3|T4"]);
assert.deepStrictEqual(r.bye, ["T5"]);

/* 3. Vòng 2: gom nhóm theo thành tích + float nhóm lẻ (T3 1-0 float gặp T4 0-1) */
const m1 = [mk("T1","T2",[[21,15],[21,18]]), mk("T3","T4",[[21,10],[18,21],[15,12]]), mk("T5","T6",[[21,19],[21,17]])];
r = S.pairRound(["T1","T2","T3","T4","T5","T6"], m1, 2);
assert.deepStrictEqual(names(r.pairs), ["T1|T5", "T2|T4", "T3|T6"]);
assert.deepStrictEqual(r.bye, []);

/* 4. Tránh tái đấu: 4 đội, vòng 3 phải ghép cặp chưa gặp (T1-T4, T2-T3) */
const m2 = [
	mk("T1","T2",[[21,15],[21,18]]), mk("T3","T4",[[21,10],[21,12]]),
	mk("T1","T3",[[21,11],[21,13]]), mk("T2","T4",[[21,9],[21,14]])
];
r = S.pairRound(["T1","T2","T3","T4"], m2, 3);
assert.deepStrictEqual(names(r.pairs), ["T1|T4", "T2|T3"]);
assert.deepStrictEqual(r.bye, []);

/* 5. 8 đội vòng 1 → 4 cặp */
r = S.pairRound(["A","B","C","D","E","F","G","H"], [], 1);
assert.strictEqual(r.pairs.length, 4);
assert.deepStrictEqual(r.bye, []);

/* 6. computeStandings: trận có winner (chọn nhanh) vẫn đếm thắng/thua */
const rows = S.computeStandings(["T1","T2"], [mk("T1","T2", null, "T1")]);
assert.strictEqual(rows[0].name, "T1");
assert.strictEqual(rows[0].wins, 1);
assert.strictEqual(rows[1].losses, 1);

/* 7. computeStandings: trận có sets giữ nguyên hành vi cũ */
const rows2 = S.computeStandings(["T1","T2"], [mk("T1","T2",[[21,15],[18,21],[15,10]])]);
assert.strictEqual(rows2[0].name, "T1");
assert.strictEqual(rows2[0].setsFor, 2);
assert.strictEqual(rows2[0].setsAgainst, 1);

/* 8. groupByRecord sắp theo wins giảm dần */
const g = S.groupByRecord(["T1","T2","T3","T4"], m1);
assert.deepStrictEqual(g.map(function (x) { return x.record; }), ["1-0", "0-1"]);

/* 9. matchWinner: ưu tiên winner, fallback sets */
assert.strictEqual(S.matchWinner(mk("A","B", null, "B")), "B");
assert.strictEqual(S.matchWinner(mk("A","B",[[21,10],[21,12]])), "A");
assert.strictEqual(S.matchWinner(mk("A","B", null)), null);
assert.strictEqual(S.matchWinner(mk("A","B",[[21,10],[21,12]], "B")), "B"); // winner ưu tiên kể cả khi có sets

/* 10. Bye khi mọi cặp đã gặp nhau */
const allPlayed = [
	mk("T1","T2",[[21,10],[21,10]]), mk("T3","T4",[[21,10],[21,10]]),
	mk("T1","T3",[[21,10],[21,10]]), mk("T2","T4",[[21,10],[21,10]]),
	mk("T1","T4",[[21,10],[21,10]]), mk("T2","T3",[[21,10],[21,10]])
];
r = S.pairRound(["T1","T2","T3","T4"], allPlayed, 4);
assert.strictEqual(r.pairs.length, 0);
assert.strictEqual(r.bye.length, 4);

/* 11. Full run 8 đội × 5 vòng: đủ 20 trận (4/vòng), không tái đấu */
function fullRun(n, rounds) {
	const participants = Array.from({ length: n }, function (_, i) { return "T" + (i + 1); });
	const matches = [];
	for (let r = 1; r <= rounds; r++) {
		const res = S.pairRound(participants, matches, r);
		res.pairs.forEach(function (p) {
			matches.push({ stage: "Vòng " + r, p1: p[0], p2: p[1], sets: [[21, 15], [21, 18]] });
		});
	}
	return matches;
}
function assertNoRematch(matches, label) {
	const seen = new Set();
	matches.forEach(function (m) {
		const k = [m.p1, m.p2].sort().join("|");
		assert.ok(!seen.has(k), label + " bị tái đấu: " + k);
		seen.add(k);
	});
}
const m8 = fullRun(8, 5);
assert.strictEqual(m8.length, 20, "8 đội × 5 vòng phải đủ 20 trận, thực tế " + m8.length);
assertNoRematch(m8, "8 đội");

/* 12. Full run 6 đội × 5 vòng: không tái đấu, ≥ 13 trận (bye chỉ khi bắt buộc) */
const m6 = fullRun(6, 5);
assert.ok(m6.length >= 13, "6 đội × 5 vòng nên có ≥13 trận, thực tế " + m6.length);
assertNoRematch(m6, "6 đội");

/* 13. useHeadToHead: A và C cùng 2-1, cùng hiệu số séc +2, A thắng đối đầu C.
   Default (điểm) → C trên (điểm cao hơn). H2H → A trên (thắng đối đầu). */
const h2hMatches = [
	mk("A", "C", [[21, 18], [17, 21], [15, 14]]), /* A thắng đối đầu C 2-1 (A +1 séc) */
	mk("A", "B", [[21, 15], [21, 18]]),            /* A 2-0 (+2 séc) */
	mk("A", "D", [[18, 21], [21, 19], [13, 15]]),  /* D thắng 2-1 (A -1 séc) */
	mk("C", "B", [[21, 15], [21, 18]]),            /* C 2-0 (+2 séc) */
	mk("C", "D", [[21, 19], [19, 21], [15, 10]]),  /* C thắng 2-1 (+1 séc) */
	mk("B", "D", [[21, 15], [18, 21], [15, 11]]),  /* D thắng 2-1 (+1 séc) */
];
/* A: 2-1, sets 5-3 (+2), điểm +6 · C: 2-1, sets 5-3 (+2), điểm +14 · D: 2-1 (+1 séc) */
const defaultRows = S.computeStandings(["A", "B", "C", "D"], h2hMatches);
assert.strictEqual(defaultRows[0].name, "C", "mặc định: C điểm cao hơn → C trên (điểm vẫn dùng)");
const h2hRows = S.computeStandings(["A", "B", "C", "D"], h2hMatches, { useHeadToHead: true });
assert.strictEqual(h2hRows[0].name, "A", "H2H: A thắng đối đầu C → A xếp trên dù điểm thấp");
assert.strictEqual(h2hRows[1].name, "C");

/* 14. useHeadToHead: không có trận đối đầu giữa các đội hòa → giữ nguyên thứ tự (không crash) */
const noH2h = S.computeStandings(["A", "B", "C", "D"], [
	mk("A", "B", [[21, 15], [18, 21], [15, 10]]),
	mk("C", "D", [[21, 10], [21, 12]]),
], { useHeadToHead: true });
assert.strictEqual(noH2h.length, 4, "không có đối đầu → vẫn đủ 4 đội, không crash");

/* 15. Mặc định (không opts) → vẫn dùng hiệu số điểm (hành vi cũ, đôi không đổi).
   Dùng lại h2hMatches: A và C hòa wins + séc nhưng C điểm cao hơn → C trên. */
assert.strictEqual(defaultRows[0].name, "C", "mặc định vẫn xếp theo hiệu số điểm → C trên A");

console.log("✅ Tất cả 15 nhóm test Swiss đều PASS");