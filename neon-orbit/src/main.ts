import './style.css';
import { Vector2 } from './math';
import { Core, Player, Enemy, Projectile, AtomicBoss, PERIODIC_TABLE } from './entities';
import { Particle, createExplosion } from './particles';
import { cryptoEngine } from './crypto';
import { networkFeed } from './network';
import { audioEngine } from './audio';
import { Application, Graphics, BlurFilter, Text, TextStyle, Container } from 'pixi.js';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const app = new Application();
const glowGfx = new Graphics();
const mainGfx = new Graphics();
const textContainer = new Container();
let appInitialized = false;

let viewWidth = window.innerWidth;
let viewHeight = window.innerHeight;

app.init({
  canvas,
  resizeTo: window,
  resolution: Math.min(window.devicePixelRatio || 1, 2),
  autoDensity: true,
  background: '#050510',
  antialias: true
}).then(() => {
  if (!prefersReducedMotion()) {
    glowGfx.filters = [new BlurFilter({ strength: 10 })];
  }
  app.stage.addChild(glowGfx);
  app.stage.addChild(mainGfx);
  app.stage.addChild(textContainer);
  appInitialized = true;
  draw();
}).catch((err) => {
  console.warn('PixiJS initialization warning:', err);
});

// UI Elements
const mainMenu = document.getElementById('main-menu')!;
const gameOverMenu = document.getElementById('game-over-menu')!;
const startBtn = document.getElementById('start-btn')!;
const restartBtn = document.getElementById('restart-btn')!;
const downloadLogsBtn = document.getElementById('download-logs-btn');
const muteBtn = document.getElementById('neon-mute-btn');
const scoreEl = document.getElementById('score')!;
const finalScoreEl = document.getElementById('final-score')!;
const healthBar = document.getElementById('health-bar')!;
const terminal = document.getElementById('crypto-terminal')!;
const hashPowerEl = document.getElementById('hash-power')!;
const infiniteModeCheckbox = document.getElementById('infinite-mode') as HTMLInputElement;

// Nerd Stats
const statBlocks = document.getElementById('stat-blocks')!;
const statKills = document.getElementById('stat-kills')!;
const statLoss = document.getElementById('stat-loss')!;
const statPackets = document.getElementById('stat-packets')!;

let totalBlocksMined = 0;
let totalEigenvalueCollapses = 0;
let totalDataPackets = 0;
let bossesDefeated = 0;
let sessionLogs: string[] = [];

let animationId = 0;
let isPlaying = false;
let isStarting = false;
let sessionId = 0;
let score = 0;
let health = 100;
const MAX_HEALTH = 100;

// Game State
let core: Core;
let player: Player;
let projectiles: Projectile[] = [];
let enemies: (Enemy | AtomicBoss)[] = [];
let particles: Particle[] = [];
let currentHashes = 0;
const HASHES_PER_BLOCK = 10;
let recentPayloadSizes: number[] = [];
let isBossActive = false;

let mousePos = new Vector2(0, 0);
let isShooting = false;
let lastShootTime = 0;
const SHOOT_DELAY = 150; // ms

let isInfiniteMode = false;
let lastLotteryTime = 0;

// Player controls
let keys: { [key: string]: boolean } = {};
let playerOrbitAngle = 0;
const ORBIT_RADIUS = 80;
const ORBIT_SPEED = 3;

function destroyEnemyResources(e: Enemy | AtomicBoss) {
  if (e instanceof AtomicBoss && e.pixiText) {
    e.pixiText.destroy();
    e.pixiText = undefined;
  }
}

// Resize handling without corrupting Pixi's WebGL canvas resolution
function resizeCanvas() {
  viewWidth = Math.max(320, window.innerWidth);
  viewHeight = Math.max(240, window.innerHeight);
  if (core) {
    core.position = new Vector2(viewWidth / 2, viewHeight / 2);
  }
  if (player && core) {
    player.position.x = core.position.x + Math.cos(playerOrbitAngle) * ORBIT_RADIUS;
    player.position.y = core.position.y + Math.sin(playerOrbitAngle) * ORBIT_RADIUS;
  }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let isAutoFire = false;
let isManualAiming = false;

// Clear sticky inputs when tab/window loses focus
const clearActiveInputs = () => {
  keys = {};
  if (!isAutoFire) isShooting = false;
};
window.addEventListener('blur', clearActiveInputs);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearActiveInputs();
});

