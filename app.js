/* ================================================================
   BWF — Giải Cầu lông nội bộ
   Frontend logic: load data từ API, render, edit mode (admin)
   ================================================================ */

/* ================================================================
   STATE
   ================================================================ */
let data = null;
let activeId = null;
let editMode = false;
let isAdmin = false;
let adminToken = null;
let fetchFailed = false;
let dragPlayerName = null;      // tên VĐV đang được kéo (drag & drop)
let selectedPoolPlayer = null;  // tên VĐV đang được chọn (fallback chạm/click trên mobile)

const tabsEl = document.getElementById("tabs");
const mainEl = document.getElementById("main");
const datesEl = document.getElementById("event-dates");
const editBtn = document.getElementById("edit-toggle-btn");
const bannerWrap = document.getElementById("banner-wrap");
const fetchWarningWrap = document.getElementById("fetch-warning-wrap");

/* ---------- tiny DOM helper ---------- */
function el(tag, attrs, children) {
	attrs = attrs || {};
	const e = document.createElement(tag);
	for (const k in attrs) {
		if (!attrs.hasOwnProperty(k)) continue;
		const v = attrs[k];
		if (v == null) continue;
		if (k === "class") e.className = v;
		else if (k === "text") e.textContent = v;
		else if (k.indexOf("on") === 0 && typeof v === "function") e.addEventListener(k.slice(2), v);
		else e.setAttribute(k, v);
	}
	const kids = children == null ? [] : (Array.isArray(children) ? children : [children]);
	kids.forEach(function (c) {
		if (c == null) return;
		e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
	});
	return e;
}
function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

/* ================================================================
   LOAD / SAVE
   ================================================================ */
async function loadData() {
	try {
		const res = await fetch("/api/data", { cache: "no-store" });
		if (res.ok) {
			data = await res.json();
			if (data && data.contents) return init();
		}
	} catch (e) { /* API không có → fallback */ }

	try {
		const res = await fetch("data.json", { cache: "no-store" });
		if (!res.ok) throw new Error("HTTP " + res.status);
		data = await res.json();
		fetchFailed = true;
	} catch (e) {
		data = { event: { dateRange: "30/9 – 04/10/2026" }, contents: [] };
		fetchFailed = true;
	}
	init();
}

async function saveData() {
	if (!isAdmin || !adminToken) return;
	try {
		const res = await fetch("/api/data", {
			method: "PUT",
			headers: { "Content-Type": "application/json", "Authorization": "Bearer " + adminToken },
			body: JSON.stringify(data)
		});
		if (!res.ok) {
			const j = await res.json().catch(function () { return {}; });
			alert("Lưu thất bại: " + (j.error || ("HTTP " + res.status)));
		} else {
			flashSaved();
		}
	} catch (e) {
		alert("Lưu thất bại (không kết nối được server): " + e.message);
	}
}

let saveFlashTimer = null;
function flashSaved() {
	const badge = document.getElementById("save-status");
	if (!badge) return;
	badge.textContent = "✓ Đã lưu";
	clearTimeout(saveFlashTimer);
	saveFlashTimer = setTimeout(function () { badge.textContent = ""; }, 1800);
}

function init() {
	datesEl.textContent = (data.event && data.event.dateRange) || "";
	renderFetchWarning();
	if (!data.contents || !data.contents.length) {
		data.contents = [];
	}
	if (!data.contents.some(function (c) { return c.id === activeId; })) {
		activeId = data.contents.length ? data.contents[0].id : null;
	}
	buildTabs();
	renderAll();
}

function renderFetchWarning() {
	clear(fetchWarningWrap);
	if (fetchFailed) {
		fetchWarningWrap.appendChild(el("div", { class: "fetch-warning" },
			"⚠ Không kết nối được API — đang hiển thị dữ liệu từ data.json. Khi deploy lên Vercel, dữ liệu sẽ được lưu trên server."));
	}
}

function renderBanner() {
	clear(bannerWrap);
	if (!editMode) return;
	const inner = el("div", { class: "banner-inner edit" }, [
		el("span", {}, "🟢 Đang chỉnh sửa — mọi thay đổi được lưu ngay lên server cho tất cả mọi người."),
		el("div", { class: "actions" }, [
			el("span", { id: "save-status", style: "font-weight:600;" }, ""),
			el("button", { class: "btn small outline", onclick: function () { editMode = false; buildTabs(); renderAll(); } }, "Thoát chỉnh sửa"),
		]),
	]);
	bannerWrap.appendChild(inner);
}

/* ================================================================
   TABS
   ================================================================ */
function buildTabs() {
	clear(tabsEl);
	data.contents.forEach(function (c) {
		const btn = el("button", {
			type: "button",
			role: "tab",
			"aria-selected": c.id === activeId ? "true" : "false",
			onclick: function () { selectTab(c.id); },
			text: c.label,
		});
		btn.dataset.id = c.id;
		tabsEl.appendChild(btn);
	});
	if (editMode) {
		tabsEl.appendChild(el("button", { class: "add-tab", type: "button", title: "Thêm nội dung mới", onclick: openAddContentModal }, "+"));
	}
}

function updateTabSelection() {
	Array.prototype.forEach.call(tabsEl.querySelectorAll("button[role='tab']"), function (b) {
		b.setAttribute("aria-selected", b.dataset.id === activeId ? "true" : "false");
	});
}

function selectTab(id) {
	activeId = id;
	updateTabSelection();
	renderAll();
}

/* ================================================================
   MODAL
   ================================================================ */
function showModal(title, bodyEl) {
	const overlay = el("div", { class: "modal-overlay" });
	const box = el("div", { class: "modal" }, [
		el("div", { class: "modal-head" }, [
			el("h3", { text: title }),
			el("button", { class: "modal-close", type: "button", text: "×", onclick: function () { overlay.remove(); } }),
		]),
		bodyEl,
	]);
	overlay.appendChild(box);
	overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });
	document.body.appendChild(overlay);
	return overlay;
}

/* ================================================================
   CONTENT MANAGEMENT
   ================================================================ */
