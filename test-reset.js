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
   2. Fixed bracket smoke — kết hợp renderCustomBracket (DOM stub)
      CustomStage + app.js được load nên test đúng hàm thật trong app.js
   ============================================================ */
const teams8 = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"];

/* 2a. 0 matches → phase "in-progress" → bracket hiện seed, không medal */
let st = CustomStage.computeFixedState(teams8, []);
assert.strictEqual(st.phase, "in-progress");
let tree = renderCustomBracket({ format: "swiss", participants: teams8, matches: [] });
let txt = allText(tree);
assert.ok(txt.indexOf("Vòng 1 — Seed") !== -1, "bracket phải có cột Vòng 1 — Seed");
assert.ok(txt.indexOf("Chung kết") !== -1, "bracket phải có cột Chung kết");
assert.ok(txt.indexOf("T1") !== -1 && txt.indexOf("T8") !== -1, "R1 phải hiện seed teams");
assert.ok(txt.indexOf("Thắng đi tiếp") !== -1, "bracket phải có legend");
assert.ok(txt.indexOf("Nhánh Thắng") !== -1, "R2 phải có nhãn Nhánh Thắng");
assert.ok(txt.indexOf("Nhánh Thua") !== -1, "R2 phải có nhãn Nhánh Thua");
assert.ok(txt.indexOf("Hạng 7-8") !== -1, "R2 phải có callout Hạng 7-8");
assert.ok(txt.indexOf("Hạng 5-6") !== -1, "R3 phải có callout Hạng 5-6");
assert.ok(txt.indexOf("Hạng 4") !== -1, "R4 phải có callout Hạng 4");
assert.ok(txt.indexOf("🥉 Hạng 3") === -1, "chưa complete → không medal đồng");
assert.ok(txt.indexOf("🏆 Hạng 1") === -1, "chưa complete → không medal chung kết");

/* 2b. 4 matches Vòng 1 chưa winner → phase in-progress, chưa loại ai */
const r1 = [
	{ stage: "Vòng 1", pos: "R1.1", p1: "T1", p2: "T2" },
	{ stage: "Vòng 1", pos: "R1.2", p1: "T3", p2: "T4" },
	{ stage: "Vòng 1", pos: "R1.3", p1: "T5", p2: "T6" },
	{ stage: "Vòng 1", pos: "R1.4", p1: "T7", p2: "T8" }
];
st = CustomStage.computeFixedState(teams8, r1);
assert.strictEqual(st.phase, "in-progress");
assert.deepStrictEqual(hostClone(st.eliminated), []); /* QUAN TRỌNG: hostClone — array tạo trong vm không cùng realm host */
tree = renderCustomBracket({ format: "swiss", participants: teams8, matches: r1 });
txt = allText(tree);
assert.ok(txt.indexOf("T1") !== -1 && txt.indexOf("T8") !== -1, "R1 teams hiển thị");
assert.ok(txt.indexOf("🥉 Hạng 3") === -1, "chưa complete → không medal đồng");
assert.ok(txt.indexOf("🏆 Hạng 1") === -1, "chưa complete → không medal chung kết");