// Input Listeners (Mouse & Keyboard)
window.addEventListener('mousemove', (e) => {
  isManualAiming = true;
  mousePos.x = e.clientX;
  mousePos.y = e.clientY;
});

window.addEventListener('mousedown', (e) => {
  const target = e.target as HTMLElement | null;
  if (target && target.closest('#ui-layer')) return;
  isManualAiming = true;
  mousePos.x = e.clientX;
  mousePos.y = e.clientY;
  isShooting = true;
});

window.addEventListener('mouseup', () => {
  if (!isAutoFire) isShooting = false;
});

window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

// Direct Canvas Touch Aiming & Shooting for Mobile
canvas.addEventListener('touchstart', (e: TouchEvent) => {
  if (e.touches.length > 0) {
    isManualAiming = true;
    mousePos.x = e.touches[0].clientX;
    mousePos.y = e.touches[0].clientY;
    isShooting = true;
  }
}, { passive: true });

canvas.addEventListener('touchmove', (e: TouchEvent) => {
  if (e.touches.length > 0) {
    isManualAiming = true;
    mousePos.x = e.touches[0].clientX;
    mousePos.y = e.touches[0].clientY;
  }
}, { passive: true });

const handleTouchEnd = (e: TouchEvent) => {
  if (e.touches.length === 0) {
    isManualAiming = false;
    if (!isAutoFire) isShooting = false;
  }
};
canvas.addEventListener('touchend', handleTouchEnd, { passive: true });
canvas.addEventListener('touchcancel', handleTouchEnd, { passive: true });

// Virtual Mobile Controls Bindings (Thumb controls)
const btnLeft = document.getElementById('btn-orbit-left');
const btnRight = document.getElementById('btn-orbit-right');
const btnFire = document.getElementById('btn-fire');
const btnAutoFire = document.getElementById('btn-autofire');

function bindHoldButton(el: HTMLElement | null, key: string) {
  if (!el) return;
  const press = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    keys[key] = true;
    el.classList.add('active');
  };
  const release = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    keys[key] = false;
    el.classList.remove('active');
  };
  el.addEventListener('pointerdown', press);
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('pointerleave', release);
}

bindHoldButton(btnLeft, 'a');
bindHoldButton(btnRight, 'd');

if (btnFire) {
  const startFire = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    isShooting = true;
    btnFire.classList.add('active');
  };
  const stopFire = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAutoFire) isShooting = false;
    btnFire.classList.remove('active');
  };
  btnFire.addEventListener('pointerdown', startFire);
  btnFire.addEventListener('pointerup', stopFire);
  btnFire.addEventListener('pointercancel', stopFire);
  btnFire.addEventListener('pointerleave', stopFire);
}

if (btnAutoFire) {
  btnAutoFire.addEventListener('click', (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    isAutoFire = !isAutoFire;
    btnAutoFire.classList.toggle('active', isAutoFire);
    btnAutoFire.textContent = isAutoFire ? 'AUTO: ON ⚡' : 'AUTO';
  });
}

if (muteBtn) {
  muteBtn.addEventListener('click', () => {
    const muted = audioEngine.toggleMute();
    muteBtn.classList.toggle('muted', muted);
    muteBtn.textContent = muted ? '🔇 MUTE' : '🔊 SFX';
  });
}

function addToTerminal(msg: string, type: string) {
  const line = document.createElement('div');
  line.className = `term-line ${type}`;
  line.textContent = msg;
  terminal.appendChild(line);

  sessionLogs.push(`[${new Date().toISOString()}] ${msg}`);
  if (sessionLogs.length > 500) {
    sessionLogs.shift();
  }

  if (terminal.childNodes.length > 50 && terminal.firstChild) {
    terminal.removeChild(terminal.firstChild);
  }
  terminal.scrollTop = terminal.scrollHeight;
}

function isPrime(num: number): boolean {
  if (num <= 1) return false;
  if (num <= 3) return true;
  if (num % 2 === 0 || num % 3 === 0) return false;
  for (let i = 5; i * i <= num; i += 6) {
    if (num % i === 0 || num % (i + 2) === 0) return false;
  }
  return true;
}