function openAddContentModal() {
	const labelInput = el("input", { type: "text", placeholder: "VD: Đơn nam, Đôi nữ..." });
	const formatSelect = el("select", {}, [
		el("option", { value: "group", text: "Chia bảng vòng tròn (group)" }),
		el("option", { value: "swiss", text: "Thể thức Swiss" }),
	]);
	const body = el("div", {}, [
		el("label", {}, ["Tên nội dung", labelInput]),
		el("label", {}, ["Thể thức", formatSelect]),
		el("div", { class: "actions" }, [
			el("button", {
				class: "btn", type: "button", onclick: function () {
					const label = labelInput.value.trim();
					if (!label) { alert("Vui lòng nhập tên nội dung."); return; }
					const format = formatSelect.value;
					const id = "content-" + Date.now();
					const content = format === "swiss"
						? { id: id, label: label, format: format, scoringNote: "", participants: [], matches: [] }
						: { id: id, label: label, format: format, scoringNote: "", unassignedPlayers: [], groups: [{ name: "Bảng A", players: [] }, { name: "Bảng B", players: [] }], matches: [] };
					data.contents.push(content);
					activeId = id;
					saveData();
					buildTabs();
					renderAll();
					overlay.remove();
				}
			}, "Thêm"),
		]),
	]);
	const overlay = showModal("Thêm nội dung thi đấu", body);
	labelInput.focus();
}

function openEditContentModal(content) {
	const labelInput = el("input", { type: "text", value: content.label });
	const noteInput = el("textarea", { value: content.scoringNote || "" });
	const body = el("div", {}, [
		el("label", {}, ["Tên nội dung", labelInput]),
		el("label", {}, ["Ghi chú cách tính điểm", noteInput]),
		el("div", { class: "actions" }, [
			el("button", {
				class: "btn danger-text", type: "button", text: "Xoá nội dung", onclick: function () {
					if (!confirm("Xoá nội dung \"" + content.label + "\" và toàn bộ dữ liệu của nó?")) return;
					data.contents = data.contents.filter(function (c) { return c !== content; });
					if (activeId === content.id) activeId = data.contents.length ? data.contents[0].id : null;
					saveData();
					buildTabs();
					renderAll();
					overlay.remove();
				}
			}),
			el("span", { class: "spacer" }),
			el("button", { class: "btn outline", type: "button", text: "Huỷ", onclick: function () { overlay.remove(); } }),
			el("button", {
				class: "btn", type: "button", text: "Lưu", onclick: function () {
					content.label = labelInput.value.trim() || content.label;
					content.scoringNote = noteInput.value.trim();
					saveData();
					buildTabs();
					renderAll();
					overlay.remove();
				}
			}),
		]),
	]);
	const overlay = showModal("Chỉnh sửa nội dung", body);
}

/* ================================================================
   SCORE HELPERS
   ================================================================ */
function computeStandings(participants, matches) {
	return SwissCore.computeStandings(participants, matches);
}

function isSwissStage(stage) {
	return /^Vòng (Swiss )?\d+$/.test(stage || "");
}

function allParticipants(content) {
	if (content.format === "group") {
		let list = (content.unassignedPlayers || []).slice();
		(content.groups || []).forEach(function (g) { list = list.concat(g.players || []); });
		return list;
	}
	return content.participants || [];
}

/* ================================================================
   NỘI DUNG ĐƠN — danh sách chờ bốc thăm (pool) & kéo-thả vào bảng
   ================================================================ */
function ensurePool(content) {
	if (!content.unassignedPlayers) content.unassignedPlayers = [];
	if (!content.groups) content.groups = [];
	return content.unassignedPlayers;
}

function assignPlayerToGroup(content, name, group) {
	const pool = ensurePool(content);
	content.groups.forEach(function (g) { g.players = (g.players || []).filter(function (p) { return p !== name; }); });
	content.unassignedPlayers = pool.filter(function (p) { return p !== name; });
	if (!group.players) group.players = [];
	if (group.players.indexOf(name) === -1) group.players.push(name);
	selectedPoolPlayer = null;
	saveData();
	renderAll();
}

function unassignPlayerFromGroup(content, name, group) {
	group.players = (group.players || []).filter(function (p) { return p !== name; });
	const pool = ensurePool(content);
	if (pool.indexOf(name) === -1) pool.push(name);
	saveData();
	renderAll();
}

function deletePlayerFromRoster(content, name) {
	if (!confirm("Xoá hẳn \"" + name + "\" khỏi danh sách thi đấu?")) return;
	content.unassignedPlayers = ensurePool(content).filter(function (p) { return p !== name; });
	(content.groups || []).forEach(function (g) { g.players = (g.players || []).filter(function (p) { return p !== name; }); });
	saveData();
	renderAll();
}

/* ================================================================
   ROUND ROBIN — tự sinh trận vòng bảng
   ================================================================ */
function generateRoundRobin(content, group) {
	const players = group.players || [];
	if (players.length < 2) { alert("Cần ít nhất 2 VĐV để sinh lịch."); return; }
	const stage = "Vòng bảng — " + group.name;
	const existing = new Set();
	content.matches.forEach(function (m) {
		if (m.stage === stage && m.p1 && m.p2) {
			existing.add([m.p1, m.p2].sort().join("|"));
		}
	});
	const added = [];
	for (let i = 0; i < players.length; i++) {
		for (let j = i + 1; j < players.length; j++) {
			const key = [players[i], players[j]].sort().join("|");
			if (!existing.has(key)) {
				content.matches.push({
					stage: stage, p1: players[i], p2: players[j],
					date: "", time: "", court: "", referee: "", sets: null
				});
				added.push(players[i] + " vs " + players[j]);
			}
		}
	}
	if (added.length) {
		saveData();
		renderAll();
		alert("Đã thêm " + added.length + " trận:\n" + added.join("\n"));
	} else {
		alert("Tất cả các cặp trong bảng đã có lịch thi đấu rồi.");
	}
}

/* ================================================================
   RENDER: STANDINGS
   ================================================================ */
