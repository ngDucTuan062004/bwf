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

const tabsEl = document.getElementById("tabs");
const mainEl = document.getElementById("main");
const datesEl = document.getElementById("event-dates");
const editBtn = document.getElementById("edit-toggle-btn");
const bannerWrap = document.getElementById("banner-wrap");
const fetchWarningWrap = document.getElementById("fetch-warning-wrap");

/* ---------- tiny DOM helper ---------- */
function el(tag, attrs, children){
  attrs = attrs || {};
  const e = document.createElement(tag);
  for(const k in attrs){
    if(!attrs.hasOwnProperty(k)) continue;
    const v = attrs[k];
    if(v == null) continue;
    if(k === "class") e.className = v;
    else if(k === "text") e.textContent = v;
    else if(k.indexOf("on") === 0 && typeof v === "function") e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  const kids = children == null ? [] : (Array.isArray(children) ? children : [children]);
  kids.forEach(function(c){
    if(c == null) return;
    e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return e;
}
function clear(node){ while(node.firstChild) node.removeChild(node.firstChild); }

/* ================================================================
   LOAD / SAVE
   ================================================================ */
async function loadData(){
  try{
    const res = await fetch("/api/data", { cache: "no-store" });
    if(res.ok){
      data = await res.json();
      if(data && data.contents) return init();
    }
  }catch(e){ /* API không có → fallback */ }

  try{
    const res = await fetch("data.json", { cache: "no-store" });
    if(!res.ok) throw new Error("HTTP " + res.status);
    data = await res.json();
    fetchFailed = true;
  }catch(e){
    data = { event: { dateRange: "30/9 – 04/10/2026" }, contents: [] };
    fetchFailed = true;
  }
  init();
}

async function saveData(){
  if(!isAdmin || !adminToken) return;
  try{
    const res = await fetch("/api/data", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + adminToken },
      body: JSON.stringify(data)
    });
    if(!res.ok){
      const j = await res.json().catch(function(){ return {}; });
      alert("Lưu thất bại: " + (j.error || ("HTTP " + res.status)));
    }else{
      flashSaved();
    }
  }catch(e){
    alert("Lưu thất bại (không kết nối được server): " + e.message);
  }
}

let saveFlashTimer = null;
function flashSaved(){
  const badge = document.getElementById("save-status");
  if(!badge) return;
  badge.textContent = "✓ Đã lưu";
  clearTimeout(saveFlashTimer);
  saveFlashTimer = setTimeout(function(){ badge.textContent = ""; }, 1800);
}

function init(){
  datesEl.textContent = (data.event && data.event.dateRange) || "";
  renderFetchWarning();
  if(!data.contents || !data.contents.length){
    data.contents = [];
  }
  if(!data.contents.some(function(c){ return c.id === activeId; })){
    activeId = data.contents.length ? data.contents[0].id : null;
  }
  buildTabs();
  renderAll();
}

function renderFetchWarning(){
  clear(fetchWarningWrap);
  if(fetchFailed){
    fetchWarningWrap.appendChild(el("div", {class:"fetch-warning"},
      "⚠ Không kết nối được API — đang hiển thị dữ liệu từ data.json. Khi deploy lên Vercel, dữ liệu sẽ được lưu trên server."));
  }
}

function renderBanner(){
  clear(bannerWrap);
  if(!editMode) return;
  const inner = el("div", {class:"banner-inner edit"}, [
    el("span", {}, "🟢 Đang chỉnh sửa — mọi thay đổi được lưu ngay lên server cho tất cả mọi người."),
    el("div", {class:"actions"}, [
      el("span", {id:"save-status", style:"font-weight:600;"}, ""),
      el("button", {class:"btn small outline", onclick: function(){ editMode = false; buildTabs(); renderAll(); }}, "Thoát chỉnh sửa"),
    ]),
  ]);
  bannerWrap.appendChild(inner);
}

/* ================================================================
   TABS
   ================================================================ */
function buildTabs(){
  clear(tabsEl);
  data.contents.forEach(function(c){
    const btn = el("button", {
      type:"button",
      role:"tab",
      "aria-selected": c.id === activeId ? "true" : "false",
      onclick: function(){ selectTab(c.id); },
      text: c.label,
    });
    btn.dataset.id = c.id;
    tabsEl.appendChild(btn);
  });
  if(editMode){
    tabsEl.appendChild(el("button", {class:"add-tab", type:"button", title:"Thêm nội dung mới", onclick: openAddContentModal}, "+"));
  }
}

function updateTabSelection(){
  Array.prototype.forEach.call(tabsEl.querySelectorAll("button[role='tab']"), function(b){
    b.setAttribute("aria-selected", b.dataset.id === activeId ? "true" : "false");
  });
}

function selectTab(id){
  activeId = id;
  updateTabSelection();
  renderAll();
}

/* ================================================================
   MODAL
   ================================================================ */
function showModal(title, bodyEl){
  const overlay = el("div", {class:"modal-overlay"});
  const box = el("div", {class:"modal"}, [
    el("div", {class:"modal-head"}, [
      el("h3", {text: title}),
      el("button", {class:"modal-close", type:"button", text:"×", onclick: function(){ overlay.remove(); }}),
    ]),
    bodyEl,
  ]);
  overlay.appendChild(box);
  overlay.addEventListener("click", function(e){ if(e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  return overlay;
}

/* ================================================================
   CONTENT MANAGEMENT
   ================================================================ */
function openAddContentModal(){
  const labelInput = el("input", {type:"text", placeholder:"VD: Đơn nam, Đôi nữ..."});
  const formatSelect = el("select", {}, [
    el("option", {value:"group", text:"Chia bảng vòng tròn (group)"}),
    el("option", {value:"swiss", text:"Thể thức Swiss"}),
  ]);
  const body = el("div", {}, [
    el("label", {}, ["Tên nội dung", labelInput]),
    el("label", {}, ["Thể thức", formatSelect]),
    el("div", {class:"actions"}, [
      el("button", {class:"btn", type:"button", onclick: function(){
        const label = labelInput.value.trim();
        if(!label){ alert("Vui lòng nhập tên nội dung."); return; }
        const format = formatSelect.value;
        const id = "content-" + Date.now();
        const content = format === "swiss"
          ? { id: id, label: label, format: format, scoringNote: "", participants: [], matches: [] }
          : { id: id, label: label, format: format, scoringNote: "", groups: [{ name: "Bảng A", players: [] }], matches: [] };
        data.contents.push(content);
        activeId = id;
        saveData();
        buildTabs();
        renderAll();
        overlay.remove();
      }}, "Thêm"),
    ]),
  ]);
  const overlay = showModal("Thêm nội dung thi đấu", body);
  labelInput.focus();
}

function openEditContentModal(content){
  const labelInput = el("input", {type:"text", value: content.label});
  const noteInput = el("textarea", {value: content.scoringNote || ""});
  const body = el("div", {}, [
    el("label", {}, ["Tên nội dung", labelInput]),
    el("label", {}, ["Ghi chú cách tính điểm", noteInput]),
    el("div", {class:"actions"}, [
      el("button", {class:"btn danger-text", type:"button", text:"Xoá nội dung", onclick: function(){
        if(!confirm("Xoá nội dung \"" + content.label + "\" và toàn bộ dữ liệu của nó?")) return;
        data.contents = data.contents.filter(function(c){ return c !== content; });
        if(activeId === content.id) activeId = data.contents.length ? data.contents[0].id : null;
        saveData();
        buildTabs();
        renderAll();
        overlay.remove();
      }}),
      el("span", {class:"spacer"}),
      el("button", {class:"btn outline", type:"button", text:"Huỷ", onclick: function(){ overlay.remove(); }}),
      el("button", {class:"btn", type:"button", text:"Lưu", onclick: function(){
        content.label = labelInput.value.trim() || content.label;
        content.scoringNote = noteInput.value.trim();
        saveData();
        buildTabs();
        renderAll();
        overlay.remove();
      }}),
    ]),
  ]);
  const overlay = showModal("Chỉnh sửa nội dung", body);
}

/* ================================================================
   SCORE HELPERS
   ================================================================ */
function countSets(sets){
  let s1=0, s2=0, pf1=0, pf2=0;
  sets.forEach(function(pair){
    const a = pair[0], b = pair[1];
    pf1+=a; pf2+=b;
    if(a>b) s1++; else if(b>a) s2++;
  });
  return { s1:s1, s2:s2, pf1:pf1, pf2:pf2 };
}

function computeStandings(participants, matches){
  const table = {};
  participants.forEach(function(name){
    table[name] = { name:name, played:0, wins:0, losses:0, setsFor:0, setsAgainst:0, ptsFor:0, ptsAgainst:0 };
  });
  matches.forEach(function(m){
    if(!m.sets || !m.sets.length) return;
    if(!(m.p1 in table) || !(m.p2 in table)) return;
    const r = countSets(m.sets);
    const r1 = table[m.p1], r2 = table[m.p2];
    r1.played++; r2.played++;
    r1.setsFor += r.s1; r1.setsAgainst += r.s2;
    r2.setsFor += r.s2; r2.setsAgainst += r.s1;
    r1.ptsFor += r.pf1; r1.ptsAgainst += r.pf2;
    r2.ptsFor += r.pf2; r2.ptsAgainst += r.pf1;
    if(r.s1 > r.s2){ r1.wins++; r2.losses++; } else if(r.s2 > r.s1){ r2.wins++; r1.losses++; }
  });
  return Object.keys(table).map(function(k){ return table[k]; }).sort(function(a,b){
    return (b.wins - a.wins) ||
      ((b.setsFor-b.setsAgainst) - (a.setsFor-a.setsAgainst)) ||
      ((b.ptsFor-b.ptsAgainst) - (a.ptsFor-a.ptsAgainst));
  });
}

function allParticipants(content){
  if(content.format === "group"){
    let list = [];
    (content.groups || []).forEach(function(g){ list = list.concat(g.players || []); });
    return list;
  }
  return content.participants || [];
}

/* ================================================================
   ROUND ROBIN — tự sinh trận vòng bảng
   ================================================================ */
function generateRoundRobin(content, group){
  const players = group.players || [];
  if(players.length < 2){ alert("Cần ít nhất 2 VĐV để sinh lịch."); return; }
  const stage = "Vòng bảng — " + group.name;
  const existing = new Set();
  content.matches.forEach(function(m){
    if(m.stage === stage && m.p1 && m.p2){
      existing.add([m.p1, m.p2].sort().join("|"));
    }
  });
  const added = [];
  for(let i=0;i<players.length;i++){
    for(let j=i+1;j<players.length;j++){
      const key = [players[i], players[j]].sort().join("|");
      if(!existing.has(key)){
        content.matches.push({
          stage: stage, p1: players[i], p2: players[j],
          date: "", time: "", court: "", referee: "", sets: null
        });
        added.push(players[i] + " vs " + players[j]);
      }
    }
  }
  if(added.length){
    saveData();
    renderAll();
    alert("Đã thêm " + added.length + " trận:\n" + added.join("\n"));
  }else{
    alert("Tất cả các cặp trong bảng đã có lịch thi đấu rồi.");
  }
}

/* ================================================================
   RENDER: STANDINGS
   ================================================================ */
function renderStandingsGroupCard(content, group, title){
  const groupMatches = content.matches.filter(function(m){ return m.stage === "Vòng bảng — " + group.name; });
  const rows = computeStandings(group.players || [], groupMatches);
  const card = el("div", {class:"group-card"});
  const headerChildren = [el("span", {text: title})];
  if(editMode){
    headerChildren.push(el("button", {class:"del-group", type:"button", title:"Xoá bảng", text:"×", onclick: function(){
      if(!confirm("Xoá bảng \"" + group.name + "\" và các VĐV trong đó?")) return;
      content.groups = content.groups.filter(function(g){ return g !== group; });
      saveData();
      renderAll();
    }}));
  }
  card.appendChild(el("h3", {}, headerChildren));

  if(!group.players || !group.players.length){
    card.appendChild(el("p", {class:"empty", style:"padding:12px 14px;"}, "Chưa có VĐV nào."));
  }else if(rows.every(function(r){ return r.played===0; })){
    card.appendChild(buildStandingsTable(rows, editMode ? deletePlayerCb(content, group) : null));
    card.appendChild(el("p", {class:"standings-note"}, "Chưa có trận nào ghi nhận kết quả."));
  }else{
    card.appendChild(buildStandingsTable(rows, editMode ? deletePlayerCb(content, group) : null));
    card.appendChild(el("p", {class:"standings-note"}, "Xếp theo: Thắng → Hiệu số séc → Hiệu số điểm."));
  }

  if(editMode){
    const input = el("input", {type:"text", placeholder:"Tên VĐV / cặp đấu mới"});
    const addRow = el("div", {class:"add-player-row"}, [
      input,
      el("button", {class:"btn small", type:"button", onclick: function(){
        const name = input.value.trim();
        if(!name) return;
        if(group.players.indexOf(name) === -1){ group.players.push(name); saveData(); renderAll(); }
        input.value = "";
      }}, "+ Thêm"),
    ]);
    card.appendChild(addRow);
    card.appendChild(el("div", {class:"group-actions"}, [
      el("button", {class:"btn small outline", type:"button", onclick: function(){ generateRoundRobin(content, group); }}, "⚡ Tự sinh lịch thi đấu"),
    ]));
  }
  return card;

  function deletePlayerCb(cnt, grp){
    return function(name){
      if(!confirm("Xoá \"" + name + "\" khỏi danh sách?")) return;
      grp.players = grp.players.filter(function(p){ return p!==name; });
      saveData();
      renderAll();
    };
  }
}

function buildStandingsTable(rows, onDeletePlayer){
  const thead = el("thead", {}, el("tr", {}, [
    el("th", {text:"VĐV / Cặp đấu"}),
    el("th", {class:"num", text:"Trận"}),
    el("th", {class:"num", text:"Thắng"}),
    el("th", {class:"num", text:"Thua"}),
    el("th", {class:"num", text:"Séc"}),
    el("th", {class:"num", text:"Điểm"}),
  ]));
  const tbody = el("tbody");
  rows.forEach(function(r, i){
    const nameCell = el("td", {}, r.name);
    if(onDeletePlayer){
      nameCell.appendChild(el("button", {class:"del-player", type:"button", title:"Xoá", onclick: function(){
        onDeletePlayer(r.name);
      }}, " ×"));
    }
    const tr = el("tr", {class: i===0 ? "rank-1" : (i===1 ? "rank-2" : "")}, [
      nameCell,
      el("td", {class:"num", text:String(r.played)}),
      el("td", {class:"num", text:String(r.wins)}),
      el("td", {class:"num", text:String(r.losses)}),
      el("td", {class:"num", text: r.setsFor+"-"+r.setsAgainst}),
      el("td", {class:"num", text: r.ptsFor+"-"+r.ptsAgainst}),
    ]);
    tbody.appendChild(tr);
  });
  return el("table", {class:"standings"}, [thead, tbody]);
}

function renderStandingsSection(content){
  const wrap = el("div", {class:"groups-wrap"});
  if(content.format === "group"){
    (content.groups || []).forEach(function(g){
      wrap.appendChild(renderStandingsGroupCard(content, g, g.name));
    });
    if(editMode){
      wrap.appendChild(el("div", {class:"group-card"}, [
        el("h3", {text:"+ Bảng mới"}),
        el("div", {class:"add-player-row"}, [
          el("button", {class:"btn small", type:"button", onclick: function(){
            const name = prompt("Tên bảng mới (VD: Bảng C):");
            if(!name) return;
            content.groups.push({ name: name.trim(), players: [] });
            saveData();
            renderAll();
          }}, "+ Thêm bảng"),
        ]),
      ]));
    }
  }else{
    const swissMatches = content.matches.filter(function(m){ return (m.stage || "").indexOf("Swiss") !== -1; });
    const rows = computeStandings(content.participants || [], swissMatches);
    const card = el("div", {class:"group-card"});
    card.appendChild(el("h3", {text:"Xếp hạng vòng Swiss"}));
    if(!content.participants || !content.participants.length){
      card.appendChild(el("p", {class:"empty", style:"padding:12px 14px;"}, "Chưa có cặp đấu nào."));
    }else if(rows.every(function(r){ return r.played===0; })){
      card.appendChild(buildStandingsTable(rows, editMode ? function(name){
        if(!confirm("Xoá \"" + name + "\" khỏi danh sách?")) return;
        content.participants = content.participants.filter(function(p){ return p!==name; });
        saveData(); renderAll();
      } : null));
      card.appendChild(el("p", {class:"standings-note"}, "Chưa có trận nào ghi nhận kết quả."));
    }else{
      card.appendChild(buildStandingsTable(rows, editMode ? function(name){
        if(!confirm("Xoá \"" + name + "\" khỏi danh sách?")) return;
        content.participants = content.participants.filter(function(p){ return p!==name; });
        saveData(); renderAll();
      } : null));
      card.appendChild(el("p", {class:"standings-note"}, "Xếp theo: Thắng → Hiệu số séc → Hiệu số điểm."));
    }
    if(editMode){
      const input = el("input", {type:"text", placeholder:"Tên cặp đấu mới"});
      const addRow = el("div", {class:"add-player-row"}, [
        input,
        el("button", {class:"btn small", type:"button", onclick: function(){
          const name = input.value.trim();
          if(!name) return;
          if(content.participants.indexOf(name) === -1){ content.participants.push(name); saveData(); renderAll(); }
          input.value = "";
        }}, "+ Thêm"),
      ]);
      card.appendChild(addRow);
    }
    wrap.appendChild(card);
  }
  return wrap;
}

/* ================================================================
   RENDER: MATCHES
   ================================================================ */
function setsToRows(sets){
  const rows = [["",""],["",""],["",""]];
  if(sets){
    sets.forEach(function(pair, i){ if(i<3) rows[i] = [String(pair[0]), String(pair[1])]; });
  }
  return rows;
}

function readSetsFromInputs(inputsA, inputsB){
  const sets = [];
  for(let i=0;i<3;i++){
    const a = inputsA[i].value.trim(), b = inputsB[i].value.trim();
    if(a === "" || b === "") break;
    sets.push([Number(a), Number(b)]);
  }
  return sets.length ? sets : null;
}

function renderMatchCard(m, content){
  const hasScore = !!(m.sets && m.sets.length);
  let winner = null;
  if(hasScore){
    const r = countSets(m.sets);
    winner = r.s1 > r.s2 ? m.p1 : (r.s2 > r.s1 ? m.p2 : null);
  }

  const card = el("div", {class:"match-card"});

  if(!editMode){
    const p1span = el("span", {class:"p" + (winner===m.p1 ? " winner":""), text:m.p1});
    const p2span = el("span", {class:"p" + (winner===m.p2 ? " winner":""), text:m.p2});
    const top = el("div", {class:"match-top"}, [
      el("div", {class:"players"}, [p1span, el("span", {class:"vs", text:"vs"}), p2span]),
      el("span", {class:"status-pill " + (hasScore?"done":"pending"), text: hasScore ? "Đã kết thúc" : "Sắp diễn ra"}),
    ]);
    card.appendChild(top);
    if(hasScore){
      const setsRow = el("div", {class:"sets-row"});
      m.sets.forEach(function(pair){ setsRow.appendChild(el("span", {class:"set-chip", text: pair[0]+"–"+pair[1]})); });
      card.appendChild(setsRow);
    }else{
      card.appendChild(el("span", {class:"no-score", text:"Chưa có kết quả"}));
    }
    const metaParts = [];
    if(m.date) metaParts.push(el("span", {text: "📅 " + m.date + (m.time ? " · "+m.time : "")}));
    if(m.court) metaParts.push(el("span", {text: "📍 " + m.court}));
    if(m.referee) metaParts.push(el("span", {text: "🧑‍⚖️ " + m.referee}));
    if(metaParts.length) card.appendChild(el("div", {class:"match-meta"}, metaParts));
    return card;
  }

  /* ---- edit mode ---- */
  const participants = allParticipants(content);
  const dlId = "dl-" + content.id;

  const p1Input = el("input", {type:"text", list:dlId, value:m.p1});
  const p2Input = el("input", {type:"text", list:dlId, value:m.p2});
  const top = el("div", {class:"match-top"}, [
    el("div", {class:"players edit-row"}, [p1Input, el("span", {class:"vs", text:"vs"}), p2Input]),
    el("span", {class:"status-pill " + (hasScore?"done":"pending"), text: hasScore ? "Đã kết thúc" : "Sắp diễn ra"}),
  ]);
  card.appendChild(top);

  const rows = setsToRows(m.sets);
  const inputsA = [], inputsB = [];
  const setsWrap = el("div", {class:"edit-row"});
  for(let i=0;i<3;i++){
    const ia = el("input", {type:"number", value: rows[i][0]});
    const ib = el("input", {type:"number", value: rows[i][1]});
    inputsA.push(ia); inputsB.push(ib);
    setsWrap.appendChild(el("div", {class:"set-edit-group"}, [
      el("span", {text:"Séc "+(i+1)}), ia, el("span", {text:"–"}), ib,
    ]));
  }
  function commitScore(){ m.sets = readSetsFromInputs(inputsA, inputsB); saveData(); renderAll(); }
  inputsA.concat(inputsB).forEach(function(inp){ inp.addEventListener("change", commitScore); });
  card.appendChild(setsWrap);

  const dateInput = el("input", {type:"text", value:m.date||"", placeholder:"dd/mm/yyyy"});
  const timeInput = el("input", {type:"text", value:m.time||"", placeholder:"giờ"});
  const courtInput = el("input", {type:"text", value:m.court||"", placeholder:"sân"});
  const refInput = el("input", {type:"text", value:m.referee||"", placeholder:"trọng tài"});
  const metaRow = el("div", {class:"edit-row"}, [
    el("label", {}, ["Ngày", dateInput]),
    el("label", {}, ["Giờ", timeInput]),
    el("label", {}, ["Sân", courtInput]),
    el("label", {}, ["Trọng tài", refInput]),
  ]);
  card.appendChild(metaRow);

  function commitMeta(){ m.date=dateInput.value; m.time=timeInput.value; m.court=courtInput.value; m.referee=refInput.value; saveData(); }
  [dateInput,timeInput,courtInput,refInput].forEach(function(inp){ inp.addEventListener("change", commitMeta); });

  function commitPlayers(){ m.p1 = p1Input.value.trim() || m.p1; m.p2 = p2Input.value.trim() || m.p2; saveData(); renderAll(); }
  [p1Input,p2Input].forEach(function(inp){ inp.addEventListener("change", commitPlayers); });

  const actions = el("div", {class:"match-edit-actions"}, [
    el("button", {class:"btn danger-text", type:"button", onclick: function(){
      if(!confirm("Xoá trận đấu này?")) return;
      content.matches = content.matches.filter(function(x){ return x!==m; });
      saveData(); renderAll();
    }}, "Xoá trận đấu"),
  ]);
  card.appendChild(actions);

  return card;
}

function renderMatchesSection(content){
  const wrap = el("div");
  const stages = [];
  const byStage = {};
  content.matches.forEach(function(m){
    if(!(m.stage in byStage)){ byStage[m.stage] = []; stages.push(m.stage); }
    byStage[m.stage].push(m);
  });
  if(stages.length === 0){
    wrap.appendChild(el("p", {class:"empty"}, "Chưa có lịch thi đấu. (Vào chế độ chỉnh sửa để thêm trận hoặc tự sinh lịch vòng bảng.)"));
  }
  stages.forEach(function(stage){
    wrap.appendChild(el("h3", {class:"stage-heading", text:stage}));
    byStage[stage].forEach(function(m){ wrap.appendChild(renderMatchCard(m, content)); });
  });

  if(editMode){
    wrap.appendChild(renderAddMatchForm(content, stages));
    const dl = el("datalist", {id:"dl-"+content.id});
    allParticipants(content).forEach(function(name){ dl.appendChild(el("option", {value:name})); });
    wrap.appendChild(dl);
  }
  return wrap;
}

function renderAddMatchForm(content, existingStages){
  const stageInput = el("input", {type:"text", list:"stages-"+content.id, placeholder:"vd: Vòng bảng — Bảng A"});
  const stageDl = el("datalist", {id:"stages-"+content.id});
  existingStages.forEach(function(s){ stageDl.appendChild(el("option", {value:s})); });

  const p1Input = el("input", {type:"text", list:"dl-"+content.id, placeholder:"VĐV / cặp 1"});
  const p2Input = el("input", {type:"text", list:"dl-"+content.id, placeholder:"VĐV / cặp 2"});
  const dateInput = el("input", {type:"text", placeholder:"vd: 05/10/2026"});
  const timeInput = el("input", {type:"text", placeholder:"vd: 19:00"});
  const courtInput = el("input", {type:"text", placeholder:"vd: Sân 1"});
  const refInput = el("input", {type:"text", placeholder:"(tuỳ chọn)"});

  const grid = el("div", {class:"add-match-grid"}, [
    el("label", {}, ["Giai đoạn / Vòng", stageInput]),
    el("label", {}, ["VĐV / cặp 1", p1Input]),
    el("label", {}, ["VĐV / cặp 2", p2Input]),
    el("label", {}, ["Ngày", dateInput]),
    el("label", {}, ["Giờ", timeInput]),
    el("label", {}, ["Sân", courtInput]),
    el("label", {}, ["Trọng tài", refInput]),
  ]);

  const submitBtn = el("button", {class:"btn", type:"button", onclick: function(){
    const stage = stageInput.value.trim();
    const p1 = p1Input.value.trim();
    const p2 = p2Input.value.trim();
    if(!stage || !p1 || !p2){ alert("Vui lòng nhập Giai đoạn và tên 2 VĐV/cặp đấu."); return; }
    content.matches.push({
      stage: stage, p1: p1, p2: p2,
      date: dateInput.value.trim(), time: timeInput.value.trim(),
      court: courtInput.value.trim(), referee: refInput.value.trim(),
      sets: null,
    });
    saveData();
    renderAll();
  }}, "+ Thêm trận đấu");

  return el("div", {class:"add-match-card"}, [
    el("h4", {text:"Thêm trận đấu mới"}),
    grid, stageDl, submitBtn,
  ]);
}

/* ================================================================
   RENDER: MAIN
   ================================================================ */
function renderAll(){
  editBtn.textContent = editMode ? "✅ Xong" : "✏️ Chỉnh sửa";
  document.body.classList.toggle("editing", editMode);
  renderBanner();

  const content = data.contents.find(function(c){ return c.id === activeId; });
  clear(mainEl);
  if(!content){
    mainEl.appendChild(el("p", {class:"empty"}, fetchFailed
      ? "Không tải được dữ liệu (đang mở file trực tiếp?). Hãy chạy qua Vercel hoặc `vercel dev` để xem dữ liệu."
      : "Chưa có nội dung nào. " + (editMode ? "Bấm + trên thanh tab để thêm." : "")));
    return;
  }

  const legend = el("div", {class:"legend"}, [
    el("span", {}, [el("i", {class:"done"}), "Đã kết thúc"]),
    el("span", {}, [el("i", {class:"pending"}), "Sắp diễn ra"]),
  ]);
  mainEl.appendChild(legend);

  const titleRow = el("div", {class:"block-title-row"}, [
    el("h2", {class:"block-title", text:"Bảng xếp hạng"}),
    editMode ? el("button", {class:"btn small outline", type:"button", onclick: function(){ openEditContentModal(content); }}, "⚙️ Chỉnh sửa nội dung") : null,
  ]);
  const standingsSection = el("section", {class:"block"}, [
    titleRow,
    content.scoringNote ? el("p", {class:"block-desc", text:content.scoringNote}) : null,
    renderStandingsSection(content),
  ]);
  mainEl.appendChild(standingsSection);

  const matchesSection = el("section", {class:"block"}, [
    el("h2", {class:"block-title", text:"Lịch thi đấu & kết quả"}),
    renderMatchesSection(content),
  ]);
  mainEl.appendChild(matchesSection);
}

/* ================================================================
   EDIT TOGGLE — xác thực admin
   ================================================================ */
editBtn.addEventListener("click", async function(){
  if(!editMode){
    const password = prompt("Nhập mật khẩu quản trị để chỉnh sửa:");
    if(!password) return;
    try{
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password })
      });
      if(res.ok){
        isAdmin = true;
        adminToken = password;
        editMode = true;
      }else{
        alert("Sai mật khẩu!");
        return;
      }
    }catch(e){
      alert("Không kết nối được server để xác thực. Kiểm tra deploy Vercel.");
      return;
    }
  }else{
    editMode = false;
  }
  buildTabs();
  renderAll();
});

loadData();