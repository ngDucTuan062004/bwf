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

console.log("test-custom-stage: OK (" + S.buildFixedBracket.name + " / " + S.computeFixedState.name + ")");