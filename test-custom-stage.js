/* test-custom-stage.js — chạy: node test-custom-stage.js (ESM vì package type:module) */
import "./custom-stage.js";
import assert from "node:assert";
const S = globalThis.CustomStage;

const teams8 = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"];

function mk(p1, p2, pos, round, winner) {
	return { stage: "Vòng " + round, pos: pos, p1: p1, p2: p2, sets: [[21, 15], [21, 18]], winner: winner };
}

/* Test 1: R1 từ seed order (chưa có trận) */
let b = S.buildFixedBracket(teams8, []);
assert.deepStrictEqual(b.filter(function (x) { return x.round === 1; }).map(function (x) { return x.teams; }), [
	["T1", "T2"], ["T3", "T4"], ["T5", "T6"], ["T7", "T8"]
]);

/* Test 2: R2 nhánh thắng/thua từ kết quả R1 */
const m = [
	mk("T1", "T2", "R1.1", 1, "T1"), mk("T3", "T4", "R1.2", 1, "T3"),
	mk("T5", "T6", "R1.3", 1, "T5"), mk("T7", "T8", "R1.4", 1, "T7"),
];
b = S.buildFixedBracket(teams8, m);
const byPos = {};
b.forEach(function (x) { byPos[x.pos] = x; });
assert.deepStrictEqual(byPos["R2.1"].teams, ["T1", "T3"]);
assert.deepStrictEqual(byPos["R2.2"].teams, ["T5", "T7"]);
assert.deepStrictEqual(byPos["R2.3"].teams, ["T2", "T4"]);
assert.deepStrictEqual(byPos["R2.4"].teams, ["T6", "T8"]);

/* Test 3: full trace (khớp aaa.md) → T1 hạng 1, T3 hạng 2, T5 hạng 3 */
const full = [
	mk("T1", "T2", "R1.1", 1, "T1"), mk("T3", "T4", "R1.2", 1, "T3"),
	mk("T5", "T6", "R1.3", 1, "T5"), mk("T7", "T8", "R1.4", 1, "T7"),
	mk("T1", "T3", "R2.1", 2, "T1"), mk("T5", "T7", "R2.2", 2, "T5"),
	mk("T2", "T4", "R2.3", 2, "T2"), mk("T6", "T8", "R2.4", 2, "T6"),
	mk("T3", "T2", "R3.1", 3, "T3"), mk("T7", "T6", "R3.2", 3, "T7"),
	mk("T3", "T7", "R4.1", 4, "T3"),
	mk("T1", "T5", "R6.1", 6, "T1"),
	mk("T3", "T5", "R5.1", 5, "T3"),
	mk("T1", "T3", "R7.1", 7, "T1"),
];
let st = S.computeFixedState(teams8, full);
assert.strictEqual(st.phase, "complete");
assert.deepStrictEqual(st.ranking.slice(0, 3), ["T1", "T3", "T5"]);
assert.deepStrictEqual(st.eliminated.slice().sort(), ["T2", "T4", "T6", "T7", "T8"].sort());

/* Test 4: partial — sau R1, phase in-progress, chưa loại ai */
st = S.computeFixedState(teams8, m);
assert.strictEqual(st.phase, "in-progress");
assert.deepStrictEqual(st.eliminated, []);
assert.deepStrictEqual(st.ranking.slice(0, 3), ["T1", "T3", "T5", "T7"].slice(0, 3));

/* Test 5: match không có pos → derive từ stage + thứ tự */
const legacy = [
	{ stage: "Vòng 1", p1: "T1", p2: "T2", winner: "T1" },
	{ stage: "Vòng 1", p1: "T3", p2: "T4", winner: "T3" },
];
b = S.buildFixedBracket(teams8, legacy);
const byPos2 = {};
b.forEach(function (x) { byPos2[x.pos] = x; });
assert.deepStrictEqual(byPos2["R2.1"].teams, ["T1", "T3"]);

/* ============================================================
   6-team flexible bracket (10 trận, 5 vòng) — Case A / Case B
   Case A: đội thua R1.2 (0-1) thắng trận chéo R2.1
   Case B: đội thắng R1.1 (1-0) thắng trận chéo R2.1
   ============================================================ */
const teams6 = ["A1", "A2", "A3", "A4", "A5", "A6"];
const r1_6 = [
	mk("A1", "A2", "R1.1", 1, "A1"), mk("A3", "A4", "R1.2", 1, "A3"), mk("A5", "A6", "R1.3", 1, "A5"),
];
/* R2.1 = W R1.1 (A1) vs L R1.2 (A4) — trận chéo */
const caseA_r2 = [
	mk("A1", "A4", "R2.1", 2, "A4"), mk("A3", "A5", "R2.2", 2, "A3"), mk("A2", "A6", "R2.3", 2, "A2"),
];
const caseB_r2 = [
	mk("A1", "A4", "R2.1", 2, "A1"), mk("A3", "A5", "R2.2", 2, "A3"), mk("A2", "A6", "R2.3", 2, "A2"),
];

