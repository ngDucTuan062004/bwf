/* test-custom-stage.js — chạy: node test-custom-stage.js (ESM vì package type:module) */
import "./custom-stage.js";
import assert from "node:assert";
const S = globalThis.CustomStage;

/* QUAN TRỌNG: sort từng cặp TRƯỚC khi so sánh (thứ tự [a,b] không cố định) */
function names(pairs) { return pairs.map(function (p) { return p.slice().sort().join("|"); }).sort(); }

function roundNumOf(stage) {
	const n = parseInt(String(stage).replace(/\D/g, ""), 10);
	return isNaN(n) ? 0 : n;
}

/* Thêm trận "Vòng N" (winner tường minh — không phụ thuộc vị trí) cho các cặp đã sinh */
function play(matches, pairs, winners) {
	const r = matches.reduce(function (max, m) { return Math.max(max, roundNumOf(m.stage)); }, 0) + 1;
	pairs.forEach(function (p, i) {
		matches.push({ stage: "Vòng " + r, p1: p[0], p2: p[1], sets: [[21, 15], [21, 18]], winner: winners[i] });
	});
}

function mk(p1, p2, round, winner) {
	return { stage: "Vòng " + round, p1: p1, p2: p2, sets: [[21, 15], [21, 18]], winner: winner };
}

/* ----- Test A: Vòng 1 ghép tuần tự, 8 đội -> 4 cặp ----- */
let r = S.customCreateRound1(["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"]);
assert.deepStrictEqual(names(r.pairs), ["T1|T2", "T3|T4", "T5|T6", "T7|T8"]);
assert.deepStrictEqual(r.bye, []);

/* Test A2: 7 đội -> 3 cặp + 1 bye */
r = S.customCreateRound1(["T1", "T2", "T3", "T4", "T5", "T6", "T7"]);
assert.deepStrictEqual(names(r.pairs), ["T1|T2", "T3|T4", "T5|T6"]);
assert.deepStrictEqual(r.bye, ["T7"]);

/* ----- Test B: kịch bản chuẩn (trace aaa.md) ----- */
const teams8 = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"];
const m = [];
r = S.customCreateRound1(teams8);
play(m, r.pairs, ["T1", "T3", "T5", "T7"]); /* R1 */
r = S.customPairNextRound(teams8, m, 2);
assert.deepStrictEqual(names(r.pairs), ["T1|T3", "T2|T4", "T5|T7", "T6|T8"]);
play(m, r.pairs, ["T1", "T5", "T2", "T6"]); /* R2 */
r = S.customPairNextRound(teams8, m, 3);
assert.deepStrictEqual(names(r.pairs), ["T2|T3", "T6|T7"]);
play(m, r.pairs, ["T3", "T7"]); /* R3 */
r = S.customPairNextRound(teams8, m, 4);
assert.deepStrictEqual(names(r.pairs), ["T3|T7"]);
let st = S.customComputeState(teams8, m);
assert.strictEqual(st.phase, "elimination");
play(m, r.pairs, ["T3"]); /* R4 */
r = S.customPairNextRound(teams8, m, 5);
assert.deepStrictEqual(names(r.pairs), ["T1|T5"]); /* R5 = vòng đầu round-robin */
play(m, r.pairs, ["T1"]); /* R5 */
r = S.customPairNextRound(teams8, m, 6);
assert.deepStrictEqual(names(r.pairs), ["T1|T3", "T3|T5"]); /* R6 = vòng sau */
play(m, r.pairs, ["T1", "T3"]); /* R6 */
st = S.customComputeState(teams8, m);
assert.deepStrictEqual(st.ranking, ["T1", "T3", "T5"]);
assert.deepStrictEqual(st.eliminated, ["T4", "T8", "T2", "T6", "T7"]);
assert.deepStrictEqual({ w: st.records["T1"].w, l: st.records["T1"].l }, { w: 4, l: 0 });
assert.deepStrictEqual({ w: st.records["T3"].w, l: st.records["T3"].l }, { w: 4, l: 2 });
assert.deepStrictEqual({ w: st.records["T5"].w, l: st.records["T5"].l }, { w: 2, l: 2 });
assert.strictEqual(st.phase, "complete");

