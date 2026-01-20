const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const cashEl = document.getElementById("cash");
const waveEl = document.getElementById("wave");
const livesEl = document.getElementById("lives");
const startWaveBtn = document.getElementById("start-wave");
const pauseBtn = document.getElementById("pause");

const menu = document.getElementById("menu");
const playBtn = document.getElementById("play");
const mapName = document.getElementById("map-name");
const mapDesc = document.getElementById("map-desc");
const mapPrev = document.getElementById("map-prev");
const mapNext = document.getElementById("map-next");

const difficultyButtons = Array.from(document.querySelectorAll(".difficulty button"));
const towerButtons = Array.from(document.querySelectorAll(".tower-btn"));

const grid = {
  cols: 15,
  rows: 10,
  size: 48,
};

const towerTypes = {
  gatling: {
    name: "Gatling",
    color: "#ff4f5e",
    cost: 40,
    range: 2.8,
    damage: 8,
    fireRate: 0.18,
    slow: 0,
    splash: 0,
    targetsAir: false,
  },
  glue: {
    name: "Glue",
    color: "#4fe88c",
    cost: 35,
    range: 2.5,
    damage: 2,
    fireRate: 0.9,
    slow: 0.45,
    splash: 0,
    targetsAir: false,
  },
  missile: {
    name: "Missile",
    color: "#46b0ff",
    cost: 60,
    range: 3.6,
    damage: 16,
    fireRate: 1.3,
    slow: 0,
    splash: 1.3,
    targetsAir: true,
  },
  tesla: {
    name: "Tesla",
    color: "#a66bff",
    cost: 90,
    range: 2.3,
    damage: 45,
    fireRate: 1.7,
    slow: 0,
    splash: 0,
    targetsAir: true,
  },
};

const difficulties = {
  fun: { cash: 260, lives: 30, health: 0.75, speed: 0.9, reward: 1.2 },
  easy: { cash: 220, lives: 25, health: 0.9, speed: 0.95, reward: 1.05 },
  normal: { cash: 200, lives: 20, health: 1, speed: 1, reward: 1 },
  hard: { cash: 170, lives: 16, health: 1.2, speed: 1.1, reward: 0.9 },
};

const maps = [
  {
    name: "Circuit Yard",
    desc: "Long corridors with tight corners.",
    start: { x: 0, y: 4 },
    exit: { x: 14, y: 5 },
    walls: [
      [3, 1], [3, 2], [3, 3], [3, 4], [3, 6], [3, 7], [3, 8],
      [6, 0], [6, 1], [6, 2], [6, 7], [6, 8], [6, 9],
      [9, 1], [9, 2], [9, 3], [9, 5], [9, 6], [9, 7],
      [12, 2], [12, 3], [12, 6], [12, 7],
    ],
  },
  {
    name: "Split Lanes",
    desc: "Wide open middle with narrow exits.",
    start: { x: 0, y: 2 },
    exit: { x: 14, y: 7 },
    walls: [
      [4, 0], [4, 1], [4, 2], [4, 7], [4, 8], [4, 9],
      [10, 0], [10, 1], [10, 2], [10, 7], [10, 8], [10, 9],
      [7, 4], [7, 5], [7, 6],
    ],
  },
  {
    name: "Forge Grid",
    desc: "Chunky walls make creative mazes.",
    start: { x: 2, y: 0 },
    exit: { x: 12, y: 9 },
    walls: [
      [1, 3], [2, 3], [3, 3],
      [11, 6], [12, 6], [13, 6],
      [5, 1], [5, 2], [5, 3], [5, 7], [5, 8],
      [9, 1], [9, 2], [9, 7], [9, 8],
    ],
  },
];

let selectedTower = "gatling";
let selectedDifficulty = "normal";
let mapIndex = 0;

let gameState = null;
let lastTime = 0;
let paused = false;

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

const playBeep = (frequency = 440) => {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "square";
  oscillator.frequency.value = frequency;
  gain.gain.value = 0.03;
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.08);
};

const createState = () => {
  const diff = difficulties[selectedDifficulty];
  return {
    cash: diff.cash,
    lives: diff.lives,
    wave: 1,
    towers: [],
    enemies: [],
    bullets: [],
    spawnQueue: [],
    spawnTimer: 0,
    isWaveActive: false,
    map: maps[mapIndex],
    distances: [],
    pathInvalid: false,
    difficulty: diff,
  };
};

