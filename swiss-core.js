/* ================================================================
   swiss-core.js — Thuật toán Swiss Stage (thuần, không DOM)
   Dùng chung: browser (script tag → window.SwissCore) + Node ESM/CJS
   ================================================================ */
(function (root, factory) {
	if (typeof module === "object" && module.exports) module.exports = factory();
	else root.SwissCore = factory();
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

	/* Thành tích (w-l) của 1 đội từ danh sách trận */
	function recordOf(matches, name) {
		let w = 0, l = 0;
		matches.forEach(function (m) {
			if (m.p1 !== name && m.p2 !== name) return;
			const winner = matchWinner(m);
			if (winner === name) w++;
			else if (winner) l++;
		});
		return { w: w, l: l };
	}

	/* Bảng xếp hạng đầy đủ (hỗ trợ winner + sets), sort: Thắng → Hiệu số séc → Hiệu số điểm */
	function computeStandings(participants, matches, opts) {
		opts = opts || {};
		const useHeadToHead = opts.useHeadToHead === true;
		const table = {};
		participants.forEach(function (name) {
			table[name] = { name: name, played: 0, wins: 0, losses: 0, setsFor: 0, setsAgainst: 0, ptsFor: 0, ptsAgainst: 0 };
		});
		matches.forEach(function (m) {
			if (!(m.p1 in table) || !(m.p2 in table)) return;
			const r1 = table[m.p1], r2 = table[m.p2];
			if (m.winner) {
				r1.played++; r2.played++;
				if (m.winner === m.p1) { r1.wins++; r2.losses++; }
				else if (m.winner === m.p2) { r2.wins++; r1.losses++; }
				return;
			}
			if (!m.sets || !m.sets.length) return;
			const r = countSets(m.sets);
			r1.played++; r2.played++;
			r1.setsFor += r.s1; r1.setsAgainst += r.s2;
			r2.setsFor += r.s2; r2.setsAgainst += r.s1;
			r1.ptsFor += r.pf1; r1.ptsAgainst += r.pf2;
			r2.ptsFor += r.pf2; r2.ptsAgainst += r.pf1;
			if (r.s1 > r.s2) { r1.wins++; r2.losses++; } else if (r.s2 > r.s1) { r2.wins++; r1.losses++; }
		});
		const h2h = {};
		if (useHeadToHead) {
			matches.forEach(function (m) {
				if (!(m.p1 in table) || !(m.p2 in table)) return;
				const w = matchWinner(m);
				if (w) h2h[pairKey(m.p1, m.p2)] = w;
			});
		}
		return Object.keys(table).map(function (k) { return table[k]; }).sort(function (a, b) {
			return (b.wins - a.wins) ||
				((b.setsFor - b.setsAgainst) - (a.setsFor - a.setsAgainst)) ||
				(useHeadToHead
					? (function () {
						const w = h2h[pairKey(a.name, b.name)];
						if (!w) return 0;
						return w === a.name ? -1 : 1;
					})()
					: ((b.ptsFor - b.ptsAgainst) - (a.ptsFor - a.ptsAgainst)));
		});
	}

	/* Gom nhóm theo thành tích (theo thứ hạng standings), sort wins giảm dần */
	function groupByRecord(participants, matches) {
		const groups = [];
		computeStandings(participants, matches).forEach(function (r) {
			const key = r.wins + "-" + r.losses;
			const last = groups[groups.length - 1];
			if (last && last.record === key) last.teams.push(r.name);
			else groups.push({ record: key, teams: [r.name] });
		});
		return groups;
	}

	function pairKey(a, b) { return [a, b].sort().join("|"); }

	function recordDist(r1, r2) {
		const a = r1.split("-").map(Number), b = r2.split("-").map(Number);
		return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
	}

	/* Backtracking: tìm pairing ưu tiên cùng thành tích (dist 0), tránh tái đấu tuyệt đối,
	   bye tối thiểu khi không thể ghép đủ (VD: đồ thị chưa gặp tách thành 2 tam giác). */
	function backtrackPair(order, rec, played) {
		if (order.length === 0) return { pairs: [], bye: [], byeCount: 0 };
		const a = order[0];
		const candidates = [];
		for (let i = 1; i < order.length; i++) {
			const b = order[i];
			if (played.has(pairKey(a, b))) continue;
			candidates.push({ name: b, dist: recordDist(rec[a], rec[b]), idx: i });
		}
		candidates.sort(function (x, y) { return (x.dist - y.dist) || (x.idx - y.idx); });
		let best = null;
		for (let c = 0; c < candidates.length; c++) {
			const rest = order.filter(function (t) { return t !== a && t !== candidates[c].name; });
			const sub = backtrackPair(rest, rec, played);
			if (!sub) continue;
			const cand = { pairs: [[a, candidates[c].name]].concat(sub.pairs), bye: sub.bye, byeCount: sub.byeCount };
			if (!best || cand.byeCount < best.byeCount) best = cand;
			if (best.byeCount === 0) return best;
		}
		const sub2 = backtrackPair(order.slice(1), rec, played);
		if (sub2) {
			const cand = { pairs: sub2.pairs, bye: [a].concat(sub2.bye), byeCount: sub2.byeCount + 1 };
			if (!best || cand.byeCount < best.byeCount) best = cand;
		}
		return best;
	}

	/* Sinh cặp cho vòng roundNum. Vòng 1: tuần tự 1v2,3v4... Vòng 2+: backtracking theo thứ hạng. */
	function pairRound(participants, matches, roundNum) {
		const played = new Set();
		matches.forEach(function (m) {
			if (m.p1 && m.p2) played.add(pairKey(m.p1, m.p2));
		});
		if (roundNum === 1) {
			const pairs = [], bye = [];
			for (let i = 0; i < participants.length; i += 2) {
				if (i + 1 < participants.length) pairs.push([participants[i], participants[i + 1]]);
				else bye.push(participants[i]);
			}
			return { pairs: pairs, bye: bye };
		}
		const standings = computeStandings(participants, matches);
		const order = standings.map(function (r) { return r.name; });
		const rec = {};
		standings.forEach(function (r) { rec[r.name] = r.wins + "-" + r.losses; });
		const res = backtrackPair(order, rec, played);
		return { pairs: res.pairs, bye: res.bye };
	}

	/* Cấu trúc bracket cho từng vòng Swiss (thuần, không DOM):
	   [
	     { round: N, groups: [{ record: "w-l", matches: [m,...] }], bye: [name,...] }
	   ]
	   - groups sắp theo thứ hạng giảm dần (record theo wins)
	   - matches trong group sắp theo thứ hạng của cặp đứng cao hơn
	   - bye: cặp không có trận vòng N nhưng có trận vòng N+1 */
	function buildSwissBracket(participants, matches, totalRounds) {
		const byStage = {};
		matches.forEach(function (m) {
			if (!byStage[m.stage]) byStage[m.stage] = [];
			byStage[m.stage].push(m);
		});
		const result = [];
		let playedSoFar = [];
		for (let r = 1; r <= totalRounds; r++) {
			const roundMatches = (byStage["Vòng " + r] || byStage["Vòng Swiss " + r] || []).slice();
			const standings = computeStandings(participants, playedSoFar);
			const rankOf = {}, recOf = {};
			standings.forEach(function (row, i) { rankOf[row.name] = i; recOf[row.name] = row.wins + "-" + row.losses; });
			const topRank = function (m) {
				const a = rankOf[m.p1] != null ? rankOf[m.p1] : 999;
				const b = rankOf[m.p2] != null ? rankOf[m.p2] : 999;
				return Math.min(a, b);
			};
			roundMatches.sort(function (a, b) { return topRank(a) - topRank(b); });
			const groups = [];
			roundMatches.forEach(function (m) {
				const top = (rankOf[m.p1] != null ? rankOf[m.p1] : 999) <= (rankOf[m.p2] != null ? rankOf[m.p2] : 999) ? m.p1 : m.p2;
				const record = recOf[top] || "0-0";
				const last = groups[groups.length - 1];
				if (last && last.record === record) last.matches.push(m);
				else groups.push({ record: record, matches: [m] });
			});
			const nextMatches = (byStage["Vòng " + (r + 1)] || byStage["Vòng Swiss " + (r + 1)] || []);
			const inRound = new Set();
			roundMatches.forEach(function (m) { inRound.add(m.p1); inRound.add(m.p2); });
			const bye = [];
			nextMatches.forEach(function (m) {
				if (!inRound.has(m.p1) && participants.indexOf(m.p1) !== -1) bye.push(m.p1);
				if (!inRound.has(m.p2) && participants.indexOf(m.p2) !== -1) bye.push(m.p2);
			});
			result.push({ round: r, groups: groups, bye: bye });
			playedSoFar = playedSoFar.concat(roundMatches);
		}
		return result;
	}

	return { countSets: countSets, matchWinner: matchWinner, recordOf: recordOf, computeStandings: computeStandings, groupByRecord: groupByRecord, pairRound: pairRound, pairKey: pairKey, buildSwissBracket: buildSwissBracket };
});