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

/* ================================================================
   THEME — dark/light mode (lưu localStorage, mặc định dark)
   ================================================================ */
function getTheme() {
	return localStorage.getItem("bwf-theme") === "light" ? "light" : "dark";
}

function setTheme(t) {
	const theme = t === "light" ? "light" : "dark";
	localStorage.setItem("bwf-theme", theme);
	document.documentElement.setAttribute("data-theme", theme);
	const btn = document.getElementById("theme-toggle-btn");
	if (btn) btn.textContent = theme === "dark" ? "☀️" : "🌙";
	return theme;
}

function initTheme() {
	const theme = getTheme();
	document.documentElement.setAttribute("data-theme", theme);
	const btn = document.getElementById("theme-toggle-btn");
	if (btn) {
		btn.textContent = theme === "dark" ? "☀️" : "🌙";
		btn.addEventListener("click", function () {
			setTheme(getTheme() === "dark" ? "light" : "dark");
		});
	}
	return theme;
}

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
	lastSaveAt = Date.now(); /* set TRƯỚC await — server broadcast sau writeFileSync, PUT response về sau → nếu set sau await thì echo arrive trước lastSaveAt */
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
let lastSaveAt = 0;
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
	if (!fetchFailed) startPolling();
}

let pollTimer = null;
function startPolling() {
	if (typeof setInterval === "undefined") return;
	if (pollTimer) return; /* tránh double interval */
	pollTimer = setInterval(pollOnce, 5000);
}