function renderPlayerPool(content) {
	const pool = ensurePool(content);
	const wrap = el("div", { class: "pool-card" });
	wrap.appendChild(el("div", { class: "pool-head" }, [
		el("h3", { text: "Danh sách vận động viên chờ bốc thăm" }),
		el("span", { class: "pool-count", text: pool.length + " VĐV chưa vào bảng" }),
	]));

	if (editMode) {
		wrap.appendChild(el("p", { class: "pool-hint" },
			"Sau khi bốc thăm, kéo (hoặc chạm để chọn rồi bấm vào bảng) từng tên vào Bảng A / Bảng B bên dưới."));
	}

	const chipsWrap = el("div", { class: "pool-chips" });
	if (!pool.length) {
		chipsWrap.appendChild(el("p", { class: "empty", style: "padding:4px 2px;" }, "Không còn VĐV nào trong danh sách chờ."));
	} else {
		pool.forEach(function (name) {
			const chip = el("span", {
				class: "pool-chip" + (selectedPoolPlayer === name ? " selected" : ""),
				text: name,
			});
			if (editMode) {
				chip.setAttribute("draggable", "true");
				chip.addEventListener("dragstart", function (e) {
					dragPlayerName = name;
					e.dataTransfer.setData("text/plain", name);
					e.dataTransfer.effectAllowed = "move";
				});
				chip.addEventListener("click", function () {
					selectedPoolPlayer = (selectedPoolPlayer === name) ? null : name;
					renderAll();
				});
				chip.appendChild(el("button", {
					class: "pool-chip-del", type: "button", title: "Xoá khỏi danh sách",
					onclick: function (e) { e.stopPropagation(); deletePlayerFromRoster(content, name); },
				}, " ×"));
			}
			chipsWrap.appendChild(chip);
		});
	}
	wrap.appendChild(chipsWrap);

	if (editMode) {
		const input = el("input", { type: "text", placeholder: "Tên VĐV mới → Enter hoặc bấm Thêm" });
		function addToPool() {
			const name = input.value.trim();
			if (!name) return;
			const already = pool.indexOf(name) !== -1 || allParticipants(content).indexOf(name) !== -1;
			if (already) { alert("VĐV \"" + name + "\" đã có trong danh sách."); return; }
			pool.push(name);
			saveData(); renderAll();
		}
		input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addToPool(); } });
		wrap.appendChild(el("div", { class: "add-player-row" }, [
			input,
			el("button", { class: "btn small", type: "button", onclick: addToPool }, "+ Thêm vào danh sách"),
		]));
	}
	return wrap;
}

function renderStandingsGroupCard(content, group, title) {
	const groupMatches = content.matches.filter(function (m) { return m.stage === "Vòng bảng — " + group.name; });
	const rows = computeStandings(group.players || [], groupMatches);
	const card = el("div", { class: "group-card" });
	const headerChildren = [el("span", { text: title })];
	if (editMode) {
		headerChildren.push(el("button", {
			class: "del-group", type: "button", title: "Xoá bảng", text: "×", onclick: function () {
				if (!confirm("Xoá bảng \"" + group.name + "\" và các VĐV trong đó?")) return;
				content.groups = content.groups.filter(function (g) { return g !== group; });
				saveData();
				renderAll();
			}
		}));
	}
	card.appendChild(el("h3", {}, headerChildren));

	if (editMode) {
		card.setAttribute("data-dropzone", "1");
		card.addEventListener("dragover", function (e) { e.preventDefault(); card.classList.add("dropzone-active"); });
		card.addEventListener("dragleave", function () { card.classList.remove("dropzone-active"); });
		card.addEventListener("drop", function (e) {
			e.preventDefault();
			card.classList.remove("dropzone-active");
			const name = dragPlayerName || e.dataTransfer.getData("text/plain");
			dragPlayerName = null;
			if (name) assignPlayerToGroup(content, name, group);
		});
		if (selectedPoolPlayer) {
			card.classList.add("dropzone-pickable");
			card.addEventListener("click", function (e) {
				if (e.target.closest("button")) return;
				assignPlayerToGroup(content, selectedPoolPlayer, group);
			});
		}
	}

	if (!group.players || !group.players.length) {
		card.appendChild(el("p", { class: "empty", style: "padding:12px 14px;" },
			editMode ? "Chưa có VĐV — kéo tên từ danh sách chờ vào đây." : "Chưa có VĐV nào."));
	} else if (rows.every(function (r) { return r.played === 0; })) {
		card.appendChild(buildStandingsTable(rows, editMode ? unassignCb(content, group) : null, "Đưa về danh sách chờ", " ↩"));
		card.appendChild(el("p", { class: "standings-note" }, "Chưa có trận nào ghi nhận kết quả."));
	} else {
		card.appendChild(buildStandingsTable(rows, editMode ? unassignCb(content, group) : null, "Đưa về danh sách chờ", " ↩"));
		card.appendChild(el("p", { class: "standings-note" }, "Xếp theo: Thắng → Hiệu số séc → Hiệu số điểm."));
	}

	if (editMode) {
		card.appendChild(el("div", { class: "group-actions" }, [
			el("button", { class: "btn small outline", type: "button", onclick: function () { generateRoundRobin(content, group); } }, "⚡ Tự sinh lịch thi đấu"),
		]));
	}
	return card;

	function unassignCb(cnt, grp) {
		return function (name) {
			unassignPlayerFromGroup(cnt, name, grp);
		};
	}
}

function buildStandingsTable(rows, onDeletePlayer, deleteTitle, deleteSymbol, onClickName, showNumber) {
	deleteTitle = deleteTitle || "Xoá";
	deleteSymbol = deleteSymbol || " ×";
	const thead = el("thead", {}, el("tr", {}, [
		el("th", { text: "VĐV / Cặp đấu" }),
		el("th", { class: "num", text: "Thành tích" }),
		el("th", { class: "num", text: "Trận" }),
		el("th", { class: "num", text: "Thắng" }),
		el("th", { class: "num", text: "Thua" }),
		el("th", { class: "num", text: "Séc" }),
		el("th", { class: "num", text: "Điểm" }),
	]));
	const tbody = el("tbody");
	rows.forEach(function (r, i) {
		const label = (showNumber ? (i + 1) + ". " : "") + r.name;
		const nameCell = el("td", {});
		if (onClickName) {
			nameCell.appendChild(el("button", { class: "link-name", type: "button", title: "Xem lịch sử thi đấu", onclick: function () { onClickName(r.name); } }, label));
		} else {
			nameCell.textContent = label;
		}
		if (onDeletePlayer) {
			nameCell.appendChild(el("button", {
				class: "del-player", type: "button", title: deleteTitle, onclick: function () {
					onDeletePlayer(r.name);
				}
			}, deleteSymbol));
		}
		const tr = el("tr", { class: i === 0 ? "rank-1" : (i === 1 ? "rank-2" : "") }, [
			nameCell,
			el("td", { class: "num" }, el("span", { class: "record-badge", text: r.wins + "-" + r.losses })),
			el("td", { class: "num", text: String(r.played) }),
			el("td", { class: "num", text: String(r.wins) }),
			el("td", { class: "num", text: String(r.losses) }),
			el("td", { class: "num", text: r.setsFor + "-" + r.setsAgainst }),
			el("td", { class: "num", text: r.ptsFor + "-" + r.ptsAgainst }),
		]);
		tbody.appendChild(tr);
	});
	return el("table", { class: "standings" }, [thead, tbody]);
}