function spawnParticles(x: number, y: number, color: string, count: number) {
  const scaled = prefersReducedMotion() ? Math.min(8, Math.ceil(count * 0.2)) : count;
  if (particles.length > 450) return;
  particles.push(...createExplosion(x, y, color, scaled));
}

networkFeed.onNewData = (payload, dataSize) => {
  if (!isPlaying) return;

  recentPayloadSizes.push(dataSize);
  if (recentPayloadSizes.length > 20) recentPayloadSizes.shift();

  let variance = 0;
  if (recentPayloadSizes.length === 20) {
    const mean = recentPayloadSizes.reduce((a, b) => a + b, 0) / 20;
    variance = recentPayloadSizes.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / 20;
  }

  if (!isBossActive && totalBlocksMined > 0 && isPrime(totalBlocksMined) && variance > 100000) {
    spawnAtomicBoss();
  } else if (!isBossActive) {
    spawnEnemyWithPayload(payload, dataSize);
  }
};

function spawnAtomicBoss() {
  const edge = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;
  if (edge === 0) { x = viewWidth / 2; y = -100; }
  else if (edge === 1) { x = viewWidth + 100; y = viewHeight / 2; }
  else if (edge === 2) { x = viewWidth / 2; y = viewHeight + 100; }
  else { x = -100; y = viewHeight / 2; }

  const element = PERIODIC_TABLE[Math.floor(Math.random() * PERIODIC_TABLE.length)];

  enemies.forEach(e => {
    e.markedForDeletion = true;
    destroyEnemyResources(e);
    spawnParticles(e.position.x, e.position.y, e.color, 12);
  });
  enemies = enemies.filter(e => !e.markedForDeletion);

  const boss = new AtomicBoss(x, y, core.position, element.z, element.symbol);

  const text = new Text({ text: element.symbol, style: new TextStyle({ fill: '#ffffff', fontSize: 32, fontWeight: 'bold' }) });
  text.anchor.set(0.5);
  textContainer.addChild(text);
  boss.pixiText = text;

  enemies.push(boss);
  isBossActive = true;
  addToTerminal('[WARN] CRITICAL ENTROPY SPIKE DETECTED.', 'mined');
  addToTerminal(`[SYS] SPONTANEOUS MATERIALIZATION: ${element.symbol} ISOTOPE`, 'mined');

  audioEngine.playEMPSound();
}

function spawnEnemyWithPayload(payload: string, dataSize: number) {
  const edge = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;

  if (edge === 0) { x = Math.random() * viewWidth; y = -50; }
  else if (edge === 1) { x = viewWidth + 50; y = Math.random() * viewHeight; }
  else if (edge === 2) { x = Math.random() * viewWidth; y = viewHeight + 50; }
  else { x = -50; y = Math.random() * viewHeight; }

  const radius = Math.min(60, Math.max(10, dataSize / 20));
  const color = `hsl(${Math.random() * 60 + 300}, 100%, 50%)`;
  const speed = Math.random() * 50 + 30 + (bossesDefeated * 15);

  enemies.push(new Enemy(x, y, core.position, speed, radius, color, payload, dataSize));
  addToTerminal(`[RCV] ${payload.substring(0, 40)}... [${dataSize} bytes]`, 'raw');
  totalDataPackets++;
}

// Game Loop with clamped deltaTime
let lastTime = 0;
function gameLoop(time: number) {
  if (!isPlaying) return;

  const rawDt = (time - lastTime) / 1000;
  lastTime = time;
  const deltaTime = Number.isFinite(rawDt) ? Math.min(0.05, Math.max(0, rawDt)) : 0.016;

  update(deltaTime, time);
  if (!isPlaying) return;
  draw();

  animationId = requestAnimationFrame(gameLoop);
}

