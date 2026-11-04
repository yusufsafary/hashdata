// Penjaga anti basi: bila version.json di server lebih baru dari build ini,
// muat ulang sekali agar tidak ada device yang tertinggal di versi lama.
const BUILD_ID = "20261104-5";
fetch("version.json", { cache: "no-store" }).then(r => r.json()).then(v => {
  if (v && v.build && v.build !== BUILD_ID && !sessionStorage.getItem("hd-reloaded")) {
    sessionStorage.setItem("hd-reloaded", "1");
    location.reload();
  }
}).catch(() => {});

// HASDATA — papan live dari chain. Tanpa kontrak, papan menampilkan keadaan genesis.
var CONFIG = {
  contract: "0x4191882207C69f076d41FDEf824988342C312301", // HASDATA NFT v2 (live)
  rpcs: ["https://bsc-dataseed1.binance.org", "https://bsc-dataseed-public.bnbchain.org", "https://bsc-mainnet.public.blastapi.io", "https://bsc-rpc.publicnode.com", "https://bsc-dataseed.bnbchain.org"],
  totalUnits: 2048,
  maxGolden: 2
};
var VALS = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
var SEL = { totalSupply: "0x18160ddd", unitsMinted: "0xf8eabc9d", aliveByLevel: "0x8f4f6a7f", walletLevelCount: "0x274a1ea2", mintOpen: "0x24bbd049" };
function fmt(n) { return Number(n).toLocaleString("en-US"); }
function $(id) { return document.getElementById(id); }

// --- bangun peta level + papan tangga (kerangka) ---
var sky = $("sky"), bins = $("bins"), board = $("board");
VALS.forEach(function (v, i) {
  var h = 46 + i * 27;
  var m = document.createElement("div");
  m.className = "m" + (v === 2048 ? " goldm" : "");
  m.style.height = h + "px";
  m.id = "m" + (i + 1);
  m.innerHTML = (v === 2048 ? '<span class="flag">⚑</span>' : "") + "<b>" + v + "</b><small>B-" + String(i + 1).padStart(2, "0") + "</small>";
  m.addEventListener("click", function () { selectRung(i); });
  sky.appendChild(m);
  var b = document.createElement("div"); b.textContent = v.toString(2); bins.appendChild(b);
  var r = document.createElement("div");
  r.className = "row" + (v === 2048 ? " goldrow" : ""); r.id = "row" + (i + 1);
  r.innerHTML = '<span class="n">' + v + '</span><span class="bin">' + v.toString(2) + '</span><span class="bar"><i id="bar' + (i + 1) + '" style="width:2%"></i></span><span class="c" id="cnt' + (i + 1) + '">0 alive</span>';
  board.appendChild(r);
});
var counts = VALS.map(function () { return 0; });
function selectRung(i) {
  document.querySelectorAll(".m").forEach(function (e) { e.classList.remove("sel"); });
  document.querySelectorAll(".row").forEach(function (e) { e.classList.remove("hl"); });
  $("m" + (i + 1)).classList.add("sel");
  $("row" + (i + 1)).classList.add("hl");
  $("mapCap").innerHTML = "RUNG <b>B-" + String(i + 1).padStart(2, "0") + " · " + VALS[i] + "</b> · BINARY " + VALS[i].toString(2) + " · <b>" + fmt(counts[i]) + " ALIVE</b> · WRITING ONE EATS " + fmt(VALS[i] / 2) + " UNITS";
}
function render(state) {
  counts = state.counts;
  var max = Math.max.apply(null, counts.concat([1]));
  VALS.forEach(function (v, i) {
    $("cnt" + (i + 1)).textContent = fmt(counts[i]) + " alive";
    $("bar" + (i + 1)).style.width = Math.max(2, Math.round(counts[i] / max * 100)) + "%";
  });
  countUp($("hudMinted"), state.totalSupply);
  $("hudUnits").textContent = fmt(CONFIG.totalUnits - state.unitsMinted);
  $("hudGold").textContent = counts[10] + " / " + CONFIG.maxGolden;
  if (state.live) {
    $("mintStatus").innerHTML = state.mintOpen ? 'STATUS: <b>MINT IS LIVE</b> · MERGE IS LIVE' : 'STATUS: <b>CONTRACT DEPLOYED</b> · MINT OPENS SOON';
    $("contractAddr").textContent = "Contract address: " + CONFIG.contract;
  }
}
function countUp(el, target) {
  var from = parseInt((el.textContent || "0").replace(/[^0-9]/g, ""), 10) || 0;
  if (from === target) { el.textContent = fmt(target); return; }
  var t0 = performance.now();
  (function step(t) {
    var p = Math.min(1, (t - t0) / 700), e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(Math.round(from + (target - from) * e));
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}

// --- baca chain (balapan RPC) ---
function rpc(body) {
  var ctrl = new AbortController(); var to = setTimeout(function () { ctrl.abort(); }, 6000);
  return fetch(body.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: CONFIG.contract, data: body.data }, "latest"] }), signal: ctrl.signal })
    .then(function (r) { return r.json(); })
    .then(function (j) { clearTimeout(to); if (!j.result) throw new Error("no result"); return parseInt(j.result, 16); });
}
function call(data) {
  return Promise.any(CONFIG.rpcs.map(function (u) { return rpc({ url: u, data: data }); }));
}
function pad(n) { return n.toString(16).padStart(64, "0"); }
function load() {
  if (!CONFIG.contract) { render({ counts: counts, totalSupply: 0, unitsMinted: 0, live: false, mintOpen: false }); return; }
  var jobs = [call(SEL.totalSupply), call(SEL.unitsMinted), call(SEL.mintOpen)];
  VALS.forEach(function (v, i) { jobs.push(call(SEL.aliveByLevel + pad(i + 1))); });
  Promise.all(jobs).then(function (r) {
    render({ totalSupply: r[0], unitsMinted: r[1], mintOpen: r[2] === 1, counts: r.slice(3), live: true });
  }).catch(function () { /* diam, coba lagi siklus berikut */ });
}
load(); setInterval(load, 30000);