function renderStandingsSection(content) {
	const outer = el("div");
	if (content.format === "group") {
		outer.appendChild(renderPlayerPool(content));
	}
	const wrap = el("div", { class: "groups-wrap" });
	outer.appendChild(wrap);
	if (content.format === "group") {
		(content.groups || []).forEach(function (g) {
			wrap.appendChild(renderStandingsGroupCard(content, g, g.name));
		});
		if (editMode) {
			wrap.appendChild(el("div", { class: "group-card" }, [
				el("h3", { text: "+ Bảng mới" }),
				el("div", { class: "add-player-row" }, [
					el("button", {
						class: "btn small", type: "button", onclick: function () {
							const name = prompt("Tên bảng mới (VD: Bảng C):");
							if (!name) return;
							content.groups.push({ name: name.trim(), players: [] });
							saveData();
							renderAll();
						}
					}, "+ Thêm bảng"),
				]),
			]));
		}
	} else {
		const swissMatches = content.matches.filter(function (m) { return isSwissStage(m.stage); });
		const rows = computeStandings(content.participants || [], swissMatches);
		const card = el("div", { class: "group-card" });
		card.appendChild(el("h3", { text: "Xếp hạng vòng Swiss" }));
		const openHistory = function (name) { showTeamHistory(content, name); };
		const hasMatches = swissMatches.length > 0;
		const deleteCb = editMode ? function (name) {
			if (!confirm("Xoá \"" + name + "\" khỏi danh sách?")) return;
			content.participants = content.participants.filter(function (p) { return p !== name; });
			saveData(); renderAll();
		} : null;

		if (editMode && !hasMatches) {
			/* Chưa có trận + đang chỉnh sửa → bảng kéo-thả đánh số cặp (thay cho bảng xếp hạng rỗng) */
			card.appendChild(renderSwissPairOrder(content));
		} else if (!content.participants || !content.participants.length) {
			card.appendChild(el("p", { class: "empty", style: "padding:12px 14px;" }, "Chưa có cặp đấu nào."));
		} else if (rows.every(function (r) { return r.played === 0; })) {
			card.appendChild(buildStandingsTable(rows, deleteCb, null, null, openHistory, true));
			card.appendChild(el("p", { class: "standings-note" }, "Chưa có trận nào ghi nhận kết quả."));
		} else {
			card.appendChild(buildStandingsTable(rows, deleteCb, null, null, openHistory, true));
			card.appendChild(el("p", { class: "standings-note" }, "Xếp theo: Thắng → Hiệu số séc → Hiệu số điểm. Đội nghỉ vòng (bye) khi không thể ghép cặp tránh tái đấu."));
			card.appendChild(renderSwissBranches(rows));
		}
		if (editMode && hasMatches) {
			const input = el("input", { type: "text", placeholder: "Tên cặp đấu mới" });
			const addRow = el("div", { class: "add-player-row" }, [
				input,
				el("button", {
					class: "btn small", type: "button", onclick: function () {
						const name = input.value.trim();
						if (!name) return;
						if (content.participants.indexOf(name) === -1) { content.participants.push(name); saveData(); renderAll(); }
						input.value = "";
					}
				}, "+ Thêm"),
			]);
			card.appendChild(addRow);
		}
		if (editMode) {
			card.appendChild(el("div", { class: "group-actions" }, [
				el("button", {
					class: "btn small outline", type: "button", onclick: function () {
						if (!hasMatches && content.unassignedPairs && content.unassignedPairs.length) {
							alert("Còn " + content.unassignedPairs.length + " cặp chưa xếp vào ô số — kéo vào bảng trước khi sinh lịch.");
							return;
						}
						generateNextSwissRound(content);
					}
				}, "⚡ Tự sinh vòng tiếp theo"),
			]));
		}
		wrap.appendChild(card);
		outer.appendChild(renderSwissBracket(content));
	}
	return outer;
}

/* ================================================================
   SWISS — bảng kéo-thả đánh số cặp (chỉ khi chưa có trận)
   ================================================================ */