const updateHud = () => {
  cashEl.textContent = Math.floor(gameState.cash);
  livesEl.textContent = gameState.lives;
  waveEl.textContent = gameState.wave;
};

const inBounds = (x, y) => x >= 0 && x < grid.cols && y >= 0 && y < grid.rows;

const getCellIndex = (x, y) => y * grid.cols + x;

const buildBlockedSet = () => {
  const blocked = new Set();
  gameState.map.walls.forEach(([x, y]) => blocked.add(getCellIndex(x, y)));
  gameState.towers.forEach((tower) => blocked.add(getCellIndex(tower.x, tower.y)));
  return blocked;
};

const computeDistances = () => {
  const distances = new Array(grid.cols * grid.rows).fill(Infinity);
  const queue = [];
  const exitIndex = getCellIndex(gameState.map.exit.x, gameState.map.exit.y);
  distances[exitIndex] = 0;
  queue.push(gameState.map.exit);
  const blocked = buildBlockedSet();

  while (queue.length) {
    const { x, y } = queue.shift();
    const dist = distances[getCellIndex(x, y)] + 1;
    const neighbors = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    neighbors.forEach(([nx, ny]) => {
      if (!inBounds(nx, ny)) return;
      const index = getCellIndex(nx, ny);
      if (blocked.has(index)) return;
      if (dist < distances[index]) {
        distances[index] = dist;
        queue.push({ x: nx, y: ny });
      }
    });
  }

  gameState.distances = distances;
  const startIndex = getCellIndex(gameState.map.start.x, gameState.map.start.y);
  gameState.pathInvalid = distances[startIndex] === Infinity;
};

const canBuildAt = (x, y) => {
  const isWall = gameState.map.walls.some(([wx, wy]) => wx === x && wy === y);
  const isTower = gameState.towers.some((tower) => tower.x === x && tower.y === y);
  const isStart = gameState.map.start.x === x && gameState.map.start.y === y;
  const isExit = gameState.map.exit.x === x && gameState.map.exit.y === y;
  return !(isWall || isTower || isStart || isExit);
};

const tryPlaceTower = (x, y) => {
  if (!canBuildAt(x, y)) return;
  const type = towerTypes[selectedTower];
  if (gameState.cash < type.cost) return;

  const tower = {
    x,
    y,
    type: selectedTower,
    cooldown: 0,
    direction: 0,
    targetId: null,
  };

  gameState.towers.push(tower);
  computeDistances();
  if (gameState.pathInvalid) {
    gameState.towers.pop();
    computeDistances();
    return;
  }

  gameState.cash -= type.cost;
  playBeep(640);
};

const removeTower = (x, y) => {
  const index = gameState.towers.findIndex((tower) => tower.x === x && tower.y === y);
  if (index === -1) return;
  const tower = gameState.towers[index];
  const refund = towerTypes[tower.type].cost * 0.7;
  gameState.towers.splice(index, 1);
  gameState.cash += refund;
  computeDistances();
};

const spawnWave = () => {
  if (gameState.isWaveActive) return;
  gameState.isWaveActive = true;
  const count = 8 + gameState.wave * 3;
  const airCount = Math.max(0, Math.floor((gameState.wave - 2) / 3));
  gameState.spawnQueue = [];

  for (let i = 0; i < count; i += 1) {
    gameState.spawnQueue.push({ type: "ground" });
  }
  for (let i = 0; i < airCount; i += 1) {
    gameState.spawnQueue.push({ type: "air" });
  }

  gameState.spawnTimer = 0.6;
};

const createEnemy = (kind) => {
  const diff = gameState.difficulty;
  const baseHealth = kind === "air" ? 50 : 70;
  return {
    id: Math.random().toString(36).slice(2),
    kind,
    x: gameState.map.start.x + 0.5,
    y: gameState.map.start.y + 0.5,
    speed: (kind === "air" ? 1.5 : 1.15) * diff.speed,
    health: baseHealth * (1 + gameState.wave * 0.2) * diff.health,
    maxHealth: baseHealth * (1 + gameState.wave * 0.2) * diff.health,
    slowTimer: 0,
  };
};