/* Test 6: pickStructure6 — chọn case theo kết quả trận chéo R2.1 */
assert.strictEqual(S.pickStructure6(r1_6.concat(caseA_r2)), S.STRUCTURE6_A, "R2.1 đội 0-1 (thua R1.2) thắng → Case A");
assert.strictEqual(S.pickStructure6(r1_6.concat(caseB_r2)), S.STRUCTURE6_B, "R2.1 đội 1-0 (thắng R1.1) thắng → Case B");
assert.strictEqual(S.pickStructure6(r1_6), S.STRUCTURE6_A, "chưa có kết quả R2.1 → mặc định Case A");

/* Test 7: buildFixedBracket6 — Case A feeds (R3/R4/R5) */
let b6 = S.buildFixedBracket6(teams6, r1_6.concat(caseA_r2));
let by6 = {};
b6.forEach(function (x) { by6[x.pos] = x; });
assert.deepStrictEqual(by6["R3.1"].teams, ["A1", "A2"], "Case A R3.1 = L R2.1 vs W R2.3 (1-1 vs 1-1)");
assert.deepStrictEqual(by6["R3.2"].teams, ["A4", "A5"], "Case A R3.2 = W R2.1 vs L R2.2 (1-1 vs 1-1)");
assert.deepStrictEqual(by6["R5.1"].teams, ["A3", null], "Case A R5.1 = W R2.2 (2-0) vs W R4.1 (chưa có)");

/* Test 8: buildFixedBracket6 — Case B feeds */
b6 = S.buildFixedBracket6(teams6, r1_6.concat(caseB_r2));
by6 = {};
b6.forEach(function (x) { by6[x.pos] = x; });
assert.deepStrictEqual(by6["R3.1"].teams, ["A1", "A3"], "Case B R3.1 = W R2.1 vs W R2.2 (2-0 vs 2-0)");
assert.deepStrictEqual(by6["R3.2"].teams, ["A5", "A2"], "Case B R3.2 = L R2.2 vs W R2.3 (1-1 vs 1-1)");
assert.deepStrictEqual(by6["R5.1"].teams, [null, null], "Case B R5.1 chưa có team (cần kết quả R3.1/R4.1)");

/* Test 9: computeFixedState6 — Case A full trace → A1 vô địch, A3 hạng 2, A4 hạng 3 */
const fullA = r1_6.concat(caseA_r2).concat([
	mk("A1", "A2", "R3.1", 3, "A1"), mk("A4", "A5", "R3.2", 3, "A4"),
	mk("A1", "A4", "R4.1", 4, "A1"),
	mk("A3", "A1", "R5.1", 5, "A1"),
]);
let st6 = S.computeFixedState6(teams6, fullA);
assert.strictEqual(st6.caseId, "A");
assert.strictEqual(st6.phase, "complete");
assert.deepStrictEqual(st6.ranking.slice(0, 3), ["A1", "A3", "A4"], "Case A: A1 vô địch, A3 nhì, A4 ba");
assert.deepStrictEqual(st6.eliminated.slice().sort(), ["A2", "A4", "A5", "A6"].sort(), "Case A loại: A2, A4, A5, A6 (mọi đội ngoài top 2)");

/* Test 10: computeFixedState6 — Case B full trace → A1 vô địch, A3 nhì, A2 ba */
const fullB = r1_6.concat(caseB_r2).concat([
	mk("A1", "A3", "R3.1", 3, "A1"), mk("A5", "A2", "R3.2", 3, "A2"),
	mk("A3", "A2", "R4.1", 4, "A3"),
	mk("A1", "A3", "R5.1", 5, "A1"),
]);
st6 = S.computeFixedState6(teams6, fullB);
assert.strictEqual(st6.caseId, "B");
assert.strictEqual(st6.phase, "complete");
assert.deepStrictEqual(st6.ranking.slice(0, 3), ["A1", "A3", "A2"], "Case B: A1 vô địch, A3 nhì, A2 ba");
assert.deepStrictEqual(st6.eliminated.slice().sort(), ["A2", "A4", "A5", "A6"].sort(), "Case B loại: A2, A4, A5, A6 (mọi đội ngoài top 2)");

/* Test 11: computeFixedState6 — sau R2 (chưa R3) → in-progress, loại đúng theo case */
st6 = S.computeFixedState6(teams6, r1_6.concat(caseA_r2));
assert.strictEqual(st6.phase, "in-progress");
assert.deepStrictEqual(st6.eliminated.slice().sort(), ["A6"].sort(), "Case A sau R2 loại A6 (0-2)");
st6 = S.computeFixedState6(teams6, r1_6.concat(caseB_r2));
assert.deepStrictEqual(st6.eliminated.slice().sort(), ["A4", "A6"].sort(), "Case B sau R2 loại A4, A6 (0-2)");

console.log("test-custom-stage: OK (" + S.buildFixedBracket.name + " / " + S.computeFixedState.name + " / 6-team A/B)");