function renderSwissPairOrder(content) {
	const wrap = el("div", { class: "swiss-pair-order" });
	if (!content.unassignedPairs) content.unassignedPairs = [];
	const participants = content.participants || [];

	wrap.appendChild(el("p", { class: "pool-hint" }, "Kéo từng cặp từ danh sách chờ vào ô số bên dưới để đánh số thứ tự — quyết định ghép Vòng 1 (1v2, 3v4, 5v6)."));

	/* 1. Pool — cặp chưa xếp */
	const chipsWrap = el("div", { class: "pool-chips" });
	if (!content.unassignedPairs.length) {
		chipsWrap.appendChild(el("p", { class: "empty", style: "padding:4px 2px;" }, "Không còn cặp nào trong danh sách chờ."));
	} else {
		content.unassignedPairs.forEach(function (name) {
			const chip = el("span", { class: "pool-chip", text: name });
			chip.setAttribute("draggable", "true");
			chip.addEventListener("dragstart", function (e) {
				dragPlayerName = name;
				e.dataTransfer.setData("text/plain", name);
				e.dataTransfer.effectAllowed = "move";
			});
			chip.appendChild(el("button", {
				class: "pool-chip-del", type: "button", title: "Xoá khỏi danh sách",
				onclick: function (e) {
					e.stopPropagation();
					content.unassignedPairs = content.unassignedPairs.filter(function (p) { return p !== name; });
					saveData(); renderAll();
				}
			}, " ×"));
			chipsWrap.appendChild(chip);
		});
	}
	wrap.appendChild(chipsWrap);

	/* 2. Bảng ô số — mỗi dòng là dropzone */
	const table = el("table", { class: "standings swiss-order-table" });
	const tbody = el("tbody");
	participants.forEach(function (name, i) {
		const row = el("tr", { class: "swiss-order-row" });
		row.setAttribute("data-dropzone", "1");
		row.addEventListener("dragover", function (e) { e.preventDefault(); row.classList.add("dropzone-active"); });
		row.addEventListener("dragleave", function () { row.classList.remove("dropzone-active"); });
		row.addEventListener("drop", function (e) {
			e.preventDefault();
			row.classList.remove("dropzone-active");
			const pair = dragPlayerName || e.dataTransfer.getData("text/plain");
			dragPlayerName = null;
			if (!pair) return;
			const old = participants[i];
			if (old && old !== pair) content.unassignedPairs.push(old);
			content.unassignedPairs = content.unassignedPairs.filter(function (p) { return p !== pair; });
			participants[i] = pair;
			saveData(); renderAll();
		});
		const nameCell = el("td", { class: "swiss-order-name", text: name });
		nameCell.appendChild(el("button", {
			class: "del-player", type: "button", title: "Đưa về danh sách chờ",
			onclick: function () {
				content.unassignedPairs.push(name);
				content.participants = participants.filter(function (p) { return p !== name; });
				saveData(); renderAll();
			}
		}, " ↩"));
		row.appendChild(el("td", { class: "swiss-order-num", text: "Cặp " + (i + 1) }));
		row.appendChild(nameCell);
		tbody.appendChild(row);
	});
	/* Dòng cuối: ô trống để thêm vào cuối */
	const appendRow = el("tr", { class: "swiss-order-row append" });
	appendRow.setAttribute("data-dropzone", "1");
	appendRow.addEventListener("dragover", function (e) { e.preventDefault(); appendRow.classList.add("dropzone-active"); });
	appendRow.addEventListener("dragleave", function () { appendRow.classList.remove("dropzone-active"); });
	appendRow.addEventListener("drop", function (e) {
		e.preventDefault();
		appendRow.classList.remove("dropzone-active");
		const pair = dragPlayerName || e.dataTransfer.getData("text/plain");
		dragPlayerName = null;
		if (!pair) return;
		content.unassignedPairs = content.unassignedPairs.filter(function (p) { return p !== pair; });
		participants.push(pair);
		content.participants = participants;
		saveData(); renderAll();
	});
	appendRow.appendChild(el("td", { class: "swiss-order-num", text: "Cặp " + (participants.length + 1) }));
	appendRow.appendChild(el("td", { class: "swiss-order-name empty", text: "+ Kéo cặp vào đây để thêm cuối" }));
	tbody.appendChild(appendRow);
	table.appendChild(tbody);
	wrap.appendChild(table);

	/* 3. Ô nhập cặp mới → thêm vào pool */
	const input = el("input", { type: "text", placeholder: "Tên cặp đấu mới" });
	const addRow = el("div", { class: "add-player-row" }, [
		input,
		el("button", {
			class: "btn small", type: "button", onclick: function () {
				const name = input.value.trim();
				if (!name) return;
				if (content.unassignedPairs.indexOf(name) !== -1 || content.participants.indexOf(name) !== -1) { alert("Cặp \"" + name + "\" đã có trong danh sách."); return; }
				content.unassignedPairs.push(name);
				saveData(); renderAll();
			}
		}, "+ Thêm vào danh sách chờ"),
	]);
	wrap.appendChild(addRow);

	return wrap;
}

/* ================================================================
   SWISS — nhánh Thắng/Thua & lịch sử thi đấu
   ================================================================ */
function renderSwissBranches(rows) {
	const wrap = el("div", { class: "swiss-branches" });
	wrap.appendChild(branchCard("NHÁNH THẮNG", "Đội có số trận thắng nhiều hơn thua", rows.filter(function (r) { return r.wins > r.losses; }), "thang"));
	wrap.appendChild(branchCard("CÂN BẰNG", "Đội có số trận thắng bằng số trận thua", rows.filter(function (r) { return r.wins === r.losses; }), "canbang"));
	wrap.appendChild(branchCard("NHÁNH THUA", "Đội có số trận thua nhiều hơn thắng", rows.filter(function (r) { return r.wins < r.losses; }), "thua"));
	return wrap;
}

function branchCard(title, note, rows, cls) {
	const card = el("div", { class: "swiss-branch " + cls });
	card.appendChild(el("h4", { class: "swiss-branch-title", text: title }));
	card.appendChild(el("p", { class: "swiss-branch-note", text: note }));
	if (!rows.length) {
		card.appendChild(el("p", { class: "empty", style: "padding:8px 2px;" }, "Chưa có đội nào."));
	} else {
		rows.forEach(function (r) {
			card.appendChild(el("div", { class: "swiss-branch-team" }, [
				el("span", { class: "swiss-branch-name", text: r.name }),
				el("span", { class: "swiss-branch-record", text: r.wins + "-" + r.losses }),
			]));
		});
	}
	return card;
}

function showTeamHistory(content, name) {
	const overlay = el("div", { class: "modal-overlay team-history-overlay" });
	const modal = el("div", { class: "modal team-history-modal" });
	modal.appendChild(el("h3", { text: "Lịch sử thi đấu — " + name }));
	const list = el("div", { class: "team-history-list" });
	const myMatches = content.matches.filter(function (m) { return m.p1 === name || m.p2 === name; });
	if (!myMatches.length) {
		list.appendChild(el("p", { class: "empty" }, "Chưa có trận nào."));
	} else {
		myMatches.forEach(function (m) {
			const opp = m.p1 === name ? m.p2 : m.p1;
			const winner = SwissCore.matchWinner(m);
			const result = winner === name ? "Thắng" : (winner ? "Thua" : "Chưa đấu");
			const score = m.sets ? m.sets.map(function (p) { return p[0] + "–" + p[1]; }).join(", ") : (m.winner ? "chọn nhanh" : "—");
			list.appendChild(el("div", { class: "team-history-row" }, [
				el("span", { class: "th-stage", text: m.stage }),
				el("span", { class: "th-opp", text: "vs " + opp }),
				el("span", { class: "th-score", text: score }),
				el("span", { class: "th-result " + (winner === name ? "win" : winner ? "loss" : "pending"), text: result }),
			]));
		});
	}
	modal.appendChild(list);
	modal.appendChild(el("button", { class: "btn small", type: "button", onclick: function () { overlay.remove(); } }, "Đóng"));
	overlay.appendChild(modal);
	document.body.appendChild(overlay);
	overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });
}

