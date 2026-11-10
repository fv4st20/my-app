import './style.css'
import { Vector2 } from './math';
import { Core, Player, Enemy, Projectile, AtomicBoss, PERIODIC_TABLE } from './entities';
import { Particle, createExplosion } from './particles';
import { cryptoEngine } from './crypto';
import { networkFeed } from './network';
import { audioEngine } from './audio';
import { Application, Graphics, BlurFilter, Text, TextStyle, Container } from 'pixi.js';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;

const app = new Application();
const glowGfx = new Graphics();
const mainGfx = new Graphics();
const textContainer = new Container();
let appInitialized = false;

app.init({
  canvas: canvas,
  resizeTo: window,
  background: '#050510',
  antialias: true
}).then(() => {
  glowGfx.filters = [new BlurFilter({ strength: 12 })];
  app.stage.addChild(glowGfx);
  app.stage.addChild(mainGfx);
  app.stage.addChild(textContainer);
  appInitialized = true;
});

// UI Elements
const mainMenu = document.getElementById('main-menu')!;
const gameOverMenu = document.getElementById('game-over-menu')!;
const startBtn = document.getElementById('start-btn')!;
const restartBtn = document.getElementById('restart-btn')!;
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

let animationId: number;
let isPlaying = false;
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

// Resize handling
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (core) {
    core.position = new Vector2(canvas.width / 2, canvas.height / 2);
  }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let isAutoFire = false;
let isManualAiming = false;

// Input Listeners (Mouse & Keyboard)
window.addEventListener('mousemove', (e) => {
  isManualAiming = true;
  mousePos.x = e.clientX;
  mousePos.y = e.clientY;
});

window.addEventListener('mousedown', (e) => {
  // Prevent shooting if clicking UI controls or menus
  const target = e.target as HTMLElement;
  if (target && target.closest('#ui-layer')) return;
  isManualAiming = true;
  mousePos.x = e.clientX;
  mousePos.y = e.clientY;
  isShooting = true;
});

window.addEventListener('mouseup', () => {
  if (!isAutoFire) isShooting = false;
});

window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

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
    btnAutoFire.innerText = isAutoFire ? 'AUTO: ON ⚡' : 'AUTO';
  });
}