function update(dt: number, time: number) {
  if (keys['a'] || keys['arrowleft']) {
    playerOrbitAngle -= ORBIT_SPEED * dt;
  }
  if (keys['d'] || keys['arrowright']) {
    playerOrbitAngle += ORBIT_SPEED * dt;
  }

  player.position.x = core.position.x + Math.cos(playerOrbitAngle) * ORBIT_RADIUS;
  player.position.y = core.position.y + Math.sin(playerOrbitAngle) * ORBIT_RADIUS;

  if (isManualAiming) {
    player.updateAngle(mousePos.x, mousePos.y);
  } else {
    let closestEnemy: (Enemy | AtomicBoss) | null = null;
    let minDist = Infinity;
    for (const e of enemies) {
      if (e.markedForDeletion) continue;
      const d = e.position.sub(player.position).mag();
      if (d < minDist) {
        minDist = d;
        closestEnemy = e;
      }
    }
    if (closestEnemy) {
      mousePos = new Vector2(closestEnemy.position.x, closestEnemy.position.y);
    } else {
      const outward = player.position.sub(core.position).normalize();
      mousePos = player.position.add(outward.mult(200));
    }
    player.updateAngle(mousePos.x, mousePos.y);
  }

  if (isInfiniteMode && time - lastLotteryTime > 1000) {
    lastLotteryTime = time;
    if (Math.random() < (1 / 300000000)) {
      addToTerminal('[FATAL] A COSMIC RAY FLIPPED A CRITICAL BIT. THE LOTTERY OF DEATH WAS WON.', 'error');
      health = 0;
      updateUI();
      gameOver();
      return;
    }
  }

  // Shooting
  if ((isShooting || isAutoFire) && time - lastShootTime > SHOOT_DELAY) {
    let dir = mousePos.sub(player.position).normalize();
    if (dir.mag() === 0) {
      dir = player.position.sub(core.position).normalize();
    }
    const projVel = dir.mult(600);
    projectiles.push(new Projectile(player.position.x, player.position.y, projVel));
    audioEngine.playShootSound(dir);
    lastShootTime = time;
  }

  // Update entities
  core.update(dt);
  player.update(dt);

  projectiles.forEach(p => p.update(dt));
  enemies.forEach(e => e.update(dt, projectiles));
  particles.forEach(p => p.update(dt));

  // 1. Projectiles out of bounds
  projectiles.forEach(p => {
    if (p.position.x < -40 || p.position.x > viewWidth + 40 || p.position.y < -40 || p.position.y > viewHeight + 40) {
      p.markedForDeletion = true;
    }
  });

  // 2. Projectile hitting Enemy or Boss
  const activeSession = sessionId;
  projectiles.forEach(p => {
    enemies.forEach(e => {
      if (!p.markedForDeletion && !e.markedForDeletion) {
        if (e instanceof AtomicBoss) {
          let hitElectron = false;
          for (let i = 0; i < e.electrons.length; i++) {
            const el = e.electrons[i];
            const ex = e.position.x + Math.cos(el.angle) * el.distance;
            const ey = e.position.y + Math.sin(el.angle) * el.distance;
            const dist = p.position.sub(new Vector2(ex, ey)).mag();

            if (dist < 20) {
              el.bindingEnergy--;
              p.markedForDeletion = true;
              hitElectron = true;

              if (el.bindingEnergy <= 0) {
                e.electrons.splice(i, 1);
                audioEngine.playImpactSound(1, 2, false);
                spawnParticles(ex, ey, '#00ffff', 15);
                addToTerminal(`[CHEM] Photoelectric Emission: Electron ejected from Shell ${el.shell}!`, 'aes');
              } else {
                audioEngine.playImpactSound(0.5, 3, false);
                spawnParticles(ex, ey, '#ffff00', 3);
                addToTerminal(`[PHYS] Photon absorbed by electron. Binding Energy: ${el.bindingEnergy}/${el.maxBindingEnergy}`, 'raw');
              }
              break;
            }
          }

          if (!hitElectron) {
            const distToNucleus = p.position.sub(e.position).mag();
            if (distToNucleus < 50) {
              p.velocity = p.velocity.mult(-1.5).add(new Vector2(Math.random() * 200 - 100, Math.random() * 200 - 100));
              addToTerminal('[PHYS] Rutherford Scattering: Vector deflected by massive nucleus', 'raw');
            }
          }

          if (e.electrons.length === 0) {
            e.markedForDeletion = true;
            isBossActive = false;
            bossesDefeated++;
            if (!isInfiniteMode) score += 10 * e.atomicNumber;
            totalBlocksMined += e.atomicNumber;
            updateUI();
            audioEngine.playEMPSound();
            spawnParticles(e.position.x, e.position.y, e.color, 120);
            addToTerminal(`[PHYS] CATASTROPHIC FISSION: ${e.symbol} Nucleus Destabilized!`, 'mined');
          }
        } else if (e instanceof Enemy && p.checkCollision(e)) {
          const transformedVector = e.matrix.multiplyVector(p.velocity.normalize());
          const structuralIntegrity = Math.abs(e.matrix.getDeterminant());
          const force = transformedVector.mag() / (structuralIntegrity + 0.1);

          p.markedForDeletion = true;

          if (force > 1.5) {
            e.markedForDeletion = true;
            totalEigenvalueCollapses++;

            audioEngine.playImpactSound(force, e.matrix.getDeterminant(), true);

            if (!isInfiniteMode) score += e.value;
            updateUI();

            spawnParticles(e.position.x, e.position.y, e.color, 15);
            addToTerminal(`[MATH] Matrix factored. Eigenvalues collapsed (F=${force.toFixed(2)})`, 'sha');

            if (e.payload) {
              cryptoEngine.encryptDataAES(e.payload).then(({ ciphertext }) => {
                if (!isPlaying || activeSession !== sessionId) return null;
                addToTerminal(`[AES] ${ciphertext.substring(0, 32)}...`, 'aes');
                return cryptoEngine.hashSHA256(ciphertext);
              }).then(hash => {
                if (!hash || !isPlaying || activeSession !== sessionId) return;
                addToTerminal(`[SHA256] ${hash}`, 'sha');
                currentHashes++;
                hashPowerEl.textContent = `Hash Rate: ${(currentHashes * 850).toFixed(0)} H/s`;

                if (currentHashes >= HASHES_PER_BLOCK) {
                  mineBlock();
                }
              }).catch(() => {});
            }
          } else {
            audioEngine.playImpactSound(force, e.matrix.getDeterminant(), false);
            addToTerminal(`[MATH] Vector rejected by Adversarial Matrix (F=${force.toFixed(2)})`, 'raw');
            spawnParticles(p.position.x, p.position.y, '#fff', 3);
          }
        }
      }
    });
  });

  // 3. Enemy hitting Core
  for (const e of enemies) {
    if (!e.markedForDeletion && e.checkCollision(core)) {
      e.markedForDeletion = true;
      if (e instanceof AtomicBoss) isBossActive = false;
      if (!isInfiniteMode) health -= (e instanceof AtomicBoss) ? 50 : 20;
      updateUI();
      audioEngine.updateBGMFilter(health / MAX_HEALTH);
      spawnParticles(e.position.x, e.position.y, e.color, 25);

      if (health <= 0) {
        gameOver();
        return;
      }
    }
  }

  // 4. Enemy hitting Player
  for (const e of enemies) {
    if (!e.markedForDeletion && e.checkCollision(player)) {
      e.markedForDeletion = true;
      if (e instanceof AtomicBoss) isBossActive = false;
      if (!isInfiniteMode) health -= 10;
      updateUI();
      audioEngine.updateBGMFilter(health / MAX_HEALTH);
      spawnParticles(e.position.x, e.position.y, player.color, 10);
      if (health <= 0) {
        gameOver();
        return;
      }
    }
  }

  // Cleanup
  projectiles = projectiles.filter(p => !p.markedForDeletion);
  enemies = enemies.filter(e => {
    if (e.markedForDeletion) {
      destroyEnemyResources(e);
    }
    return !e.markedForDeletion;
  });
  particles = particles.filter(p => !p.markedForDeletion);
}