/* 2c. full trace cố định (khớp aaa.md) → phase complete → bracket 🏆 + ranking T1/T3/T5 */
const full = [
	{ stage: "Vòng 1", pos: "R1.1", p1: "T1", p2: "T2", sets: [[21, 15], [21, 18]], winner: "T1" },
	{ stage: "Vòng 1", pos: "R1.2", p1: "T3", p2: "T4", sets: [[21, 15], [21, 18]], winner: "T3" },
	{ stage: "Vòng 1", pos: "R1.3", p1: "T5", p2: "T6", sets: [[21, 15], [21, 18]], winner: "T5" },
	{ stage: "Vòng 1", pos: "R1.4", p1: "T7", p2: "T8", sets: [[21, 15], [21, 18]], winner: "T7" },
	{ stage: "Vòng 2", pos: "R2.1", p1: "T1", p2: "T3", sets: [[21, 15], [21, 18]], winner: "T1" },
	{ stage: "Vòng 2", pos: "R2.2", p1: "T5", p2: "T7", sets: [[21, 15], [21, 18]], winner: "T5" },
	{ stage: "Vòng 2", pos: "R2.3", p1: "T2", p2: "T4", sets: [[21, 15], [21, 18]], winner: "T2" },
	{ stage: "Vòng 2", pos: "R2.4", p1: "T6", p2: "T8", sets: [[21, 15], [21, 18]], winner: "T6" },
	{ stage: "Vòng 3", pos: "R3.1", p1: "T3", p2: "T2", sets: [[21, 15], [21, 18]], winner: "T3" },
	{ stage: "Vòng 3", pos: "R3.2", p1: "T7", p2: "T6", sets: [[21, 15], [21, 18]], winner: "T7" },
	{ stage: "Vòng 4", pos: "R4.1", p1: "T3", p2: "T7", sets: [[21, 15], [21, 18]], winner: "T3" },
	{ stage: "Vòng 6", pos: "R6.1", p1: "T1", p2: "T5", sets: [[21, 15], [21, 18]], winner: "T1" },
	{ stage: "Vòng 5", pos: "R5.1", p1: "T3", p2: "T5", sets: [[21, 15], [21, 18]], winner: "T3" },
	{ stage: "Vòng 7", pos: "R7.1", p1: "T1", p2: "T3", sets: [[21, 15], [21, 18]], winner: "T1" }
];
st = CustomStage.computeFixedState(teams8, full);
assert.strictEqual(st.phase, "complete");
assert.deepStrictEqual(hostClone(st.ranking.slice(0, 3)), ["T1", "T3", "T5"]); /* hostClone — vm realm */
tree = renderCustomBracket({ format: "swiss", participants: teams8, matches: full });
txt = allText(tree);
assert.ok(txt.indexOf("🏆") !== -1, "complete → bracket phải hiện 🏆 chung kết");
assert.ok(txt.indexOf("🥉 Hạng 3") !== -1, "complete → R5 phải hiện 🥉 Hạng 3");
assert.ok(txt.indexOf("🏆 Hạng 1") !== -1, "complete → R7 phải hiện 🏆 Hạng 1");
assert.ok(txt.indexOf("T1") !== -1 && txt.indexOf("T3") !== -1, "R7 phải hiện T1 vs T3");
const rankTxt = allText(ctx.renderCustomRanking(st));
["🥇", "🥈", "🥉", "T1", "T3", "T5"].forEach(function (s) {
	assert.ok(rankTxt.indexOf(s) !== -1, "complete → bảng xếp hạng phải chứa " + s);
});
assert.ok(rankTxt.indexOf("Đã loại") !== -1, "complete → bảng xếp hạng phải hiện danh sách đã loại");

console.log("✅ Fixed bracket smoke: (a) 0 matches, (b) Vòng 1 chưa kết quả, (c) full trace complete (T1/T3/T5) — PASS");

/* ============================================================
   3. Fixed bracket UI helpers — ensureR1 / syncFixedBracket / assignSeed
   ============================================================ */
/* renderAll phụ thuộc DOM thật (data null) → stub để test data logic */
ctx.renderAll = function () {};

/* 3a. ensureR1: đủ 8 đội + chưa có R1 → tạo 4 trận R1 đúng seed order */
const c1 = { participants: teams8.slice(), matches: [] };
ctx.ensureR1(c1);
assert.strictEqual(c1.matches.length, 4, "ensureR1 tạo đúng 4 trận R1");
assert.deepStrictEqual(hostClone(c1.matches.map(function (m) { return m.pos; })), ["R1.1", "R1.2", "R1.3", "R1.4"]);
assert.deepStrictEqual(hostClone(c1.matches.map(function (m) { return m.p1 + "-" + m.p2; })), ["T1-T2", "T3-T4", "T5-T6", "T7-T8"]);

/* 3b. ensureR1: đã có R1 → không tạo thêm */
const c2 = { participants: teams8.slice(), matches: [{ stage: "Vòng 1", pos: "R1.1", p1: "T1", p2: "T2" }] };
ctx.ensureR1(c2);
assert.strictEqual(c2.matches.length, 1, "ensureR1 không tạo thêm khi đã có R1");

/* 3c. ensureR1: chưa đủ 8 đội → không tạo */
const c3 = { participants: ["T1", "T2", "T3"], matches: [] };
ctx.ensureR1(c3);
assert.strictEqual(c3.matches.length, 0, "ensureR1 không tạo khi chưa đủ 8 đội");