/* ================================================================
   SWISS — sơ đồ thi đấu & tự sinh cặp đấu vòng kế tiếp
   ================================================================ */
function renderSwissBracket(content) {
	const section = el("div", { class: "swiss-bracket-card" });
	section.appendChild(el("h3", { class: "swiss-bracket-title", text: "Sơ đồ thi đấu — vòng Swiss" }));

	const participants = content.participants || [];
	const swissMatches = content.matches.filter(function (m) { return isSwissStage(m.stage); });
	const totalRounds = 5;
	const bracket = SwissCore.buildSwissBracket(participants, swissMatches, totalRounds);

	const track = el("div", { class: "swiss-bracket-track", "data-bracket-track": "1" });
	bracket.forEach(function (roundData) {
		const col = el("div", { class: "swiss-round" });
		col.appendChild(el("h4", { class: "swiss-round-head", text: "Vòng " + roundData.round }));
		roundData.groups.forEach(function (group) {
			col.appendChild(el("div", { class: "swiss-group-label", text: "Nhánh " + group.record }));
			group.matches.forEach(function (m) { col.appendChild(buildBracketMatchNode(content, m, swissMatches)); });
		});
		roundData.bye.forEach(function (name) {
			const idx = participants.indexOf(name);
			col.appendChild(el("div", { class: "swiss-bye-node", "data-team": name }, [
				el("span", { class: "swiss-side-name", text: (idx >= 0 ? (idx + 1) + ". " : "") + name }),
				el("span", { class: "swiss-bye-tag", text: "Miễn thi đấu (bye)" }),
			]));
		});
		const played = roundData.groups.reduce(function (n, g) { return n + g.matches.length; }, 0) + roundData.bye.length;
		const slots = Math.max(1, Math.ceil(participants.length / 2));
		for (let i = played; i < slots; i++) {
			col.appendChild(el("div", { class: "swiss-empty-slot", text: "Chưa ghép cặp" }));
		}
		track.appendChild(col);
	});
	section.appendChild(track);
	drawSwissConnectors(track, participants, bracket);
	return section;
}

function buildBracketMatchNode(content, m, swissMatches) {
	const winner = SwissCore.matchWinner(m);
	const hasScore = !!(m.sets && m.sets.length);
	const rec1 = SwissCore.recordOf(swissMatches, m.p1);
	const rec2 = SwissCore.recordOf(swissMatches, m.p2);
	const cs = hasScore ? SwissCore.countSets(m.sets) : null;
	const scoreText = hasScore
		? m.sets.map(function (p) { return p[0] + "–" + p[1]; }).join(", ") + " · " + cs.s1 + "–" + cs.s2
		: (m.winner ? "chọn nhanh" : "chưa đấu");
	const idx1 = (content.participants || []).indexOf(m.p1);
	const idx2 = (content.participants || []).indexOf(m.p2);
	const name1 = (idx1 >= 0 ? (idx1 + 1) + ". " : "") + m.p1;
	const name2 = (idx2 >= 0 ? (idx2 + 1) + ". " : "") + m.p2;
	const node = el("div", { class: "swiss-match", "data-team": m.p1, "data-round": m.stage });
	node.appendChild(el("div", { class: "swiss-side" + (winner === m.p1 ? " winner" : ""), "data-team-side": m.p1 }, [
		el("button", { class: "swiss-side-name link-name", type: "button", text: name1, onclick: function () { showTeamHistory(content, m.p1); } }),
		el("span", { class: "swiss-record", text: rec1.w + "-" + rec1.l }),
	]));
	node.appendChild(el("div", { class: "swiss-side" + (winner === m.p2 ? " winner" : ""), "data-team-side": m.p2 }, [
		el("button", { class: "swiss-side-name link-name", type: "button", text: name2, onclick: function () { showTeamHistory(content, m.p2); } }),
		el("span", { class: "swiss-record", text: rec2.w + "-" + rec2.l }),
	]));
	node.appendChild(el("div", { class: "swiss-score", text: scoreText }));
	return node;
}

function drawSwissConnectors() { /* Task 3 */ }

function generateNextSwissRound(content) {
	const participants = (content.participants || []).slice();
	if (participants.length < 2) { alert("Cần ít nhất 2 cặp đấu để sinh vòng Swiss."); return; }

	const existingRounds = [];
	content.matches.forEach(function (m) {
		if (isSwissStage(m.stage) && existingRounds.indexOf(m.stage) === -1) existingRounds.push(m.stage);
	});
	const roundNum = existingRounds.length + 1;
	if (roundNum > 5) { alert("Đã đủ 5 vòng Swiss."); return; }
	const stage = "Vòng " + roundNum;

	const swissMatches = content.matches.filter(function (m) { return isSwissStage(m.stage); });
	const res = SwissCore.pairRound(participants, swissMatches, roundNum);
	if (!res.pairs.length) { alert("Không thể sinh thêm cặp đấu mới."); return; }
	res.pairs.forEach(function (pair) {
		content.matches.push({ stage: stage, p1: pair[0], p2: pair[1], date: "", time: "", court: "", referee: "", sets: null });
	});
	saveData();
	renderAll();
	let msg = "Đã sinh " + stage + " với " + res.pairs.length + " trận:\n" + res.pairs.map(function (p) { return p[0] + " vs " + p[1]; }).join("\n");
	if (res.bye.length) msg += "\n\nMiễn thi đấu (bye): " + res.bye.join(", ");
	alert(msg);
}

/* ================================================================
   RENDER: MATCHES
   ================================================================ */
function setsToRows(sets) {
	const rows = [["", ""], ["", ""], ["", ""]];
	if (sets) {
		sets.forEach(function (pair, i) { if (i < 3) rows[i] = [String(pair[0]), String(pair[1])]; });
	}
	return rows;
}