/* ----- Test C: kịch bản khác (T2 thắng T1 R1) — không hardcode ----- */
const m2 = [];
r = S.customCreateRound1(teams8);
play(m2, r.pairs, ["T2", "T3", "T5", "T7"]); /* R1: T2 thắng T1 */
let st2 = S.customComputeState(teams8, m2);
assert.deepStrictEqual({ w: st2.records["T2"].w, l: st2.records["T2"].l }, { w: 1, l: 0 }); /* winner path */
assert.deepStrictEqual({ w: st2.records["T1"].w, l: st2.records["T1"].l }, { w: 0, l: 1 }); /* loser path */
r = S.customPairNextRound(teams8, m2, 2);
assert.deepStrictEqual(names(r.pairs), ["T1|T4", "T2|T3", "T5|T7", "T6|T8"]); /* KHÁC kịch bản chuẩn: T2 nhóm 1-0, T1 nhóm 0-1 */
play(m2, r.pairs, ["T3", "T5", "T4", "T6"]); /* R2 */
r = S.customPairNextRound(teams8, m2, 3);
assert.deepStrictEqual(names(r.pairs), ["T2|T4", "T6|T7"]); /* 1-1 ghép, 0-thua T3/T5 chờ */
const flat = r.pairs.reduce(function (a, p) { return a.concat(p); }, []);
assert.ok(flat.indexOf("T3") === -1 && flat.indexOf("T5") === -1, "0-thua T3/T5 phải chờ (không ghép)");

/* Test C2: customBuildBracket gom theo stage + thêm cột trống nếu chưa complete */
const br2 = S.customBuildBracket(teams8, m2);
assert.strictEqual(br2.rounds.length, 3); /* R1..R2 có trận + R3 cột trống */
assert.strictEqual(br2.rounds[0].groups[0].label, "Vòng 1");
assert.deepStrictEqual(br2.rounds[2].groups[0].matches, []);
assert.strictEqual(br2.state.phase, "elimination");

/* ----- Test D1: nhóm 1 thua lẻ 3 đội -> 1 cặp + 1 bye (pha loại) ----- */
const mD1 = [
	mk("T1", "T8", 1, "T1"), mk("T7", "T2", 1, "T2"), mk("T6", "T3", 1, "T3"), mk("T5", "T4", 1, "T4"),
	mk("T1", "T7", 2, "T1"), mk("T6", "T2", 2, "T2"), mk("T8", "T3", 2, "T3"), mk("T4", "T5", 2, "T5"),
	mk("T1", "T5", 3, "T1"), mk("T4", "T6", 3, "T4"), mk("T8", "T2", 3, "T8"), mk("T7", "T3", 3, "T7")
]; /* T1:3-0; T2,T3,T4:2-1; T5,T6,T7:1-2; T8:0-3 */
r = S.customPairNextRound(teams8, mD1, 4);
assert.deepStrictEqual(names(r.pairs), ["T2|T3"]); /* 1 cặp */
assert.ok(r.bye.indexOf("T4") !== -1, "đội cuối nhóm 1 thua lẻ phải bye: " + JSON.stringify(r.bye));

/* ----- Test D2: 2 đội active -> 1 cặp (round-robin) ----- */
const mD2 = [mk("T1", "T3", 1, "T1"), mk("T2", "T4", 1, "T2"), mk("T1", "T4", 2, "T1"), mk("T2", "T3", 2, "T2")];
r = S.customPairNextRound(["T1", "T2", "T3", "T4"], mD2, 3);
assert.deepStrictEqual(names(r.pairs), ["T1|T2"]);
assert.deepStrictEqual(r.bye, []);

/* ----- Test D3: 1 đội active -> phase "complete", không sinh cặp ----- */
const mD3 = [mk("T1", "T2", 1, "T1"), mk("T1", "T2", 2, "T1")];
st = S.customComputeState(["T1", "T2"], mD3);
assert.strictEqual(st.phase, "complete");
assert.deepStrictEqual(st.ranking, ["T1", "T2"]);
r = S.customPairNextRound(["T1", "T2"], mD3, 3);
assert.deepStrictEqual(r.pairs, []);

/* ----- Test E: customBuildBracket sau kịch bản chuẩn complete ----- */
const br = S.customBuildBracket(teams8, m);
assert.strictEqual(br.rounds.length, 6);
assert.strictEqual(br.rounds[2].groups[0].label, "Vòng 3");
assert.strictEqual(br.state.phase, "complete");

console.log("✅ Tất cả 6 nhóm test Custom Stage đều PASS");