function addToTerminal(msg: string, type: string) {
  const line = document.createElement('div');
  line.className = `term-line ${type}`;
  line.innerText = msg;
  terminal.appendChild(line);
  
  // Also save to session logs for download
  sessionLogs.push(`[${new Date().toISOString()}] ${msg}`);
  
  // Keep terminal from getting too huge in DOM
  if (terminal.childNodes.length > 50) {
    terminal.removeChild(terminal.firstChild!);
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

networkFeed.onNewData = (payload, dataSize) => {
  if (isPlaying) {
    // Entropy Tracking
    recentPayloadSizes.push(dataSize);
    if (recentPayloadSizes.length > 20) recentPayloadSizes.shift();
    
    // Calculate variance/std dev
    let variance = 0;
    if (recentPayloadSizes.length === 20) {
      const mean = recentPayloadSizes.reduce((a, b) => a + b, 0) / 20;
      variance = recentPayloadSizes.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / 20;
    }
    
    // Spawn Boss if prime block, high entropy, and no boss active
    if (!isBossActive && totalBlocksMined > 0 && isPrime(totalBlocksMined) && variance > 100000) {
      spawnAtomicBoss();
    } else if (!isBossActive) {
      spawnEnemyWithPayload(payload, dataSize);
    }
  }
};

function spawnAtomicBoss() {
  const edge = Math.floor(Math.random() * 4);
  let x = 0, y = 0;
  if (edge === 0) { x = canvas.width / 2; y = -100; }
  else if (edge === 1) { x = canvas.width + 100; y = canvas.height / 2; }
  else if (edge === 2) { x = canvas.width / 2; y = canvas.height + 100; }
  else { x = -100; y = canvas.height / 2; }
  
  // Pick random element
  const element = PERIODIC_TABLE[Math.floor(Math.random() * PERIODIC_TABLE.length)];
  
  // Clear all existing normal enemies to focus on the boss
  enemies.forEach(e => {
    e.markedForDeletion = true;
    particles.push(...createExplosion(e.position.x, e.position.y, e.color, 15));
  });
  // Force filter them out immediately
  enemies = enemies.filter(e => !e.markedForDeletion);
  
  const boss = new AtomicBoss(x, y, core.position, element.z, element.symbol);
  
  const text = new Text({ text: element.symbol, style: new TextStyle({ fill: '#ffffff', fontSize: 32, fontWeight: 'bold' }) });
  text.anchor.set(0.5);
  textContainer.addChild(text);
  boss.pixiText = text;
  
  enemies.push(boss);
  isBossActive = true;
  addToTerminal(`[WARN] CRITICAL ENTROPY SPIKE DETECTED.`, 'mined');
  addToTerminal(`[SYS] SPONTANEOUS MATERIALIZATION: ${element.symbol} ISOTOPE`, 'mined');
  
  audioEngine.playEMPSound(); // Ominous spawn sound
}

function spawnEnemyWithPayload(payload: string, dataSize: number) {
  // Spawn from edges
  const edge = Math.floor(Math.random() * 4);
  let x = 0, y = 0;
  
  if (edge === 0) { x = Math.random() * canvas.width; y = -50; }
  else if (edge === 1) { x = canvas.width + 50; y = Math.random() * canvas.height; }
  else if (edge === 2) { x = Math.random() * canvas.width; y = canvas.height + 50; }
  else { x = -50; y = Math.random() * canvas.height; }
  
  // Radius based on data size (min 10, max 60)
  const radius = Math.min(60, Math.max(10, dataSize / 20));
  
  const color = `hsl(${Math.random() * 60 + 300}, 100%, 50%)`; // Pink to Red
  // Speed increases smoothly ONLY when a Boss is defeated
  const speed = Math.random() * 50 + 30 + (bossesDefeated * 15); 
  
  enemies.push(new Enemy(x, y, core.position, speed, radius, color, payload, dataSize));
  addToTerminal(`[RCV] ${payload.substring(0, 40)}... [${dataSize} bytes]`, 'raw');
  totalDataPackets++;
}

// Game Loop
let lastTime = 0;
function gameLoop(time: number) {
  if (!isPlaying) return;
  
  const deltaTime = (time - lastTime) / 1000;
  lastTime = time;
  
  update(deltaTime, time);
  draw();
  
  animationId = requestAnimationFrame(gameLoop);
}

function update(dt: number, time: number) {
  // Player movement (Orbit)
  if (keys['a'] || keys['arrowleft']) {
    playerOrbitAngle -= ORBIT_SPEED * dt;
  }
  if (keys['d'] || keys['arrowright']) {
    playerOrbitAngle += ORBIT_SPEED * dt;
  }
  
  player.position.x = core.position.x + Math.cos(playerOrbitAngle) * ORBIT_RADIUS;
  player.position.y = core.position.y + Math.sin(playerOrbitAngle) * ORBIT_RADIUS;
  
  // Player aiming logic (Manual touch/mouse drag OR smart auto-targeting)
  if (isManualAiming) {
    player.updateAngle(mousePos.x, mousePos.y);
  } else {
    // Intelligent auto-lock onto nearest threat for mobile thumb play
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
      // Default aim: outwards from core through player
      const outward = player.position.sub(core.position).normalize();
      mousePos = player.position.add(outward.mult(200));
    }
    player.updateAngle(mousePos.x, mousePos.y);
  }
  
  if (isInfiniteMode && time - lastLotteryTime > 1000) {
    lastLotteryTime = time;
    // 1 in 300 million chance of dying per second
    if (Math.random() < (1 / 300000000)) {
      addToTerminal(`[FATAL] A COSMIC RAY FLIPPED A CRITICAL BIT. THE LOTTERY OF DEATH WAS WON.`, 'error');
      health = 0;
      updateUI();
      gameOver();
    }
  }
  
  // Shooting
  if ((isShooting || isAutoFire) && time - lastShootTime > SHOOT_DELAY) {
    const dir = mousePos.sub(player.position).normalize();
    const projVel = dir.mult(600); // Projectile speed
    projectiles.push(new Projectile(player.position.x, player.position.y, projVel));
    audioEngine.playShootSound(dir); // Math-based audio
    lastShootTime = time;
  }
  
  // Update entities
  core.update(dt);
  player.update(dt);
  
  projectiles.forEach(p => p.update(dt));
  enemies.forEach(e => e.update(dt, projectiles));
  particles.forEach(p => p.update(dt));
  
  // Collisions and cleanup
  
  // 1. Projectiles out of bounds
  projectiles.forEach(p => {
    if (p.position.x < 0 || p.position.x > canvas.width || p.position.y < 0 || p.position.y > canvas.height) {
      p.markedForDeletion = true;
    }
  });
  
  // 2. Projectile hitting Enemy or Boss
  projectiles.forEach(p => {
    enemies.forEach(e => {
      if (!p.markedForDeletion && !e.markedForDeletion) {
        
        if (e instanceof AtomicBoss) {
          // Rutherford scattering vs Photoelectric effect
          let hitElectron = false;
          for (let i = 0; i < e.electrons.length; i++) {
            const el = e.electrons[i];
            const ex = e.position.x + Math.cos(el.angle) * el.distance;
            const ey = e.position.y + Math.sin(el.angle) * el.distance;
            const dist = p.position.sub(new Vector2(ex, ey)).mag();
            
            if (dist < 20) { // Electron hit radius
               el.bindingEnergy--;
               p.markedForDeletion = true;
               hitElectron = true;
               
               if (el.bindingEnergy <= 0) {
                 e.electrons.splice(i, 1); // Strip electron
                 audioEngine.playImpactSound(1, 2, false); // "Zap" sound
                 particles.push(...createExplosion(ex, ey, '#00ffff', 15));
                 addToTerminal(`[CHEM] Photoelectric Emission: Electron ejected from Shell ${el.shell}!`, 'aes');
               } else {
                 audioEngine.playImpactSound(0.5, 3, false); // Absorb sound
                 particles.push(...createExplosion(ex, ey, '#ffff00', 3)); // Yellow sparks
                 addToTerminal(`[PHYS] Photon absorbed by electron. Binding Energy: ${el.bindingEnergy}/${el.maxBindingEnergy}`, 'raw');
               }
               break;
            }
          }

          if (!hitElectron) {
            // Check nucleus hit
            const distToNucleus = p.position.sub(e.position).mag();
            if (distToNucleus < 50) {
               // Rutherford Scattering (deflect)
               p.velocity = p.velocity.mult(-1.5).add(new Vector2(Math.random()*200 - 100, Math.random()*200 - 100));
               addToTerminal(`[PHYS] Rutherford Scattering: Vector deflected by massive nucleus`, 'raw');
            }
          }

          // Check if completely ionized
          if (e.electrons.length === 0) {
             e.markedForDeletion = true;
             isBossActive = false;
             bossesDefeated++;
             if (!isInfiniteMode) score += 10 * e.atomicNumber; // Base enemy value (10) * atomicNumber
             totalBlocksMined += e.atomicNumber; // Huge bonus
             updateUI();
             audioEngine.playEMPSound(); // massive explosion
             particles.push(...createExplosion(e.position.x, e.position.y, e.color, 200));
             addToTerminal(`[PHYS] CATASTROPHIC FISSION: ${e.symbol} Nucleus Destabilized!`, 'mined');
          }
        } 
        else if (e instanceof Enemy && p.checkCollision(e)) {
          
          // Linear Algebra Combat: Matrix-Vector Multiplication
        const transformedVector = e.matrix.multiplyVector(p.velocity.normalize());
        const structuralIntegrity = Math.abs(e.matrix.getDeterminant());
        const force = transformedVector.mag() / (structuralIntegrity + 0.1);

        p.markedForDeletion = true; // Bullet is always consumed

        if (force > 1.5) {
          e.markedForDeletion = true; // Enemy destroyed
          totalEigenvalueCollapses++;
          
          audioEngine.playImpactSound(force, e.matrix.getDeterminant(), true);

          // Add score
          if (!isInfiniteMode) score += e.value;
          updateUI();
          
          // Explosion
          particles.push(...createExplosion(e.position.x, e.position.y, e.color, 15));
          addToTerminal(`[MATH] Matrix factored. Eigenvalues collapsed (F=${force.toFixed(2)})`, 'sha');
          addToTerminal(`[WARN] Bypassing Neural-Firewall via SQL injection on the Blockchain...`, 'raw');

          // Cryptographic process
          if (e.payload) {
            cryptoEngine.encryptDataAES(e.payload).then(({ciphertext}) => {
               addToTerminal(`[AES] ${ciphertext.substring(0, 32)}...`, 'aes');
               return cryptoEngine.hashSHA256(ciphertext);
            }).then(hash => {
               addToTerminal(`[SHA256] ${hash}`, 'sha');
               currentHashes++;
               hashPowerEl.innerText = `Hash Rate: ${(currentHashes * 850).toFixed(0)} H/s`;
               
               if (currentHashes >= HASHES_PER_BLOCK) {
                  mineBlock();
               }
            });
          }
        } else {
          // Attack deflected by matrix
          audioEngine.playImpactSound(force, e.matrix.getDeterminant(), false);
          addToTerminal(`[MATH] Vector rejected by Adversarial Matrix (F=${force.toFixed(2)})`, 'raw');
          particles.push(...createExplosion(p.position.x, p.position.y, '#fff', 3));
        }
      }
      }
    });
  });
  
  // 3. Enemy hitting Core
  enemies.forEach(e => {
    if (!e.markedForDeletion && e.checkCollision(core)) {
      e.markedForDeletion = true;
      if (e instanceof AtomicBoss) isBossActive = false;
      if (!isInfiniteMode) health -= (e instanceof AtomicBoss) ? 50 : 20;
      updateUI();
      audioEngine.updateBGMFilter(health / MAX_HEALTH); // Responsive music
      particles.push(...createExplosion(e.position.x, e.position.y, e.color, 25));
      
      // Screen shake could go here
      
      if (health <= 0) {
        gameOver();
      }
    }
  });
  
  // 4. Enemy hitting Player
  enemies.forEach(e => {
     if (!e.markedForDeletion && e.checkCollision(player)) {
        e.markedForDeletion = true;
        if (!isInfiniteMode) health -= 10;
        updateUI();
        particles.push(...createExplosion(e.position.x, e.position.y, player.color, 10));
        if (health <= 0) gameOver();
     }
  });
  
  // Cleanup
  projectiles = projectiles.filter(p => !p.markedForDeletion);
  enemies = enemies.filter(e => {
    if (e.markedForDeletion && e instanceof AtomicBoss && e.pixiText) {
      e.pixiText.destroy();
    }
    return !e.markedForDeletion;
  });
  particles = particles.filter(p => !p.markedForDeletion);
}

function mineBlock() {
  currentHashes = 0;
  totalBlocksMined++;
  if (!isInfiniteMode) score += 1000;
  if (!isInfiniteMode) health = Math.min(MAX_HEALTH, health + 50); // Heal 
  updateUI();
  audioEngine.updateBGMFilter(health / MAX_HEALTH);
  
  // EMP Blast!
  audioEngine.playEMPSound();
  hashPowerEl.innerText = `Hash Rate: 0 H/s`;
  addToTerminal(`>>> BLOCK MINED <<< EMP DEPLOYED`, 'mined');
  addToTerminal(`[SYS] Quantum Heuristic Decoupler Initialized...`, 'raw');
  addToTerminal(`[SYS] Flushing TCP/IP handshake through Visual Basic GUI...`, 'raw');
  
  // EMP Blast
  particles.push(...createExplosion(core.position.x, core.position.y, '#9d00ff', 200));
  
  // Destroy all enemies on screen
  enemies.forEach(e => {
    e.markedForDeletion = true;
    if (e instanceof AtomicBoss) isBossActive = false;
    if (!isInfiniteMode) score += e.value * 2 || 0; // Bonus score
    particles.push(...createExplosion(e.position.x, e.position.y, e.color, 15));
  });
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

  // Enemy Infinite Trails
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
      
      // Draw Nucleus
      glowGfx.circle(e.position.x, e.position.y, 40);
      glowGfx.fill(e.color);
      mainGfx.circle(e.position.x, e.position.y, 35);
      mainGfx.fill('#220022');
      
      // Draw Electrons
      e.electrons.forEach(el => {
        const ex = e.position.x + Math.cos(el.angle) * el.distance;
        const ey = e.position.y + Math.sin(el.angle) * el.distance;
        
        // Calculate health ratio and shift color: Cyan (180) -> Red (0)
        const ratio = el.bindingEnergy / el.maxBindingEnergy;
        const hue = 180 * ratio;
        const eColor = `hsl(${hue}, 100%, 50%)`;
        
        glowGfx.circle(ex, ey, 8);
        glowGfx.fill(eColor);
        mainGfx.circle(ex, ey, 5);
        mainGfx.fill('#ffffff');
      });
    } else {
      glowGfx.circle(e.position.x, e.position.y, e.radius);
      glowGfx.fill(e.color);
      mainGfx.circle(e.position.x, e.position.y, e.radius - 2);
      mainGfx.fill(e.color);
    }
  });

  // Particles
  particles.forEach(p => {
    glowGfx.circle(p.position.x, p.position.y, p.radius * 1.5);
    glowGfx.fill({ color: p.color, alpha: p.alpha });
    mainGfx.circle(p.position.x, p.position.y, p.radius);
    mainGfx.fill({ color: '#ffffff', alpha: p.alpha });
  });
}