// --- cek wallet ---
$("whoBtn").addEventListener("click", function () {
  var a = $("who").value.trim();
  var out = $("whoOut");
  if (!/^0x[0-9a-fA-F]{40}$/.test(a)) { out.textContent = "That does not look like a wallet address."; return; }
  if (!CONFIG.contract) { out.textContent = "Wallet check opens with the contract at launch."; return; }
  var jobs = VALS.map(function (v, i) { return call(SEL.walletLevelCount + a.slice(2).padStart(64, "0") + pad(i + 1)); });
  out.textContent = "Reading chain…";
  Promise.all(jobs).then(function (r) {
    var parts = [];
    r.forEach(function (c, i) { if (c > 0) parts.push(VALS[i] + " × " + c); });
    out.textContent = parts.length ? a.slice(0, 8) + "… holds " + parts.join(" · ") + "." : a.slice(0, 8) + "… holds no hashes yet.";
  }).catch(function () { out.textContent = "Chain read failed. Try again in a moment."; });
});

// --- salin prompt + ticker ---
document.querySelectorAll("[data-copy]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    var t = $(btn.getAttribute("data-copy")).textContent;
    if (navigator.clipboard) navigator.clipboard.writeText(t);
    btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy prompt"; }, 1600);
  });
});
var tick = "$HAS TOKEN · HOLDERS ONLY <b>◆</b> EVERY HASH STARTS AT 2 BITS <b>◆</b> MERGE TWO EQUAL HASHES <b>◆</b> 2048 BITS = ONE COMPLETE SHA-256 <b>◆</b> MINT $0.20 <b>◆</b> BOOST TO 32 BITS FOR $3 <b>◆</b> MERGE IS FREE <b>◆</b> ";
$("tickerText").innerHTML = tick + tick;