function readSetsFromInputs(inputsA, inputsB) {
	const sets = [];
	for (let i = 0; i < 3; i++) {
		const a = inputsA[i].value.trim(), b = inputsB[i].value.trim();
		if (a === "" || b === "") break;
		sets.push([Number(a), Number(b)]);
	}
	return sets.length ? sets : null;
}

function renderMatchCard(m, content) {
	const hasScore = !!(m.sets && m.sets.length);
	const hasResult = hasScore || !!m.winner;
	const isSwiss = isSwissStage(m.stage);
	let winner = SwissCore.matchWinner(m);

	const card = el("div", { class: "match-card" });

	if (!editMode) {
		const p1span = el("span", { class: "p" + (winner === m.p1 ? " winner" : ""), text: m.p1 });
		const p2span = el("span", { class: "p" + (winner === m.p2 ? " winner" : ""), text: m.p2 });
		const top = el("div", { class: "match-top" }, [
			el("div", { class: "players" }, [p1span, el("span", { class: "vs", text: "vs" }), p2span]),
			el("span", { class: "status-pill " + (hasResult ? "done" : "pending"), text: hasResult ? "Đã kết thúc" : "Sắp diễn ra" }),
		]);
		card.appendChild(top);
		if (hasResult) {
			if (hasScore) {
				const setsRow = el("div", { class: "sets-row" });
				m.sets.forEach(function (pair) { setsRow.appendChild(el("span", { class: "set-chip", text: pair[0] + "–" + pair[1] })); });
				card.appendChild(setsRow);
			} else if (isSwiss) {
				card.appendChild(el("span", { class: "no-score quick-pick-badge", text: "⚡ Chọn thắng nhanh" }));
			} else {
				card.appendChild(el("span", { class: "no-score", text: "Đã kết thúc" }));
			}
		} else {
			card.appendChild(el("span", { class: "no-score", text: "Chưa có kết quả" }));
		}
		const metaParts = [];
		if (m.date) metaParts.push(el("span", { text: "📅 " + m.date + (m.time ? " · " + m.time : "") }));
		if (m.court) metaParts.push(el("span", { text: "📍 " + m.court }));
		if (m.referee) metaParts.push(el("span", { text: "🧑‍⚖️ " + m.referee }));
		if (metaParts.length) card.appendChild(el("div", { class: "match-meta" }, metaParts));
		return card;
	}

	/* ---- edit mode ---- */
	const participants = allParticipants(content);
	const dlId = "dl-" + content.id;

	const p1Input = el("input", { type: "text", list: dlId, value: m.p1 });
	const p2Input = el("input", { type: "text", list: dlId, value: m.p2 });
	const top = el("div", { class: "match-top" }, [
		el("div", { class: "players edit-row" }, [p1Input, el("span", { class: "vs", text: "vs" }), p2Input]),
		el("span", { class: "status-pill " + (hasResult ? "done" : "pending"), text: hasResult ? "Đã kết thúc" : "Sắp diễn ra" }),
	]);
	card.appendChild(top);

	const rows = setsToRows(m.sets);
	const inputsA = [], inputsB = [];
	const setsWrap = el("div", { class: "edit-row" });
	for (let i = 0; i < 3; i++) {
		const ia = el("input", { type: "number", value: rows[i][0] });
		const ib = el("input", { type: "number", value: rows[i][1] });
		inputsA.push(ia); inputsB.push(ib);
		setsWrap.appendChild(el("div", { class: "set-edit-group" }, [
			el("span", { text: "Séc " + (i + 1) }), ia, el("span", { text: "–" }), ib,
		]));
	}
	function commitScore() { m.sets = readSetsFromInputs(inputsA, inputsB); if (m.sets) m.winner = null; saveData(); renderAll(); }
	inputsA.concat(inputsB).forEach(function (inp) { inp.addEventListener("change", commitScore); });
	card.appendChild(setsWrap);

	if (isSwiss) {
		const quickRow = el("div", { class: "edit-row quick-win-row" }, [
			el("span", { class: "quick-win-label", text: "Chọn đội thắng nhanh:" }),
			el("button", { class: "btn small", type: "button", onclick: function () { if (!m.p1 || !m.p2) return; m.winner = m.p1; m.sets = null; saveData(); renderAll(); } }, "🏆 " + (m.p1 || "Đội 1")),
			el("button", { class: "btn small", type: "button", onclick: function () { if (!m.p1 || !m.p2) return; m.winner = m.p2; m.sets = null; saveData(); renderAll(); } }, "🏆 " + (m.p2 || "Đội 2")),
			el("button", { class: "btn small outline", type: "button", onclick: function () { m.winner = null; m.sets = null; saveData(); renderAll(); } }, "Xoá kết quả"),
		]);
		card.appendChild(quickRow);
	}

	const dateInput = el("input", { type: "text", value: m.date || "", placeholder: "dd/mm/yyyy" });
	const timeInput = el("input", { type: "text", value: m.time || "", placeholder: "giờ" });
	const courtInput = el("input", { type: "text", value: m.court || "", placeholder: "sân" });
	const refInput = el("input", { type: "text", value: m.referee || "", placeholder: "trọng tài" });
	const metaRow = el("div", { class: "edit-row" }, [
		el("label", {}, ["Ngày", dateInput]),
		el("label", {}, ["Giờ", timeInput]),
		el("label", {}, ["Sân", courtInput]),
		el("label", {}, ["Trọng tài", refInput]),
	]);
	card.appendChild(metaRow);

	function commitMeta() { m.date = dateInput.value; m.time = timeInput.value; m.court = courtInput.value; m.referee = refInput.value; saveData(); }
	[dateInput, timeInput, courtInput, refInput].forEach(function (inp) { inp.addEventListener("change", commitMeta); });

	function commitPlayers() { m.p1 = p1Input.value.trim() || m.p1; m.p2 = p2Input.value.trim() || m.p2; if (m.winner && m.winner !== m.p1 && m.winner !== m.p2) m.winner = null; saveData(); renderAll(); }
	[p1Input, p2Input].forEach(function (inp) { inp.addEventListener("change", commitPlayers); });

	const actions = el("div", { class: "match-edit-actions" }, [
		el("button", {
			class: "btn danger-text", type: "button", onclick: function () {
				if (!confirm("Xoá trận đấu này?")) return;
				content.matches = content.matches.filter(function (x) { return x !== m; });
				saveData(); renderAll();
			}
		}, "Xoá trận đấu"),
	]);
	card.appendChild(actions);

	return card;
}