async function startGame() {
  mainMenu.classList.remove('active');
  gameOverMenu.classList.remove('active');
  if (neonRankAlert) neonRankAlert.innerText = '';
  requestNeonChallenge();
  
  // Reset state
  isInfiniteMode = infiniteModeCheckbox.checked;
  score = 0;
  health = MAX_HEALTH;
  currentHashes = 0;
  totalBlocksMined = 0;
  totalEigenvalueCollapses = 0;
  totalDataPackets = 0;
  bossesDefeated = 0;
  sessionLogs = [];
  sessionLogs.push(`[${new Date().toISOString()}] === NEON ORBIT SESSION STARTED ===`);
  
  enemies.forEach(e => {
    if (e instanceof AtomicBoss && e.pixiText) e.pixiText.destroy();
  });
  enemies = [];
  projectiles = [];
  particles = [];
  terminal.innerHTML = '';
  updateUI();
  
  addToTerminal('INITIALIZING CRYPTO & AUDIO ENGINE...', 'raw');
  await cryptoEngine.init();
  await audioEngine.init();
  audioEngine.updateBGMFilter(1.0); // Reset BGM filters
  addToTerminal('RSA/AES KEYS GENERATED.', 'sha');
  
  networkFeed.connect();
  addToTerminal('CONNECTING TO WIKIMEDIA STREAM...', 'raw');

  core = new Core(canvas.width / 2, canvas.height / 2);
  player = new Player(core.position.x + ORBIT_RADIUS, core.position.y);
  playerOrbitAngle = 0;
  
  projectiles = [];
  enemies = [];
  particles = [];
  
  isPlaying = true;
  lastTime = performance.now();
  gameLoop(performance.now());
}

