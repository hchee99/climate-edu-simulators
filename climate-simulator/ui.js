/* =========================================================
   ui.js — 화면 요소와 로직을 연결 (DOM 이벤트 처리)
   model.js 계산 + sketch.js 그림을 사용자 조작과 묶어줍니다.
   ========================================================= */

let currentTerrainKey = "city";

const els = {
  sst: document.getElementById("sst"),
  sstValue: document.getElementById("sstValue"),
  ensoState: document.getElementById("ensoState"),
  ensoHint: document.getElementById("ensoHint"),
  terrainHint: document.getElementById("terrainHint"),
  rainfall: document.getElementById("rainfall"),
  riskLabel: document.getElementById("riskLabel"),
  runBtn: document.getElementById("runBtn"),
  summary: document.getElementById("summary"),
};

// 슬라이더/지형이 바뀔 때마다 파생값(엘니뇨 상태, 강수강도) 갱신
function refreshDerived() {
  const sst = parseFloat(els.sst.value);
  const enso = classifyENSO(sst);
  const terrain = TERRAINS[currentTerrainKey];
  const rainfall = rainfallFromSST(sst);

  els.sstValue.textContent = sst.toFixed(1) + "℃";
  els.ensoState.textContent = enso.state;
  els.ensoState.className = "badge " + enso.key;
  els.ensoHint.textContent = enso.hint;
  els.terrainHint.textContent = terrain.hint;
  els.rainfall.textContent = rainfall + " mm/h";
}

// 슬라이더
els.sst.addEventListener("input", refreshDerived);

// 지형 버튼
document.querySelectorAll(".terrain").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".terrain").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentTerrainKey = btn.dataset.terrain;
    refreshDerived();
  });
});

// 실행 버튼 → 5회 시뮬레이션
els.runBtn.addEventListener("click", () => {
  const sst = parseFloat(els.sst.value);
  const rainfall = rainfallFromSST(sst);
  const terrain = TERRAINS[currentTerrainKey];

  runResults = [];
  for (let i = 0; i < 5; i++) {
    runResults.push(simulateOnce(rainfall, terrain));
  }

  // 마지막 실행 결과를 격자에 표시
  redrawGrid();
  redrawChart();

  // 평균 침수 비율로 위험도 등급
  const avg = runResults.reduce((a, b) => a + b, 0) / runResults.length;
  const ratio = avg / (gridState.length * gridState[0].length);
  const risk = riskLevel(ratio);
  els.riskLabel.textContent = risk.label;
  els.riskLabel.className = "risk " + risk.key;

  // 결과 요약 문구 (사람이 읽을 수 있게)
  const terrainName = terrain.emoji + " " + terrain.name;
  const enso = classifyENSO(sst);
  const pct = Math.round(ratio * 100);
  els.summary.innerHTML =
    `<b>${enso.state}</b> 상황의 <b>${terrainName}</b>에 시간당 <b>${rainfall}mm</b>의 비가 내리면,<br>` +
    `평균 <b>${pct}%</b>의 구역이 잠겨요 → 위험도 <b class="risk ${risk.key}">${risk.label}</b>`;
});

// 초기 표시
refreshDerived();
