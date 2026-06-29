/* =========================================================
   model.js — 침수 계산 로직 (단면도용)
   화면 그리기와 분리되어 있어 나중에 React 이식이 쉽습니다.
   ========================================================= */

// 지형별 설정 (한곳에서만 관리)
const TERRAINS = {
  city: {
    name: "도시", emoji: "🏙️",
    absorb: 0.10,      // 흡수율 (스며드는 비율)
    drainRate: 25,     // 하수도가 빼주는 양 (mm/h)
    soil: "#7a6a55", surface: "#9aa0a6",  // 흙색 / 지표(아스팔트)색
    hint: "아스팔트라 물이 거의 안 스며들어요. (흡수율 10%)",
  },
  plain: {
    name: "평지", emoji: "🌾",
    absorb: 0.50, drainRate: 15,
    soil: "#8a6f4a", surface: "#9bbf6a",
    hint: "흙이 절반쯤 물을 흡수해요. (흡수율 50%)",
  },
  forest: {
    name: "산림", emoji: "🌲",
    absorb: 0.80, drainRate: 10,
    soil: "#6f5a3a", surface: "#4f8f3f",
    hint: "나무뿌리와 흙이 물을 많이 흡수해요. (흡수율 80%)",
  },
};

// 물이 차오르는 순속도(mm/h) = 강수 - 흡수 - 배수
// 0보다 크면 도로에 물이 고이기 시작.
function netInflow(rainfall, terrain) {
  const absorbed = rainfall * terrain.absorb;
  return rainfall - absorbed - terrain.drainRate;
}

// 물 높이(cm) → 위험 등급
function riskLevel(cm) {
  if (cm < 1)  return { label: "안전", key: "safe" };
  if (cm < 15) return { label: "주의(발목)", key: "caution" };
  if (cm < 40) return { label: "위험(무릎)", key: "danger" };
  return { label: "침수(허리 이상)", key: "flood" };
}
