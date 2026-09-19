/* test-reset.js — chạy: node test-reset.js (ESM vì package type:module)
   Harness: trích pure function applySeedToContent từ app.js và test trực tiếp. */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, "app.js"), "utf8");

/* Trích `function <name>(...) { ... }` khỏi app.js bằng cách cân bằng dấu ngoặc nhọn */
function extractFunction(source, name) {
	const start = source.indexOf("function " + name + "(");
	assert.ok(start !== -1, "Không tìm thấy function " + name + " trong app.js");
	const bodyStart = source.indexOf("{", start);
	let depth = 0, i = bodyStart, end = -1;
	for (; i < source.length; i++) {
		if (source[i] === "{") depth++;
		else if (source[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
	}
	const fnText = source.slice(start, end);
	eval("globalThis.__extracted = " + fnText);
	return globalThis.__extracted;
}

const applySeedToContent = extractFunction(src, "applySeedToContent");

/* 1. Seed chi tiết → ghi đè/khôi phục toàn bộ field của content */
const content = {
	id: "x", label: "Đã sửa", format: "group", scoringNote: "note cũ",
	participants: ["A", "B"], matches: [{ stage: "Vòng 1", p1: "A", p2: "B" }],
	unassignedPairs: ["C"]
};
const seed = {
	id: "x", label: "Đôi nam", format: "swiss", scoringNote: "note gốc",
	participants: ["A", "B", "C"], matches: []
};
applySeedToContent(content, seed);
assert.strictEqual(content.label, "Đôi nam");
assert.strictEqual(content.format, "swiss");
assert.strictEqual(content.scoringNote, "note gốc");
assert.deepStrictEqual(content.participants, ["A", "B", "C"]);
assert.deepStrictEqual(content.matches, []);
assert.deepStrictEqual(content.unassignedPairs, []);

/* 2. Copy mảng — content sửa sau không làm hỏng seed */
const seed2 = { participants: ["P1", "P2"], matches: [{ stage: "Vòng 1" }] };
const content2 = { participants: [], matches: [], unassignedPairs: [] };
applySeedToContent(content2, seed2);
content2.participants.push("P3");
content2.matches.push({ stage: "V" });
assert.strictEqual(seed2.participants.length, 2);
assert.strictEqual(seed2.matches.length, 1);

/* 3. Seed thiếu field → array rỗng, không crash */
const seed3 = { label: "L", format: "swiss" };
const content3 = { label: "cũ", format: "group", participants: ["X"], matches: ["m"], unassignedPairs: ["u"] };
applySeedToContent(content3, seed3);
assert.strictEqual(content3.label, "L");
assert.strictEqual(content3.format, "swiss");
assert.deepStrictEqual(content3.participants, []);
assert.deepStrictEqual(content3.matches, []);
assert.deepStrictEqual(content3.unassignedPairs, []);

/* 4. seedContent null → chỉ xoá trận/cặp chờ, giữ nguyên label/format/participants */
const content4 = { label: "Giữ", format: "swiss", participants: ["A"], matches: ["m"], unassignedPairs: ["u"] };
applySeedToContent(content4, null);
assert.strictEqual(content4.label, "Giữ");
assert.strictEqual(content4.format, "swiss");
assert.deepStrictEqual(content4.participants, ["A"]);
assert.deepStrictEqual(content4.matches, []);
assert.deepStrictEqual(content4.unassignedPairs, []);

console.log("✅ Tất cả 4 nhóm test reset (applySeedToContent) đều PASS");