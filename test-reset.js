/* test-reset.js — chạy: node test-reset.js (ESM vì package type:module)
   Harness: stub browser globals → load custom-stage.js + app.js vào vm context →
   test applySeedToContent (reset) + podium gating (chỉ hiện ranking khi complete). */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/* ---------- DOM stub cơ bản (đủ để app.js load + renderCustomBracket chạy) ---------- */
function makeEl(tag) {
	return {
		nodeType: 1,
		tagName: String(tag || "div").toUpperCase(),
		children: [],
		parentNode: null,
		firstChild: null,
		className: "",
		style: {},
		dataset: {},
		value: "",
		appendChild(c) {
			c.parentNode = this;
			this.children.push(c);
			if (!this.firstChild) this.firstChild = c;
			return c;
		},
		removeChild(c) {
			const i = this.children.indexOf(c);
			if (i !== -1) this.children.splice(i, 1);
			if (this.firstChild === c) this.firstChild = this.children[0] || null;
			return c;
		},
		remove() { if (this.parentNode) this.parentNode.removeChild(this); },
		setAttribute(k, v) { this[k] = v; },
		getAttribute(k) { return this[k]; },
		addEventListener() {},
		removeEventListener() {},
		focus() {},
		querySelector() { return null; },
		querySelectorAll() { return []; },
		classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
		getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
	};
}

const sandbox = {
	console: console,
	document: {
		body: makeEl("body"),
		getElementById: function () { return makeEl("div"); },
		createElement: function (tag) { return makeEl(tag); },
		createTextNode: function (t) { return { nodeType: 3, textContent: String(t) }; },
		createElementNS: function () { return makeEl("svg"); },
		querySelector: function () { return null; },
		querySelectorAll: function () { return []; }
	},
	location: { search: "" },
	localStorage: { getItem: function () { return null; }, setItem() {}, removeItem() {} },
	requestAnimationFrame: function () {},
	prompt: function () { return null; },
	confirm: function () { return true; },
	alert: function () {},
	/* fetch treo (không bao giờ resolve) → loadData() đợi mãi, không chạy init()/renderAll() khi load */
	fetch: function () { return new Promise(function () {}); },
	addEventListener: function () {}
};
sandbox.window = sandbox;
const ctx = createContext(sandbox);

const customStageSrc = readFileSync(join(__dirname, "custom-stage.js"), "utf8");
const appSrc = readFileSync(join(__dirname, "app.js"), "utf8");
runInContext(customStageSrc, ctx);
runInContext(appSrc, ctx);

const applySeedToContent = ctx.applySeedToContent;
const renderCustomBracket = ctx.renderCustomBracket;
const CustomStage = ctx.CustomStage;
assert.ok(applySeedToContent, "applySeedToContent phải tồn tại sau khi load app.js");
assert.ok(renderCustomBracket, "renderCustomBracket phải tồn tại sau khi load app.js");
assert.ok(CustomStage, "CustomStage phải tồn tại sau khi load custom-stage.js");

/* vm context có intrinsics riêng → array tạo bên trong vm không cùng realm host Array.
   normalize về host realm (JSON round-trip) rồi mới deepStrictEqual. */
function hostClone(v) { return JSON.parse(JSON.stringify(v)); }

/* Thu thập toàn bộ text trong cây DOM fake */
function allText(node) {
	if (!node) return "";
	const parts = [];
	if (typeof node.textContent === "string" && node.textContent) parts.push(node.textContent);
	if (Array.isArray(node.children)) node.children.forEach(function (c) { parts.push(allText(c)); });
	return parts.join("|");
}

/* ============================================================
   1. applySeedToContent — harness plan Step 2
   ============================================================ */

/* (a) seed đầy đủ → khôi phục label/format/scoringNote/participants/matches/unassignedPairs */
const content = {
	id: "x", label: "Đã sửa", format: "group", scoringNote: "note cũ",
	participants: ["A", "B"], matches: [{ stage: "Vòng 1", p1: "A", p2: "B" }],
	unassignedPairs: ["C"]
};
const seed = {
	id: "x", label: "Đôi nam", format: "swiss", scoringNote: "note gốc",
	participants: ["A", "B", "C"], matches: [], unassignedPairs: []
};
applySeedToContent(content, seed);
assert.strictEqual(content.label, "Đôi nam");
assert.strictEqual(content.format, "swiss");
assert.strictEqual(content.scoringNote, "note gốc");
assert.deepStrictEqual(hostClone(content.participants), ["A", "B", "C"]);
assert.deepStrictEqual(hostClone(content.matches), []);
assert.deepStrictEqual(hostClone(content.unassignedPairs), []);

/* (b) seed thiếu unassignedPairs → content.unassignedPairs = [] (không throw) */
const seedB = { label: "L", format: "swiss", scoringNote: "n", participants: ["P"], matches: [] };
const contentB = { label: "cũ", format: "swiss", participants: ["X"], matches: ["m"], unassignedPairs: ["u"] };
applySeedToContent(contentB, seedB);
assert.strictEqual(contentB.unassignedPairs.length, 0, "seed thiếu unassignedPairs → content.unassignedPairs = []");
assert.deepStrictEqual(hostClone(contentB.participants), ["P"]);
assert.deepStrictEqual(hostClone(contentB.matches), []);

/* (c) không có seed content → matches=[], unassignedPairs=[] (giữ label/format/participants) */
const contentC = { label: "Giữ", format: "swiss", participants: ["A"], matches: ["m"], unassignedPairs: ["u"] };
applySeedToContent(contentC, undefined);
assert.deepStrictEqual(hostClone(contentC.matches), [], "không có seed → matches = []");
assert.deepStrictEqual(hostClone(contentC.unassignedPairs), [], "không có seed → unassignedPairs = []");
assert.strictEqual(contentC.label, "Giữ");
assert.strictEqual(contentC.participants.length, 1);
applySeedToContent(contentC, null); /* null cũng là không có seed */
assert.deepStrictEqual(hostClone(contentC.matches), []);
assert.deepStrictEqual(hostClone(contentC.unassignedPairs), []);

