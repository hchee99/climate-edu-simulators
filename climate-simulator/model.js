/* =========================================================
   model.js — 시뮬레이터의 "두뇌" (계산 로직만 모음)
   화면 그리기와 완전히 분리되어 있어, 나중에 React로 옮길 때
   이 파일은 거의 그대로 재사용할 수 있습니다.
   ========================================================= */

// 지형별 설정값 (한곳에서만 관리 → 수치 조정이 쉬움)
const TERRAINS = {
  city:   { name: "도시", emoji: "🏙️", absorb: 0.10, drainage: 8,  hint: "아스팔트가 많아 물을 거의 못 흡수해요. (흡수율 10%)" },
  plain:  { name: "평지", emoji: "🌾", absorb: 0.50, drainage: 5,  hint: "흙이 절반쯤 물을 흡수해요. (흡수율 50%)" },
  forest: { name: "산림", emoji: "🌲", absorb: 0.80, drainage: 3,  hint: "나무와 흙이 물을 많이 흡수해요. (흡수율 80%)" },
};

// 해수면 온도(편차 ℃) → 엘니뇨/라니냐 판정
function classifyENSO(sst) {
  if (sst >= 0.5)  return { state: "엘니뇨", key: "elnino", hint: "동태평양이 따뜻한 상태. 한국 '여름' 강수와는 관계가 약해요." };
  if (sst <= -0.5) return { state: "라니냐", key: "lanina", hint: "무역풍이 강해 동태평양이 차가워졌어요. 우리나라 장마가 강해집니다!" };
  return { state: "평상시", key: "neutral", hint: "평년과 비슷한 상태예요." };
}

// 해수면 온도 → 한반도 여름 강수강도(mm/h)
//  - 라니냐(음의 편차): 북태평양 고기압 강화 → 장마전선 강화 → 강수 급증
//  - 평상시: 기준값
//  - 엘니뇨(양의 편차): 한국 '여름' 강수와는 관계가 약함 → 오히려 살짝 감소
// 이렇게 셋을 서로 다르게 만들어 비교 학습이 되도록 설계.
function rainfallFromSST(sst) {
  const base = 30;                                  // 평상시 기준
  const laninaBoost = sst < 0 ? -sst * 18 : 0;      // 라니냐일수록 급증 (-3℃ → +54)
  const elninoDrop  = sst > 0 ? sst * 3 : 0;        // 엘니뇨는 여름 강수 살짝 감소
  return Math.round(base + laninaBoost - elninoDrop);
}

// 한 격자 셀의 침수 여부 계산 (확률형)
// 1) 침수 압력 = 강수량 - 흡수량 - 배수량
// 2) 이 압력을 0~1 확률로 변환해, 셀마다 그 확률로 침수시킴
//    → 임계점 근처에서 매번 결과가 달라지고, 막대그래프에 분포가 생김
function floodPressure(rainfall, terrain) {
  const absorbed = rainfall * terrain.absorb;
  return rainfall - absorbed - terrain.drainage;
}

function isCellFlooded(rainfall, terrain) {
  const pressure = floodPressure(rainfall, terrain);
  // 압력 0 → 확률 0.5, 압력이 ±15 범위에서 0~1로 부드럽게 변함
  const prob = 1 / (1 + Math.exp(-pressure / 8));
  return Math.random() < prob;
}

// 위험도 등급
function riskLevel(floodRatio) {
  if (floodRatio < 0.15) return { label: "안전", key: "safe" };
  if (floodRatio < 0.40) return { label: "주의", key: "caution" };
  if (floodRatio < 0.70) return { label: "위험", key: "danger" };
  return { label: "침수", key: "flood" };
}
