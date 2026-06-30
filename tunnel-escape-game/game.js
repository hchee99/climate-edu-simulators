/* =========================================================
   지하차도 침수 탈출 게임
   - 5개 길, 위(출구)로 이동하며 차오르는 물을 피해 대피
   - 양 끝 길 = 손잡이(안전), 가운데 3칸 = 아이템(위험)
   - 골든타임(제한시간) 안에 출구 도착해야 클리어
   ========================================================= */
(function () {
  const cv = document.getElementById("game"), ctx = cv.getContext("2d");

  // ---- 맵/게임 상수 ----
  const COLS = 5;            // 길 개수
  const WROWS = 26;          // 월드 전체 칸 수 (맵 길이)
  const VIS = 9;             // 화면에 보이는 칸 수
  const CW = cv.width / COLS;
  const CH = cv.height / VIS;
  const WORLDH = WROWS * CH;
  const RAILS = [0, 4];      // 손잡이(안전) 길
  const TOTAL = 20;          // 골든타임(초)
  const W_DELAY = 1.0;       // 시작 후 이 시간(초)은 물이 안 참 (손잡이 잡을 여유)
  const W_BASE = 2.7;        // 물 시작 상승속도 (행/초)
  const W_ACC = 0.13;        // 물 가속 (점점 빨라짐)

  const SAFE_ROWS = 3;       // 시작 후 이 칸 수까지는 장애물 없음
  const MOVE_CD = 0.13;      // 이동 쿨다운(초) — 무한 연타 방지
  let player, items, obstacles, branches, timeLeft, score, running, tubeUntil, pushAcc, last, msgFlash, camY, branchHitAt, lastMove;

  // ---- 게임 초기화 ----
  function reset() {
    player = { col: 2, row: WROWS - 1 };   // 맨 아래에서 시작
    items = [];
    const types = ["ladder", "tube"];
    let placed = 0, tries = 0;
    while (placed < types.length && tries < 120) {
      tries++;
      const col = 1 + Math.floor(Math.random() * 3);            // 가운데 3칸만
      const row = 2 + Math.floor(Math.random() * (WROWS - 4));
      if (items.some((it) => it.col === col && it.row === row)) continue;
      items.push({ col, row, type: types[placed], taken: false });
      placed++;
    }
    // 장애물: 시작 3칸 뒤(row WROWS-1-SAFE_ROWS 위쪽)부터 등장. 손잡이 길(0,4)엔 없음.
    const maxRow = WROWS - 1 - SAFE_ROWS;     // 장애물이 나올 수 있는 가장 아래 칸
    // 사다리 착지 보호: 사다리 앞 2칸(같은 열)에는 장애물 금지 → 타고 올라가도 안 갇힘
    const ladders = items.filter((it) => it.type === "ladder");
    const reservedCell = (c, r) => ladders.some((l) => l.col === c && (r === l.row - 1 || r === l.row - 2));
    const reservedRow = (r) => ladders.some((l) => r === l.row - 1 || r === l.row - 2);

    const occupied = (c, r) =>
      items.some((it) => it.col === c && it.row === r) ||
      obstacles.some((o) => o.col === c && o.row === r);
    // 차: 4줄마다 한 밴드. 가운데 3칸 중 2칸 막고 1칸만 뚫림(줄마다 이동) → 지그재그 필요.
    // 손잡이 길(0,4)은 항상 열림.
    obstacles = [];
    const gapPattern = [2, 1, 3, 2, 3, 1];   // 줄마다 '뚫린' 가운데 칸
    const carRows = [];
    let gi = 0;
    for (let row = maxRow; row >= 3; row -= 4) {
      if (reservedRow(row)) continue;
      const gap = gapPattern[gi % gapPattern.length]; gi++;
      for (const c of [1, 2, 3]) {
        if (c === gap) continue;
        if (occupied(c, row) || reservedCell(c, row)) continue;
        obstacles.push({ col: c, row });
      }
      carRows.push(row);
    }
    // 나뭇가지: 차 밴드 사이(차줄 -2)에만 배치 → 차와 항상 2칸 이상 간격
    const itemRows = new Set(items.map((it) => it.row));
    branches = [];
    carRows.forEach((cr) => {
      const row = cr - 2;
      if (row < 3 || reservedRow(row) || itemRows.has(row)) return;
      branches.push({ row, x: 1 + Math.random() * 2, dir: Math.random() < 0.5 ? -1 : 1, speed: 0.9 + Math.random() * 0.9 });
    });
    branchHitAt = 0; lastMove = 0;

    timeLeft = TOTAL; score = 0; running = true;
    tubeUntil = 0; pushAcc = 0; last = performance.now(); msgFlash = "";
    updateCam();   // 시작 시 아이 위치로 카메라 맞춤
    setStatus("출발! 물이 바닥부터 차올라요. 위 출구로 대피! 막히면 파란 손잡이를 잡아요");
  }
  function setStatus(t) { document.getElementById("status").textContent = t; }

  // ---- 상태 헬퍼 ----
  const hasTube = () => performance.now() < tubeUntil;
  const onRail = () => RAILS.includes(player.col);
  // 물 높이(행) = 시작 속도 + 가속. 처음부터 빠르게 차고 점점 더 빨라짐.
  // → 가운데는 거의 늘 잠겨 막히므로 손잡이를 잡아야만 전진 가능.
  const waterRows = () => {
    const e = (TOTAL - timeLeft) - W_DELAY;     // 유예 시간 뺀 경과 시간
    if (e <= 0) return 0;                        // 시작 직후엔 물이 안 참
    return W_BASE * e + W_ACC * e * e;
  };
  const waterWorldTop = () => WORLDH - waterRows() * CH;
  const playerWorldY = () => player.row * CH;
  const submerged = () => playerWorldY() + CH * 0.5 > waterWorldTop();

  // ---- 카메라 (아이를 화면 중앙에) ----
  function updateCam() {
    camY = playerWorldY() - (VIS / 2 - 0.5) * CH;
    camY = Math.max(0, Math.min(WORLDH - cv.height, camY));
  }
  const sY = (worldY) => worldY - camY;

  // ---- 이동 ----
  function move(dc, dr) {
    if (!running) return;
    const now = performance.now();
    if (now - lastMove < MOVE_CD * 1000) return;               // 쿨다운: 너무 빠른 연타 무시
    const nc = Math.max(0, Math.min(COLS - 1, player.col + dc));
    const nr = Math.max(0, Math.min(WROWS - 1, player.row + dr));
    // 물에 잠긴 상태에서 가운데 길은 위로 못 감 → 손잡이(양 끝)로 가야 전진
    if (dr < 0 && submerged() && !onRail() && !hasTube()) {
      flash("물살에 막혔어요! 파란 손잡이로 가세요"); return;
    }
    // 버려진 차가 있는 칸은 못 지나감
    if (obstacles.some((o) => o.col === nc && o.row === nr)) { flash("버려진 차! 못 지나가요"); return; }
    lastMove = now;
    player.col = nc; player.row = nr;
    collect(); checkBranch(); updateCam();
    if (player.row === 0) win();
  }

  // ---- 나뭇가지 충돌 (닿으면 한 칸 밀림) ----
  function checkBranch() {
    if (!running) return;
    const now = performance.now();
    if (now - branchHitAt < 800 || hasTube()) return;
    for (const b of branches) {
      if (b.row === player.row && Math.abs(b.x - player.col) < 0.5) {
        branchHitAt = now;
        player.row = Math.min(WROWS - 1, player.row + 1);
        flash("나뭇가지에 밀렸어요!"); updateCam();
        break;
      }
    }
  }

  // ---- 아이템 획득 ----
  function collect() {
    items.forEach((it) => {
      if (it.taken || it.col !== player.col || it.row !== player.row) return;
      it.taken = true; score += 10;
      if (it.type === "ladder") {
        player.row = Math.max(0, player.row - 2); flash("사다리! 2칸↑");
        if (player.row === 0) win();
      }
      if (it.type === "tube") { tubeUntil = performance.now() + 6000; flash("튜브! 잠시 안전"); }
    });
  }
  function flash(t) { msgFlash = t; setTimeout(() => { if (msgFlash === t) msgFlash = ""; }, 900); }

  function win() { running = false; score += Math.round(timeLeft * 5); setStatus("🎉 탈출 성공! 골든타임 안에 대피했어요"); }
  function lose() { running = false; setStatus("😢 물에 잠겼어요. 망설이지 말고 더 빨리! 다시 도전"); }

  // ---- 매 프레임 물리 ----
  function update(dt) {
    if (!running) return;
    timeLeft -= dt;
    if (timeLeft <= 0) { timeLeft = 0; lose(); return; }
    // 물에 잠겼는데 손잡이도 없고 튜브도 없으면 → 물살에 밀림
    if (submerged() && !onRail() && !hasTube()) {
      pushAcc += dt;
      if (pushAcc >= 0.7) { pushAcc = 0; player.row = Math.min(WROWS - 1, player.row + 1); flash("물살에 밀렸어요!"); updateCam(); }
    } else pushAcc = 0;
    // 나뭇가지: 가운데(1~3열)를 좌우로 휩쓸려 다님
    branches.forEach((b) => {
      b.x += b.dir * b.speed * dt;
      if (b.x < 1) { b.x = 1; b.dir = 1; }
      if (b.x > 3) { b.x = 3; b.dir = -1; }
    });
    checkBranch();
    // 물에 잠겨도 게임은 안 끝남 — 실패는 골든타임 초과(위 timeLeft 체크)로만
  }

  // ---- 그리기 ----
  function drawChild(cx, cy) {
    ctx.fillStyle = "#f2c84b"; ctx.fillRect(cx - 7, cy - 2, 14, 16);     // 우비 몸통
    ctx.beginPath(); ctx.arc(cx, cy - 9, 7, 0, 7); ctx.fillStyle = "#f5dcb4"; ctx.fill();  // 머리
    ctx.strokeStyle = "#bbb"; ctx.lineWidth = 2;                          // 우산대
    ctx.beginPath(); ctx.moveTo(cx + 8, cy - 12); ctx.lineTo(cx + 8, cy - 24); ctx.stroke();
    ctx.fillStyle = "#e05656";                                           // 우산
    ctx.beginPath(); ctx.arc(cx + 8, cy - 24, 11, Math.PI, 2 * Math.PI); ctx.fill();
  }
  function drawCar(cx, cy) {
    ctx.fillStyle = "#454c57"; ctx.fillRect(cx - CW * 0.34, cy - CH * 0.16, CW * 0.68, CH * 0.34);  // 차체
    ctx.fillStyle = "#363c45"; ctx.fillRect(cx - CW * 0.22, cy - CH * 0.30, CW * 0.44, CH * 0.18);  // 지붕
    ctx.fillStyle = "#9fc4e0"; ctx.fillRect(cx - CW * 0.18, cy - CH * 0.27, CW * 0.36, CH * 0.12);  // 창
    ctx.fillStyle = "#222"; ctx.beginPath();
    ctx.arc(cx - CW * 0.2, cy + CH * 0.18, 5, 0, 7); ctx.arc(cx + CW * 0.2, cy + CH * 0.18, 5, 0, 7); ctx.fill();
  }
  function drawBranch(cx, cy) {
    ctx.strokeStyle = "#7a5230"; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx - 18, cy + 3); ctx.lineTo(cx + 18, cy - 3); ctx.stroke();
    ctx.lineWidth = 3;                                                   // 잔가지
    ctx.beginPath(); ctx.moveTo(cx - 4, cy); ctx.lineTo(cx + 2, cy - 12);
    ctx.moveTo(cx + 8, cy - 1); ctx.lineTo(cx + 14, cy + 9); ctx.stroke();
    ctx.fillStyle = "#5a8f3f";                                           // 잎
    ctx.beginPath(); ctx.arc(cx + 2, cy - 12, 4, 0, 7); ctx.arc(cx + 14, cy + 9, 4, 0, 7); ctx.fill();
  }

  function draw() {
    ctx.clearRect(0, 0, cv.width, cv.height);

    // 길 바닥
    for (let c = 0; c < COLS; c++) {
      ctx.fillStyle = RAILS.includes(c) ? "#2c4a63" : "#26323f";
      ctx.fillRect(c * CW, 0, CW, cv.height);
    }
    // 손잡이 기둥
    RAILS.forEach((c) => {
      ctx.fillStyle = "#3aa0e0";
      ctx.fillRect(c * CW + CW / 2 - 3, 0, 6, cv.height);
      for (let wy = 0; wy < WORLDH; wy += CH) {
        const y = sY(wy + CH / 2);
        if (y > -6 && y < cv.height + 6) ctx.fillRect(c * CW + CW / 2 - 9, y - 2, 18, 4);
      }
    });
    // 깊이 눈금
    ctx.fillStyle = "#3a4b5c"; ctx.font = "10px sans-serif"; ctx.textAlign = "right";
    for (let r = 0; r < WROWS; r += 3) {
      const y = sY(r * CH);
      if (y > 8 && y < cv.height) ctx.fillText((WROWS - r) + "m", cv.width - 3, y + 10);
    }
    ctx.textAlign = "center";
    // 출구
    const ey = sY(0);
    if (ey > -CH && ey < cv.height) {
      ctx.fillStyle = "#3ec98a"; ctx.fillRect(0, ey, cv.width, CH * 0.5);
      ctx.fillStyle = "#0c3b27"; ctx.font = "13px sans-serif";
      ctx.fillText("▲ 출구 EXIT ▲", cv.width / 2, ey + CH * 0.34);
    }
    // 아이템
    const COL = { time: "#e0a93a", ladder: "#5dc99a", tube: "#d46a8a" };
    const LAB = { time: "시간", ladder: "사다리", tube: "튜브" };
    items.forEach((it) => {
      if (it.taken) return;
      const y = sY(it.row * CH + CH / 2);
      if (y < -16 || y > cv.height + 16) return;
      const cx = it.col * CW + CW / 2;
      ctx.fillStyle = COL[it.type]; ctx.beginPath(); ctx.arc(cx, y, 13, 0, 7); ctx.fill();
      ctx.fillStyle = "#1a2330"; ctx.font = "11px sans-serif"; ctx.fillText(LAB[it.type], cx, y + 4);
    });
    // 장애물 (버려진 차 / 나뭇가지)
    obstacles.forEach((o) => {
      const y = sY(o.row * CH + CH / 2);
      if (y > -20 && y < cv.height + 20) drawCar(o.col * CW + CW / 2, y);
    });
    branches.forEach((b) => {
      const y = sY(b.row * CH + CH / 2);
      if (y > -20 && y < cv.height + 20) drawBranch(b.x * CW + CW / 2, y);
    });

    // 플레이어 (물보다 먼저 그려야 물이 몸 위로 차오름)
    const px = player.col * CW, py = sY(player.row * CH);
    if (hasTube()) {
      ctx.strokeStyle = "#d46a8a"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(px + CW / 2, py + CH / 2 - 4, 16, 0, 7); ctx.stroke();
    }
    drawChild(px + CW / 2, py + CH / 2 + 4);

    // 물 (바닥부터 차오름) — 아이 다음에 그려서 발밑→머리까지 잠기게
    const wy = sY(waterWorldTop());
    if (wy < cv.height) {
      const top = Math.max(0, wy);
      ctx.fillStyle = "rgba(52,120,220,0.5)"; ctx.fillRect(0, top, cv.width, cv.height - top);
      if (wy > 0) { ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.fillRect(0, wy, cv.width, 2); }
    }
    // 플래시 메시지
    if (msgFlash) {
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(cv.width / 2 - 70, 24, 140, 28);
      ctx.fillStyle = "#fff"; ctx.font = "13px sans-serif"; ctx.fillText(msgFlash, cv.width / 2, 42);
    }
  }

  // ---- 메인 루프 ----
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); draw();
    const tEl = document.getElementById("timer");
    tEl.textContent = "0:" + String(Math.ceil(timeLeft)).padStart(2, "0");
    tEl.style.color = timeLeft < 12 ? "#e24b4a" : "#3478dc";
    document.getElementById("score").textContent = score;
    document.getElementById("dist").textContent = player.row + "칸";
    requestAnimationFrame(loop);
  }

  // ---- 입력 ----
  document.getElementById("left").onclick = () => move(-1, 0);
  document.getElementById("right").onclick = () => move(1, 0);
  document.getElementById("up").onclick = () => move(0, -1);
  document.getElementById("start").onclick = reset;
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") move(-1, 0);
    else if (e.key === "ArrowRight") move(1, 0);
    else if (e.key === "ArrowUp") move(0, -1);
    else return;
    e.preventDefault();
  });

  // 첫 화면 (대기 상태)
  reset(); running = false; updateCam();
  setStatus("▶ 시작을 눌러 대피를 시작하세요");
  requestAnimationFrame(loop);
})();
