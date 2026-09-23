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

/* makeEl variant: capture addEventListener → handler onclick gọi được (test handler thật) */
function makeElCapture(tag) {
	const e = makeEl(tag);
	e.addEventListener = function (type, fn) { this["on" + type] = fn; };
	return e;
}

const sandbox = {
	console: console,
	document: {
		body: makeEl("body"),
		documentElement: makeEl("html"),
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
runInContext(readFileSync(join(__dirname, "swiss-core.js"), "utf8"), ctx);
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

/* (e) reset phải xoá seedFilled khi seed không có seedFilled (ngăn ensureR1 tái tạo R1 sau reset) */
const contentE = { label: "cũ", format: "swiss", participants: ["A"], matches: ["m"], unassignedPairs: [], seedFilled: [true, true, true, true, true, true, true, true] };
const seedE = { label: "Đôi nam nữ", format: "swiss", participants: ["A", "B"], matches: [], unassignedPairs: [] };
applySeedToContent(contentE, seedE);
assert.deepStrictEqual(hostClone(contentE.seedFilled), [], "reset phải xoá seedFilled khi seed không có seedFilled");

/* (f) seed có seedFilled → khôi phục seedFilled từ seed */
const contentF = { participants: [], matches: [], unassignedPairs: [], seedFilled: [] };
const seedF = { participants: ["A"], matches: [], unassignedPairs: [], seedFilled: [true] };
applySeedToContent(contentF, seedF);
assert.deepStrictEqual(hostClone(contentF.seedFilled), [true], "seed có seedFilled → khôi phục từ seed");

/* (g) reset custom-stage (8 cặp, marker customStage) → 8 cặp về danh sách chờ (giống nội dung đơn):
   participants = [] (bracket trống), unassignedPairs = 8 cặp, marker giữ lại */
const pairs8 = ["P1-P2", "P3-P4", "P5-P6", "P7-P8", "P9-P10", "P11-P12", "P13-P14", "P15-P16"];
const contentG = {
	label: "cũ", format: "swiss", scoringNote: "n", customStage: true,
	participants: ["A-B", "C-D"], matches: [{ stage: "Vòng 1", pos: "R1.1" }],
	unassignedPairs: ["X-Y"], seedFilled: [true, true, true, true]
};
const seedG = {
	label: "Đôi nam nữ · Nhóm 1", format: "swiss", scoringNote: "note gốc",
	customStage: true, participants: pairs8.slice(), matches: [], unassignedPairs: []
};
applySeedToContent(contentG, seedG);
assert.deepStrictEqual(hostClone(contentG.participants), [], "reset custom-stage → participants = [] (bracket trống)");
assert.deepStrictEqual(hostClone(contentG.unassignedPairs), pairs8, "reset custom-stage → 8 cặp về danh sách chờ");
assert.strictEqual(contentG.customStage, true, "reset giữ marker customStage (isCustomStage vẫn true dù participants rỗng)");
assert.deepStrictEqual(hostClone(contentG.matches), [], "reset custom-stage → matches = []");
assert.deepStrictEqual(hostClone(contentG.seedFilled), [], "reset custom-stage → seedFilled = []");

/* (g2) seed swiss + 8 đội KHÔNG marker (data cũ) → cũng chuyển về danh sách chờ + tự gắn marker */
const seedG2 = { label: "L", format: "swiss", scoringNote: "n", participants: pairs8.slice(), matches: [], unassignedPairs: [] };
const contentG2 = { label: "cũ", format: "swiss", customStage: true, participants: ["Q"], matches: ["m"], unassignedPairs: [], seedFilled: [true] };
applySeedToContent(contentG2, seedG2);
assert.deepStrictEqual(hostClone(contentG2.unassignedPairs), pairs8, "swiss 8 đội không marker → vẫn chuyển 8 cặp về danh sách chờ");
assert.deepStrictEqual(hostClone(contentG2.participants), [], "swiss 8 đội không marker → participants = []");
assert.strictEqual(contentG2.customStage, true, "seed 8 đội không marker → content vẫn được gắn marker customStage");

console.log("✅ applySeedToContent: (a) seed đầy đủ, (b) seed thiếu unassignedPairs, (c) không seed, (d) copy mảng, (e) reset seedFilled, (f) khôi phục seedFilled, (g) reset custom-stage → danh sách chờ, (g2) swiss 8 không marker — PASS");

/* ============================================================
   2. Fixed bracket smoke — kết hợp renderCustomBracket (DOM stub)
      CustomStage + app.js được load nên test đúng hàm thật trong app.js
   ============================================================ */
const teams8 = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"];

/* 2a. 0 matches → phase "in-progress" → R1 TRỐNG (Hạt Giống N placeholder, không vẽ cặp từ seed), không medal */
let st = CustomStage.computeFixedState(teams8, []);
assert.strictEqual(st.phase, "in-progress");
let tree = renderCustomBracket({ format: "swiss", participants: teams8, matches: [] });
let txt = allText(tree);
assert.ok(txt.indexOf("VÒNG 1 (R1)") !== -1, "bracket phải có header VÒNG 1 (R1)");
assert.ok(txt.indexOf("Khai Mạc (0-0)") !== -1, "R1 phải có sub Khai Mạc (0-0)");
assert.ok(txt.indexOf("VÒNG 7 (R7)") !== -1, "bracket phải có header VÒNG 7 (R7)");
assert.ok(txt.indexOf("CHUNG KẾT TỔNG") !== -1, "R7 phải có tiêu đề CHUNG KẾT TỔNG");
assert.ok(txt.indexOf("GRAND FINAL") !== -1, "R7 phải có badge GRAND FINAL");
assert.ok(txt.indexOf("Hạt Giống 1") !== -1 && txt.indexOf("Hạt Giống 8") !== -1, "R1 trống → hiện Hạt Giống N placeholder");
assert.ok(txt.indexOf("T1") === -1, "R1 trống → KHÔNG hiện cặp đấu từ seed (sau reset)");
assert.ok(txt.indexOf("Thắng đi tiếp") !== -1, "bracket phải có legend (giữ chữ Thắng đi tiếp)");
assert.ok(txt.indexOf("Nhánh Thắng (1-0)") !== -1, "R2 phải có nhãn Nhánh Thắng (1-0)");
assert.ok(txt.indexOf("Nhánh Thua (0-1)") !== -1, "R2 phải có nhãn Nhánh Thua (0-1)");
assert.ok(txt.indexOf("ĐIỂM THOÁT") !== -1 && txt.indexOf("HẠNG 7-8") !== -1, "R2 phải có callout ĐIỂM THOÁT • HẠNG 7-8");
assert.ok(txt.indexOf("HẠNG 5-6") !== -1, "R3 phải có callout HẠNG 5-6");
assert.ok(txt.indexOf("HẠNG 4") !== -1, "R4 phải có callout HẠNG 4");
assert.ok(txt.indexOf("🥉 HẠNG 3") === -1, "chưa complete → không medal đồng");
assert.ok(txt.indexOf("🏆 HẠNG 1") === -1, "chưa complete → không medal chung kết");

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
assert.ok(txt.indexOf("Thắng ➔") !== -1, "card phải có flow hint Thắng ➔ …");
assert.ok(txt.indexOf("Thua ➔") !== -1, "card phải có flow hint Thua ➔ …");
assert.ok(txt.indexOf("🥉 HẠNG 3") === -1, "chưa complete → không medal đồng");
assert.ok(txt.indexOf("🏆 HẠNG 1") === -1, "chưa complete → không medal chung kết");

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
assert.ok(txt.indexOf("🥉 HẠNG 3") !== -1, "complete → R5 phải hiện 🥉 HẠNG 3");
assert.ok(txt.indexOf("🏆 HẠNG 1") !== -1, "complete → R7 phải hiện 🏆 HẠNG 1");
assert.ok(txt.indexOf("T1") !== -1 && txt.indexOf("T3") !== -1, "R7 phải hiện T1 vs T3");
assert.ok(txt.indexOf("THẮNG") !== -1, "complete → side tag THẮNG phải xuất hiện");
assert.ok(txt.indexOf("THUA") !== -1, "complete → side tag THUA phải xuất hiện");
assert.ok(txt.indexOf("BỊ LOẠI") !== -1, "complete → side tag BỊ LOẠI phải xuất hiện");
const rankTxt = allText(ctx.renderCustomRanking(st));
["🥇", "🥈", "🥉", "T1", "T3", "T5"].forEach(function (s) {
	assert.ok(rankTxt.indexOf(s) !== -1, "complete → bảng xếp hạng phải chứa " + s);
});
assert.ok(rankTxt.indexOf("Đã loại") !== -1, "complete → bảng xếp hạng phải hiện danh sách đã loại");

console.log("✅ Fixed bracket smoke: (a) 0 matches, (b) Vòng 1 chưa kết quả, (c) full trace complete (T1/T3/T5) — PASS");

/* ============================================================
   2d. Fixed bracket 6 đội — renderCustomBracket6 (linh hoạt Case A/B)
   ============================================================ */
const teams6 = ["A1", "A2", "A3", "A4", "A5", "A6"];

/* 2d1. 0 matches → Case A mặc định, 5 vòng, R1 trống, không medal */
let tree6 = renderCustomBracket({ format: "swiss", customStage: true, participants: teams6, matches: [] });
let txt6 = allText(tree6);
assert.ok(txt6.indexOf("VÒNG 1 (R1)") !== -1, "6 đội: phải có header VÒNG 1 (R1)");
assert.ok(txt6.indexOf("VÒNG 5 (R5)") !== -1, "6 đội: phải có header VÒNG 5 (R5)");
assert.ok(txt6.indexOf("CHUNG KẾT TỔNG") !== -1, "6 đội: R5 phải có CHUNG KẾT TỔNG");
assert.ok(txt6.indexOf("GRAND FINAL") !== -1, "6 đội: R5 phải có badge GRAND FINAL");
assert.ok(txt6.indexOf("Case A") !== -1, "6 đội: chưa có R2.1 → badge Case A");
assert.ok(txt6.indexOf("Trận Chéo (1-0 vs 0-1)") !== -1, "6 đội: R2 phải có nhóm Trận Chéo");
assert.ok(txt6.indexOf("Nhánh Thắng (1-0)") !== -1, "6 đội: R2 phải có Nhánh Thắng (1-0)");
assert.ok(txt6.indexOf("Nhánh Thua (0-1)") !== -1, "6 đội: R2 phải có Nhánh Thua (0-1)");
assert.ok(txt6.indexOf("HẠNG 6") !== -1, "6 đội Case A: R2 callout ĐIỂM THOÁT • HẠNG 6");
assert.ok(txt6.indexOf("HẠNG 4-5") !== -1, "6 đội Case A: R3 callout HẠNG 4-5");
assert.ok(txt6.indexOf("Hạt Giống 6") !== -1, "6 đội: R1 trống → Hạt Giống 6 placeholder");
assert.ok(txt6.indexOf("🏆 HẠNG 1") === -1, "6 đội: chưa complete → không medal chung kết");

/* 2d2. Case A full trace → complete → 🏆 + 🥉 + badge Case A */
const full6A = [
	{ stage: "Vòng 1", pos: "R1.1", p1: "A1", p2: "A2", sets: [[21, 15], [21, 18]], winner: "A1" },
	{ stage: "Vòng 1", pos: "R1.2", p1: "A3", p2: "A4", sets: [[21, 15], [21, 18]], winner: "A3" },
	{ stage: "Vòng 1", pos: "R1.3", p1: "A5", p2: "A6", sets: [[21, 15], [21, 18]], winner: "A5" },
	{ stage: "Vòng 2", pos: "R2.1", p1: "A1", p2: "A4", sets: [[21, 15], [21, 18]], winner: "A4" },
	{ stage: "Vòng 2", pos: "R2.2", p1: "A3", p2: "A5", sets: [[21, 15], [21, 18]], winner: "A3" },
	{ stage: "Vòng 2", pos: "R2.3", p1: "A2", p2: "A6", sets: [[21, 15], [21, 18]], winner: "A2" },
	{ stage: "Vòng 3", pos: "R3.1", p1: "A1", p2: "A2", sets: [[21, 15], [21, 18]], winner: "A1" },
	{ stage: "Vòng 3", pos: "R3.2", p1: "A4", p2: "A5", sets: [[21, 15], [21, 18]], winner: "A4" },
	{ stage: "Vòng 4", pos: "R4.1", p1: "A1", p2: "A4", sets: [[21, 15], [21, 18]], winner: "A1" },
	{ stage: "Vòng 5", pos: "R5.1", p1: "A3", p2: "A1", sets: [[21, 15], [21, 18]], winner: "A1" },
];
let st6 = CustomStage.computeFixedState6(teams6, full6A);
assert.strictEqual(st6.phase, "complete");
assert.deepStrictEqual(hostClone(st6.ranking.slice(0, 3)), ["A1", "A3", "A4"], "Case A ranking: A1/A3/A4");
tree6 = renderCustomBracket({ format: "swiss", customStage: true, participants: teams6, matches: full6A });
txt6 = allText(tree6);
assert.ok(txt6.indexOf("🏆 HẠNG 1") !== -1, "6 đội complete → medal chung kết");
assert.ok(txt6.indexOf("🥉 HẠNG 3") !== -1, "6 đội complete → medal đồng");
assert.ok(txt6.indexOf("Case A") !== -1, "6 đội full A → badge Case A");

/* 2d3. Case B full trace → complete → badge Case B + R3 sub 2-0 vs 2-0 */
const full6B = [
	{ stage: "Vòng 1", pos: "R1.1", p1: "A1", p2: "A2", sets: [[21, 15], [21, 18]], winner: "A1" },
	{ stage: "Vòng 1", pos: "R1.2", p1: "A3", p2: "A4", sets: [[21, 15], [21, 18]], winner: "A3" },
	{ stage: "Vòng 1", pos: "R1.3", p1: "A5", p2: "A6", sets: [[21, 15], [21, 18]], winner: "A5" },
	{ stage: "Vòng 2", pos: "R2.1", p1: "A1", p2: "A4", sets: [[21, 15], [21, 18]], winner: "A1" },
	{ stage: "Vòng 2", pos: "R2.2", p1: "A3", p2: "A5", sets: [[21, 15], [21, 18]], winner: "A3" },
	{ stage: "Vòng 2", pos: "R2.3", p1: "A2", p2: "A6", sets: [[21, 15], [21, 18]], winner: "A2" },
	{ stage: "Vòng 3", pos: "R3.1", p1: "A1", p2: "A3", sets: [[21, 15], [21, 18]], winner: "A1" },
	{ stage: "Vòng 3", pos: "R3.2", p1: "A5", p2: "A2", sets: [[21, 15], [21, 18]], winner: "A2" },
	{ stage: "Vòng 4", pos: "R4.1", p1: "A3", p2: "A2", sets: [[21, 15], [21, 18]], winner: "A3" },
	{ stage: "Vòng 5", pos: "R5.1", p1: "A1", p2: "A3", sets: [[21, 15], [21, 18]], winner: "A1" },
];
st6 = CustomStage.computeFixedState6(teams6, full6B);
assert.strictEqual(st6.phase, "complete");
assert.deepStrictEqual(hostClone(st6.ranking.slice(0, 3)), ["A1", "A3", "A2"], "Case B ranking: A1/A3/A2");
tree6 = renderCustomBracket({ format: "swiss", customStage: true, participants: teams6, matches: full6B });
txt6 = allText(tree6);
assert.ok(txt6.indexOf("Case B") !== -1, "6 đội full B → badge Case B");
assert.ok(txt6.indexOf("2-0 vs 2-0") !== -1, "6 đội Case B: R3 sub phải là 2-0 vs 2-0");
assert.ok(txt6.indexOf("HẠNG 5-6") !== -1, "6 đội Case B: R2 callout ĐIỂM THOÁT • HẠNG 5-6");
assert.ok(txt6.indexOf("HẠNG 4") !== -1, "6 đội Case B: R3 callout HẠNG 4");

console.log("✅ Fixed bracket 6 đội smoke: (a) 0 matches Case A, (b) full Case A, (c) full Case B — PASS");

/* ============================================================
   3. Fixed bracket UI helpers — ensureR1 / syncFixedBracket / assignSeed
   ============================================================ */
/* renderAll phụ thuộc DOM thật (data null) → stub để test data logic */
ctx.renderAll = function () {};

/* 3a. ensureR1: đủ 8 đội + đủ 8 seed filled + chưa có R1 → tạo 4 trận R1 đúng seed order */
const c1 = { participants: teams8.slice(), matches: [], seedFilled: [true, true, true, true, true, true, true, true] };
ctx.ensureR1(c1);
assert.strictEqual(c1.matches.length, 4, "ensureR1 tạo đúng 4 trận R1");
assert.deepStrictEqual(hostClone(c1.matches.map(function (m) { return m.pos; })), ["R1.1", "R1.2", "R1.3", "R1.4"]);
assert.deepStrictEqual(hostClone(c1.matches.map(function (m) { return m.p1 + "-" + m.p2; })), ["T1-T2", "T3-T4", "T5-T6", "T7-T8"]);

/* 3a2. ensureR1: đủ 8 đội nhưng chưa đủ 8 seed filled → không tạo R1 */
const c1b = { participants: teams8.slice(), matches: [], seedFilled: [true] };
ctx.ensureR1(c1b);
assert.strictEqual(c1b.matches.length, 0, "ensureR1 không tạo khi chưa đủ 8 seed filled");

/* 3b. ensureR1: đã có R1 → không tạo thêm */
const c2 = { participants: teams8.slice(), matches: [{ stage: "Vòng 1", pos: "R1.1", p1: "T1", p2: "T2" }] };
ctx.ensureR1(c2);
assert.strictEqual(c2.matches.length, 1, "ensureR1 không tạo thêm khi đã có R1");

/* 3c. ensureR1: chưa đủ 8 đội → không tạo */
const c3 = { participants: ["T1", "T2", "T3"], matches: [] };
ctx.ensureR1(c3);
assert.strictEqual(c3.matches.length, 0, "ensureR1 không tạo khi chưa đủ 8 đội");

/* 3c2. ensureR1: 6 đội + đủ 6 seed filled → tạo 3 trận R1 đúng seed order */
const c3b = { participants: teams6.slice(), matches: [], seedFilled: [true, true, true, true, true, true] };
ctx.ensureR1(c3b);
assert.strictEqual(c3b.matches.length, 3, "ensureR1 6 đội tạo đúng 3 trận R1");
assert.deepStrictEqual(hostClone(c3b.matches.map(function (m) { return m.pos; })), ["R1.1", "R1.2", "R1.3"]);
assert.deepStrictEqual(hostClone(c3b.matches.map(function (m) { return m.p1 + "-" + m.p2; })), ["A1-A2", "A3-A4", "A5-A6"]);

/* 3c3. ensureR1: 6 đội nhưng chưa đủ 6 seed filled → không tạo */
const c3c = { participants: teams6.slice(), matches: [], seedFilled: [true, true, true] };
ctx.ensureR1(c3c);
assert.strictEqual(c3c.matches.length, 0, "ensureR1 6 đội không tạo khi chưa đủ 6 seed filled");

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

/* 3e2. syncFixedBracket 6 đội: sau R1 có kết quả → tạo R2.1-R2.3 đúng nhánh (chéo) */
const c4b = {
	participants: teams6.slice(),
	matches: [
		{ stage: "Vòng 1", pos: "R1.1", p1: "A1", p2: "A2", winner: "A1" },
		{ stage: "Vòng 1", pos: "R1.2", p1: "A3", p2: "A4", winner: "A3" },
		{ stage: "Vòng 1", pos: "R1.3", p1: "A5", p2: "A6", winner: "A5" },
	]
};
ctx.syncFixedBracket(c4b);
const c4bByPos = {};
c4b.matches.forEach(function (m) { c4bByPos[m.pos] = m; });
assert.ok(c4bByPos["R2.1"], "syncFixedBracket 6 đội tạo R2.1");
assert.strictEqual(c4bByPos["R2.1"].p1, "A1", "R2.1 = W R1.1");
assert.strictEqual(c4bByPos["R2.1"].p2, "A4", "R2.1 = L R1.2 (trận chéo)");
assert.strictEqual(c4bByPos["R2.2"].p1, "A3", "R2.2 = W R1.2");
assert.strictEqual(c4bByPos["R2.2"].p2, "A5", "R2.2 = W R1.3");
assert.strictEqual(c4bByPos["R2.3"].p1, "A2", "R2.3 = L R1.1");
assert.strictEqual(c4bByPos["R2.3"].p2, "A6", "R2.3 = L R1.3");

/* 3e3. syncFixedBracket 6 đội: R2.1 có kết quả → tạo R3 theo case (A: 1-1 vs 1-1) */
const c4c = {
	participants: teams6.slice(),
	matches: [
		{ stage: "Vòng 1", pos: "R1.1", p1: "A1", p2: "A2", winner: "A1" },
		{ stage: "Vòng 1", pos: "R1.2", p1: "A3", p2: "A4", winner: "A3" },
		{ stage: "Vòng 1", pos: "R1.3", p1: "A5", p2: "A6", winner: "A5" },
		{ stage: "Vòng 2", pos: "R2.1", p1: "A1", p2: "A4", winner: "A4" },
		{ stage: "Vòng 2", pos: "R2.2", p1: "A3", p2: "A5", winner: "A3" },
		{ stage: "Vòng 2", pos: "R2.3", p1: "A2", p2: "A6", winner: "A2" },
	]
};
ctx.syncFixedBracket(c4c);
const c4cByPos = {};
c4c.matches.forEach(function (m) { c4cByPos[m.pos] = m; });
assert.strictEqual(c4cByPos["R3.1"].p1, "A1", "Case A R3.1 = L R2.1");
assert.strictEqual(c4cByPos["R3.1"].p2, "A2", "Case A R3.1 = W R2.3");
assert.strictEqual(c4cByPos["R3.2"].p1, "A4", "Case A R3.2 = W R2.1");
assert.strictEqual(c4cByPos["R3.2"].p2, "A5", "Case A R3.2 = L R2.2");
assert.ok(!c4cByPos["R4.1"], "Case A chưa có kết quả R3 → chưa tạo R4.1");

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

/* 3g. assignSeed model MỚI: sau reset → participants=[], 8 cặp nằm ở unassignedPairs → kéo dần vào seed */
const c6 = { format: "swiss", customStage: true, participants: [], unassignedPairs: teams8.slice(), seedFilled: [], matches: [] };
const assignOrder = [[1, "T5"], [8, "T8"], [2, "T1"], [7, "T7"], [3, "T2"], [6, "T6"], [4, "T3"], [5, "T4"]];
ctx.assignSeed(c6, assignOrder[0][0], assignOrder[0][1]);
assert.strictEqual(c6.participants[0], "T5", "assignSeed đặt T5 vào seed 1");
assert.strictEqual(c6.unassignedPairs.indexOf("T5"), -1, "T5 rời danh sách chờ");
assert.strictEqual(c6.unassignedPairs.length, 7, "danh sách chờ còn 7 cặp");
assert.strictEqual(c6.matches.length, 0, "kéo 1 cặp → CHƯA tạo R1");
/* kéo đủ 8 (thứ tự gán lộn xộn) → R1 sinh đúng theo vị trí seed */
assignOrder.slice(1).forEach(function (a) { ctx.assignSeed(c6, a[0], a[1]); });
assert.deepStrictEqual(hostClone(c6.participants), ["T5", "T1", "T2", "T3", "T4", "T6", "T7", "T8"], "participants theo đúng thứ tự seed dù gán lộn xộn");
assert.strictEqual(c6.unassignedPairs.length, 0, "danh sách chờ rỗng khi đã gán đủ 8");
assert.strictEqual(c6.matches.length, 4, "đủ 8 seed → tạo đúng 4 trận R1");
const c6ByPos = {};
c6.matches.forEach(function (m) { c6ByPos[m.pos] = m; });
assert.strictEqual(c6ByPos["R1.1"].p1 + "-" + c6ByPos["R1.1"].p2, "T5-T1", "R1.1 = seed 1 vs seed 2");
assert.strictEqual(c6ByPos["R1.4"].p1 + "-" + c6ByPos["R1.4"].p2, "T7-T8", "R1.4 = seed 7 vs seed 8");

/* 3g2. tương thích state CŨ (chưa reset): participants đủ 8, unassignedPairs rỗng → vẫn đổi seed được, không nhân bản đội */
const c9 = { participants: teams8.slice(), matches: [], seedFilled: [true, true, false, false, false, false, false, false] };
ctx.assignSeed(c9, 3, "T8");
assert.strictEqual(c9.participants[2], "T8", "state cũ: T8 về seed 3");
assert.strictEqual(c9.participants.filter(function (t) { return t === "T8"; }).length, 1, "không nhân bản đội khi đổi seed");
assert.strictEqual(c9.participants.length, 8, "state cũ: giữ đủ 8 đội");
assert.strictEqual(c9.matches.length, 0, "state cũ: seedFilled chưa đủ 8 → chưa tạo R1");

/* 3j. unassignSeed: gỡ cặp khỏi seed → về danh sách chờ + xoá R1 (chưa ghi kết quả); gán lại → R1 sinh lại */
assert.ok(ctx.unassignSeed, "unassignSeed phải tồn tại sau khi load app.js");
const c8 = { format: "swiss", customStage: true, participants: [], unassignedPairs: teams8.slice(), seedFilled: [], matches: [] };
teams8.forEach(function (t, i) { ctx.assignSeed(c8, i + 1, t); });
assert.strictEqual(c8.matches.length, 4, "gán đủ 8 → R1 tồn tại trước khi unassign");
ctx.unassignSeed(c8, 1);
assert.strictEqual(c8.participants[0], "", "unassignSeed dọn slot seed 1 (giữ vị trí các seed còn lại)");
assert.ok(!c8.seedFilled[0], "unassignSeed xoá seedFilled[0]");
assert.deepStrictEqual(hostClone(c8.unassignedPairs), ["T1"], "cặp T1 trở lại danh sách chờ");
assert.strictEqual(c8.matches.filter(function (m) { return m.pos && m.pos.indexOf("R1.") === 0; }).length, 0, "unassign khi R1 chưa có kết quả → xoá R1");
ctx.assignSeed(c8, 1, "T1");
assert.strictEqual(c8.matches.length, 4, "gán lại đủ 8 → R1 sinh lại");
assert.deepStrictEqual(hostClone(c8.participants), teams8, "thứ tự seed khôi phục sau khi gán lại");
assert.strictEqual(c8.unassignedPairs.length, 0, "danh sách chờ rỗng sau khi gán lại");

/* 3k. Nhập kết quả R1 ở mục "Lịch thi đấu & kết quả" (edit mode) → R2 phải tự sinh.
   Bugfix: renderMatchCard (commitScore / quick-win / Xoá kết quả / commitPlayers) không gọi
   syncFixedBracket → R2+ không bao giờ xuất hiện ở mục Lịch thi đấu.
   Test gọi handler thật (quick-win 🏆) qua DOM stub capture addEventListener. */
{
	const sandbox2 = {
		console: console,
		document: {
			body: makeEl("body"),
			documentElement: makeEl("html"),
			getElementById: function () { return makeEl("div"); },
			createElement: function (tag) { return makeElCapture(tag); },
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
		fetch: function () { return new Promise(function () {}); },
		addEventListener: function () {}
	};
	sandbox2.window = sandbox2;
	const ctx2 = createContext(sandbox2);
	runInContext(customStageSrc, ctx2);
	runInContext(readFileSync(join(__dirname, "swiss-core.js"), "utf8"), ctx2);
	/* editMode là let lexical → không set qua ctx. Load lại với var để test handler edit-mode. */
	runInContext(appSrc.replace("let editMode = false;", "var editMode = false;"), ctx2);
	ctx2.saveData = function () {};
	ctx2.renderAll = function () {};
	ctx2.editMode = true;

	const c10 = { format: "swiss", customStage: true, participants: [], unassignedPairs: teams8.slice(), seedFilled: [], matches: [] };
	teams8.forEach(function (t, i) { ctx2.assignSeed(c10, i + 1, t); });
	const r1List = c10.matches.filter(function (m) { return m.pos && m.pos.indexOf("R1.") === 0; });
	assert.strictEqual(r1List.length, 4, "setup 3k: R1 có 4 trận sau khi gán seed");

	function clickQuickWin(m, content) {
		const card = ctx2.renderMatchCard(m, content);
		function nodeText(node) {
			let t = "";
			if (typeof node.textContent === "string") t += node.textContent;
			(node.children || []).forEach(function (c) { t += nodeText(c); });
			return t;
		}
		let btn = null;
		(function walk(node) {
			if (btn) return;
			if (node && typeof node.onclick === "function" && nodeText(node).indexOf("🏆") !== -1) { btn = node; return; }
			(node.children || []).forEach(walk);
		})(card);
		assert.ok(btn, "card R1 phải có nút quick-win 🏆");
		btn.onclick();
	}
	clickQuickWin(r1List[0], c10); /* R1.1 → T1 thắng */
	clickQuickWin(r1List[1], c10); /* R1.2 → T3 thắng */
	const r21 = c10.matches.find(function (m) { return m.pos === "R2.1"; });
	assert.ok(r21, "nhập kết quả R1 ở mục Lịch thi đấu → R2.1 tự sinh");
	assert.strictEqual(r21.p1, "T1", "R2.1.p1 = thắng R1.1");
	assert.strictEqual(r21.p2, "T3", "R2.1.p2 = thắng R1.2");
	console.log("✅ 3k: nhập kết quả R1 ở mục Lịch thi đấu → R2 tự sinh — PASS");
}

/* 3h. buildFixedMatchNode seedMode: R1 trống → 2 seed-slot có data-seed */
const bEmpty = CustomStage.buildFixedBracket([], []).find(function (b) { return b.pos === "R1.1"; });
const seedNode = ctx.buildFixedMatchNode({ format: "swiss", participants: [], matches: [] }, bEmpty, {}, true);
assert.strictEqual(seedNode.getAttribute("data-pos"), "R1.1", "card phải có data-pos");
const slots = seedNode.children.filter(function (c) { return c.className.indexOf("seed-slot") !== -1; });
assert.strictEqual(slots.length, 2, "seedMode R1 phải có 2 seed-slot");
assert.strictEqual(String(slots[0].getAttribute("data-seed")), "1");
assert.strictEqual(String(slots[1].getAttribute("data-seed")), "2");
assert.ok(allText(seedNode).indexOf("Hạt Giống 1") !== -1 && allText(seedNode).indexOf("Hạt Giống 2") !== -1, "seed-slot trống hiện Hạt Giống N");

/* 3h2. seedMode sau reset: đủ 8 participants nhưng seedFilled trống → slot TRỐNG (không hiện team từ seed) */
const bSeed = CustomStage.buildFixedBracket(teams8, []).find(function (b) { return b.pos === "R1.1"; });
const seedNodeReset = ctx.buildFixedMatchNode({ format: "swiss", participants: teams8, matches: [], seedFilled: [] }, bSeed, {}, true);
const slotsReset = seedNodeReset.children.filter(function (c) { return c.className.indexOf("seed-slot") !== -1; });
assert.strictEqual(slotsReset.length, 2, "seedMode R1 phải có 2 seed-slot");
assert.ok(allText(seedNodeReset).indexOf("T1") === -1, "seedFilled trống → slot KHÔNG hiện team");
assert.ok(allText(seedNodeReset).indexOf("Hạt Giống 1") !== -1 && allText(seedNodeReset).indexOf("Hạt Giống 2") !== -1, "seedFilled trống → slot hiện Hạt Giống N");

/* 3h3. seedMode: seedFilled[0]=true → slot 1 hiện team, slot 2 vẫn trống */
const seedNodeFilled = ctx.buildFixedMatchNode({ format: "swiss", participants: teams8, matches: [], seedFilled: [true] }, bSeed, {}, true);
assert.ok(allText(seedNodeFilled).indexOf("T1") !== -1, "seedFilled[0]=true → slot 1 hiện T1");
assert.ok(allText(seedNodeFilled).indexOf("Hạt Giống 2") !== -1, "seedFilled[1] chưa fill → slot 2 hiện Hạt Giống 2");

/* 3i. renderSeedPool(content) — 1 arg, render từ unassignedPairs, dùng class pool-chip của nội dung đơn */
const pool = ctx.renderSeedPool({ format: "swiss", customStage: true, participants: [], unassignedPairs: teams8.slice(), matches: [] });
const chipsWrap = pool.children.filter(function (c) { return c.className === "pool-chips"; })[0];
assert.ok(chipsWrap, "seed pool phải có wrapper pool-chips");
const chips = chipsWrap.children.filter(function (c) { return String(c.className).split(" ").indexOf("pool-chip") !== -1; });
assert.strictEqual(chips.length, 8, "seed pool phải có 8 pool-chip");
assert.strictEqual(chips[0].getAttribute("data-team"), "T1");
assert.strictEqual(chips[7].getAttribute("data-team"), "T8");

console.log("✅ Fixed bracket UI helpers: ensureR1 / syncFixedBracket / assignSeed (model mới) / unassignSeed / seed slots / seed pool — PASS");

/* ============================================================
   4. isCustomStage — marker customStage + tương thích participants.length === 8
   ============================================================ */
assert.strictEqual(ctx.isCustomStage({ format: "swiss", customStage: true, participants: [] }), true, "marker customStage + participants rỗng → custom (sau reset)");
assert.strictEqual(ctx.isCustomStage({ format: "swiss", participants: teams8 }), true, "tương thích: swiss + 8 đội không marker → custom");
assert.strictEqual(ctx.isCustomStage({ format: "swiss", participants: [] }), false, "không marker + participants rỗng → không custom");
assert.strictEqual(ctx.isCustomStage({ format: "group", customStage: true, participants: [] }), false, "format group → không custom bất kể marker");
console.log("✅ isCustomStage: marker / tương thích 8 đội / không custom / group — PASS");

/* ============================================================
   5. Theme helpers — getTheme / setTheme / initTheme (localStorage round-trip)
   ============================================================ */
{
	const store = {};
	sandbox.localStorage = { getItem: function (k) { return (k in store) ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; } };
	/* mặc định dark khi chưa lưu */
	assert.strictEqual(ctx.getTheme(), "dark", "chưa lưu preference → dark");
	/* set light → persist + data-theme trên documentElement */
	assert.strictEqual(ctx.setTheme("light"), "light", "setTheme('light') trả về 'light'");
	assert.strictEqual(store["bwf-theme"], "light", "setTheme lưu localStorage");
	assert.strictEqual(sandbox.document.documentElement.getAttribute("data-theme"), "light", "setTheme đặt data-theme trên <html>");
	assert.strictEqual(ctx.getTheme(), "light", "getTheme đọc preference đã lưu");
	/* set dark */
	assert.strictEqual(ctx.setTheme("dark"), "dark", "setTheme('dark') trả về 'dark'");
	assert.strictEqual(ctx.getTheme(), "dark", "getTheme trả về dark sau khi set dark");
	/* giá trị lạ → dark */
	store["bwf-theme"] = "sepia";
	assert.strictEqual(ctx.getTheme(), "dark", "giá trị lạ → dark");
	/* initTheme: áp theme hiện tại + không vỡ khi thiếu nút */
	assert.strictEqual(ctx.initTheme(), "dark", "initTheme trả về theme hiện tại");
	assert.strictEqual(sandbox.document.documentElement.getAttribute("data-theme"), "dark", "initTheme áp data-theme");
	console.log("✅ Theme helpers: default dark / set light / persist / set dark / invalid → dark / initTheme — PASS");
}

/* ============================================================
   6. commitSetsFromInputs — nhập tỉ số không mất số khi tab qua ô khác
   ============================================================ */
{
	const mk = function (v) { return { value: String(v) }; };
	const m = { p1: "T1", p2: "T2", sets: null };
	/* mới gõ ô A1 (21), tab sang B1 (trống) → KHÔNG commit, không mất số */
	assert.strictEqual(ctx.commitSetsFromInputs(m, [mk(21), mk(""), mk("")], [mk(""), mk(""), mk("")]), false, "cặp nửa chừng → không commit");
	assert.strictEqual(m.sets, null, "cặp nửa chừng → m.sets không đổi (không mất số)");
	/* đủ cặp 1 → commit */
	assert.strictEqual(ctx.commitSetsFromInputs(m, [mk(21), mk(""), mk("")], [mk(15), mk(""), mk("")]), true, "đủ cặp 1 → commit");
	assert.deepStrictEqual(hostClone(m.sets), [[21, 15]], "m.sets = [[21,15]]");
	/* cặp 2 nửa chừng (A2=21, B2 trống) khi cặp 1 đã đủ → không commit, giữ nguyên cặp 1 */
	const before = hostClone(m.sets);
	assert.strictEqual(ctx.commitSetsFromInputs(m, [mk(21), mk(21), mk("")], [mk(15), mk(""), mk("")]), false, "cặp 2 nửa chừng → không commit");
	assert.deepStrictEqual(hostClone(m.sets), before, "m.sets giữ nguyên (không mất cặp 1)");
	/* đủ 2 cặp → commit cả 2 */
	assert.strictEqual(ctx.commitSetsFromInputs(m, [mk(21), mk(21), mk("")], [mk(15), mk(18), mk("")]), true, "đủ 2 cặp → commit");
	assert.deepStrictEqual(hostClone(m.sets), [[21, 15], [21, 18]], "m.sets = 2 cặp");
	/* cặp giữa trống nhưng cặp 3 đủ → commit giữ cặp 3 (không mất) */
	assert.strictEqual(ctx.commitSetsFromInputs(m, [mk(21), mk(""), mk(21)], [mk(15), mk(""), mk(18)]), true, "cặp 3 đủ dù cặp 2 trống → commit");
	assert.deepStrictEqual(hostClone(m.sets), [[21, 15], [21, 18]], "m.sets giữ cặp 3");
	console.log("✅ commitSetsFromInputs: nửa chừng không commit / đủ cặp commit / không mất số khi tab — PASS");

/* ============================================================
   7. fixedGroupSize — bracket không nhầm 6/8 đội khi seed dở dang
   ============================================================ */
{
	assert.ok(ctx.fixedGroupSize, "fixedGroupSize phải tồn tại sau khi load app.js");
	/* 8 đội chưa seed: 0 trong bracket + 8 chờ → 8 */
	assert.strictEqual(ctx.fixedGroupSize({ participants: [], unassignedPairs: ["a", "b", "c", "d", "e", "f", "g", "h"] }), 8, "0 seed + 8 chờ → 8");
	/* kéo 6/8 vào bracket: 6 trong bracket + 2 chờ → vẫn 8 (KHÔNG nhầm 6) */
	assert.strictEqual(ctx.fixedGroupSize({ participants: ["a", "b", "c", "d", "e", "f"], unassignedPairs: ["g", "h"] }), 8, "6 seed + 2 chờ → 8");
	/* nhóm 6 đội thật: 6 seed + 0 chờ → 6 */
	assert.strictEqual(ctx.fixedGroupSize({ participants: ["a", "b", "c", "d", "e", "f"], unassignedPairs: [] }), 6, "6 seed + 0 chờ → 6");
	/* state cũ (không có unassignedPairs) */
	assert.strictEqual(ctx.fixedGroupSize({ participants: ["a", "b", "c", "d", "e", "f", "g", "h"] }), 8, "state cũ, 8 seed đặc → 8");
	/* rỗng */
	assert.strictEqual(ctx.fixedGroupSize({ participants: [], unassignedPairs: [] }), 0, "rỗng → 0");

	/* renderCustomBracket: 6 seed + 2 chờ → VẪN bracket 8 đội (không nhảy sang 6) */
	const t8 = ctx.renderCustomBracket({ format: "swiss", customStage: true, participants: teams8.slice(0, 6), unassignedPairs: teams8.slice(6), matches: [] });
	assert.ok(allText(t8).indexOf("nhóm 8 đội") !== -1, "6 seed + 2 chờ → vẫn bracket 8 đội");
	/* 6 seed + 0 chờ (nhóm 6 đội thật) → bracket 6 đội */
	const t6 = ctx.renderCustomBracket({ format: "swiss", customStage: true, participants: teams8.slice(0, 6), unassignedPairs: [], matches: [] });
	assert.ok(allText(t6).indexOf("nhóm 6 đội") !== -1, "6 seed + 0 chờ → bracket 6 đội");
	console.log("✅ fixedGroupSize: tổng participants+chờ / bracket giữ 8 khi seed dở dang / 6 thật → 6 — PASS");
}
}

/* ============================================================
   8. renderParticipantsSection + renderBracketSection — smoke 4-section
   ============================================================ */
{
	/* swiss custom: participants section hiện cặp đã seed, KHÔNG hiện unassignedPairs */
	const cSec = { format: "swiss", customStage: true, participants: teams8.slice(0, 6), unassignedPairs: teams8.slice(6), matches: [] };
	const pSec = ctx.renderParticipantsSection(cSec);
	const pText = allText(pSec);
	assert.ok(pText.indexOf("T1") !== -1, "participants section swiss hiện T1 (đã seed)");
	assert.ok(pText.indexOf("T6") !== -1, "participants section swiss hiện T6 (đã seed)");
	assert.ok(pText.indexOf("T7") === -1, "participants section swiss KHÔNG hiện T7 (chờ)");
	assert.ok(pText.indexOf("T8") === -1, "participants section swiss KHÔNG hiện T8 (chờ)");

	/* participants section group: pool hiển thị */
	const gSec = { format: "group", groups: [{ name: "Bảng A", players: ["P1", "P2"] }], matches: [] };
	const pSecG = ctx.renderParticipantsSection(gSec);
	assert.ok(allText(pSecG).indexOf("Danh sách vận động viên") !== -1, "participants section group hiện pool");

	/* bracket section group: tên bảng + VĐV trong bảng */
	const bSecG = ctx.renderBracketSection(gSec);
	const bTextG = allText(bSecG);
	assert.ok(bTextG.indexOf("Bảng A") !== -1, "bracket section group hiện tên bảng");
	assert.ok(bTextG.indexOf("P1") !== -1, "bracket section group hiện VĐV P1");

	/* bracket section swiss custom: nhóm 8 đội */
	const bSec = ctx.renderBracketSection({ format: "swiss", customStage: true, participants: teams8.slice(0, 6), unassignedPairs: teams8.slice(6), matches: [] });
	assert.ok(allText(bSec).indexOf("nhóm 8 đội") !== -1, "bracket section swiss custom hiện nhóm 8 đội");

	/* renderGroupCard / renderGroupStandings */
	const gCard = ctx.renderGroupCard(gSec, gSec.groups[0], "Bảng A");
	assert.ok(allText(gCard).indexOf("Bảng A") !== -1, "renderGroupCard hiện tên bảng");
	assert.ok(allText(gCard).indexOf("P1") !== -1, "renderGroupCard hiện VĐV P1");
	const gStand = ctx.renderGroupStandings(gSec, gSec.groups[0], "Bảng A");
	assert.ok(allText(gStand).indexOf("Bảng A") !== -1, "renderGroupStandings hiện tên bảng");
	assert.ok(allText(gStand).indexOf("Chưa có trận") !== -1, "renderGroupStandings hiện note BXH khi chưa có trận");
	console.log("✅ renderParticipantsSection + renderBracketSection: swiss seed/chờ / group pool / bracket group / custom 8 đội / group card + standings — PASS");
}

/* ============================================================
   9. renderAll — 4 section theo đúng thứ tự (smoke qua var-replace sandbox)
   ============================================================ */
{
	const mainEl3 = makeEl("div");
	const sandbox3 = {
		console: console,
		document: {
			body: makeEl("body"),
			documentElement: makeEl("html"),
			getElementById: function (id) { return id === "main" ? mainEl3 : makeEl("div"); },
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
		fetch: function () { return new Promise(function () {}); },
		addEventListener: function () {}
	};
	sandbox3.window = sandbox3;
	const ctx3 = createContext(sandbox3);
	runInContext(customStageSrc, ctx3);
	runInContext(readFileSync(join(__dirname, "swiss-core.js"), "utf8"), ctx3);
	runInContext(appSrc
		.replace("let data = null;", "var data = null;")
		.replace("let activeId = null;", "var activeId = null;")
		.replace("let editMode = false;", "var editMode = false;"), ctx3);
	ctx3.saveData = function () {};
	ctx3.data = { contents: [{ id: "x", format: "swiss", customStage: true, participants: teams8.slice(), unassignedPairs: [], seedFilled: [], matches: [] }] };
	ctx3.activeId = "x";
	ctx3.renderAll();
	const mainText = allText(mainEl3);
	const order = ["VĐV / cặp VĐV tham gia thi đấu", "Sơ đồ / Bảng đấu", "Bảng xếp hạng", "Lịch thi đấu & kết quả"];
	let last = -1;
	order.forEach(function (t) {
		const i = mainText.indexOf(t);
		assert.ok(i !== -1, "renderAll hiện section \"" + t + "\"");
		assert.ok(i > last, "section \"" + t + "\" đứng sau section trước");
		last = i;
	});
	/* BXH-thuần: slice "Bảng xếp hạng" → "Lịch thi đấu" KHÔNG chứa bracket/add-pair */
	const bxhStart = mainText.indexOf("Bảng xếp hạng");
	const bxhEnd = mainText.indexOf("Lịch thi đấu & kết quả");
	const bxhSlice = mainText.slice(bxhStart, bxhEnd);
	assert.ok(bxhSlice.indexOf("nhóm 8 đội") === -1, "BXH không chứa bracket (nhóm 8 đội)");
	assert.ok(bxhSlice.indexOf("Sơ đồ thi đấu") === -1, "BXH không chứa bracket (Sơ đồ thi đấu)");
	assert.ok(bxhSlice.indexOf("Tên cặp đấu mới") === -1, "BXH không chứa add-pair input");
	/* slice "Sơ đồ / Bảng đấu" chứa bracket */
	const bracketStart = mainText.indexOf("Sơ đồ / Bảng đấu");
	const bracketSlice = mainText.slice(bracketStart, bxhStart);
	assert.ok(bracketSlice.indexOf("nhóm 8 đội") !== -1, "Sơ đồ / Bảng đấu chứa bracket nhóm 8 đội");
	console.log("✅ renderAll: 4 section đúng thứ tự (VĐV → Sơ đồ → BXH → Lịch thi đấu) — PASS");
}

console.log("✅ Tất cả test reset + smoke bracket đều PASS");