const updateEnemies = (dt) => {
  const exit = gameState.map.exit;
  gameState.enemies.forEach((enemy) => {
    let speedMultiplier = 1;
    if (enemy.slowTimer > 0) {
      enemy.slowTimer -= dt;
      speedMultiplier = 0.55;
    }

    if (enemy.kind === "air") {
      const dx = exit.x + 0.5 - enemy.x;
      const dy = exit.y + 0.5 - enemy.y;
      const dist = Math.hypot(dx, dy) || 1;
      enemy.x += (dx / dist) * enemy.speed * speedMultiplier * dt;
      enemy.y += (dy / dist) * enemy.speed * speedMultiplier * dt;
      return;
    }

    const cx = Math.floor(enemy.x);
    const cy = Math.floor(enemy.y);
    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];

    let best = null;
    let bestValue = Infinity;
    neighbors.forEach(([nx, ny]) => {
      if (!inBounds(nx, ny)) return;
      const index = getCellIndex(nx, ny);
      const value = gameState.distances[index];
      if (value < bestValue) {
        bestValue = value;
        best = { x: nx + 0.5, y: ny + 0.5 };
      }
    });

    if (best) {
      const dx = best.x - enemy.x;
      const dy = best.y - enemy.y;
      const dist = Math.hypot(dx, dy) || 1;
      enemy.x += (dx / dist) * enemy.speed * speedMultiplier * dt;
      enemy.y += (dy / dist) * enemy.speed * speedMultiplier * dt;
    }
  });

  gameState.enemies = gameState.enemies.filter((enemy) => {
    if (enemy.health <= 0) {
      gameState.cash += 8 * gameState.difficulty.reward;
      return false;
    }
    const reachedExit = Math.hypot(enemy.x - (exit.x + 0.5), enemy.y - (exit.y + 0.5)) < 0.4;
    if (reachedExit) {
      gameState.lives -= 1;
      return false;
    }
    return true;
  });

  if (gameState.lives <= 0) {
    gameState.isWaveActive = false;
    gameState.spawnQueue = [];
    gameState.enemies = [];
  }
};

const updateTowers = (dt) => {
  gameState.towers.forEach((tower) => {
    const config = towerTypes[tower.type];
    tower.cooldown -= dt;

    let target = gameState.enemies.find((enemy) => enemy.id === tower.targetId);
    const inRange = (enemy) => {
      const dx = enemy.x - (tower.x + 0.5);
      const dy = enemy.y - (tower.y + 0.5);
      const range = config.range;
      return Math.hypot(dx, dy) <= range;
    };

    if (!target || !inRange(target)) {
      tower.targetId = null;
      const candidates = gameState.enemies.filter((enemy) => {
        if (enemy.kind === "air" && !config.targetsAir) return false;
        return inRange(enemy);
      });

      if (candidates.length) {
        target = candidates.reduce((best, enemy) => {
          const angle = Math.atan2(enemy.y - (tower.y + 0.5), enemy.x - (tower.x + 0.5));
          const diff = Math.abs(Math.atan2(Math.sin(angle - tower.direction), Math.cos(angle - tower.direction)));
          if (!best || diff < best.diff) {
            return { enemy, diff };
          }
          return best;
        }, null).enemy;
        tower.targetId = target.id;
        tower.direction = Math.atan2(target.y - (tower.y + 0.5), target.x - (tower.x + 0.5));
      }
    }

    if (target && tower.cooldown <= 0) {
      tower.cooldown = config.fireRate;
      if (config.splash > 0) {
        gameState.enemies.forEach((enemy) => {
          const dx = enemy.x - target.x;
          const dy = enemy.y - target.y;
          if (Math.hypot(dx, dy) <= config.splash) {
            enemy.health -= config.damage;
            if (config.slow > 0) enemy.slowTimer = 1.5;
          }
        });
      } else {
        target.health -= config.damage;
        if (config.slow > 0) target.slowTimer = 1.5;
      }
      playBeep(320 + Math.random() * 160);
    }
  });
};

const updateSpawnQueue = (dt) => {
  if (!gameState.isWaveActive) return;
  gameState.spawnTimer -= dt;
  if (gameState.spawnTimer <= 0 && gameState.spawnQueue.length) {
    const entry = gameState.spawnQueue.shift();
    gameState.enemies.push(createEnemy(entry.type));
    gameState.spawnTimer = 0.6;
  }

  if (gameState.spawnQueue.length === 0 && gameState.enemies.length === 0) {
    gameState.isWaveActive = false;
    gameState.wave += 1;
  }
};