/* ===== lapisan interaktif ===== */
(function () {
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* hujan hex di hero */
  var cv = document.getElementById("hexRain");
  if (cv && !reduced) {
    var ctx = cv.getContext("2d");
    var pairs = [];
    var seed = 987654321;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed; }
    for (var i = 0; i < 500; i++) pairs.push(("0" + (rnd() % 256).toString(16)).slice(-2));
    var cols = [];
    function sizeCanvas() {
      cv.width = cv.clientWidth; cv.height = cv.clientHeight;
      cols = [];
      var n = Math.floor(cv.width / 46);
      for (var j = 0; j < n; j++) cols.push({ x: 12 + j * 46, y: Math.random() * cv.height, sp: 0.3 + Math.random() * 0.7, off: Math.floor(Math.random() * 400) });
    }
    sizeCanvas();
    window.addEventListener("resize", sizeCanvas);
    ctx.font = "12px 'Plex Mono', monospace";
    var frame = 0;
    (function draw() {
      requestAnimationFrame(draw);
      if (document.hidden || frame++ % 3) return;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = "#33e0ff";
      cols.forEach(function (c) {
        for (var k = 0; k < 7; k++) ctx.fillText(pairs[(c.off + k * 13) % 500], c.x, c.y + k * 17);
        c.y += c.sp;
        if (c.y - 120 > cv.height) { c.y = -120; c.off = Math.floor(Math.random() * 400); }
      });
    })();
  }

  /* kalkulator naik tangga */
  var cBase = 4, cBoost = 0;
  function calcRender() {
    var units = cBase + cBoost * 16;
    var cost = cBase * 0.2 + cBoost * 3;
    var countsL = {};
    countsL[1] = cBase; countsL[5] = cBoost;
    for (var l = 1; l < 11; l++) {
      var pairsN = Math.floor((countsL[l] || 0) / 2);
      if (pairsN) { countsL[l] -= pairsN * 2; countsL[l + 1] = (countsL[l + 1] || 0) + pairsN; }
    }
    var top = 0;
    Object.keys(countsL).forEach(function (l) { if (countsL[l] > 0) top = Math.max(top, Math.pow(2, Number(l))); });
    document.getElementById("calcBase").textContent = cBase;
    document.getElementById("calcBoost").textContent = cBoost;
    document.getElementById("calcUnits").textContent = units + " / 64";
    document.getElementById("calcCost").textContent = "$" + cost.toFixed(2);
    document.getElementById("calcTop").textContent = top ? top + " bits" : "none yet";
  }
  document.querySelectorAll("[data-step]").forEach(function (b) {
    b.addEventListener("click", function () {
      var parts = b.getAttribute("data-step").split(":");
      var d = Number(parts[1]);
      if (parts[0] === "base") cBase = Math.min(64, Math.max(0, cBase + d));
      else cBoost = Math.min(4, Math.max(0, cBoost + d));
      if (cBase + cBoost * 16 > 64) { if (parts[0] === "base") cBase = 64 - cBoost * 16; else cBoost = Math.floor((64 - cBase) / 16); }
      calcRender();
    });
  });
  if (document.getElementById("calc")) calcRender();

  /* Merge Lab */
  var tray = [2, 2, 2, 2, 2, 2, 2, 2], sel = -1, merges = 0, spent = 1.6, popIdx = -1;
  var trayEl = document.getElementById("labTray");
  function labRender() {
    if (!trayEl) return;
    trayEl.innerHTML = "";
    tray.forEach(function (v, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (v === 2048 ? " gold" : "") + (i === sel ? " sel" : "") + (i === popIdx ? " pop" : "");
      b.innerHTML = v + " bits<small>B-" + String(Math.log2(v)).padStart(2, "0") + "</small>";
      b.addEventListener("click", function () { labTap(i); });
      trayEl.appendChild(b);
    });
    popIdx = -1;
    var top = tray.length ? Math.max.apply(null, tray) : 0;
    document.getElementById("labMerges").textContent = merges + " merges";
    document.getElementById("labTop").textContent = "top " + top + " bits";
    document.getElementById("labSpent").textContent = "$" + spent.toFixed(2) + " spent";
  }
  function labMsg(t) { document.getElementById("labMsg").textContent = t; }
  function labTap(i) {
    if (sel === -1) { sel = i; labMsg("Selected " + tray[i] + " bits. Tap an equal hash."); labRender(); return; }
    if (sel === i) { sel = -1; labMsg("Tap two equal hashes to merge them."); labRender(); return; }
    if (tray[sel] !== tray[i]) { sel = i; labMsg("Those differ. Merging needs two equal sizes."); labRender(); return; }
    var v = tray[sel] * 2;
    var keep = Math.min(sel, i);
    tray = tray.filter(function (_, j) { return j !== sel && j !== i; });
    tray.splice(keep, 0, v);
    tray.sort(function (a, b) { return a - b; });
    popIdx = tray.indexOf(v);
    sel = -1; merges++;
    if (v === 2048) labMsg("SHA-256 COMPLETE. One full hash, built by hand. Only two can ever exist on chain.");
    else labMsg("Merged into " + v + " bits. Keep doubling.");
    if (navigator.vibrate) navigator.vibrate(8);
    labRender();
  }
  var addBtn = document.getElementById("labAdd");
  if (addBtn) addBtn.addEventListener("click", function () {
    if (tray.length >= 24) { labMsg("Tray is full. Merge something first."); return; }
    tray.push(2); tray.sort(function (a, b) { return a - b; }); spent += 0.2;
    labMsg("A fresh 2-bit hash joins the tray."); labRender();
  });
  var rstBtn = document.getElementById("labReset");
  if (rstBtn) rstBtn.addEventListener("click", function () {
    tray = [2, 2, 2, 2, 2, 2, 2, 2]; sel = -1; merges = 0; spent = 1.6;
    labMsg("Fresh tray. Eight 2-bit hashes."); labRender();
  });
  labRender();

  /* papan: ketuk baris untuk angka lengkap */
  var detail = document.getElementById("boardDetail");
  if (detail) {
    VALS.forEach(function (v, i) {
      var row = document.getElementById("row" + (i + 1));
      if (row) row.addEventListener("click", function () {
        selectRung(i);
        detail.textContent = "B-" + String(i + 1).padStart(2, "0") + " · " + fmt(v) + " bits · max " + fmt(4096 / v) + " can ever exist · writing one eats " + fmt(v / 2) + " units · " + fmt(counts[i]) + " alive now";
      });
    });
  }
})();