function gameOver() {
  isPlaying = false;
  networkFeed.disconnect();
  cancelAnimationFrame(animationId);
  finalScoreEl.innerText = score.toString();
  gameOverMenu.classList.add('active');
  submitNeonScore(score);
  
  // Final big explosion
  particles.push(...createExplosion(core.position.x, core.position.y, core.color, 100));
  
  draw(); // Draw final explosion
  
  // Download session logs
  downloadLogs();
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
  scoreEl.innerText = score.toString();
  healthBar.style.width = `${Math.max(0, (health / MAX_HEALTH) * 100)}%`;
  
  statBlocks.innerText = totalBlocksMined.toString();
  statKills.innerText = totalEigenvalueCollapses.toString();
  statPackets.innerText = totalDataPackets.toString();
  
  if (enemies.length > 0) {
    const avgDist = enemies.reduce((sum, e) => sum + e.position.sub(core.position).mag(), 0) / enemies.length;
    // Calculated simplified adversarial loss metric based on spatial data
    const loss = (avgDist * avgDist) / 1000;
    statLoss.innerText = loss.toFixed(4);
  } else {
    statLoss.innerText = "0.0000";
  }
}

// Event Listeners
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// --- Global Leaderboard Integration ---
let neonChallenge: any = null;
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId: 'neon-orbit' })
    });
    const data = await res.json();
    if (data && data.success) {
      neonChallenge = data.challenge;
    }
  } catch (e) {}
}