const shadeColor = (hex, amount) => {
  const value = hex.replace("#", "");
  const num = parseInt(value, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `rgb(${r}, ${g}, ${b})`;
};

const drawBevelTile = (x, y, size, baseColor) => {
  const light = shadeColor(baseColor, 24);
  const dark = shadeColor(baseColor, -24);
  ctx.fillStyle = baseColor;
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = light;
  ctx.fillRect(x, y, size, 3);
  ctx.fillRect(x, y, 3, size);
  ctx.fillStyle = dark;
  ctx.fillRect(x, y + size - 3, size, 3);
  ctx.fillRect(x + size - 3, y, 3, size);
};

const drawGrid = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#0b0f14";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < grid.rows; y += 1) {
    for (let x = 0; x < grid.cols; x += 1) {
      const px = x * grid.size;
      const py = y * grid.size;
      const isEven = (x + y) % 2 === 0;
      const baseColor = isEven ? "#0f131a" : "#111821";
      drawBevelTile(px, py, grid.size, baseColor);
    }
  }

  ctx.strokeStyle = "#3a4b5e";
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
};

const drawMap = () => {
  const { walls, start, exit } = gameState.map;
  walls.forEach(([x, y]) => {
    drawBevelTile(x * grid.size, y * grid.size, grid.size, "#252f3c");
  });

  drawBevelTile(start.x * grid.size, start.y * grid.size, grid.size, "#1f4b6b");
  drawBevelTile(exit.x * grid.size, exit.y * grid.size, grid.size, "#5c4a1c");
  ctx.fillStyle = "#7bd8ff";
  ctx.fillRect(start.x * grid.size + 12, start.y * grid.size + 12, 24, 24);
  ctx.fillStyle = "#ffd166";
  ctx.fillRect(exit.x * grid.size + 12, exit.y * grid.size + 12, 24, 24);
};

const drawTowers = () => {
  gameState.towers.forEach((tower) => {
    const config = towerTypes[tower.type];
    const px = tower.x * grid.size;
    const py = tower.y * grid.size;
    const cx = px + grid.size / 2;
    const cy = py + grid.size / 2;

    drawBevelTile(px + 6, py + 6, grid.size - 12, "#1a222d");
    ctx.fillStyle = config.color;
    ctx.fillRect(px + 14, py + 14, grid.size - 28, grid.size - 28);
    ctx.fillStyle = shadeColor(config.color, -30);
    ctx.fillRect(px + 18, py + 18, grid.size - 36, grid.size - 36);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tower.direction);
    ctx.fillStyle = "#0a0d12";
    ctx.fillRect(-6, -3, 16, 6);
    ctx.fillStyle = config.color;
    ctx.fillRect(-4, -2, 12, 4);
    ctx.restore();

    ctx.fillStyle = "#0b0f14";
    if (tower.type === "gatling") {
      ctx.fillRect(cx - 8, cy - 6, 6, 12);
      ctx.fillRect(cx + 2, cy - 6, 6, 12);
    } else if (tower.type === "glue") {
      ctx.beginPath();
      ctx.arc(cx, cy + 2, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = config.color;
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (tower.type === "missile") {
      ctx.fillRect(cx - 4, cy - 8, 8, 16);
      ctx.fillStyle = config.color;
      ctx.fillRect(cx - 3, cy - 6, 6, 12);
    } else if (tower.type === "tesla") {
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 8);
      ctx.lineTo(cx + 2, cy - 2);
      ctx.lineTo(cx - 2, cy + 2);
      ctx.lineTo(cx + 6, cy + 8);
      ctx.lineTo(cx - 2, cy + 2);
      ctx.lineTo(cx + 2, cy - 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = config.color;
      ctx.fillRect(cx - 2, cy - 6, 4, 12);
    }

    ctx.strokeStyle = shadeColor(config.color, 30);
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 14, py + 14, grid.size - 28, grid.size - 28);
  });
};