function mineBlock() {
  if (!isPlaying) return;
  currentHashes = 0;
  totalBlocksMined++;
  if (!isInfiniteMode) score += 1000;
  if (!isInfiniteMode) health = Math.min(MAX_HEALTH, health + 50);
  updateUI();
  audioEngine.updateBGMFilter(health / MAX_HEALTH);

  audioEngine.playEMPSound();
  hashPowerEl.textContent = 'Hash Rate: 0 H/s';
  addToTerminal('>>> BLOCK MINED <<< EMP DEPLOYED', 'mined');
  addToTerminal('[SYS] Quantum Heuristic Decoupler Synchronized...', 'raw');

  spawnParticles(core.position.x, core.position.y, '#9d00ff', 100);

  enemies.forEach(e => {
    e.markedForDeletion = true;
    if (e instanceof AtomicBoss) isBossActive = false;
    destroyEnemyResources(e);
    if (!isInfiniteMode) score += e.value * 2 || 0;
    spawnParticles(e.position.x, e.position.y, e.color, 15);
  });
  enemies = enemies.filter(e => !e.markedForDeletion);
  updateUI();
}

function draw() {
  if (!appInitialized) return;

  glowGfx.clear();
  mainGfx.clear();

  if (!core || !player) return;

  // Core
  glowGfx.circle(core.position.x, core.position.y, core.radius + 5);
  glowGfx.fill(core.color);

  mainGfx.circle(core.position.x, core.position.y, core.radius - 10);
  mainGfx.fill('#ffffff');

  // Player
  const pCos = Math.cos(player.angle);
  const pSin = Math.sin(player.angle);
  const rotate = (x: number, y: number) => ({
    x: player.position.x + x * pCos - y * pSin,
    y: player.position.y + x * pSin + y * pCos
  });
  const p1 = rotate(20, 0);
  const p2 = rotate(-10, 15);
  const p3 = rotate(-10, -15);

  glowGfx.poly([p1.x, p1.y, p2.x, p2.y, p3.x, p3.y]);
  glowGfx.fill(player.color);

  mainGfx.poly([p1.x, p1.y, p2.x, p2.y, p3.x, p3.y]);
  mainGfx.stroke({ color: '#ffffff', width: 2 });
  mainGfx.fill(player.color);

  // Projectiles
  projectiles.forEach(p => {
    glowGfx.circle(p.position.x, p.position.y, p.radius * 2);
    glowGfx.fill(p.color);
    mainGfx.circle(p.position.x, p.position.y, p.radius);
    mainGfx.fill('#ffffff');
  });

  // Enemy Trails
  enemies.forEach(e => {
    if (e instanceof Enemy && e.history.length > 1) {
      glowGfx.moveTo(e.history[0].x, e.history[0].y);
      for (let i = 1; i < e.history.length; i++) {
        glowGfx.lineTo(e.history[i].x, e.history[i].y);
      }
      glowGfx.stroke({ color: e.color, width: 2, alpha: 0.5 });

      mainGfx.moveTo(e.history[0].x, e.history[0].y);
      for (let i = 1; i < e.history.length; i++) {
        mainGfx.lineTo(e.history[i].x, e.history[i].y);
      }
      mainGfx.stroke({ color: '#ffffff', width: 1, alpha: 0.5 });
    }
  });

  // Enemy & Boss Bodies
  enemies.forEach(e => {
    if (e instanceof AtomicBoss) {
      if (e.pixiText) {
        e.pixiText.x = e.position.x;
        e.pixiText.y = e.position.y;
      }

      glowGfx.circle(e.position.x, e.position.y, 40);
      glowGfx.fill(e.color);
      mainGfx.circle(e.position.x, e.position.y, 35);
      mainGfx.fill('#220022');

      e.electrons.forEach(el => {
        const ex = e.position.x + Math.cos(el.angle) * el.distance;
        const ey = e.position.y + Math.sin(el.angle) * el.distance;

        const ratio = el.maxBindingEnergy > 0 ? el.bindingEnergy / el.maxBindingEnergy : 0;
        const hue = 180 * Math.max(0, Math.min(1, ratio));
        const eColor = `hsl(${hue}, 100%, 50%)`;

        glowGfx.circle(ex, ey, 8);
        glowGfx.fill(eColor);
        mainGfx.circle(ex, ey, 5);
        mainGfx.fill('#ffffff');
      });
    } else {
      glowGfx.circle(e.position.x, e.position.y, e.radius);
      glowGfx.fill(e.color);
      mainGfx.circle(e.position.x, e.position.y, Math.max(1, e.radius - 2));
      mainGfx.fill(e.color);
    }
  });

  // Particles
  particles.forEach(p => {
    const safeAlpha = Math.max(0, Math.min(1, p.alpha));
    glowGfx.circle(p.position.x, p.position.y, p.radius * 1.5);
    glowGfx.fill({ color: p.color, alpha: safeAlpha });
    mainGfx.circle(p.position.x, p.position.y, p.radius);
    mainGfx.fill({ color: '#ffffff', alpha: safeAlpha });
  });
}