/* 3d. syncFixedBracket: sau R1 có kết quả → tạo R2.1-R2.4 đúng nhánh */
const c4 = {
	participants: teams8.slice(),
	matches: [
		{ stage: "Vòng 1", pos: "R1.1", p1: "T1", p2: "T2", winner: "T1" },
		{ stage: "Vòng 1", pos: "R1.2", p1: "T3", p2: "T4", winner: "T3" },
		{ stage: "Vòng 1", pos: "R1.3", p1: "T5", p2: "T6", winner: "T5" },
		{ stage: "Vòng 1", pos: "R1.4", p1: "T7", p2: "T8", winner: "T7" },
	]
};
ctx.syncFixedBracket(c4);
const c4ByPos = {};
c4.matches.forEach(function (m) { c4ByPos[m.pos] = m; });
assert.ok(c4ByPos["R2.1"], "syncFixedBracket tạo R2.1");
assert.strictEqual(c4ByPos["R2.1"].p1, "T1");
assert.strictEqual(c4ByPos["R2.1"].p2, "T3");
assert.strictEqual(c4ByPos["R2.2"].p1, "T5");
assert.strictEqual(c4ByPos["R2.2"].p2, "T7");
assert.strictEqual(c4ByPos["R2.3"].p1, "T2");
assert.strictEqual(c4ByPos["R2.3"].p2, "T4");
assert.strictEqual(c4ByPos["R2.4"].p1, "T6");
assert.strictEqual(c4ByPos["R2.4"].p2, "T8");

/* 3e. syncFixedBracket: không tạo R1 (R1 do seed) */
assert.strictEqual(c4.matches.filter(function (m) { return m.pos && m.pos.indexOf("R1.") === 0; }).length, 4, "syncFixedBracket không tạo R1 mới");

/* 3f. syncFixedBracket: cập nhật p1/p2 khi teams đổi theo kết quả */
const c5 = {
	participants: teams8.slice(),
	matches: [
		{ stage: "Vòng 1", pos: "R1.1", p1: "T1", p2: "T2", winner: "T1" },
		{ stage: "Vòng 1", pos: "R1.2", p1: "T3", p2: "T4", winner: "T3" },
		{ stage: "Vòng 2", pos: "R2.1", p1: "T1", p2: "T9", sets: null },
	]
};
ctx.syncFixedBracket(c5);
const r21 = c5.matches.find(function (m) { return m.pos === "R2.1"; });
assert.strictEqual(r21.p2, "T3", "syncFixedBracket cập nhật p2 theo kết quả R1");

/* 3g. assignSeed: đổi seed order + gọi ensureR1 */
const c6 = { participants: teams8.slice(), matches: [] };
ctx.assignSeed(c6, 1, "T5");
assert.strictEqual(c6.participants[0], "T5", "assignSeed đặt T5 vào seed 1");
assert.strictEqual(c6.participants.length, 8, "assignSeed giữ đủ 8 đội");
assert.strictEqual(c6.participants.indexOf("T5"), 0, "T5 không còn ở vị trí cũ");
assert.strictEqual(c6.matches.length, 4, "assignSeed gọi ensureR1 → tạo R1");

/* 3h. buildFixedMatchNode seedMode: R1 trống → 2 seed-slot có data-seed */
const bEmpty = CustomStage.buildFixedBracket([], []).find(function (b) { return b.pos === "R1.1"; });
const seedNode = ctx.buildFixedMatchNode({ format: "swiss", participants: [], matches: [] }, bEmpty, {}, true);
assert.strictEqual(seedNode.getAttribute("data-pos"), "R1.1", "card phải có data-pos");
const slots = seedNode.children.filter(function (c) { return c.className.indexOf("seed-slot") !== -1; });
assert.strictEqual(slots.length, 2, "seedMode R1 phải có 2 seed-slot");
assert.strictEqual(String(slots[0].getAttribute("data-seed")), "1");
assert.strictEqual(String(slots[1].getAttribute("data-seed")), "2");
assert.ok(allText(seedNode).indexOf("Seed 1") !== -1 && allText(seedNode).indexOf("Seed 2") !== -1, "seed-slot trống hiện Seed N");

/* 3i. renderSeedPool → 8 chip seed-chip có data-team */
const pool = ctx.renderSeedPool({ format: "swiss", participants: teams8, matches: [] }, teams8);
const chips = pool.children.filter(function (c) { return c.className.indexOf("seed-chip") !== -1; });
assert.strictEqual(chips.length, 8, "seed pool phải có 8 chip");
assert.strictEqual(chips[0].getAttribute("data-team"), "T1");
assert.strictEqual(chips[7].getAttribute("data-team"), "T8");

console.log("✅ Fixed bracket UI helpers: ensureR1 / syncFixedBracket / assignSeed / seed slots — PASS");
console.log("✅ Tất cả test reset + smoke bracket đều PASS");