/* (d) copy mảng — content sửa sau không làm hỏng seed */
const seedD = { participants: ["P1", "P2"], matches: [{ stage: "Vòng 1" }], unassignedPairs: ["U"] };
const contentD = { participants: [], matches: [], unassignedPairs: [] };
applySeedToContent(contentD, seedD);
contentD.participants.push("P3");
contentD.matches.push({ stage: "V" });
contentD.unassignedPairs.push("U2");
assert.strictEqual(seedD.participants.length, 2);
assert.strictEqual(seedD.matches.length, 1);
assert.strictEqual(seedD.unassignedPairs.length, 1);

console.log("✅ applySeedToContent: (a) seed đầy đủ, (b) seed thiếu unassignedPairs, (c) không seed, (d) copy mảng — PASS");

/* ============================================================
   2. Podium gating — smoke kết hợp renderCustomBracket (DOM stub)
      CustomStage + app.js được load nên test đúng hàm thật trong app.js
   ============================================================ */
const teams8 = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"];

/* 2a. 0 matches → phase "elimination" → podium "Tạm xếp hạng" (không ranking giả) */
let st = CustomStage.customComputeState(teams8, []);
assert.strictEqual(st.phase, "elimination");
let tree = renderCustomBracket({ format: "swiss", participants: teams8, matches: [] });
let txt = allText(tree);
assert.ok(txt.indexOf("Tạm xếp hạng — còn vòng đấu") !== -1, "0 matches → podium phải hiện 'Tạm xếp hạng'");
assert.ok(txt.indexOf("🥇") === -1, "0 matches → KHÔNG được hiện medal giả");
assert.ok(txt.indexOf("T1") === -1, "0 matches → KHÔNG được hiện ranking giả (T1)");

/* 2b. 4 matches Vòng 1, chưa có winner → phase "elimination" → tương tự */
const r1 = [
	{ stage: "Vòng 1", p1: "T1", p2: "T2" },
	{ stage: "Vòng 1", p1: "T3", p2: "T4" },
	{ stage: "Vòng 1", p1: "T5", p2: "T6" },
	{ stage: "Vòng 1", p1: "T7", p2: "T8" }
];
st = CustomStage.customComputeState(teams8, r1);
assert.strictEqual(st.phase, "elimination");
tree = renderCustomBracket({ format: "swiss", participants: teams8, matches: r1 });
txt = allText(tree);
assert.ok(txt.indexOf("Tạm xếp hạng — còn vòng đấu") !== -1, "Vòng 1 chưa có kết quả → podium 'Tạm xếp hạng'");
assert.ok(txt.indexOf("🥇") === -1, "Vòng 1 chưa có kết quả → KHÔNG được hiện medal giả");
const rankCardTxt = allText(ctx.renderCustomRanking(st));
["1.", "2.", "3.", "T1", "T2", "T3"].forEach(function (s) {
	assert.ok(rankCardTxt.indexOf(s) !== -1, "bảng xếp hạng chưa complete phải chứa " + s);
});
assert.ok(rankCardTxt.indexOf("🥇") === -1, "bảng xếp hạng chưa complete → số thứ tự 'N.', không medal");

/* 2c. full trace aaa.md → phase "complete" → podium hiện T1/T3/T5 (medal) */
const m = [];
function play(pairs, winners) {
	const round = m.reduce(function (max, x) { return Math.max(max, parseInt(String(x.stage).replace(/\D/g, ""), 10)); }, 0) + 1;
	pairs.forEach(function (p, i) {
		m.push({ stage: "Vòng " + round, p1: p[0], p2: p[1], sets: [[21, 15], [21, 18]], winner: winners[i] });
	});
}
let r = CustomStage.customCreateRound1(teams8);
play(r.pairs, ["T1", "T3", "T5", "T7"]); /* R1 */
r = CustomStage.customPairNextRound(teams8, m, 2);
play(r.pairs, ["T1", "T5", "T2", "T6"]); /* R2 */
r = CustomStage.customPairNextRound(teams8, m, 3);
play(r.pairs, ["T3", "T7"]); /* R3 */
r = CustomStage.customPairNextRound(teams8, m, 4);
play(r.pairs, ["T3"]); /* R4 */
r = CustomStage.customPairNextRound(teams8, m, 5);
play(r.pairs, ["T1"]); /* R5 */
r = CustomStage.customPairNextRound(teams8, m, 6);
play(r.pairs, ["T1", "T3"]); /* R6 */
st = CustomStage.customComputeState(teams8, m);
assert.strictEqual(st.phase, "complete");
assert.deepStrictEqual(st.ranking, ["T1", "T3", "T5"]);
tree = renderCustomBracket({ format: "swiss", participants: teams8, matches: m });
txt = allText(tree);
["🥇", "🥈", "🥉", "T1", "T3", "T5"].forEach(function (s) {
	assert.ok(txt.indexOf(s) !== -1, "complete → podium phải chứa " + s);
});
assert.ok(txt.indexOf("Đã loại") !== -1, "complete → podium phải hiện danh sách đã loại");
assert.ok(txt.indexOf("Tạm xếp hạng") === -1, "complete → KHÔNG còn 'Tạm xếp hạng'");

console.log("✅ Podium gating: (a) 0 matches, (b) Vòng 1 chưa kết quả, (c) full trace complete (T1/T3/T5) — PASS");
console.log("✅ Tất cả test reset + smoke podium đều PASS");