async function startGame() {
  if (isStarting) return;
  isStarting = true;
  isPlaying = false;
  sessionId++;
  cancelAnimationFrame(animationId);
  networkFeed.disconnect();

  try {
    mainMenu.classList.remove('active');
    gameOverMenu.classList.remove('active');
    if (neonRankAlert) neonRankAlert.textContent = '';
    neonChallenge = null;
    requestNeonChallenge();

    isInfiniteMode = infiniteModeCheckbox.checked;
    score = 0;
    health = MAX_HEALTH;
    currentHashes = 0;
    totalBlocksMined = 0;
    totalEigenvalueCollapses = 0;
    totalDataPackets = 0;
    bossesDefeated = 0;
    recentPayloadSizes = [];
    isBossActive = false;
    hashPowerEl.textContent = 'Hash Rate: 0 H/s';
    sessionLogs = [`[${new Date().toISOString()}] === NEON ORBIT SESSION STARTED ===`];

    enemies.forEach(destroyEnemyResources);
    textContainer.removeChildren();
    enemies = [];
    projectiles = [];
    particles = [];
    terminal.replaceChildren();

    core = new Core(viewWidth / 2, viewHeight / 2);
    player = new Player(core.position.x + ORBIT_RADIUS, core.position.y);
    playerOrbitAngle = 0;
    updateUI();

    addToTerminal('INITIALIZING CRYPTO & AUDIO ENGINE...', 'raw');
    await cryptoEngine.init();
    await audioEngine.init();
    audioEngine.updateBGMFilter(1.0);
    addToTerminal('CRYPTOGRAPHIC ENGINE READY.', 'sha');

    networkFeed.connect();
    addToTerminal('CONNECTING TO DATA STREAM...', 'raw');

    isPlaying = true;
    lastTime = performance.now();
    animationId = requestAnimationFrame(gameLoop);
  } finally {
    isStarting = false;
  }
}