async function pollOnce() {
	if (Date.now() - lastSaveAt < 1000) return; /* chính mình vừa PUT → bỏ qua */
	try {
		const res = await fetch("/api/data", { cache: "no-store" });
		if (!res.ok) return;
		const fresh = await res.json();
		if (!fresh || !fresh.contents) return;
		if (JSON.stringify(fresh) === JSON.stringify(data)) return; /* không đổi → không render */
		data = fresh;
		if (!data.contents.some(function (c) { return c.id === activeId; })) {
			activeId = data.contents.length ? data.contents[0].id : null;
		}
		buildTabs();
		renderAll();
	} catch (e) { /* giữ dữ liệu cũ */ }
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
   RESET CONTENT — khôi phục nội dung đang mở về trạng thái seed
   ================================================================ */
function applySeedToContent(content, seedContent) {
	/* Nội dung đơn (group): khôi phục toàn bộ — unassignedPlayers + groups + xoá matches */
	if (seedContent && seedContent.format === "group") {
		content.label = seedContent.label;
		content.format = "group";
		content.scoringNote = seedContent.scoringNote;
		content.unassignedPlayers = (seedContent.unassignedPlayers || []).slice();
		content.groups = (seedContent.groups || []).map(function (g) {
			return { name: g.name, players: (g.players || []).slice() };
		});
		content.matches = (seedContent.matches || []).slice();
		content.unassignedPairs = [];
		content.seedFilled = [];
		content.participants = [];
		content.customStage = false;
		return;
	}
	if (seedContent) {
		content.label = seedContent.label;
		content.format = seedContent.format;
		content.scoringNote = seedContent.scoringNote;
		content.matches = (seedContent.matches || []).slice();
		content.seedFilled = (seedContent.seedFilled || []).slice(); // reset seed → R1 không tự tái tạo
		/* Custom stage 8 đội: reset đưa toàn bộ cặp về danh sách chờ (giống nội dung đơn) — bracket trống */
		const seedIsCustom = seedContent.format === "swiss" &&
			(seedContent.customStage === true || (seedContent.participants || []).length === 8);
		if (seedIsCustom) {
			content.customStage = true;
			content.participants = [];
			content.unassignedPairs = (seedContent.participants || []).slice();
		} else {
			content.participants = (seedContent.participants || []).slice();
			content.unassignedPairs = (seedContent.unassignedPairs || []).slice(); // seed thiếu field → []
			content.customStage = seedContent.customStage === true;
		}
	} else {
		content.matches = [];
		content.unassignedPairs = [];
		content.seedFilled = [];
	}
}

async function resetContentToSeed(content) {
	try {
		const res = await fetch("data.json", { cache: "no-store" });
		if (!res.ok) throw new Error("HTTP " + res.status);
		const seed = await res.json();
		const seedContent = (seed.contents || []).find(function (c) { return c.id === content.id; });
		applySeedToContent(content, seedContent);
		saveData();
		renderAll();
	} catch (e) {
		alert("Reset thất bại: " + e.message);
	}
}

/* ================================================================
   SCORE HELPERS
   ================================================================ */
function computeStandings(participants, matches, opts) {
	return SwissCore.computeStandings(participants, matches, opts);
}

function isSwissStage(stage) {
	return /^Vòng (Swiss )?\d+$/.test(stage || "");
}

/* Nhóm 8 đội đúng theo thể thức custom (aaa.md) — chỉ áp dụng cho format "swiss".
   Marker customStage (đặt khi reset/seed) giữ nhận diện kể cả khi participants rỗng (đã về danh sách chờ). */
function isCustomStage(content) {
	return content.format === "swiss" && (content.customStage === true || (content.participants || []).length === 8);
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
					court: "", referee: "", sets: null
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
		el("h3", { text: "Danh sách vận động viên tham gia" }),
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

function renderGroupCard(content, group, title) {
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
	} else {
		const chipsWrap = el("div", { class: "pool-chips" });
		group.players.forEach(function (name) {
			const chip = el("span", { class: "pool-chip", text: name });
			if (editMode) {
				chip.appendChild(el("button", {
					class: "pool-chip-del", type: "button", title: "Đưa về danh sách chờ",
					onclick: function (e) { e.stopPropagation(); unassignCb(content, group)(name); },
				}, " ↩"));
			}
			chipsWrap.appendChild(chip);
		});
		card.appendChild(chipsWrap);
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

function renderGroupStandings(content, group, title) {
	const groupMatches = content.matches.filter(function (m) { return m.stage === "Vòng bảng — " + group.name; });
	const rows = computeStandings(group.players || [], groupMatches, { useHeadToHead: true });
	const wrap = el("div", { class: "group-card" });
	wrap.appendChild(el("h3", { text: title }));
	if (!group.players || !group.players.length) {
		wrap.appendChild(el("p", { class: "empty", style: "padding:12px 14px;" }, "Chưa có VĐV nào."));
		wrap.appendChild(el("p", { class: "standings-note" }, "Xếp theo: Thắng → Hiệu số séc → Đối đầu trực tiếp."));
	} else if (rows.every(function (r) { return r.played === 0; })) {
		wrap.appendChild(buildStandingsTable(rows, null, null, null, null, true));
		wrap.appendChild(el("p", { class: "standings-note" }, "Chưa có trận nào ghi nhận kết quả."));
		wrap.appendChild(el("p", { class: "standings-note" }, "Xếp theo: Thắng → Hiệu số séc → Đối đầu trực tiếp."));
	} else {
		wrap.appendChild(buildStandingsTable(rows, null, null, null, null, true));
		wrap.appendChild(el("p", { class: "standings-note" }, "Xếp theo: Thắng → Hiệu số séc → Đối đầu trực tiếp."));
	}
	return wrap;
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
	const wrap = el("div", { class: "groups-wrap" });
	outer.appendChild(wrap);
	if (content.format === "group") {
		(content.groups || []).forEach(function (g) {
			wrap.appendChild(renderGroupStandings(content, g, g.name));
		});
		if (editMode) {
			wrap.appendChild(el("div", { class: "group-card" }, [
				el("div", { class: "group-actions" }, [
					el("button", {
						class: "btn small outline danger-text", type: "button", onclick: function () {
							if (!confirm("Reset nội dung này về trạng thái ban đầu? Mọi trận đã nhập sẽ bị xóa.")) return;
							resetContentToSeed(content);
						}
					}, "↺ Reset"),
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

		if (isCustomStage(content)) {
			/* Nhóm 6/8 đội: xếp hạng tùy chỉnh thay bảng standings + nhánh; không dùng pair order */
			const participants = content.participants || [];
			const size = fixedGroupSize(content);
			const state = size === 6
				? CustomStage.computeFixedState6(participants, swissMatches)
				: CustomStage.computeFixedState(participants, swissMatches);
			if (!hasMatches) {
				card.appendChild(el("p", { class: "standings-note" }, "Chưa có trận nào — xếp " + (size === 6 ? "6" : "8") + " cặp từ danh sách chờ vào ô Hạt Giống ở mục Sơ đồ / Bảng đấu để bắt đầu"));
				card.appendChild(el("p", { class: "standings-note" }, "Xếp theo: Thắng → Hiệu số séc → Hiệu số điểm."));
			} else {
				card.appendChild(renderCustomRanking(state));
				card.appendChild(el("p", { class: "standings-note" }, "Xếp theo: Thắng → Hiệu số séc → Hiệu số điểm."));
			}
		} else if (!content.participants || !content.participants.length) {
			card.appendChild(el("p", { class: "empty", style: "padding:12px 14px;" }, "Chưa có cặp đấu nào."));
			card.appendChild(el("p", { class: "standings-note" }, "Xếp theo: Thắng → Hiệu số séc → Hiệu số điểm."));
		} else if (rows.every(function (r) { return r.played === 0; })) {
			card.appendChild(buildStandingsTable(rows, null, null, null, openHistory, true));
			card.appendChild(el("p", { class: "standings-note" }, "Chưa có trận nào ghi nhận kết quả."));
			card.appendChild(el("p", { class: "standings-note" }, "Xếp theo: Thắng → Hiệu số séc → Hiệu số điểm."));
		} else {
			card.appendChild(buildStandingsTable(rows, null, null, null, openHistory, true));
			card.appendChild(el("p", { class: "standings-note" }, "Xếp theo: Thắng → Hiệu số séc → Hiệu số điểm. Đội nghỉ vòng (bye) khi không thể ghép cặp tránh tái đấu."));
			card.appendChild(renderSwissBranches(rows));
		}
		if (editMode) {
			const actions = [];
			if (!isCustomStage(content)) {
				actions.push(el("button", {
					class: "btn small outline", type: "button", onclick: function () {
						if (!hasMatches && content.unassignedPairs && content.unassignedPairs.length) {
							alert("Còn " + content.unassignedPairs.length + " cặp chưa xếp vào ô số — kéo vào bảng trước khi sinh lịch.");
							return;
						}
						generateNextSwissRound(content);
					}
				}, "⚡ Tự sinh vòng tiếp theo"));
			}
			actions.push(el("button", {
				class: "btn small outline danger-text", type: "button", onclick: function () {
					if (!confirm("Reset nội dung này về trạng thái ban đầu? Mọi trận đã nhập sẽ bị xóa.")) return;
					resetContentToSeed(content);
				}
			}, "↺ Reset"));
			card.appendChild(el("div", { class: "group-actions" }, actions));
		}
		wrap.appendChild(card);
	}
	return outer;
}

/* ================================================================
   SECTION 1 — VĐV / cặp VĐV tham gia thi đấu
   ================================================================ */
function renderParticipantsSection(content) {
	const outer = el("div");
	if (content.format === "group") {
		outer.appendChild(renderPlayerPool(content));
		return outer;
	}
	/* swiss: chỉ hiện participants đã seed; danh sách chờ (unassignedPairs) do
	   renderSwissPairOrder / renderSeedPool đảm nhiệm — tránh trùng lặp. */
	const participants = content.participants || [];
	const waiting = content.unassignedPairs || [];
	const allPairs = participants.slice();
	waiting.forEach(function (n) { if (allPairs.indexOf(n) === -1) allPairs.push(n); });
	const swissMatches = content.matches.filter(function (m) { return isSwissStage(m.stage); });
	const hasMatches = swissMatches.length > 0;
	const wrap = el("div", { class: "pool-card" });
	wrap.appendChild(el("div", { class: "pool-head" }, [
		el("h3", { text: "Danh sách cặp đấu tham gia" }),
		el("span", { class: "pool-count", text: allPairs.length + " cặp tham gia" }),
	]));
	const chipsWrap = el("div", { class: "pool-chips" });
	if (!allPairs.length) {
		chipsWrap.appendChild(el("p", { class: "empty", style: "padding:4px 2px;" }, "Chưa có cặp nào."));
	} else {
		allPairs.forEach(function (name) {
			const chip = el("span", { class: "pool-chip", text: name });
			if (editMode && !isCustomStage(content) && participants.indexOf(name) !== -1) {
				chip.appendChild(el("button", {
					class: "pool-chip-del", type: "button", title: "Xoá khỏi danh sách",
					onclick: function (e) {
						e.stopPropagation();
						if (!confirm("Xoá \"" + name + "\" khỏi danh sách?")) return;
						content.participants = content.participants.filter(function (p) { return p !== name; });
						saveData(); renderAll();
					}
				}, " ×"));
			}
			chipsWrap.appendChild(chip);
		});
	}
	wrap.appendChild(chipsWrap);
	if (editMode && !isCustomStage(content)) {
		const input = el("input", { type: "text", placeholder: "Tên cặp đấu mới" });
		function addPair() {
			const name = input.value.trim();
			if (!name) return;
			const all = (content.participants || []).concat(content.unassignedPairs || []);
			if (all.indexOf(name) !== -1) { alert("Cặp \"" + name + "\" đã có trong danh sách."); return; }
			if (!hasMatches) {
				if (!content.unassignedPairs) content.unassignedPairs = [];
				content.unassignedPairs.push(name);
			} else {
				if (!content.participants) content.participants = [];
				content.participants.push(name);
			}
			saveData(); renderAll();
		}
		input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addPair(); } });
		wrap.appendChild(el("div", { class: "add-player-row" }, [
			input,
			el("button", { class: "btn small", type: "button", onclick: addPair }, "+ Thêm cặp"),
		]));
	}
	outer.appendChild(wrap);
	return outer;
}

/* ================================================================
   SECTION 2 — Sơ đồ / Bảng đấu
   ================================================================ */
function renderBracketSection(content) {
	const outer = el("div");
	if (content.format === "group") {
		const wrap = el("div", { class: "groups-wrap" });
		(content.groups || []).forEach(function (g) {
			wrap.appendChild(renderGroupCard(content, g, g.name));
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
		outer.appendChild(wrap);
		return outer;
	}
	/* swiss */
	const swissMatches = content.matches.filter(function (m) { return isSwissStage(m.stage); });
	const hasMatches = swissMatches.length > 0;
	if (editMode && !hasMatches && !isCustomStage(content)) {
		outer.appendChild(renderSwissPairOrder(content));
	}
	outer.appendChild(isCustomStage(content) ? renderCustomBracket(content) : renderSwissBracket(content));
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
	requestAnimationFrame(function () {
		drawSwissConnectors(track, participants, bracket);
	});
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

/* ================================================================
   CUSTOM STAGE — 8 đội: xếp hạng & bracket flowchart 7 cột
   ================================================================ */
function customRankRow(state, name, i, isFinal) {
	const rec = (state.records && state.records[name]) || { w: 0, l: 0 };
	const medals = ["🥇", "🥈", "🥉"];
	return el("div", { class: "custom-rank-row rank-" + (i + 1) }, [
		el("span", { class: "custom-rank-medal", text: isFinal ? medals[i] : (i + 1) + "." }),
		el("span", { class: "custom-rank-name", text: name }),
		el("span", { class: "custom-rank-record", text: rec.w + "-" + rec.l }),
	]);
}

function renderCustomRanking(state) {
	const isFinal = state.phase === "complete";
	const wrap = el("div", { class: "custom-rank" });
	state.ranking.forEach(function (name, i) {
		wrap.appendChild(customRankRow(state, name, i, isFinal));
	});
	if (isFinal && state.eliminated && state.eliminated.length) {
		wrap.appendChild(el("p", { class: "custom-eliminated", text: "Đã loại: " + state.eliminated.join(", ") }));
	}
	return wrap;
}

function renderBracketLegend() {
	return el("div", { class: "bracket-legend fixed-legend" }, [
		el("span", { class: "legend-item win" }, [
			el("span", { class: "legend-arrow win", text: "━━►" }),
			el("span", { text: "Thắng đi tiếp" }),
		]),
		el("span", { class: "legend-item loss" }, [
			el("span", { class: "legend-arrow loss", text: "╌╌❯" }),
			el("span", { text: "Thua xuống nhánh dưới" }),
		]),
		el("span", { class: "legend-item out" }, [
			el("span", { class: "legend-arrow out", text: "✕" }),
			el("span", { text: "Thua bị loại" }),
		]),
		el("span", { class: "legend-item gold" }, [
			el("span", { class: "legend-arrow gold", text: "═══►" }),
			el("span", { text: "Chung kết" }),
		]),
	]);
}

/* Kích thước nhóm = tổng đội (participants + danh sách chờ) — tránh nhầm 6/8 đội
   khi mới gán 6/8 seed của nhóm 8 đội. */
function fixedGroupSize(content) {
	return (content.participants || []).length + (content.unassignedPairs || []).length;
}

function renderCustomBracket(content) {
	const participants = content.participants || [];
	if (fixedGroupSize(content) === 6) return renderCustomBracket6(content);

	const section = el("div", { class: "swiss-bracket-card fixed-bracket" });
	section.appendChild(el("h3", { class: "swiss-bracket-title", text: "Sơ đồ thi đấu — nhóm 8 đội (14 trận cố định)" }));
	section.appendChild(renderBracketLegend());

	const customMatches = content.matches.filter(function (m) { return isSwissStage(m.stage); });
	const state = CustomStage.computeFixedState(participants, customMatches);
	const hasR1 = customMatches.some(function (m) { return m.pos && m.pos.indexOf("R1.") === 0; });
	const seedMode = editMode && !hasR1;

	if (seedMode) {
		section.appendChild(renderSeedPool(content));
	}

	const track = el("div", { class: "swiss-bracket-track fixed-track", "data-bracket-track": "1" });
	const headers = {
		1: ["VÒNG 1 (R1)", "Khai Mạc (0-0)", "4 TRẬN BO3", "8 Slot hạt giống bắt đầu"],
		2: ["VÒNG 2 (R2)", "Phân Nhánh 1-0 / 0-1", "4 TRẬN BO3", "Tách 2 nhánh: Thắng & Sinh Tử"],
		3: ["VÒNG 3 (R3)", "Vòng Đào Thải", "2 TRẬN BO3", "Thua R2(1-0) vs Thắng R2(0-1)"],
		4: ["VÒNG 4 (R4)", "Bán Kết Nhánh Thua", "1 TRẬN BO3", "Thắng R3 #1 vs Thắng R3 #2"],
		5: ["VÒNG 5 (R5)", "Chung Kết Nhánh Thua", "1 TRẬN BO3", "Thắng R4 vs Thua R6"],
		6: ["VÒNG 6 (R6)", "Định Hình Nhánh", "1 TRẬN BO3", "Thắng R2(1-0) #1 vs #2"],
		7: ["VÒNG 7 (R7)", "CHUNG KẾT TỔNG", "GRAND FINAL", "Trận Chiến Đoạt Ngai Vàng BO5"],
	};
	[1, 2, 3, 4, 5, 6, 7].forEach(function (r) {
		const h = headers[r];
		const col = el("div", { class: "swiss-round fixed-round r" + r });
		col.appendChild(el("div", { class: "fixed-round-head" }, [
			el("span", { class: "fixed-round-code", text: h[0] }),
			el("span", { class: "fixed-round-badge", text: h[2] }),
		]));
		col.appendChild(el("span", { class: "fixed-round-title", text: h[1] }));
		col.appendChild(el("span", { class: "fixed-round-sub", text: h[3] }));

		if (r === 2) {
			const winGroup = el("div", { class: "fixed-branch-group win" });
			winGroup.appendChild(el("div", { class: "fixed-branch-label win", text: "Nhánh Thắng (1-0)" }));
			state.bracket.filter(function (b) { return b.pos === "R2.1" || b.pos === "R2.2"; }).forEach(function (b) {
				winGroup.appendChild(buildFixedMatchNode(content, b, state.records, seedMode));
			});
			col.appendChild(winGroup);

			const lossGroup = el("div", { class: "fixed-branch-group loss" });
			lossGroup.appendChild(el("div", { class: "fixed-branch-label loss", text: "Nhánh Thua (0-1)" }));
			state.bracket.filter(function (b) { return b.pos === "R2.3" || b.pos === "R2.4"; }).forEach(function (b) {
				lossGroup.appendChild(buildFixedMatchNode(content, b, state.records, seedMode));
			});
			col.appendChild(lossGroup);

			col.appendChild(el("div", { class: "fixed-callout danger", text: "ĐIỂM THOÁT • HẠNG 7-8" }));
		} else {
			state.bracket.filter(function (b) { return b.round === r; }).forEach(function (b) {
				col.appendChild(buildFixedMatchNode(content, b, state.records, seedMode));
			});
			if (r === 3) col.appendChild(el("div", { class: "fixed-callout danger", text: "ĐIỂM THOÁT • HẠNG 5-6" }));
			if (r === 4) col.appendChild(el("div", { class: "fixed-callout danger", text: "ĐIỂM THOÁT • HẠNG 4" }));
			if (r === 5 && state.phase === "complete") col.appendChild(el("div", { class: "fixed-callout gold", text: "🥉 HẠNG 3" }));
			if (r === 7 && state.phase === "complete") col.appendChild(el("div", { class: "fixed-callout gold", text: "🏆 HẠNG 1 · 🥈 HẠNG 2" }));
		}
		track.appendChild(col);
		if (r < 7) {
			track.appendChild(el("div", { class: "fixed-connector", "data-gap": r + "-" + (r + 1) }));
		}
	});

	section.appendChild(track);
	requestAnimationFrame(function () {
		drawFixedConnectors(track, state.bracket);
	});
	return section;
}

/* Nhóm 6 đội — bracket linh hoạt 10 trận, 5 vòng. Case A/B do trận chéo R2.1 quyết định. */
function renderCustomBracket6(content) {
	const section = el("div", { class: "swiss-bracket-card fixed-bracket" });
	const participants = content.participants || [];
	const customMatches = content.matches.filter(function (m) { return isSwissStage(m.stage); });
	const state = CustomStage.computeFixedState6(participants, customMatches);
	const caseId = state.caseId || "A";
	const hasR1 = customMatches.some(function (m) { return m.pos && m.pos.indexOf("R1.") === 0; });
	const seedMode = editMode && !hasR1;

	section.appendChild(el("h3", { class: "swiss-bracket-title" }, [
		el("span", { text: "Sơ đồ thi đấu — nhóm 6 đội (10 trận linh hoạt)" }),
		el("span", { class: "fixed-case-badge " + (caseId === "A" ? "a" : "b"), text: "Case " + caseId }),
	]));
	section.appendChild(renderBracketLegend());

	if (seedMode) section.appendChild(renderSeedPool(content, 6));

	const track = el("div", { class: "swiss-bracket-track fixed-track", "data-bracket-track": "1" });
	const headers = {
		1: ["VÒNG 1 (R1)", "Khai Mạc (0-0)", "3 TRẬN BO3", "6 Slot hạt giống bắt đầu"],
		2: ["VÒNG 2 (R2)", "Phân Nhánh 1-0 / 0-1", "3 TRẬN BO3", "1 trận chéo + nhánh Thắng & Sinh Tử"],
		3: ["VÒNG 3 (R3)", "Vòng Đào Thải", "2 TRẬN BO3", caseId === "A" ? "1-1 vs 1-1 ×2 — thua loại" : "2-0 vs 2-0 · 1-1 vs 1-1"],
		4: ["VÒNG 4 (R4)", "Tranh Vé Chung Kết", "1 TRẬN BO3", "2-1 vs 2-1 — thua hạng 3"],
		5: ["VÒNG 5 (R5)", "CHUNG KẾT TỔNG", "GRAND FINAL", "Trận Chiến Đoạt Ngai Vàng BO5"],
	};
	[1, 2, 3, 4, 5].forEach(function (r) {
		const h = headers[r];
		const col = el("div", { class: "swiss-round fixed-round r" + r });
		col.appendChild(el("div", { class: "fixed-round-head" }, [
			el("span", { class: "fixed-round-code", text: h[0] }),
			el("span", { class: "fixed-round-badge", text: h[2] }),
		]));
		col.appendChild(el("span", { class: "fixed-round-title", text: h[1] }));
		col.appendChild(el("span", { class: "fixed-round-sub", text: h[3] }));

		if (r === 2) {
			const crossGroup = el("div", { class: "fixed-branch-group cross" });
			crossGroup.appendChild(el("div", { class: "fixed-branch-label cross", text: "Trận Chéo (1-0 vs 0-1)" }));
			state.bracket.filter(function (b) { return b.pos === "R2.1"; }).forEach(function (b) {
				crossGroup.appendChild(buildFixedMatchNode(content, b, state.records, seedMode, state.structure));
			});
			col.appendChild(crossGroup);

			const winGroup = el("div", { class: "fixed-branch-group win" });
			winGroup.appendChild(el("div", { class: "fixed-branch-label win", text: "Nhánh Thắng (1-0)" }));
			state.bracket.filter(function (b) { return b.pos === "R2.2"; }).forEach(function (b) {
				winGroup.appendChild(buildFixedMatchNode(content, b, state.records, seedMode, state.structure));
			});
			col.appendChild(winGroup);

			const lossGroup = el("div", { class: "fixed-branch-group loss" });
			lossGroup.appendChild(el("div", { class: "fixed-branch-label loss", text: "Nhánh Thua (0-1)" }));
			state.bracket.filter(function (b) { return b.pos === "R2.3"; }).forEach(function (b) {
				lossGroup.appendChild(buildFixedMatchNode(content, b, state.records, seedMode, state.structure));
			});
			col.appendChild(lossGroup);

			col.appendChild(el("div", { class: "fixed-callout danger", text: caseId === "A" ? "ĐIỂM THOÁT • HẠNG 6" : "ĐIỂM THOÁT • HẠNG 5-6" }));
		} else {
			state.bracket.filter(function (b) { return b.round === r; }).forEach(function (b) {
				col.appendChild(buildFixedMatchNode(content, b, state.records, seedMode, state.structure));
			});
			if (r === 3) col.appendChild(el("div", { class: "fixed-callout danger", text: caseId === "A" ? "ĐIỂM THOÁT • HẠNG 4-5" : "ĐIỂM THOÁT • HẠNG 4" }));
			if (r === 4 && state.phase === "complete") col.appendChild(el("div", { class: "fixed-callout gold", text: "🥉 HẠNG 3" }));
			if (r === 5 && state.phase === "complete") col.appendChild(el("div", { class: "fixed-callout gold", text: "🏆 HẠNG 1 · 🥈 HẠNG 2" }));
		}
		track.appendChild(col);
		if (r < 5) track.appendChild(el("div", { class: "fixed-connector", "data-gap": r + "-" + (r + 1) }));
	});

	section.appendChild(track);
	requestAnimationFrame(function () {
		drawFixedConnectors(track, state.bracket);
	});
	return section;
}

/* Trận kế tiếp nhận feed từ pos theo loại W/L — dùng cho flow hint + tag THUA/BỊ LOẠI.
   structure mặc định = STRUCTURE (8 đội); 6 đội truyền structure đã chọn. */
function fixedFeedDest(pos, type, structure) {
	structure = structure || CustomStage.STRUCTURE || [];
	for (let i = 0; i < structure.length; i++) {
		const feeds = structure[i].feeds || [];
		for (let j = 0; j < feeds.length; j++) {
			if (feeds[j][0] === type && feeds[j][1] === pos) return structure[i].pos;
		}
	}
	return null;
}

function buildFixedMatchNode(content, b, records, seedMode, structure) {
	const node = el("div", { class: "swiss-match fixed-match", "data-pos": b.pos, "data-round": b.round });
	const isSeedRound = seedMode && b.round === 1;

	/* Header trận: mã trận + badge BO3 (kiểu design) */
	node.appendChild(el("div", { class: "fixed-match-head" }, [
		el("span", { class: "fixed-match-code", text: "TRẬN " + b.pos.replace("R", "") }),
		el("span", { class: "fixed-bo3", text: "BO3" }),
	]));

	b.feeds.forEach(function (feed, i) {
		const team = b.teams[i];
		if (isSeedRound) {
			const seedNum = feed[1];
			const filled = !!(content.seedFilled || [])[seedNum - 1];
			const slot = el("div", { class: "seed-slot" + (filled ? " filled" : ""), "data-seed": seedNum, "data-side": String(i) });
			slot.appendChild(el("span", { class: "seed-num", text: String(seedNum) }));
			slot.appendChild(el("span", { class: "seed-slot-name", text: filled && team ? team : "Hạt Giống " + seedNum }));
			if (filled) {
				slot.appendChild(el("button", {
					class: "seed-unassign", type: "button", title: "Bỏ xếp hạt giống", text: "↩",
					onclick: function (e) { e.stopPropagation(); unassignSeed(content, seedNum); },
				}));
			}
			slot.addEventListener("dragover", function (e) { e.preventDefault(); slot.classList.add("dropzone-active"); });
			slot.addEventListener("dragleave", function () { slot.classList.remove("dropzone-active"); });
			slot.addEventListener("drop", function (e) {
				e.preventDefault();
				slot.classList.remove("dropzone-active");
				const name = dragPlayerName || e.dataTransfer.getData("text/plain");
				dragPlayerName = null;
				if (name) assignSeed(content, seedNum, name);
			});
			slot.addEventListener("click", function () {
				if (selectedPoolPlayer) { const name = selectedPoolPlayer; selectedPoolPlayer = null; assignSeed(content, seedNum, name); }
			});
			node.appendChild(slot);
		} else {
			const winner = b.match ? CustomStage.matchWinner(b.match) : null;
			const rec = (records && team && records[team]) || { w: 0, l: 0 };
			const isEmptyR1 = b.round === 1 && !b.match; /* R1 chưa có trận → hiện trống, không vẽ cặp từ seed */
			const side = el("div", {
				class: "swiss-side fixed-slot" + (winner === team ? " winner" : (winner ? " loser" : "")),
				"data-team-side": isEmptyR1 ? "" : (team || ""),
				"data-side": String(i),
			});
			/* Badge số hạt giống (chỉ R1 — feed loại S) */
			if (feed[0] === "S") {
				side.appendChild(el("span", { class: "fixed-slot-seed", text: String(feed[1]) }));
			}
			if (team && !isEmptyR1) {
				side.appendChild(el("button", { class: "swiss-side-name link-name", type: "button", text: team, onclick: function () { showTeamHistory(content, team); } }));
				side.appendChild(el("span", { class: "swiss-record", text: rec.w + "-" + rec.l }));
				if (winner) {
					const isWin = winner === team;
					const hasLossDest = !!fixedFeedDest(b.pos, "L", structure);
					const tag = isWin ? (b.round === 7 ? "HẠNG 1" : "THẮNG") : (hasLossDest ? "THUA" : (b.round === 7 ? "HẠNG 2" : "BỊ LOẠI"));
					side.appendChild(el("span", {
						class: "fixed-side-tag " + (isWin ? "win" : (hasLossDest ? "loss" : "out")),
						text: tag,
					}));
				}
			} else {
				side.appendChild(el("span", { class: "swiss-side-name seed-placeholder", text: b.round === 1 ? "Hạt Giống " + feed[1] : "Chờ kết quả" }));
			}
			node.appendChild(side);
		}
	});

	/* Flow hint: ▲ Thắng ➔ đâu / ▼ Thua ➔ đâu */
	const wDest = fixedFeedDest(b.pos, "W", structure);
	const lDest = fixedFeedDest(b.pos, "L", structure);
	if (wDest || lDest) {
		const parts = [];
		if (wDest) parts.push("▲ Thắng ➔ " + wDest);
		if (lDest) parts.push("▼ Thua ➔ " + lDest);
		node.appendChild(el("div", { class: "fixed-flow-hint", text: parts.join(" · ") }));
	}

	if (editMode && b.match && b.match.p1 && b.match.p2) {
		node.classList.add("clickable");
		node.addEventListener("click", function (e) {
			if (e.target.closest("button")) return;
			openFixedResultModal(content, b);
		});
	}

	return node;
}

function renderSeedPool(content, size) {
	size = size || 8;
	const pool = content.unassignedPairs || [];
	const wrap = el("div", { class: "pool-card seed-pool" });
	wrap.appendChild(el("div", { class: "pool-head" }, [
		el("h3", { text: "Danh sách chờ — xếp hạt giống (1-" + size + ")" }),
		el("span", { class: "pool-count", text: pool.length + " CẶP chưa xếp" }),
	]));

	if (editMode) {
		wrap.appendChild(el("p", { class: "pool-hint" },
			"Kéo (hoặc chạm để chọn rồi bấm ô) từng cặp vào ô Hạt Giống 1-" + size + " — R1 tự sinh khi đủ " + size + "."));
	}

	const chipsWrap = el("div", { class: "pool-chips" });
	if (!pool.length) {
		chipsWrap.appendChild(el("p", { class: "empty", style: "padding:4px 2px;" }, "Đã xếp đủ " + size + " cặp vào hạt giống."));
	} else {
		pool.forEach(function (name) {
			const chip = el("span", {
				class: "pool-chip" + (selectedPoolPlayer === name ? " selected" : ""),
				"data-team": name, text: name,
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
			}
			chipsWrap.appendChild(chip);
		});
	}
	wrap.appendChild(chipsWrap);
	return wrap;
}

function assignSeed(content, seedNum, team) {
	if (!content.participants) content.participants = [];
	if (!content.unassignedPairs) content.unassignedPairs = [];
	if (!content.seedFilled) content.seedFilled = [];
	/* Rời danh sách chờ (model mới) + rời vị trí seed cũ (state cũ / đổi seed) */
	const pi = content.unassignedPairs.indexOf(team);
	if (pi !== -1) content.unassignedPairs.splice(pi, 1);
	const oi = content.participants.indexOf(team);
	if (oi !== -1) content.participants.splice(oi, 1);
	/* Model mới (sau reset): ô seed rải rác → pad "" rồi gán thẳng vào đúng vị trí.
	   State cũ (đặc, chưa reset): đổi seed = xoá rồi chèn đúng vị trí (shift). */
	if (content.participants.indexOf("") !== -1 || content.participants.length < seedNum) {
		while (content.participants.length < seedNum) content.participants.push("");
		content.participants[seedNum - 1] = team;
	} else {
		content.participants.splice(seedNum - 1, 0, team);
	}
	content.seedFilled[seedNum - 1] = true;
	saveData();
	renderAll();
	ensureR1(content);
}

function unassignSeed(content, seedNum) {
	if (!content.participants) content.participants = [];
	if (!content.seedFilled) content.seedFilled = [];
	/* Đã ghi kết quả → không cho gỡ seed (tránh phá bracket đang chảy) */
	const hasResults = (content.matches || []).some(function (m) {
		return m.pos && (m.winner || (m.sets && m.sets.length));
	});
	if (hasResults) return false;
	const team = content.participants[seedNum - 1];
	/* Xoá các trận tự sinh chưa có kết quả (R1…) — bracket trở về trạng thái chưa đủ seed */
	content.matches = (content.matches || []).filter(function (m) { return !m.pos; });
	if (team && content.unassignedPairs.indexOf(team) === -1) content.unassignedPairs.push(team);
	content.participants[seedNum - 1] = "";
	content.seedFilled[seedNum - 1] = false;
	saveData();
	renderAll();
	return true;
}

function ensureR1(content) {
	const participants = content.participants || [];
	const seedFilled = content.seedFilled || [];
	const hasR1 = (content.matches || []).some(function (m) { return m.pos && m.pos.indexOf("R1.") === 0; });
	/* Kích thước nhóm = tổng đội (participants + danh sách chờ) — tránh tạo R1 6 đội
	   khi mới gán 6/8 seed của nhóm 8 đội. */
	const total = participants.length + (content.unassignedPairs || []).length;
	const size = (total === 8 || total === 6) ? total : 0;
	if (size === 0) return;
	/* every(Boolean) bỏ qua hole trong mảng thưa (seedFilled sau reset) → phải check tường minh các ô */
	const allSeedsFilled = seedFilled.length === size && [0, 1, 2, 3, 4, 5, 6, 7].slice(0, size).every(function (i) { return seedFilled[i] === true; });
	if (allSeedsFilled && !hasR1) {
		const rows = size === 8
			? [["R1.1", 0, 1], ["R1.2", 2, 3], ["R1.3", 4, 5], ["R1.4", 6, 7]]
			: [["R1.1", 0, 1], ["R1.2", 2, 3], ["R1.3", 4, 5]];
		rows.forEach(function (row) {
			content.matches.push({ stage: "Vòng 1", pos: row[0], p1: participants[row[1]], p2: participants[row[2]], court: "", referee: "", sets: null });
		});
		saveData();
		renderAll();
	}
}

function syncFixedBracket(content) {
	const participants = content.participants || [];
	const customMatches = content.matches.filter(function (m) { return isSwissStage(m.stage); });
	const bracket = fixedGroupSize(content) === 6
		? CustomStage.buildFixedBracket6(participants, customMatches)
		: CustomStage.buildFixedBracket(participants, customMatches);
	let changed = false;
	bracket.forEach(function (b) {
		if (b.round === 1) return; /* R1 do seed tạo */
		if (!b.match && b.teams[0] && b.teams[1]) {
			content.matches.push({ stage: "Vòng " + b.round, pos: b.pos, p1: b.teams[0], p2: b.teams[1], court: "", referee: "", sets: null });
			changed = true;
		} else if (b.match && b.teams[0] && b.teams[1] && (b.match.p1 !== b.teams[0] || b.match.p2 !== b.teams[1])) {
			b.match.p1 = b.teams[0]; b.match.p2 = b.teams[1]; changed = true;
		}
	});
	if (changed) { saveData(); renderAll(); }
}

function openFixedResultModal(content, b) {
	const m = b.match;
	if (!m || !m.p1 || !m.p2) return;
	const overlay = el("div", { class: "modal-backdrop" });
	const card = el("div", { class: "modal-card" });
	card.appendChild(el("div", { class: "modal-card-head" }, [
		el("h3", { text: b.pos + " — Vòng " + b.round + " (BO3)" }),
		el("button", { class: "modal-close", type: "button", text: "✕", onclick: function () { overlay.remove(); } }),
	]));
	card.appendChild(el("div", { class: "modal-card-teams" }, [
		el("span", { class: "fixed-modal-team", text: m.p1 }),
		el("span", { class: "fixed-modal-vs", text: "vs" }),
		el("span", { class: "fixed-modal-team", text: m.p2 }),
	]));

	const rows = setsToRows(m.sets);
	const inputsA = [], inputsB = [];
	const setsWrap = el("div", { class: "fixed-modal-sets" });
	for (let i = 0; i < 3; i++) {
		const ia = el("input", { type: "number", value: rows[i][0] });
		const ib = el("input", { type: "number", value: rows[i][1] });
		inputsA.push(ia); inputsB.push(ib);
		setsWrap.appendChild(el("div", { class: "set-edit-group" }, [
			el("span", { text: "Séc " + (i + 1) }), ia, el("span", { text: "–" }), ib,
		]));
	}
	function commitScore() {
		if (!commitSetsFromInputs(m, inputsA, inputsB)) return false;
		saveData();
		syncFixedBracket(content);
		return true;
	}
	inputsA.concat(inputsB).forEach(function (inp) { inp.addEventListener("change", commitScore); });
	card.appendChild(setsWrap);

	const quickRow = el("div", { class: "edit-row quick-win-row" }, [
		el("span", { class: "quick-win-label", text: "Chọn đội thắng nhanh:" }),
		el("button", { class: "btn small", type: "button", onclick: function () { m.winner = m.p1; m.sets = null; saveData(); syncFixedBracket(content); overlay.remove(); renderAll(); } }, "🏆 " + m.p1),
		el("button", { class: "btn small", type: "button", onclick: function () { m.winner = m.p2; m.sets = null; saveData(); syncFixedBracket(content); overlay.remove(); renderAll(); } }, "🏆 " + m.p2),
		el("button", { class: "btn small outline", type: "button", onclick: function () { m.winner = null; m.sets = null; saveData(); syncFixedBracket(content); overlay.remove(); renderAll(); } }, "Xoá kết quả"),
	]);
	card.appendChild(quickRow);
	card.appendChild(el("div", { class: "edit-row modal-save-row" }, [
		el("button", { class: "btn primary", type: "button", onclick: function () { if (commitScore()) { overlay.remove(); renderAll(); } } }, "💾 Lưu kết quả"),
	]));

	overlay.appendChild(card);
	overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });
	document.body.appendChild(overlay);
}

function drawFixedConnectors(track, bracket) {
	const byPos = {};
	bracket.forEach(function (b) { byPos[b.pos] = b; });

	/* Tập feed có hướng — chỉ vẽ khi trận nguồn đã có kết quả (winner) */
	const feeds = [];
	bracket.forEach(function (b) {
		b.feeds.forEach(function (feed, i) {
			if (feed[0] === "S") return; /* seed không có connector */
			const src = byPos[feed[1]];
			if (!src) return;
			feeds.push({ type: feed[0], srcPos: src.pos, dstPos: b.pos, dstSide: i, srcRound: src.round, dstRound: b.round });
		});
	});

	track.querySelectorAll(".fixed-connector").forEach(function (conn) {
		const gap = (conn.getAttribute("data-gap") || "").split("-");
		const r1 = Number(gap[0]), r2 = Number(gap[1]);
		const oldSvg = conn.querySelector("svg");
		if (oldSvg) conn.removeChild(oldSvg);

		const connRect = conn.getBoundingClientRect();
		const W = Math.max(connRect.width || 28, 28);
		const H = Math.max(connRect.height || 100, 100);
		const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svgEl.setAttribute("class", "fixed-connector-svg");
		svgEl.setAttribute("width", W);
		svgEl.setAttribute("height", H);
		svgEl.style.position = "absolute";
		svgEl.style.top = "0";
		svgEl.style.left = "0";
		svgEl.style.pointerEvents = "none";

		/* Mũi tên marker: xanh (thắng), đỏ (thua), vàng (chung kết) */
		const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
		[["arrow-win", "#34d399"], ["arrow-loss", "#ff6b5e"], ["arrow-gold", "#fbbf24"]].forEach(function (m) {
			const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
			marker.setAttribute("id", m[0]);
			marker.setAttribute("viewBox", "0 0 10 10");
			marker.setAttribute("refX", "9");
			marker.setAttribute("refY", "5");
			marker.setAttribute("markerWidth", "7");
			marker.setAttribute("markerHeight", "7");
			marker.setAttribute("orient", "auto-start-reverse");
			const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
			p.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
			p.setAttribute("fill", m[1]);
			marker.appendChild(p);
			defs.appendChild(marker);
		});
		svgEl.appendChild(defs);

		feeds.forEach(function (f) {
			/* Feed này có đi qua khe gap này không? */
			if (f.srcRound > r1 || f.dstRound < r2) return;

			const srcNode = track.querySelector('[data-pos="' + cssEscape(f.srcPos) + '"]');
			const dstNode = track.querySelector('[data-pos="' + cssEscape(f.dstPos) + '"]');
			if (!srcNode || !dstNode) return;

			const srcMatch = byPos[f.srcPos].match;
			const winner = srcMatch ? CustomStage.matchWinner(srcMatch) : null;
			if (!winner) return; /* chưa có kết quả → chưa vẽ */

			/* Tìm ô nguồn: W → ô thắng, L → ô thua */
			const srcSides = srcNode.querySelectorAll(".fixed-slot");
			let srcSide = null;
			for (let i = 0; i < srcSides.length; i++) {
				const ts = srcSides[i].getAttribute("data-team-side");
				if (!ts) continue;
				if (f.type === "W" && ts === winner) { srcSide = srcSides[i]; break; }
				if (f.type === "L" && ts !== winner) { srcSide = srcSides[i]; break; }
			}
			if (!srcSide) return;

			const dstSides = dstNode.querySelectorAll(".fixed-slot");
			const dstSide = dstSides[f.dstSide];
			if (!dstSide) return;

			const srcRect = srcSide.getBoundingClientRect();
			const dstRect = dstSide.getBoundingClientRect();
			const y1 = (srcRect.top + srcRect.bottom) / 2 - connRect.top;
			const y2 = (dstRect.top + dstRect.bottom) / 2 - connRect.top;
			const x1 = 2, x2 = W - 2;
			const yMain = y1; /* feed dài chạy ngang ở độ cao ô nguồn (các cột cùng top) */

			let d;
			if (f.srcRound === r1 && f.dstRound === r2) {
				d = "M " + x1 + " " + y1 + " C " + ((x1 + x2) / 2) + " " + y1 + ", " + ((x1 + x2) / 2) + " " + y2 + ", " + x2 + " " + y2;
			} else if (f.srcRound === r1) {
				d = "M " + x1 + " " + y1 + " L " + x2 + " " + y1;
			} else if (f.dstRound === r2) {
				d = "M " + x1 + " " + yMain + " C " + ((x1 + x2) / 2) + " " + yMain + ", " + ((x1 + x2) / 2) + " " + y2 + ", " + x2 + " " + y2;
			} else {
				d = "M " + x1 + " " + yMain + " L " + x2 + " " + yMain;
			}

			const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
			path.setAttribute("d", d);
			path.setAttribute("fill", "none");
			if (f.dstRound === 7) {
				path.setAttribute("stroke", "#fbbf24");
				path.setAttribute("stroke-width", "3");
			} else if (f.type === "W") {
				path.setAttribute("stroke", "#34d399");
				path.setAttribute("stroke-width", "2");
			} else {
				path.setAttribute("stroke", "#ff6b5e");
				path.setAttribute("stroke-width", "2");
				path.setAttribute("stroke-dasharray", "5 3");
			}
			/* Chỉ mũi tên ở đoạn cuối (kết thúc tại khe này) */
			if (f.dstRound === r2) {
				const markerId = f.dstRound === 7 ? "arrow-gold" : (f.type === "W" ? "arrow-win" : "arrow-loss");
				path.setAttribute("marker-end", "url(#" + markerId + ")");
			}
			svgEl.appendChild(path);
		});

		conn.appendChild(svgEl);
	});
}

let bracketResizeTimer = null;
function drawSwissConnectors(track, participants, bracket) {
	const svg = track.querySelector("svg.swiss-connectors");
	if (svg) svg.remove();
	const rounds = track.querySelectorAll(".swiss-round");
	if (rounds.length < 2) return;
	const teamsInRound = [];
	bracket.forEach(function (roundData, ri) {
		const map = {};
		roundData.groups.forEach(function (g) {
			g.matches.forEach(function (m) {
				const node = rounds[ri].querySelector('.swiss-match[data-team="' + cssEscape(m.p1) + '"]');
				const side = node ? node.querySelector('[data-team-side="' + cssEscape(m.p1) + '"]') : null;
				if (side) map[m.p1] = side.getBoundingClientRect();
			});
		});
		roundData.bye.forEach(function (name) {
			const node = rounds[ri].querySelector('.swiss-bye-node[data-team="' + cssEscape(name) + '"]');
			if (node) map[name] = node.getBoundingClientRect();
		});
		teamsInRound.push(map);
	});
	const trackRect = track.getBoundingClientRect();
	const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svgEl.setAttribute("class", "swiss-connectors");
	svgEl.setAttribute("width", track.scrollWidth);
	svgEl.setAttribute("height", track.scrollHeight);
	svgEl.style.position = "absolute";
	svgEl.style.top = "0";
	svgEl.style.left = "0";
	svgEl.style.pointerEvents = "none";
	for (let ri = 0; ri < teamsInRound.length - 1; ri++) {
		const cur = teamsInRound[ri], next = teamsInRound[ri + 1];
		participants.forEach(function (name) {
			const a = cur[name], b = next[name];
			if (!a || !b) return;
			const x1 = a.right - trackRect.left, y1 = (a.top + a.bottom) / 2 - trackRect.top;
			const x2 = b.left - trackRect.left, y2 = (b.top + b.bottom) / 2 - trackRect.top;
			const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
			path.setAttribute("d", "M " + x1 + " " + y1 + " C " + ((x1 + x2) / 2) + " " + y1 + ", " + ((x1 + x2) / 2) + " " + y2 + ", " + x2 + " " + y2);
			path.setAttribute("fill", "none");
			path.setAttribute("stroke", "var(--line-strong)");
			path.setAttribute("stroke-width", "2");
			path.setAttribute("opacity", "0.7");
			svgEl.appendChild(path);
		});
	}
	track.insertBefore(svgEl, track.firstChild);
}
function cssEscape(s) { return String(s).replace(/["\\]/g, "\\$&"); }

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
		content.matches.push({ stage: stage, p1: pair[0], p2: pair[1], court: "", referee: "", sets: null });
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
		if (a === "" && b === "") continue; /* bỏ cặp trống hoàn toàn */
		if (a === "" || b === "") return null; /* cặp nửa chừng → chưa commit */
		sets.push([Number(a), Number(b)]);
	}
	return sets.length ? sets : null;
}

/* Commit tỉ số: chỉ commit khi đủ cặp hoàn chỉnh; cặp nửa chừng → KHÔNG đụng m.sets
   (tránh mất số vừa nhập khi tab qua ô kế tiếp). Trả về true nếu đã commit. */
function commitSetsFromInputs(m, inputsA, inputsB) {
	const s = readSetsFromInputs(inputsA, inputsB);
	if (!s) return false;
	m.sets = s;
	m.winner = null;
	return true;
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
	function commitScore() { if (!commitSetsFromInputs(m, inputsA, inputsB)) return; saveData(); if (isCustomStage(content)) syncFixedBracket(content); }
	inputsA.concat(inputsB).forEach(function (inp) { inp.addEventListener("change", commitScore); });
	card.appendChild(setsWrap);
	/* Rời khỏi nhóm ô nhập (Tab sang meta / click ngoài) → render lại để cập nhật hiển thị;
	   Tab giữa các ô trong nhóm → giữ focus, không rebuild. */
	setsWrap.addEventListener("focusout", function (e) {
		const next = e.relatedTarget;
		if (next && setsWrap.contains(next)) return;
		renderAll();
	});

	if (isSwiss) {
		const quickRow = el("div", { class: "edit-row quick-win-row" }, [
			el("span", { class: "quick-win-label", text: "Chọn đội thắng nhanh:" }),
			el("button", { class: "btn small", type: "button", onclick: function () { if (!m.p1 || !m.p2) return; m.winner = m.p1; m.sets = null; saveData(); if (isCustomStage(content)) syncFixedBracket(content); renderAll(); } }, "🏆 " + (m.p1 || "Đội 1")),
			el("button", { class: "btn small", type: "button", onclick: function () { if (!m.p1 || !m.p2) return; m.winner = m.p2; m.sets = null; saveData(); if (isCustomStage(content)) syncFixedBracket(content); renderAll(); } }, "🏆 " + (m.p2 || "Đội 2")),
			el("button", { class: "btn small outline", type: "button", onclick: function () { m.winner = null; m.sets = null; saveData(); if (isCustomStage(content)) syncFixedBracket(content); renderAll(); } }, "Xoá kết quả"),
		]);
		card.appendChild(quickRow);
	}

	const courtInput = el("input", { type: "text", value: m.court || "", placeholder: "sân" });
	const refInput = el("input", { type: "text", value: m.referee || "", placeholder: "trọng tài" });
	const metaRow = el("div", { class: "edit-row" }, [
		el("label", {}, ["Sân", courtInput]),
		el("label", {}, ["Trọng tài", refInput]),
	]);
	card.appendChild(metaRow);

	function commitMeta() { m.court = courtInput.value; m.referee = refInput.value; saveData(); }
	[courtInput, refInput].forEach(function (inp) { inp.addEventListener("change", commitMeta); });

	function commitPlayers() { m.p1 = p1Input.value.trim() || m.p1; m.p2 = p2Input.value.trim() || m.p2; if (m.winner && m.winner !== m.p1 && m.winner !== m.p2) m.winner = null; saveData(); if (isCustomStage(content)) syncFixedBracket(content); renderAll(); }
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
	const courtInput = el("input", { type: "text", placeholder: "vd: Sân 1" });
	const refInput = el("input", { type: "text", placeholder: "(tuỳ chọn)" });

	const grid = el("div", { class: "add-match-grid" }, [
		el("label", {}, ["Giai đoạn / Vòng", stageInput]),
		el("label", {}, ["VĐV / cặp 1", p1Input]),
		el("label", {}, ["VĐV / cặp 2", p2Input]),
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

	const participantsSection = el("section", { class: "block" }, [
		el("h2", { class: "block-title", text: "VĐV / cặp VĐV tham gia thi đấu" }),
		renderParticipantsSection(content),
	]);
	mainEl.appendChild(participantsSection);

	const bracketSection = el("section", { class: "block" }, [
		el("h2", { class: "block-title", text: "Sơ đồ / Bảng đấu" }),
		renderBracketSection(content),
	]);
	mainEl.appendChild(bracketSection);

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

window.addEventListener("resize", function () {
	clearTimeout(bracketResizeTimer);
	bracketResizeTimer = setTimeout(function () {
		const track = document.querySelector("[data-bracket-track]");
		if (!track) return;
		const content = data.contents.find(function (c) { return c.id === activeId; });
		if (!content || content.format !== "swiss") return;
		const swissMatches = content.matches.filter(function (m) { return isSwissStage(m.stage); });
		if (isCustomStage(content)) {
			const bracket = CustomStage.computeFixedState(content.participants || [], swissMatches).bracket;
			drawFixedConnectors(track, bracket);
		} else {
			const bracket = SwissCore.buildSwissBracket(content.participants || [], swissMatches, 5);
			drawSwissConnectors(track, content.participants || [], bracket);
		}
	}, 150);
});

initTheme();
loadData();