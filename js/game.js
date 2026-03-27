/**
 * Lollo Adventures — en nivå i Lolo-stil (rutnät, hjärtan, kista, juvel, utgång).
 */
(function () {
  const TILE = 32;
  const COLS = 13;
  const ROWS = 11;

  const T = {
    EMPTY: 0,
    WALL: 1,
    HEART: 2,
    CHEST: 3,
    DOOR: 4,
    BLOCK: 5,
    WATER: 6,
    BRIDGE: 7,
  };

  // Level 1: W wall . floor, H heart, C chest, D door frame, O door opening, B block, ~ water, = bridge
  const LEVEL_LINES = [
    "WWWODOWWWWWWW",
    "W~...H....~..W",
    "W~.........~.W",
    "W......B....W",
    "W...H.......W",
    "W...........W",
    "W.....C.....W",
    "W...........W",
    "W...........W",
    "W....P......W",
    "WWWWWWWWWWWWW",
  ];

  const heartTotal = 2;

  let grid = [];
  let player = { x: 0, y: 0 };
  /** @type {{x:number,y:number,vx:number,xmin:number,xmax:number}[]} */
  let enemies = [];
  let heartsCollected = 0;
  let hasGem = false;
  let doorOpen = false;
  let statusMsg = "";
  let lastMoveAt = 0;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const hudHearts = document.getElementById("hud-hearts");
  const hudGem = document.getElementById("hud-gem");
  const hudStatus = document.getElementById("hud-status");

  function parseLevel() {
    grid = [];
    enemies = [];
    heartsCollected = 0;
    hasGem = false;
    doorOpen = false;
    statusMsg = "";

    for (let y = 0; y < ROWS; y++) {
      const row = [];
      const line = LEVEL_LINES[y];
      for (let x = 0; x < COLS; x++) {
        const ch = line[x];
        let t = T.EMPTY;
        if (ch === "W") t = T.WALL;
        else if (ch === "H") t = T.HEART;
        else if (ch === "C") t = T.CHEST;
        else if (ch === "D") t = T.DOOR;
        else if (ch === "B") t = T.BLOCK;
        else if (ch === "~") t = T.WATER;
        else if (ch === "=") t = T.BRIDGE;
        else if (ch === "O") t = T.EMPTY;
        else if (ch === "P") {
          t = T.EMPTY;
          player = { x, y };
        }
        row.push(t);
      }
      grid.push(row);
    }

    enemies.push({ x: 6, y: 5, vx: 1, xmin: 2, xmax: 10 });
  }

  function cellAt(x, y) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return T.WALL;
    return grid[y][x];
  }

  /** Utgångsrad (övre dörr) — låst tills juvelen är tagen. */
  function isExitZone(x, y) {
    return y === 0 && x >= 3 && x <= 5;
  }

  function canWalkOnto(x, y) {
    const t = cellAt(x, y);
    if (t === T.WALL) return false;
    if (t === T.WATER) return false;
    if (isExitZone(x, y) && !hasGem) return false;
    if (t === T.CHEST && heartsCollected < heartTotal) return false;
    if (blockAt(x, y)) return false;
    if (enemyAt(x, y)) return false;
    return true;
  }

  function enemyAt(x, y) {
    return enemies.some((e) => e.x === x && e.y === y);
  }

  function blockAt(x, y) {
    return cellAt(x, y) === T.BLOCK;
  }

  function pushBlock(fromX, fromY, dx, dy) {
    const bx = fromX + dx;
    const by = fromY + dy;
    if (cellAt(bx, by) !== T.BLOCK) return false;
    const nx = bx + dx;
    const ny = by + dy;
    const dest = cellAt(nx, ny);
    if (isExitZone(nx, ny) && !hasGem) return false;
    if (dest === T.WALL || dest === T.WATER || dest === T.HEART || dest === T.CHEST || dest === T.DOOR) return false;
    if (dest === T.BLOCK) return false;
    if (enemyAt(nx, ny) || enemyAt(bx, by)) return false;
    grid[by][bx] = T.EMPTY;
    grid[ny][nx] = T.BLOCK;
    return true;
  }

  function tryMove(dx, dy) {
    const nx = player.x + dx;
    const ny = player.y + dy;
    const here = cellAt(nx, ny);

    if (here === T.BLOCK) {
      if (!pushBlock(player.x, player.y, dx, dy)) return;
    }

    if (!canWalkOnto(nx, ny)) return;

    player.x = nx;
    player.y = ny;

    if (cellAt(player.x, player.y) === T.HEART) {
      grid[player.y][player.x] = T.EMPTY;
      heartsCollected++;
      if (heartsCollected >= heartTotal) statusMsg = "Kistan öppnas!";
    }

    if (cellAt(player.x, player.y) === T.CHEST && heartsCollected >= heartTotal && !hasGem) {
      hasGem = true;
      doorOpen = true;
      statusMsg = "Du har juvelen! Utgången är öppen.";
    }

    if (isExitZone(player.x, player.y) && hasGem) {
      statusMsg = "Nivå klar! Bra jobbat, Lollo.";
    }
  }

  function tickEnemies() {
    for (const e of enemies) {
      let nx = e.x + e.vx;
      const ny = e.y;
      if (nx < e.xmin || nx > e.xmax) {
        e.vx = -e.vx;
        nx = e.x + e.vx;
      }
      let t = cellAt(nx, ny);
      if (isExitZone(nx, ny) && !hasGem) t = T.WALL;
      if (t === T.WALL || t === T.WATER || blockAt(nx, ny) || (t === T.CHEST && heartsCollected < heartTotal)) {
        e.vx = -e.vx;
        nx = e.x + e.vx;
      }
      if (nx !== e.x) {
        if (player.x === nx && player.y === ny) {
          statusMsg = "Ouch! Börja om med R.";
          parseLevel();
          return;
        }
        e.x = nx;
        if (player.x === e.x && player.y === e.y) {
          statusMsg = "Ouch! Börja om med R.";
          parseLevel();
        }
      }
    }
  }

  // NES-liknande färgpalett (blue floor, tegel, Lolo-blå)
  const PAL = {
    floor: "#3468c9",
    floorAlt: "#2d5bb3",
    wallTop: "#8b6914",
    wallFace: "#6b4f0c",
    water: "#2b64a8",
    waterHi: "#4a8cd4",
    heart: "#e84a4a",
    heartShine: "#ff9ea8",
    chest: "#c4a35a",
    chestLock: "#5c4033",
    door: "#4a3728",
    doorOpen: "#2a1810",
    lolo: "#4a7bdc",
    loloEye: "#fff",
    loloOutline: "#1e3a6e",
    block: "#7a5c3e",
    blockHi: "#a07a52",
    enemy: "#c94a9c",
    enemyEye: "#fff",
  };

  function drawTileBase(x, y) {
    const px = x * TILE;
    const py = y * TILE;
    ctx.fillStyle = (x + y) % 2 === 0 ? PAL.floor : PAL.floorAlt;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
  }

  function drawWall(x, y) {
    const px = x * TILE;
    const py = y * TILE;
    ctx.fillStyle = PAL.wallFace;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = PAL.wallTop;
    ctx.fillRect(px, py, TILE, 8);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(px + 4, py + 10, TILE - 8, TILE - 14);
  }

  function drawWater(x, y) {
    const px = x * TILE;
    const py = y * TILE;
    const t = Date.now() / 400;
    ctx.fillStyle = PAL.water;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = PAL.waterHi;
    for (let i = 0; i < 3; i++) {
      const wave = Math.sin(t + x * 0.7 + y * 0.5 + i) * 3;
      ctx.fillRect(px + 4 + i * 8, py + 14 + wave, 6, 3);
    }
  }

  function drawHeart(x, y) {
    const cx = x * TILE + TILE / 2;
    const cy = y * TILE + TILE / 2;
    drawTileBase(x, y);
    ctx.fillStyle = PAL.heart;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 6);
    ctx.bezierCurveTo(cx - 12, cy - 4, cx - 12, cy - 12, cx, cy - 8);
    ctx.bezierCurveTo(cx + 12, cy - 12, cx + 12, cy - 4, cx, cy + 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PAL.heartShine;
    ctx.fillRect(cx - 5, cy - 8, 4, 4);
  }

  function drawChest(x, y) {
    drawTileBase(x, y);
    const px = x * TILE + 6;
    const py = y * TILE + 10;
    const locked = heartsCollected < heartTotal;
    ctx.fillStyle = locked ? "#6b5a3a" : PAL.chest;
    ctx.fillRect(px, py, TILE - 12, TILE - 16);
    ctx.fillStyle = PAL.chestLock;
    ctx.fillRect(x * TILE + TILE / 2 - 3, y * TILE + TILE / 2, 6, 8);
  }

  function drawDoor(x, y) {
    const px = x * TILE;
    const py = y * TILE;
    drawTileBase(x, y);
    if (doorOpen && y === 0) {
      ctx.fillStyle = PAL.doorOpen;
      ctx.fillRect(px + 6, py + 4, TILE - 12, TILE - 8);
      return;
    }
    ctx.fillStyle = PAL.door;
    ctx.fillRect(px + 4, py + 2, TILE - 8, TILE - 4);
    ctx.fillStyle = "#2a1810";
    ctx.fillRect(px + TILE / 2 - 4, py + TILE / 2 - 6, 8, 10);
  }

  function drawBlock(x, y) {
    drawTileBase(x, y);
    const px = x * TILE + 3;
    const py = y * TILE + 3;
    ctx.fillStyle = PAL.block;
    ctx.fillRect(px + 2, py + 4, TILE - 10, TILE - 10);
    ctx.fillStyle = PAL.blockHi;
    ctx.fillRect(px + 2, py + 4, TILE - 10, 6);
  }

  function drawLolo(x, y) {
    const cx = x * TILE + TILE / 2;
    const cy = y * TILE + TILE / 2;
    ctx.fillStyle = PAL.loloOutline;
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.lolo;
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.loloEye;
    ctx.fillRect(cx - 6, cy - 2, 4, 5);
    ctx.fillRect(cx + 2, cy - 2, 4, 5);
    ctx.fillStyle = PAL.loloOutline;
    ctx.fillRect(cx - 5, cy - 1, 2, 2);
    ctx.fillRect(cx + 3, cy - 1, 2, 2);
  }

  function drawEnemy(x, y) {
    const cx = x * TILE + TILE / 2;
    const cy = y * TILE + TILE / 2;
    drawTileBase(x, y);
    ctx.fillStyle = PAL.enemy;
    ctx.fillRect(cx - 10, cy - 6, 20, 16);
    ctx.fillStyle = PAL.enemyEye;
    ctx.fillRect(cx - 7, cy - 2, 5, 5);
    ctx.fillRect(cx + 2, cy - 2, 5, 5);
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const t = grid[y][x];
        if (t === T.WALL) drawWall(x, y);
        else if (t === T.WATER) drawWater(x, y);
        else if (t === T.BRIDGE) {
          drawTileBase(x, y);
          ctx.fillStyle = "#8b7355";
          ctx.fillRect(x * TILE + 4, y * TILE + 12, TILE - 8, 10);
        } else if (t === T.HEART) drawHeart(x, y);
        else if (t === T.CHEST) drawChest(x, y);
        else if (t === T.DOOR) drawDoor(x, y);
        else if (t === T.BLOCK) drawBlock(x, y);
        else drawTileBase(x, y);
      }
    }
    for (const e of enemies) drawEnemy(e.x, e.y);
    drawLolo(player.x, player.y);

    hudHearts.textContent = `Hjärtan: ${heartsCollected} / ${heartTotal}`;
    hudGem.textContent = `Juvel: ${hasGem ? "ja" : "nej"}`;
    hudStatus.textContent = statusMsg;
  }

  function loop() {
    render();
    requestAnimationFrame(loop);
  }

  const MOVE_COOLDOWN_MS = 140;

  document.addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
      e.preventDefault();
    }
    const now = performance.now();
    if (now - lastMoveAt < MOVE_COOLDOWN_MS) return;

    if (e.key === "r" || e.key === "R") {
      parseLevel();
      return;
    }

    let dx = 0;
    let dy = 0;
    if (e.key === "ArrowUp") dy = -1;
    else if (e.key === "ArrowDown") dy = 1;
    else if (e.key === "ArrowLeft") dx = -1;
    else if (e.key === "ArrowRight") dx = 1;
    else return;

    lastMoveAt = now;
    tryMove(dx, dy);
  });

  let enemyTimer = 0;
  function enemyStepLoop(ts) {
    if (!enemyTimer) enemyTimer = ts;
    if (ts - enemyTimer >= 420) {
      enemyTimer = ts;
      tickEnemies();
    }
    requestAnimationFrame(enemyStepLoop);
  }

  parseLevel();
  loop();
  requestAnimationFrame(enemyStepLoop);
})();