function gameOver() {
  if (!isPlaying) return;
  isPlaying = false;
  sessionId++;
  networkFeed.disconnect();
  cancelAnimationFrame(animationId);

  enemies.forEach(destroyEnemyResources);
  finalScoreEl.textContent = score.toString();
  gameOverMenu.classList.add('active');
  submitNeonScore(score);

  spawnParticles(core.position.x, core.position.y, core.color, 80);
  draw();
}

function downloadLogs() {
  if (sessionLogs.length === 0) return;
  const blob = new Blob([sessionLogs.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `neon_orbit_logs_${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function updateUI() {
  scoreEl.textContent = score.toString();
  healthBar.style.width = `${Math.max(0, Math.min(100, (health / MAX_HEALTH) * 100))}%`;

  statBlocks.textContent = totalBlocksMined.toString();
  statKills.textContent = totalEigenvalueCollapses.toString();
  statPackets.textContent = totalDataPackets.toString();

  if (enemies.length > 0 && core) {
    const avgDist = enemies.reduce((sum, e) => sum + e.position.sub(core.position).mag(), 0) / enemies.length;
    const loss = (avgDist * avgDist) / 1000;
    statLoss.textContent = Number.isFinite(loss) ? loss.toFixed(4) : '0.0000';
  } else {
    statLoss.textContent = '0.0000';
  }
}

// Event Listeners
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
if (downloadLogsBtn) downloadLogsBtn.addEventListener('click', downloadLogs);

// --- Global Leaderboard Integration ---
interface GameChallenge {
  gameId: string;
  startedAt: number;
  nonce: string;
  sig: string;
}

interface LeaderboardEntry {
  rank?: number;
  username?: string;
  score?: number;
  isVerified?: boolean;
}

let neonChallenge: GameChallenge | null = null;
const neonLbModal = document.getElementById('neon-leaderboard-modal');
const neonLbContent = document.getElementById('neon-lb-content');
const neonCloseLb = document.getElementById('neon-close-lb');
const neonOpenLbMain = document.getElementById('neon-open-lb-main');
const neonOpenLbOver = document.getElementById('neon-open-lb-over');
const neonRankAlert = document.getElementById('neon-rank-alert');

async function requestNeonChallenge() {
  try {
    const res = await fetch('/api/leaderboard/start', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId: 'neon-orbit' })
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.success && data.challenge) {
      neonChallenge = data.challenge;
    }
  } catch {
    // Offline or unauthenticated session
  }
}

async function submitNeonScore(finalScore: number) {
  if (!Number.isFinite(finalScore) || finalScore <= 0) return;
  const activeChallenge = neonChallenge;
  neonChallenge = null;

  try {
    const res = await fetch('/api/leaderboard/submit', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameId: 'neon-orbit',
        score: Math.min(5000000, Math.floor(finalScore)),
        username: 'Guest_Pilot',
        challenge: activeChallenge,
        details: { blocks: totalBlocksMined, kills: totalEigenvalueCollapses }
      })
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data && data.success && neonRankAlert) {
      neonRankAlert.textContent = `🚀 Score saved to Global Leaderboard! Rank #${data.rank || 1}`;
    } else if (neonRankAlert && data?.reason) {
      neonRankAlert.textContent = `Leaderboard: ${String(data.reason)}`;
    }
  } catch {
    // Network error ignored gracefully
  }
}

