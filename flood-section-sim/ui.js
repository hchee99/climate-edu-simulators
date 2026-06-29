/* =========================================================
   ui.js — 화면 요소와 시뮬레이션 상태를 연결
   ========================================================= */

const els = {
  rain: document.getElementById("rain"),
  rainValue: document.getElementById("rainValue"),
  terrainHint: document.getElementById("terrainHint"),
  netRate: document.getElementById("netRate"),
  waterLevel: document.getElementById("waterLevel"),
  riskLabel: document.getElementById("riskLabel"),
  startBtn: document.getElementById("startBtn"),
  resetBtn: document.getElementById("resetBtn"),
  summary: document.getElementById("summary"),
};

function refresh() {
  const t = TERRAINS[sim.terrainKey];
  sim.rainfall = parseInt(els.rain.value, 10);
  els.rainValue.textContent = sim.rainfall + " mm/h";
  els.terrainHint.textContent = t.hint;

  const net = netInflow(sim.rainfall, t);
  if (net <= 0) {
    els.netRate.textContent = "안 참 (다 빠짐)";
    els.netRate.style.color = "#2e9e5b";
  } else {
    els.netRate.textContent = "+" + net + " mm/h";
    els.netRate.style.color = "#d9722b";
  }
}

// 슬라이더
els.rain.addEventListener("input", refresh);

// 지형 버튼
document.querySelectorAll(".terrain").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".terrain").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    sim.terrainKey = btn.dataset.terrain;
    sim.wetness = 0;
    refresh();
  });
});

// 비 내리기 / 멈추기 토글
els.startBtn.addEventListener("click", () => {
  sim.raining = !sim.raining;
  els.startBtn.textContent = sim.raining ? "⏸ 멈추기" : "▶ 비 내리기";
});

// 초기화
els.resetBtn.addEventListener("click", () => {
  sim.raining = false;
  sim.waterCm = 0;
  sim.wetness = 0;
  els.startBtn.textContent = "▶ 비 내리기";
});

// 매 프레임 물 높이 → 화면 갱신 (sketch.js가 호출)
window.onWaterUpdate = (cm) => {
  els.waterLevel.textContent = Math.round(cm) + " cm";
  const risk = riskLevel(cm);
  els.riskLabel.textContent = risk.label;
  els.riskLabel.className = "risk " + risk.key;

  const t = TERRAINS[sim.terrainKey];
  if (cm < 1 && !sim.raining) return;
  els.summary.innerHTML =
    `<b>${t.emoji} ${t.name}</b>에 시간당 <b>${sim.rainfall}mm</b>의 비 → ` +
    `물이 <b>${Math.round(cm)}cm</b> 찼어요 (<b class="risk ${risk.key}">${risk.label}</b>)`;
};

refresh();