const drawEnemies = () => {
  gameState.enemies.forEach((enemy) => {
    const px = enemy.x * grid.size;
    const py = enemy.y * grid.size;
    const size = grid.size * 0.28;
    const color = enemy.kind === "air" ? "#46b0ff" : "#ff9f43";
    ctx.fillStyle = shadeColor(color, -25);
    ctx.fillRect(px - size / 2, py - size / 2, size, size);
    ctx.fillStyle = color;
    ctx.fillRect(px - size / 2 + 3, py - size / 2 + 3, size - 6, size - 6);

    const barWidth = grid.size * 0.5;
    const healthRatio = Math.max(0, enemy.health / enemy.maxHealth);
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(px - barWidth / 2, py - grid.size * 0.35, barWidth, 5);
    ctx.fillStyle = "#6ee7b7";
    ctx.fillRect(px - barWidth / 2, py - grid.size * 0.35, barWidth * healthRatio, 5);
  });
};

const drawPathWarning = () => {
  if (!gameState.pathInvalid) return;
  ctx.fillStyle = "rgba(255, 79, 94, 0.2)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ff4f5e";
  ctx.font = "bold 20px Inter";
  ctx.fillText("Path blocked!", 16, 28);
};

const drawHover = (cell) => {
  if (!cell) return;
  if (!canBuildAt(cell.x, cell.y)) return;
  const config = towerTypes[selectedTower];
  ctx.strokeStyle = config.color;
  ctx.lineWidth = 3;
  ctx.strokeRect(cell.x * grid.size + 6, cell.y * grid.size + 6, grid.size - 12, grid.size - 12);
};

const render = () => {
  drawGrid();
  drawMap();
  drawTowers();
  drawEnemies();
  drawPathWarning();
};

const getCellFromEvent = (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) / (rect.width / canvas.width) / grid.size);
  const y = Math.floor((event.clientY - rect.top) / (rect.height / canvas.height) / grid.size);
  if (!inBounds(x, y)) return null;
  return { x, y };
};

let hoverCell = null;

canvas.addEventListener("mousemove", (event) => {
  hoverCell = getCellFromEvent(event);
});

canvas.addEventListener("mouseleave", () => {
  hoverCell = null;
});

canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  const cell = getCellFromEvent(event);
  if (!cell) return;
  removeTower(cell.x, cell.y);
});

canvas.addEventListener("click", (event) => {
  const cell = getCellFromEvent(event);
  if (!cell) return;
  tryPlaceTower(cell.x, cell.y);
});

startWaveBtn.addEventListener("click", () => {
  if (gameState.lives <= 0) return;
  spawnWave();
});

pauseBtn.addEventListener("click", () => {
  paused = !paused;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
});

towerButtons.forEach((button) => {
  button.addEventListener("click", () => {
    towerButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
    selectedTower = button.dataset.tower;
  });
});

const updateDifficultyUi = () => {
  difficultyButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.difficulty === selectedDifficulty);
  });
};

const updateMapUi = () => {
  const map = maps[mapIndex];
  mapName.textContent = map.name;
  mapDesc.textContent = map.desc;
};

difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedDifficulty = button.dataset.difficulty;
    updateDifficultyUi();
  });
});

mapPrev.addEventListener("click", () => {
  mapIndex = (mapIndex - 1 + maps.length) % maps.length;
  updateMapUi();
});

mapNext.addEventListener("click", () => {
  mapIndex = (mapIndex + 1) % maps.length;
  updateMapUi();
});

playBtn.addEventListener("click", () => {
  menu.classList.add("hidden");
  startGame();
});

const startGame = () => {
  gameState = createState();
  computeDistances();
  updateHud();
  towerButtons.forEach((btn) => btn.classList.remove("active"));
  towerButtons[0].classList.add("active");
  selectedTower = towerButtons[0].dataset.tower;
};

const gameLoop = (timestamp) => {
  if (!gameState) {
    requestAnimationFrame(gameLoop);
    return;
  }

  const dt = Math.min(0.04, (timestamp - lastTime) / 1000 || 0);
  lastTime = timestamp;

  if (!paused) {
    updateSpawnQueue(dt);
    updateEnemies(dt);
    updateTowers(dt);
  }

  updateHud();
  render();
  drawHover(hoverCell);

  if (gameState.lives <= 0) {
    ctx.fillStyle = "rgba(5, 8, 12, 0.8)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ff4f5e";
    ctx.font = "bold 36px Inter";
    ctx.fillText("Game Over", canvas.width / 2 - 90, canvas.height / 2);
  }

  requestAnimationFrame(gameLoop);
};

updateDifficultyUi();
updateMapUi();
requestAnimationFrame(gameLoop);