function setLbStatusMessage(container: HTMLElement, message: string, color = '#94a3b8') {
  container.replaceChildren();
  const p = document.createElement('p');
  p.style.textAlign = 'center';
  p.style.padding = '20px';
  p.style.color = color;
  p.textContent = message;
  container.appendChild(p);
}

async function openNeonLeaderboard() {
  if (!neonLbModal || !neonLbContent) return;
  neonLbModal.style.display = 'flex';
  setLbStatusMessage(neonLbContent, 'Loading standings...');

  try {
    const res = await fetch('/api/leaderboard/neon-orbit?limit=25', {
      credentials: 'same-origin'
    });
    if (!res.ok) {
      setLbStatusMessage(neonLbContent, 'Failed to load leaderboard.', '#ef4444');
      return;
    }
    const data = await res.json();
    if (!data || !data.success || !Array.isArray(data.leaderboard) || data.leaderboard.length === 0) {
      setLbStatusMessage(neonLbContent, 'No scores recorded yet!');
      return;
    }

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.textAlign = 'left';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.style.color = '#a5f3fc';
    headerRow.style.borderBottom = '1px solid rgba(0,243,255,0.3)';
    headerRow.style.fontSize = '0.75rem';

    const headers = [
      { label: 'RANK', align: 'left' },
      { label: 'PILOT', align: 'left' },
      { label: 'SCORE', align: 'right' }
    ];
    for (const h of headers) {
      const th = document.createElement('th');
      th.style.padding = '6px 4px';
      th.style.textAlign = h.align;
      th.textContent = h.label;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    data.leaderboard.forEach((entry: LeaderboardEntry, idx: number) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(255,255,255,0.06)';

      const tdRank = document.createElement('td');
      tdRank.style.padding = '8px 4px';
      tdRank.style.fontWeight = 'bold';
      tdRank.style.color = 'var(--neon-pink)';
      const safeRank = typeof entry.rank === 'number' && Number.isFinite(entry.rank) ? entry.rank : idx + 1;
      tdRank.textContent = `#${safeRank}`;

      const tdPilot = document.createElement('td');
      tdPilot.style.padding = '8px 4px';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = String(entry.username || 'Anonymous').slice(0, 24);
      tdPilot.appendChild(nameSpan);
      if (entry.isVerified) {
        const badge = document.createElement('span');
        badge.style.color = '#22c55e';
        badge.style.marginLeft = '4px';
        badge.textContent = '✓';
        tdPilot.appendChild(badge);
      }

      const tdScore = document.createElement('td');
      tdScore.style.padding = '8px 4px';
      tdScore.style.textAlign = 'right';
      tdScore.style.fontWeight = 'bold';
      tdScore.style.color = 'var(--neon-blue)';
      const numericScore = Number(entry.score);
      tdScore.textContent = Number.isFinite(numericScore) ? numericScore.toLocaleString() : '0';

      tr.appendChild(tdRank);
      tr.appendChild(tdPilot);
      tr.appendChild(tdScore);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    neonLbContent.replaceChildren(table);
  } catch {
    setLbStatusMessage(neonLbContent, 'Failed to load leaderboard.', '#ef4444');
  }
}

if (neonOpenLbMain) neonOpenLbMain.addEventListener('click', openNeonLeaderboard);
if (neonOpenLbOver) neonOpenLbOver.addEventListener('click', openNeonLeaderboard);
if (neonCloseLb && neonLbModal) {
  neonCloseLb.addEventListener('click', () => {
    neonLbModal.style.display = 'none';
  });
}

// Start initial draw to clear screen
core = new Core(viewWidth / 2, viewHeight / 2);
player = new Player(core.position.x + ORBIT_RADIUS, core.position.y);
draw();
