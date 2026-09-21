/* ================================================================
   custom-stage.js — Custom Stage cho 8 đội (thuần, không DOM, không gọi swiss-core)
   Cấu trúc cố định 14 trận (double-bracket style) theo design/brakcket_8team.html:
   R1 (4 trận seed) → R2 (2 nhánh thắng + 2 nhánh thua) → R3 (2) → R4 (1) →
   R6 (1) → R5 (1 tranh hạng 3) → R7 (1 chung kết). Mỗi trận có pos cố định.
   Dùng chung: browser (script tag → window.CustomStage) + Node ESM/CJS
   ================================================================ */
(function (root, factory) {
	if (typeof module === "object" && module.exports) module.exports = factory();
	else root.CustomStage = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {

	function countSets(sets) {
		let s1 = 0, s2 = 0, pf1 = 0, pf2 = 0;
		sets.forEach(function (pair) {
			const a = pair[0], b = pair[1];
			pf1 += a; pf2 += b;
			if (a > b) s1++; else if (b > a) s2++;
		});
		return { s1: s1, s2: s2, pf1: pf1, pf2: pf2 };
	}

	/* Đội thắng 1 trận: ưu tiên m.winner, fallback đếm sets. null nếu chưa có kết quả. */
	function matchWinner(m) {
		if (m.winner) return m.winner;
		if (m.sets && m.sets.length) {
			const r = countSets(m.sets);
			if (r.s1 > r.s2) return m.p1;
			if (r.s2 > r.s1) return m.p2;
		}
		return null;
	}

	/* Thành tích đầy đủ: thắng/thua + séc/điểm (đủ tiebreak xếp hạng) */
	function buildRecords(participants, matches) {
		const table = {};
		participants.forEach(function (name) {
			table[name] = { w: 0, l: 0, sf: 0, sa: 0, pf: 0, pa: 0 };
		});
		matches.forEach(function (m) {
			if (!(m.p1 in table) || !(m.p2 in table)) return;
			const a = table[m.p1], b = table[m.p2];
			if (m.sets && m.sets.length) {
				const r = countSets(m.sets);
				a.sf += r.s1; a.sa += r.s2; a.pf += r.pf1; a.pa += r.pf2;
				b.sf += r.s2; b.sa += r.s1; b.pf += r.pf2; b.pa += r.pf1;
			}
			const winner = matchWinner(m);
			if (winner === m.p1) { a.w++; b.l++; }
			else if (winner === m.p2) { b.w++; a.l++; }
		});
		return table;
	}

	function roundOf(stage) {
		const n = parseInt(String(stage).replace(/\D/g, ""), 10);
		return isNaN(n) ? 0 : n;
	}

	function seedIndex(participants, name) {
		const i = participants.indexOf(name);
		return i === -1 ? 999 : i;
	}

	/* Sort xếp hạng: Thắng desc → Thua asc → hiệu số séc → hiệu số điểm → seed asc */
	function standingsSort(participants) {
		return function (a, b) {
			const recA = a.rec, recB = b.rec;
			return (recB.w - recA.w) ||
				(recA.l - recB.l) ||
				((recB.sf - recB.sa) - (recA.sf - recA.sa)) ||
				((recB.pf - recB.pa) - (recA.pf - recA.pa)) ||
				(seedIndex(participants, a.name) - seedIndex(participants, b.name));
		};
	}

	/* ---- Cấu trúc cố định 14 trận ---- */
	const STRUCTURE = [
		{ pos: "R1.1", round: 1, feeds: [["S", 1], ["S", 2]] },
		{ pos: "R1.2", round: 1, feeds: [["S", 3], ["S", 4]] },
		{ pos: "R1.3", round: 1, feeds: [["S", 5], ["S", 6]] },
		{ pos: "R1.4", round: 1, feeds: [["S", 7], ["S", 8]] },
		{ pos: "R2.1", round: 2, feeds: [["W", "R1.1"], ["W", "R1.2"]] },
		{ pos: "R2.2", round: 2, feeds: [["W", "R1.3"], ["W", "R1.4"]] },
		{ pos: "R2.3", round: 2, feeds: [["L", "R1.1"], ["L", "R1.2"]] },
		{ pos: "R2.4", round: 2, feeds: [["L", "R1.3"], ["L", "R1.4"]] },
		{ pos: "R3.1", round: 3, feeds: [["L", "R2.1"], ["W", "R2.3"]] },
		{ pos: "R3.2", round: 3, feeds: [["L", "R2.2"], ["W", "R2.4"]] },
		{ pos: "R4.1", round: 4, feeds: [["W", "R3.1"], ["W", "R3.2"]] },
		{ pos: "R6.1", round: 6, feeds: [["W", "R2.1"], ["W", "R2.2"]] },
		{ pos: "R5.1", round: 5, feeds: [["W", "R4.1"], ["L", "R6.1"]] },
		{ pos: "R7.1", round: 7, feeds: [["W", "R6.1"], ["W", "R5.1"]] },
	];

	/* pos của 1 trận: ưu tiên m.pos; fallback suy từ stage + thứ tự trong stage.
	   LƯU Ý: fallback chỉ dùng cho dữ liệu legacy — KHÔNG tin cậy nếu trận cũ
	   không theo thứ tự cấu trúc cố định. Mọi trận mới đều có pos tường minh. */
	function derivePos(matches, m) {
		if (m.pos) return m.pos;
		const r = roundOf(m.stage);
		const same = matches.filter(function (x) { return roundOf(x.stage) === r; });
		return "R" + r + "." + (same.indexOf(m) + 1);
	}

	/* Giải 1 feed: seed hoặc W/L của trận nguồn */
	function resolveFeed(feed, participants, byPos) {
		if (feed[0] === "S") {
			const i = feed[1] - 1;
			return i < participants.length ? participants[i] : null;
		}
		const src = byPos[feed[1]];
		if (!src) return null;
		const w = matchWinner(src);
		if (!w) return null;
		return feed[0] === "W" ? w : (w === src.p1 ? src.p2 : src.p1);
	}

	/* Bracket cố định: 14 vị trí, mỗi vị trí = { pos, round, feeds, teams:[t1,t2], match } */
	function buildFixedBracket(participants, matches) {
		const byPos = {};
		matches.forEach(function (m) { byPos[derivePos(matches, m)] = m; });
		return STRUCTURE.map(function (slot) {
			return {
				pos: slot.pos,
				round: slot.round,
				feeds: slot.feeds,
				teams: slot.feeds.map(function (f) { return resolveFeed(f, participants, byPos); }),
				match: byPos[slot.pos] || null
			};
		});
	}

	/* State: records, phase, eliminated, ranking, bracket */
	function computeFixedState(participants, matches) {
		const bracket = buildFixedBracket(participants, matches);
		const byPos = {};
		bracket.forEach(function (b) { byPos[b.pos] = b; });
		const records = buildRecords(participants, matches);

		const gf = byPos["R7.1"];
		const gfWinner = gf && gf.match ? matchWinner(gf.match) : null;
		const phase = gfWinner ? "complete" : "in-progress";

		/* Loại: thua R2 nhánh thua (0-2), thua R3 (1-2), thua R4 (1-2) */
		const eliminated = [];
		["R2.3", "R2.4", "R3.1", "R3.2", "R4.1"].forEach(function (pos) {
			const b = byPos[pos];
			if (b && b.match) {
				const w = matchWinner(b.match);
				if (w) eliminated.push(w === b.match.p1 ? b.match.p2 : b.match.p1);
			}
		});

		let ranking;
		if (phase === "complete") {
			ranking = [gfWinner];
			const l7 = gfWinner === gf.match.p1 ? gf.match.p2 : gf.match.p1;
			ranking.push(l7);
			const b5 = byPos["R5.1"];
			if (b5 && b5.match) {
				const w5 = matchWinner(b5.match);
				if (w5) ranking.push(w5 === b5.match.p1 ? b5.match.p2 : b5.match.p1);
			}
			const rest = participants.filter(function (t) { return ranking.indexOf(t) === -1; });
			rest.sort(function (a, b) {
				return (records[b].w - records[a].w) ||
					((records[b].sf - records[b].sa) - (records[a].sf - records[a].sa)) ||
					((records[b].pf - records[b].pa) - (records[a].pf - records[a].pa)) ||
					(seedIndex(participants, a) - seedIndex(participants, b));
			});
			ranking = ranking.concat(rest);
		} else {
			ranking = participants.map(function (name) { return { name: name, rec: records[name] }; })
				.slice().sort(standingsSort(participants)).map(function (x) { return x.name; });
		}

		return { records: records, phase: phase, eliminated: eliminated, ranking: ranking, bracket: bracket };
	}

	return {
		countSets: countSets,
		matchWinner: matchWinner,
		buildFixedBracket: buildFixedBracket,
		computeFixedState: computeFixedState
	};
});