async function submitNeonScore(finalScore: number) {
  if (finalScore <= 0) return;
  try {
    const res = await fetch('/api/leaderboard/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameId: 'neon-orbit',
        score: finalScore,
        challenge: neonChallenge,
        details: { blocks: totalBlocksMined, kills: totalEigenvalueCollapses }
      })
    });
    const data = await res.json();
    if (data && data.success && neonRankAlert) {
      neonRankAlert.innerText = `🚀 Score saved to Global Leaderboard! Rank #${data.rank || 1}`;
    }
  } catch (e) {}
}

async function openNeonLeaderboard() {
  if (!neonLbModal || !neonLbContent) return;
  neonLbModal.style.display = 'flex';
  neonLbContent.innerHTML = '<p style="text-align:center; padding:20px; color:#94a3b8;">Loading standings...</p>';

  try {
    const res = await fetch('/api/leaderboard/neon-orbit?limit=25');
    const data = await res.json();
    if (!data || !data.success || !Array.isArray(data.leaderboard) || data.leaderboard.length === 0) {
      neonLbContent.innerHTML = '<p style="text-align:center; padding:20px; color:#94a3b8;">No scores recorded yet!</p>';
      return;
    }

    let html = '<table style="width:100%; border-collapse:collapse; text-align:left;">';
    html += '<tr style="color:#a5f3fc; border-bottom:1px solid rgba(0,243,255,0.3); font-size:0.75rem;"><th>RANK</th><th>PILOT</th><th style="text-align:right;">SCORE</th></tr>';
    data.leaderboard.forEach((entry: any) => {
      html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.06); padding:6px 0;">
        <td style="padding:8px 4px; font-weight:bold; color:var(--neon-pink);">#${entry.rank}</td>
        <td style="padding:8px 4px;">${entry.username} ${entry.isVerified ? '<span style="color:#22c55e;">✓</span>' : ''}</td>
        <td style="padding:8px 4px; text-align:right; font-weight:bold; color:var(--neon-blue);">${entry.score.toLocaleString()}</td>
      </tr>`;
    });
    html += '</table>';
    neonLbContent.innerHTML = html;
  } catch (e) {
    neonLbContent.innerHTML = '<p style="text-align:center; color:#ef4444;">Failed to load leaderboard.</p>';
  }
}

if (neonOpenLbMain) neonOpenLbMain.addEventListener('click', openNeonLeaderboard);
if (neonOpenLbOver) neonOpenLbOver.addEventListener('click', openNeonLeaderboard);
if (neonCloseLb && neonLbModal) neonCloseLb.addEventListener('click', () => { neonLbModal.style.display = 'none'; });

// Start initial draw to clear screen
core = new Core(canvas.width / 2, canvas.height / 2);
player = new Player(core.position.x + ORBIT_RADIUS, core.position.y);
draw();