function renderMatchesSection(content) {
	const wrap = el("div");
	const stages = [];
	const byStage = {};
	content.matches.forEach(function (m) {
		if (!(m.stage in byStage)) { byStage[m.stage] = []; stages.push(m.stage); }
		byStage[m.stage].push(m);
	});
	if (stages.length === 0) {
		wrap.appendChild(el("p", { class: "empty" }, "Chưa có lịch thi đấu. (Vào chế độ chỉnh sửa để thêm trận hoặc tự sinh lịch vòng bảng.)"));
	}
	stages.forEach(function (stage) {
		wrap.appendChild(el("h3", { class: "stage-heading", text: stage }));
		byStage[stage].forEach(function (m) { wrap.appendChild(renderMatchCard(m, content)); });
	});

	if (editMode) {
		wrap.appendChild(renderAddMatchForm(content, stages));
		const dl = el("datalist", { id: "dl-" + content.id });
		allParticipants(content).forEach(function (name) { dl.appendChild(el("option", { value: name })); });
		wrap.appendChild(dl);
	}
	return wrap;
}

function renderAddMatchForm(content, existingStages) {
	const stageInput = el("input", { type: "text", list: "stages-" + content.id, placeholder: "vd: Vòng bảng — Bảng A" });
	const stageDl = el("datalist", { id: "stages-" + content.id });
	existingStages.forEach(function (s) { stageDl.appendChild(el("option", { value: s })); });

	const p1Input = el("input", { type: "text", list: "dl-" + content.id, placeholder: "VĐV / cặp 1" });
	const p2Input = el("input", { type: "text", list: "dl-" + content.id, placeholder: "VĐV / cặp 2" });
	const dateInput = el("input", { type: "text", placeholder: "vd: 05/10/2026" });
	const timeInput = el("input", { type: "text", placeholder: "vd: 19:00" });
	const courtInput = el("input", { type: "text", placeholder: "vd: Sân 1" });
	const refInput = el("input", { type: "text", placeholder: "(tuỳ chọn)" });

	const grid = el("div", { class: "add-match-grid" }, [
		el("label", {}, ["Giai đoạn / Vòng", stageInput]),
		el("label", {}, ["VĐV / cặp 1", p1Input]),
		el("label", {}, ["VĐV / cặp 2", p2Input]),
		el("label", {}, ["Ngày", dateInput]),
		el("label", {}, ["Giờ", timeInput]),
		el("label", {}, ["Sân", courtInput]),
		el("label", {}, ["Trọng tài", refInput]),
	]);

	const submitBtn = el("button", {
		class: "btn", type: "button", onclick: function () {
			const stage = stageInput.value.trim();
			const p1 = p1Input.value.trim();
			const p2 = p2Input.value.trim();
			if (!stage || !p1 || !p2) { alert("Vui lòng nhập Giai đoạn và tên 2 VĐV/cặp đấu."); return; }
			content.matches.push({
				stage: stage, p1: p1, p2: p2,
				date: dateInput.value.trim(), time: timeInput.value.trim(),
				court: courtInput.value.trim(), referee: refInput.value.trim(),
				sets: null,
			});
			saveData();
			renderAll();
		}
	}, "+ Thêm trận đấu");

	return el("div", { class: "add-match-card" }, [
		el("h4", { text: "Thêm trận đấu mới" }),
		grid, stageDl, submitBtn,
	]);
}

/* ================================================================
   RENDER: MAIN
   ================================================================ */
function renderAll() {
	editBtn.textContent = editMode ? "✅ Xong" : "✏️ Chỉnh sửa";
	document.body.classList.toggle("editing", editMode);
	renderBanner();

	const content = data.contents.find(function (c) { return c.id === activeId; });
	clear(mainEl);
	if (!content) {
		mainEl.appendChild(el("p", { class: "empty" }, fetchFailed
			? "Không tải được dữ liệu (đang mở file trực tiếp?). Hãy chạy qua Vercel hoặc `vercel dev` để xem dữ liệu."
			: "Chưa có nội dung nào. " + (editMode ? "Bấm + trên thanh tab để thêm." : "")));
		return;
	}

	const legend = el("div", { class: "legend" }, [
		el("span", {}, [el("i", { class: "done" }), "Đã kết thúc"]),
		el("span", {}, [el("i", { class: "pending" }), "Sắp diễn ra"]),
	]);
	mainEl.appendChild(legend);

	const titleRow = el("div", { class: "block-title-row" }, [
		el("h2", { class: "block-title", text: "Bảng xếp hạng" }),
		editMode ? el("button", { class: "btn small outline", type: "button", onclick: function () { openEditContentModal(content); } }, "⚙️ Chỉnh sửa nội dung") : null,
	]);
	const standingsSection = el("section", { class: "block" }, [
		titleRow,
		content.scoringNote ? el("p", { class: "block-desc", text: content.scoringNote }) : null,
		renderStandingsSection(content),
	]);
	mainEl.appendChild(standingsSection);

	const matchesSection = el("section", { class: "block" }, [
		el("h2", { class: "block-title", text: "Lịch thi đấu & kết quả" }),
		renderMatchesSection(content),
	]);
	mainEl.appendChild(matchesSection);
}

/* ================================================================
   EDIT TOGGLE — xác thực admin
   ================================================================ */
editBtn.addEventListener("click", async function () {
	if (!editMode) {
		const password = prompt("Nhập mật khẩu quản trị để chỉnh sửa:");
		if (!password) return;
		try {
			const res = await fetch("/api/auth", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ password: password })
			});
			if (res.ok) {
				isAdmin = true;
				adminToken = password;
				editMode = true;
			} else {
				alert("Sai mật khẩu!");
				return;
			}
		} catch (e) {
			alert("Không kết nối được server để xác thực. Kiểm tra deploy Vercel.");
			return;
		}
	} else {
		editMode = false;
	}
	buildTabs();
	renderAll();
});

loadData();