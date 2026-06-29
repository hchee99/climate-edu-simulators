/* =========================================================
   sketch.js — p5.js 시각화 (격자 + 막대그래프)
   model.js의 계산 결과를 "그림"으로만 표현합니다.
   ========================================================= */

const COLS = 20, ROWS = 14;   // 격자 크기
let cellSize = 22;

let gridState = [];           // 각 셀의 침수 여부 (true/false)
let runResults = [];          // 5회 실행 후 침수 셀 개수 배열

// ---- 격자 캔버스 ----
const gridSketch = (p) => {
  p.setup = () => {
    const c = p.createCanvas(COLS * cellSize, ROWS * cellSize);
    c.parent("gridHolder");
    resetGrid();
    p.noLoop();
  };

  p.draw = () => {
    p.background(255);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const flooded = gridState[y][x];
        p.stroke(235);
        p.fill(flooded ? p.color(52, 120, 220) : p.color(232, 240, 235));
        p.rect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  };

  window.redrawGrid = () => p.redraw();
};

// ---- 막대그래프 캔버스 ----
const chartSketch = (p) => {
  p.setup = () => {
    const c = p.createCanvas(COLS * cellSize, 140);
    c.parent("chartHolder");
    p.noLoop();
  };

  p.draw = () => {
    p.background(255);
    p.fill(90); p.noStroke(); p.textSize(12);
    p.text("5회 실행 — 침수 칸 수 (기상 예측의 불확실성)", 4, 14);

    if (runResults.length === 0) return;
    const maxCells = COLS * ROWS;
    const bw = p.width / runResults.length;
    runResults.forEach((v, i) => {
      const h = (v / maxCells) * 100;
      p.fill(52, 120, 220);
      p.rect(i * bw + 8, 130 - h, bw - 16, h);
      p.fill(90);
      p.text(v, i * bw + bw / 2 - 6, 128);
    });
  };

  window.redrawChart = () => p.redraw();
};

new p5(gridSketch);
new p5(chartSketch);

// 격자 초기화 (전부 안전)
function resetGrid() {
  gridState = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => false)
  );
}

// 한 번의 시뮬레이션 → 격자 채우고 침수 셀 수 반환
function simulateOnce(rainfall, terrain) {
  let count = 0;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const flooded = isCellFlooded(rainfall, terrain);
      gridState[y][x] = flooded;
      if (flooded) count++;
    }
  }
  return count;
}
