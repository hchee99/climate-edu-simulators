/* =========================================================
   sketch.js — p5.js 단면도 애니메이션
   비가 내리고, 흡수/배수를 뺀 나머지가 도로에 차오르는 모습을 보여줍니다.
   ========================================================= */

const W = 560, H = 420;
const GROUND_Y = 300;          // 지표면 높이
const PX_PER_CM = 1.1;         // 물 높이 1cm → 몇 픽셀 (도로 근처의 낮은 띠로 표현)
const MAX_CM = 80;             // 표시 한계

// 시뮬레이션 상태 (ui.js가 바꿔줌)
let sim = {
  terrainKey: "city",
  rainfall: 50,
  raining: false,
  waterCm: 0,
  wetness: 0,    // 흙이 머금은 정도 (0~1, 흡수 시각화)
};

let drops = [];

const scene = (p) => {
  p.setup = () => {
    const c = p.createCanvas(W, H);
    c.parent("sceneHolder");
    for (let i = 0; i < 90; i++) drops.push(newDrop(p));
  };

  p.draw = () => {
    const t = TERRAINS[sim.terrainKey];

    // 1) 물리 업데이트
    if (sim.raining) {
      const net = netInflow(sim.rainfall, t);          // mm/h
      sim.waterCm += net * 0.006;                       // 화면용 속도 스케일
      if (sim.waterCm < 0) sim.waterCm = 0;
      if (sim.waterCm > MAX_CM) sim.waterCm = MAX_CM;
      sim.wetness = Math.min(1, sim.wetness + t.absorb * 0.002);
    }
    if (window.onWaterUpdate) window.onWaterUpdate(sim.waterCm);

    // 2) 배경 (하늘)
    p.noStroke();
    p.fill(sim.raining ? p.color(150, 165, 185) : p.color(200, 218, 235));
    p.rect(0, 0, W, GROUND_Y);

    // 3) 흙 (젖을수록 어두워짐)
    const soil = p.color(t.soil);
    p.fill(p.lerpColor(soil, p.color(60, 45, 30), sim.wetness));
    p.rect(0, GROUND_Y, W, H - GROUND_Y);

    // 4) 지표면 띠 (아스팔트/풀)
    p.fill(t.surface);
    p.rect(0, GROUND_Y - 8, W, 8);

    // 5) 지형지물 (건물/나무)
    drawScenery(p, sim.terrainKey);

    // 5.5) 우산 쓴 아이 (물 높이 기준자 역할)
    drawChild(p, 300, GROUND_Y);

    // 6) 흡수 화살표 (땅으로 스며드는 표시)
    drawInfiltration(p, t);

    // 7) 빗방울
    if (sim.raining) {
      p.stroke(180, 200, 225); p.strokeWeight(2);
      drops.forEach((d) => {
        p.line(d.x, d.y, d.x, d.y + 8);
        d.y += d.spd;
        if (d.y > GROUND_Y) Object.assign(d, newDrop(p), { y: -10 });
      });
      p.noStroke();
    }

    // 8) 고인 물 (도로 위로 차오름)
    const wpx = sim.waterCm * PX_PER_CM;
    if (wpx > 0.5) {
      p.fill(52, 120, 220, 165);
      p.rect(0, GROUND_Y - wpx, W, wpx);
      // 수면 라인
      p.fill(255, 255, 255, 60);
      p.rect(0, GROUND_Y - wpx, W, 2);
    }

    // 9) 물 높이 눈금
    drawRuler(p, wpx);
  };
};

