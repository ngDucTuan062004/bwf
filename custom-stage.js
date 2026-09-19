/* ================================================================
   custom-stage.js — Custom Stage cho 8 đội (thuần, không DOM, không gọi swiss-core)
   Quy trình theo aaa.md: R1 tuần tự → R2 nhóm theo record → R3+ loại
   (chỉ ghép 1 thua) → vòng tròn top ≤3 → xếp hạng top 3.
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

	/* Sort nhóm 1 thua: Thắng desc → Thua asc → seed asc */
	function lossGroupSort(participants) {
		return function (a, b) {
			const recA = a.rec, recB = b.rec;
			return (recB.w - recA.w) ||
				(recA.l - recB.l) ||
				(seedIndex(participants, a.name) - seedIndex(participants, b.name));
		};
	}

	function pairKey(a, b) { return [a, b].sort().join("|"); }

	/* Ghép liền kề trong list đã sort seed-asc, tránh tái đấu; lẻ → đội cuối bye */
	function pairAdjacent(list, participants, matches) {
		const played = new Set();
		matches.forEach(function (m) {
			if (m.p1 && m.p2) played.add(pairKey(m.p1, m.p2));
		});
		const sorted = list.slice().sort(function (a, b) {
			return seedIndex(participants, a) - seedIndex(participants, b);
		});
		const pairs = [], bye = [];
		const res = [];
		for (let i = 0; i < sorted.length; i++) res.push([sorted[i]]);
		const used = new Set();
		for (let i = 0; i < res.length; i++) {
			if (used.has(res[i][0]) || res[i].length === 2) continue;
			const a = res[i][0];
			let b = null;
			for (let j = i + 1; j < res.length; j++) {
				if (used.has(res[j][0])) continue;
				if (!played.has(pairKey(a, res[j][0]))) { b = res[j][0]; used.add(b); break; }
			}
			if (b) { used.add(a); res[i] = [a, b]; }
			else { bye.push(a); used.add(a); }
		}
		res.forEach(function (r) { if (r.length === 2) pairs.push(r); });
		return { pairs: pairs, bye: bye };
	}

	/* Vòng 1: ghép tuần tự [i],[i+1]; lẻ → bye */
	function customCreateRound1(teams) {
		const pairs = [], bye = [];
		for (let i = 0; i < teams.length; i += 2) {
			if (i + 1 < teams.length) pairs.push([teams[i], teams[i + 1]]);
			else bye.push(teams[i]);
		}
		return { pairs: pairs, bye: bye };
	}

	/* Cặp 2 đội ít thua nhất trong active (tiebreak Thắng desc, seed asc) — vòng đầu vòng tròn */
	function firstRoundrobinPair(active, rec, participants) {
		return active.slice().sort(function (a, b) {
			return (rec[a].l - rec[b].l) ||
				(rec[b].w - rec[a].w) ||
				(seedIndex(participants, a) - seedIndex(participants, b));
		}).slice(0, 2);
	}

	/* Số đội còn trụ (l<2) tính tới trước vòng roundNum (chỉ đếm trận round < roundNum) */
	function activeBefore(participants, matches, roundNum) {
		let maxRound = 0;
		matches.forEach(function (m) { maxRound = Math.max(maxRound, roundOf(m.stage)); });
		const before = roundNum > maxRound ? matches : matches.filter(function (m) { return roundOf(m.stage) < roundNum; });
		const rec = buildRecords(participants, before);
		return participants.filter(function (t) { return rec[t].l < 2; });
	}

	/* Vòng đầu tiên active.length <= 3 (bắt đầu vòng tròn) */
	function rrStartRound(participants, matches, roundNum) {
		for (let r = 1; r <= roundNum; r++) {
			if (activeBefore(participants, matches, r).length <= 3) return r;
		}
		return roundNum;
	}

	/* Vòng tròn khi active.length <= 3: vòng đầu = cặp 2 đội ít thua nhất, vòng sau = cặp còn lại */
	function pairRoundrobin(participants, matches, roundNum, active, rec) {
		if (active.length <= 1) return { pairs: [], bye: [] };
		if (active.length === 2) {
			return { pairs: [[active[0], active[1]]], bye: [] };
		}
		const start = rrStartRound(participants, matches, roundNum);
		const earlyRec = buildRecords(participants, matches.filter(function (m) { return roundOf(m.stage) < start; }));
		const earlyActive = participants.filter(function (t) { return earlyRec[t].l < 2; });
		const rr = firstRoundrobinPair(earlyActive, earlyRec, participants);
		const rrKey = pairKey(rr[0], rr[1]);
		if (roundNum === start) {
			/* vòng đầu: chỉ 1 cặp (2 đội ít thua nhất) */
			return { pairs: [[rr[0], rr[1]]], bye: [] };
		}
		/* vòng sau: các cặp còn lại trong các đội trụ — cho phép tái đấu (aaa.md R6) */
		const teams = active.slice().sort(function (a, b) {
			return seedIndex(participants, a) - seedIndex(participants, b);
		});
		const all = [];
		for (let i = 0; i < teams.length; i++) {
			for (let j = i + 1; j < teams.length; j++) all.push([teams[i], teams[j]]);
		}
		return { pairs: all.filter(function (p) { return pairKey(p[0], p[1]) !== rrKey; }), bye: [] };
	}

	/* Sinh cặp cho vòng roundNum theo quy trình custom 8 đội */
	function customPairNextRound(participants, matches, roundNum) {
		const rec = buildRecords(participants, matches);
		const active = participants.filter(function (t) { return rec[t].l < 2; });

		if (roundNum === 1) return customCreateRound1(participants);
		if (active.length <= 3) return pairRoundrobin(participants, matches, roundNum, active, rec);
		if (roundNum === 2) {
			/* gom nhóm theo record, ghép liền kề seed-asc tránh tái đấu */
			const byRec = {};
			participants.forEach(function (name) {
				const key = rec[name].w + "-" + rec[name].l;
				(byRec[key] = byRec[key] || []).push(name);
			});
			const pairs = [], bye = [];
			Object.keys(byRec).sort(function (a, b) {
				const ra = a.split("-").map(Number), rb = b.split("-").map(Number);
				return (rb[0] - ra[0]) || (ra[1] - rb[1]);
			}).forEach(function (key) {
				const res = pairAdjacent(byRec[key], participants, matches);
				res.pairs.forEach(function (p) { pairs.push(p); });
				res.bye.forEach(function (b) { bye.push(b); });
			});
			return { pairs: pairs, bye: bye };
		}
		/* R3+: chỉ ghép nhóm 1 thua (0 thua chờ); nhóm lẻ → đội cuối bye */
		const oneLoss = participants.filter(function (t) { return rec[t].l === 1; });
		if (!oneLoss.length) return { pairs: [], bye: [] };
		const sorted = oneLoss.map(function (name) {
			return { name: name, rec: rec[name] };
		}).sort(lossGroupSort(participants)).map(function (x) { return x.name; });
		const res = pairAdjacent(sorted, participants, matches);
		return { pairs: res.pairs, bye: res.bye };
	}

	/* Xếp hạng + loại + phase */
	function customComputeState(participants, matches) {
		const rec = buildRecords(participants, matches);
		const rows = participants.map(function (name) {
			return { name: name, rec: rec[name] };
		});
		const ranked = rows.slice().sort(standingsSort(participants)).map(function (x) { return x.name; });
		const active = participants.filter(function (t) { return rec[t].l < 2; });
		const phase = active.length <= 1 ? "complete" : (active.length <= 3 ? "round-robin" : "elimination");
		return {
			records: rec,
			ranking: ranked.slice(0, 3),
			eliminated: ranked.slice(3).sort(function (a, b) {
				return (rec[a].w - rec[b].w) ||
					(rec[b].l - rec[a].l) ||
					(seedIndex(participants, a) - seedIndex(participants, b));
			}),
			phase: phase
		};
	}

	/* Bracket thuần: gom matches theo stage; thêm cột trống nếu chưa complete */
	function customBuildBracket(participants, matches) {
		const byStage = {};
		matches.forEach(function (m) {
			if (!byStage[m.stage]) byStage[m.stage] = [];
			byStage[m.stage].push(m);
		});
		const rounds = Object.keys(byStage).map(function (stage) {
			return {
				round: roundOf(stage),
				groups: [{ label: stage, matches: byStage[stage] }],
				bye: []
			};
		}).sort(function (a, b) { return a.round - b.round; });
		const state = customComputeState(participants, matches);
		if (state.phase !== "complete") {
			const next = rounds.length ? rounds[rounds.length - 1].round + 1 : 1;
			rounds.push({ round: next, groups: [{ label: "Vòng " + next, matches: [] }], bye: [] });
		}
		return { rounds: rounds, state: state };
	}

	return {
		countSets: countSets,
		matchWinner: matchWinner,
		customCreateRound1: customCreateRound1,
		customPairNextRound: customPairNextRound,
		customComputeState: customComputeState,
		customBuildBracket: customBuildBracket
	};
});