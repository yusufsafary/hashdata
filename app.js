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