// 우산 쓴 아이 — 물 높이를 몸으로 가늠하는 기준자. s = 크기 배율.
function drawChild(p, cx, gy, s = 1.6) {
  const foot = gy - 8;          // 발이 닿는 지면
  // 다리
  p.stroke(60, 70, 90); p.strokeWeight(5 * s);
  p.line(cx - 5 * s, foot, cx - 5 * s, foot - 26 * s);
  p.line(cx + 5 * s, foot, cx + 5 * s, foot - 26 * s);
  // 몸통 (노란 우비)
  p.noStroke(); p.fill(240, 200, 70);
  p.rect(cx - 11 * s, foot - 56 * s, 22 * s, 32 * s, 6 * s);
  // 팔 (우산 든 쪽)
  p.stroke(240, 200, 70); p.strokeWeight(6 * s);
  p.line(cx + 6 * s, foot - 50 * s, cx + 14 * s, foot - 64 * s);
  p.noStroke();
  // 머리
  p.fill(245, 220, 180);
  p.circle(cx, foot - 66 * s, 20 * s);
  // 우산대 + 우산
  p.stroke(120); p.strokeWeight(2 * s);
  p.line(cx + 14 * s, foot - 64 * s, cx + 14 * s, foot - 104 * s);
  p.noStroke();
  p.fill(225, 80, 80);
  p.arc(cx + 14 * s, foot - 104 * s, 64 * s, 40 * s, p.PI, p.TWO_PI);
}

function newDrop(p) {
  return { x: p.random(W), y: p.random(-H, GROUND_Y), spd: p.random(6, 11) };
}

function drawScenery(p, key) {
  p.noStroke();
  if (key === "city") {
    // 마천루: 건물이 화면 위(하늘)까지 올라가 잘려나감
    const xs = [30, 130, 235, 345, 455, 540];
    const tops = [40, 0, 70, 10, 50, 20];   // 각 건물의 꼭대기 y (작을수록 높음)
    const ws  = [85, 90, 80, 95, 80, 60];
    xs.forEach((x, i) => {
      const top = tops[i];
      const shade = 100 + i * 6;
      p.fill(shade, shade + 10, shade + 25);
      p.rect(x, top, ws[i], GROUND_Y - 8 - top);
      // 창문
      p.fill(205, 222, 242);
      for (let wy = top + 14; wy < GROUND_Y - 18; wy += 22)
        for (let wx = x + 10; wx < x + ws[i] - 12; wx += 20) p.rect(wx, wy, 10, 12);
    });
  } else if (key === "forest") {
    [40, 130, 230, 330, 430, 510].forEach((x) => {
      p.fill(90, 60, 40); p.rect(x - 4, GROUND_Y - 8 - 40, 8, 40);
      p.fill(50, 130, 60);
      p.triangle(x - 28, GROUND_Y - 8 - 30, x + 28, GROUND_Y - 8 - 30, x, GROUND_Y - 8 - 95);
    });
  } else {
    // 평지: 풀과 작은 집
    p.fill(150, 110, 80); p.rect(230, GROUND_Y - 8 - 45, 80, 45);
    p.fill(170, 70, 60); p.triangle(220, GROUND_Y - 8 - 45, 320, GROUND_Y - 8 - 45, 270, GROUND_Y - 8 - 80);
    p.stroke(80, 150, 70); p.strokeWeight(2);
    for (let x = 20; x < W; x += 16) { if (x > 215 && x < 320) continue; p.line(x, GROUND_Y - 8, x, GROUND_Y - 20); }
    p.noStroke();
  }
}

function drawInfiltration(p, t) {
  // 흡수율이 높을수록 화살표가 진하고 길게
  const n = Math.round(t.absorb * 8);
  p.stroke(70, 130, 210, 150); p.strokeWeight(2);
  for (let i = 0; i < n; i++) {
    const x = 40 + i * (480 / Math.max(1, n));
    const len = 10 + t.absorb * 30;
    p.line(x, GROUND_Y + 6, x, GROUND_Y + 6 + len);
    p.line(x - 3, GROUND_Y + 2 + len, x, GROUND_Y + 6 + len);
    p.line(x + 3, GROUND_Y + 2 + len, x, GROUND_Y + 6 + len);
  }
  p.noStroke();
}

function drawRuler(p, wpx) {
  p.stroke(120); p.strokeWeight(1);
  p.line(W - 24, GROUND_Y, W - 24, GROUND_Y - MAX_CM * PX_PER_CM);
  p.noStroke(); p.fill(90); p.textSize(10);
  [0, 20, 40, 60, 80].forEach((cm) => {
    const y = GROUND_Y - cm * PX_PER_CM;
    p.text(cm + "cm", W - 22, y + 3);
  });
}

new p5(scene);
