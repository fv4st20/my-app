/**
 * Sonic Soccer Cybernetic Game & Physics Engine
 */

function isReducedMotionPreferred() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export class Particle {
  constructor(x, y, color, type = 'spark', speed = 6) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const vel = (Math.random() * 0.7 + 0.3) * speed;
    this.vx = Math.cos(angle) * vel;
    this.vy = Math.sin(angle) * vel;
    this.life = 1.0;
    this.maxLife = Math.random() * 0.4 + 0.6;
    this.decay = Math.random() * 0.035 + 0.02;
    this.color = color;
    this.size = Math.random() * 4 + 2;
    this.type = type;
    this.radius = 2;
  }

  update(dtScale = 1) {
    this.x += this.vx * dtScale;
    this.y += this.vy * dtScale;
    const damp = Math.pow(0.94, dtScale);
    this.vx *= damp;
    this.vy *= damp;
    this.life -= this.decay * dtScale;
    if (this.type === 'ring') {
      this.radius += 5.5 * dtScale;
    }
  }

  draw(ctx) {
    if (this.life <= 0) return;
    const alpha = Math.max(0, Math.min(1, this.life / this.maxLife));
    ctx.save();
    ctx.globalAlpha = alpha;

    if (this.type === 'ring') {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = Math.max(0.5, 2.5 * alpha);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = this.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, Math.max(0.5, this.size * alpha), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export class LaserNet {
  constructor(x, y, width, height, side) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.side = side;
    this.tension = 0;
    this.cols = 5;
    this.rows = 8;
  }

  setGeometry(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  impact(intensity = 1.0) {
    this.tension = Math.min(30, this.tension + 25 * intensity);
  }

  update(dtScale = 1) {
    this.tension *= Math.pow(0.88, dtScale);
    if (this.tension < 0.2) this.tension = 0;
  }

  draw(ctx, beatPulse, teamColor) {
    ctx.save();
    const cellW = this.width / this.cols;
    const cellH = this.height / this.rows;

    ctx.strokeStyle = teamColor;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 10 + beatPulse * 8;
    ctx.shadowColor = teamColor;

    for (let r = 0; r <= this.rows; r++) {
      const cy = this.y + r * cellH;
      const bulge = Math.sin((r / this.rows) * Math.PI) * this.tension * (this.side === 'left' ? -1 : 1);
      ctx.beginPath();
      ctx.moveTo(this.x, cy);
      ctx.quadraticCurveTo(this.x + this.width / 2 + bulge, cy, this.x + this.width, cy);
      ctx.stroke();
    }

    for (let c = 0; c <= this.cols; c++) {
      const cx = this.x + c * cellW;
      ctx.beginPath();
      ctx.moveTo(cx, this.y);
      ctx.lineTo(cx, this.y + this.height);
      ctx.stroke();
    }

    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(this.x, this.y, this.width, this.height);
    ctx.restore();
  }
}

export class Ball {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.baseRadius = 13;
    this.radius = 13;
    this.friction = 0.988;
    this.trail = [];
    this.isSonic = false;
    this.sonicTimer = 0;
    this.lastKickerTeam = 'blue';
  }

  kick(vx, vy, isSonic = false, team = 'blue') {
    this.vx = vx;
    this.vy = vy;
    this.lastKickerTeam = team;
    if (isSonic) {
      this.isSonic = true;
      this.sonicTimer = 55;
    }
  }

  update(width, height, energyLevel, dtScale, onBounce) {
    this.trail.unshift({
      x: this.x,
      y: this.y,
      isSonic: this.isSonic,
      team: this.lastKickerTeam
    });
    if (this.trail.length > 24) this.trail.pop();

    if (this.sonicTimer > 0) {
      this.sonicTimer -= dtScale;
      if (this.sonicTimer <= 0) this.isSonic = false;
    }

    const effectiveEnergy = Math.max(0.6, Math.min(2.2, energyLevel));
    this.x += this.vx * effectiveEnergy * dtScale;
    this.y += this.vy * effectiveEnergy * dtScale;
    const damp = Math.pow(this.friction, dtScale);
    this.vx *= damp;
    this.vy *= damp;

    const margin = 50;
    if (this.y < margin + this.radius) {
      this.y = margin + this.radius;
      this.vy = Math.abs(this.vy) * 0.9;
      if (onBounce) onBounce(this.x, this.y);
    }
    if (this.y > height - margin - this.radius) {
      this.y = height - margin - this.radius;
      this.vy = -Math.abs(this.vy) * 0.9;
      if (onBounce) onBounce(this.x, this.y);
    }

    const goalTop = height / 2 - 110;
    const goalBottom = height / 2 + 110;

    if (this.x < margin) {
      if (this.y > goalTop && this.y < goalBottom) {
        return 'red';
      }
      this.x = margin;
      this.vx = Math.abs(this.vx) * 0.92;
      if (onBounce) onBounce(this.x, this.y);
    }

    if (this.x > width - margin) {
      if (this.y > goalTop && this.y < goalBottom) {
        return 'blue';
      }
      this.x = width - margin;
      this.vx = -Math.abs(this.vx) * 0.92;
      if (onBounce) onBounce(this.x, this.y);
    }

    return null;
  }

  draw(ctx, beatPulse, reducedMotion = false) {
    ctx.save();
    const pulseBoost = reducedMotion ? 0 : beatPulse * 5;
    const currentRadius = this.baseRadius + pulseBoost + (this.isSonic ? 4 : 0);

    if (!reducedMotion && this.trail.length > 1) {
      for (let i = this.trail.length - 1; i >= 1; i--) {
        const pt = this.trail[i];
        const nextPt = this.trail[i - 1];
        const progress = 1 - i / this.trail.length;
        const trailColor = pt.isSonic
          ? `rgba(255, 230, 0, ${progress * 0.75})`
          : pt.team === 'blue'
          ? `rgba(0, 240, 255, ${progress * 0.65})`
          : `rgba(255, 0, 85, ${progress * 0.65})`;

        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(nextPt.x, nextPt.y);
        ctx.strokeStyle = trailColor;
        ctx.lineWidth = Math.max(1, currentRadius * 2.0 * progress);
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }

    if (this.isSonic && !reducedMotion) {
      ctx.shadowBlur = 24;
      ctx.shadowColor = '#ffe600';
      ctx.fillStyle = 'rgba(255, 230, 0, 0.3)';
      ctx.beginPath();
      ctx.arc(this.x, this.y, currentRadius * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    const coreGlow = this.isSonic
      ? '#ffe600'
      : this.lastKickerTeam === 'blue'
      ? '#00f0ff'
      : '#ff0055';

    ctx.shadowBlur = reducedMotion ? 8 : 16 + beatPulse * 12;
    ctx.shadowColor = coreGlow;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = coreGlow;
    ctx.beginPath();
    ctx.arc(this.x, this.y, currentRadius * 0.6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}

export class Player {
  constructor(x, y, team, role = 'midfielder', number = 1) {
    this.x = x;
    this.y = y;
    this.team = team;
    this.role = role;
    this.number = number;
    this.radius = 17;
    this.vx = 0;
    this.vy = 0;
    this.baseSpeed = role === 'striker' ? 3.4 : role === 'goalkeeper' ? 2.6 : 3.0;
    this.homeX = x;
    this.homeY = y;
    this.angle = team === 'blue' ? 0 : Math.PI;
    this.color = team === 'blue' ? '#00f0ff' : '#ff0055';
    this.kickCooldown = 0;
    this.thrustPower = 0;
  }

  update(ball, width, height, energyLevel, aggression, kickPulse, beatPulse, dtScale, pushParticle, onKick) {
    if (this.kickCooldown > 0) this.kickCooldown -= dtScale;

    const dxBall = ball.x - this.x;
    const dyBall = ball.y - this.y;
    const distBall = Math.hypot(dxBall, dyBall);

    let targetX = this.homeX;
    let targetY = this.homeY;

    const goalHalf = 105;
    if (this.role === 'goalkeeper') {
      targetX = this.team === 'blue' ? 95 : Math.max(95, width - 95);
      targetY = Math.max(height / 2 - goalHalf, Math.min(height / 2 + goalHalf, ball.y));
    } else if (this.role === 'striker') {
      targetX = ball.x + (this.team === 'blue' ? -25 : 25);
      targetY = ball.y;
    } else {
      const chaseRadius = 260 + aggression * 220;
      if (distBall < chaseRadius) {
        targetX = ball.x;
        targetY = ball.y;
      } else {
        const shift = beatPulse > 0.4 ? Math.sin(this.number * 2) * 35 : 0;
        targetX = this.homeX + shift;
        targetY = this.homeY + (beatPulse > 0.4 ? Math.cos(this.number * 2) * 28 : 0);
      }
    }

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 4) {
      const snapSteer = Math.min(1, (beatPulse > 0.5 ? 0.35 : 0.16) * dtScale);
      const speed = this.baseSpeed * (0.85 + Math.min(1.5, energyLevel) * 0.4);
      this.vx += ((dx / dist) * speed - this.vx) * snapSteer;
      this.vy += ((dy / dist) * speed - this.vy) * snapSteer;
      this.thrustPower = Math.min(1.0, this.thrustPower + 0.15 * dtScale);
      this.angle = Math.atan2(this.vy, this.vx);
    } else {
      const damp = Math.pow(0.85, dtScale);
      this.vx *= damp;
      this.vy *= damp;
      this.thrustPower *= Math.pow(0.8, dtScale);
    }

    this.x = Math.max(55, Math.min(width - 55, this.x + this.vx * dtScale));
    this.y = Math.max(55, Math.min(height - 55, this.y + this.vy * dtScale));

    if (distBall < this.radius + ball.radius && this.kickCooldown <= 0) {
      this.kickCooldown = 18;

      const isSonic = kickPulse > 0.55 || beatPulse > 0.65;
      const basePower = 9 + Math.min(1.5, energyLevel) * 5 + Math.min(1.5, aggression) * 10;
      const kickPower = isSonic ? basePower * 1.55 : basePower;

      const targetGoalX = this.team === 'blue' ? width : 0;
      const targetGoalY = height / 2 + (Math.random() - 0.5) * 180;

      const kx = targetGoalX - this.x;
      const ky = (targetGoalY - this.y) * 0.65;
      const kDist = Math.max(1, Math.hypot(kx, ky));

      ball.kick((kx / kDist) * kickPower, (ky / kDist) * kickPower, isSonic, this.team);

      const sparkCount = isSonic ? 24 : 12;
      for (let i = 0; i < sparkCount; i++) {
        pushParticle(new Particle(ball.x, ball.y, isSonic ? '#ffe600' : this.color, 'spark', isSonic ? 11 : 7));
      }
      if (isSonic) {
        pushParticle(new Particle(ball.x, ball.y, '#ffe600', 'ring'));
      }

      if (onKick) {
        onKick(isSonic, this.team, this.x, this.y);
      }
    }
  }

  draw(ctx, beatPulse, kickPulse, reducedMotion = false) {
    ctx.save();
    ctx.translate(this.x, this.y);

    const pulseSize = this.radius + (reducedMotion ? 0 : beatPulse * 3);

    if (!reducedMotion && this.thrustPower > 0.1) {
      const exhaustLen = Math.max(2, 14 * this.thrustPower + kickPulse * 10);
      const exAngle = this.angle + Math.PI;
      ctx.save();
      ctx.rotate(exAngle);

      ctx.beginPath();
      ctx.moveTo(-pulseSize * 0.4, 0);
      ctx.lineTo(exhaustLen, -pulseSize * 0.35);
      ctx.lineTo(exhaustLen * 1.5, 0);
      ctx.lineTo(exhaustLen, pulseSize * 0.35);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, 0, exhaustLen * 1.5, 0);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.4, this.color);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.shadowBlur = 12;
      ctx.shadowColor = this.color;
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.rotate(this.angle);
    ctx.strokeStyle = `rgba(${this.team === 'blue' ? '0, 240, 255' : '255, 0, 85'}, 0.45)`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pulseSize + 4, 0);
    ctx.lineTo(pulseSize + 22, 0);
    ctx.stroke();
    ctx.restore();

    ctx.shadowBlur = reducedMotion ? 6 : 12 + beatPulse * 10;
    ctx.shadowColor = this.color;
    ctx.fillStyle = '#060a14';
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(0, 0, pulseSize * 0.55, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#060a14';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${this.number}`, 0, 1);

    ctx.restore();
  }
}

export class GameEngine {
  constructor(canvas, audioEngine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audioEngine = audioEngine;
    this.width = Math.max(360, canvas.clientWidth || window.innerWidth);
    this.height = Math.max(280, canvas.clientHeight || window.innerHeight);

    this.score = { blue: 0, red: 0 };
    this.sonicStrikes = 0;
    this.particles = [];
    this.players = [];
    this.isResetting = false;
    this.resetTimer = null;
    this.lastTime = 0;
    this.reducedMotion = isReducedMotionPreferred();

    this.screenShake = 0;
    this.bannerText = null;
    this.bannerColor = '#00f0ff';
    this.bannerAlpha = 0;

    this.gridCols = 24;
    this.gridRows = 14;
    this.gridWaves = [];

    this.resetPitch();
  }

  pushParticle = (p) => {
    if (this.particles.length >= 280) {
      this.particles.shift();
    }
    this.particles.push(p);
  };

  computeFormation(w, h) {
    return [
      { x: Math.min(120, w * 0.12), y: h / 2, team: 'blue', role: 'goalkeeper', num: 1 },
      { x: w * 0.25, y: h / 3, team: 'blue', role: 'defender', num: 2 },
      { x: w * 0.25, y: (h * 2) / 3, team: 'blue', role: 'defender', num: 3 },
      { x: w * 0.38, y: h / 4, team: 'blue', role: 'midfielder', num: 4 },
      { x: w * 0.38, y: (h * 3) / 4, team: 'blue', role: 'midfielder', num: 5 },
      { x: w * 0.44, y: h / 2, team: 'blue', role: 'striker', num: 9 },

      { x: Math.max(w - 120, w * 0.88), y: h / 2, team: 'red', role: 'goalkeeper', num: 1 },
      { x: w * 0.75, y: h / 3, team: 'red', role: 'defender', num: 2 },
      { x: w * 0.75, y: (h * 2) / 3, team: 'red', role: 'defender', num: 3 },
      { x: w * 0.62, y: h / 4, team: 'red', role: 'midfielder', num: 4 },
      { x: w * 0.62, y: (h * 3) / 4, team: 'red', role: 'midfielder', num: 5 },
      { x: w * 0.56, y: h / 2, team: 'red', role: 'striker', num: 9 }
    ];
  }

  resetPitch() {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    this.isResetting = false;
    const w = this.width;
    const h = this.height;

    this.ball = new Ball(w / 2, h / 2);
    this.particles = [];
    this.gridWaves = [];

    const goalH = 220;
    this.leftGoalNet = new LaserNet(0, h / 2 - goalH / 2, 50, goalH, 'left');
    this.rightGoalNet = new LaserNet(w - 50, h / 2 - goalH / 2, 50, goalH, 'right');

    const formation = this.computeFormation(w, h);
    this.players = formation.map(f => new Player(f.x, f.y, f.team, f.role, f.num));
  }

  resize(w, h) {
    const safeW = Math.max(360, w);
    const safeH = Math.max(280, h);
    const prevW = this.width || safeW;
    const prevH = this.height || safeH;
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;

    this.width = safeW;
    this.height = safeH;
    this.canvas.width = Math.floor(safeW * dpr);
    this.canvas.height = Math.floor(safeH * dpr);
    if (this.ctx) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const goalH = 220;
    if (this.leftGoalNet) this.leftGoalNet.setGeometry(0, safeH / 2 - goalH / 2, 50, goalH);
    if (this.rightGoalNet) this.rightGoalNet.setGeometry(safeW - 50, safeH / 2 - goalH / 2, 50, goalH);

    if (this.players.length === 0) {
      this.resetPitch();
      return;
    }

    const formation = this.computeFormation(safeW, safeH);
    this.players.forEach((p, idx) => {
      if (formation[idx]) {
        p.homeX = formation[idx].x;
        p.homeY = formation[idx].y;
      }
      p.x = Math.max(55, Math.min(safeW - 55, (p.x / prevW) * safeW));
      p.y = Math.max(55, Math.min(safeH - 55, (p.y / prevH) * safeH));
    });

    if (this.ball && !this.isResetting) {
      this.ball.x = Math.max(55, Math.min(safeW - 55, (this.ball.x / prevW) * safeW));
      this.ball.y = Math.max(55, Math.min(safeH - 55, (this.ball.y / prevH) * safeH));
      this.ball.trail = [];
    }
  }

  triggerSonicStrikeBanner(_team, x, y) {
    this.sonicStrikes++;
    this.bannerText = '⚡ SONIC STRIKE ⚡';
    this.bannerColor = '#ffe600';
    this.bannerAlpha = 1.0;
    if (!this.reducedMotion) {
      this.screenShake = 10;
      if (this.gridWaves.length < 8) {
        this.gridWaves.push({ x, y, radius: 0, power: 20 });
      }
    }

    if (this.audioEngine) {
      this.audioEngine.playSonicStrikeSound();
    }
  }

  touchKick(x, y) {
    if (!this.ball || this.isResetting) return;
    const dx = x - this.ball.x;
    const dy = y - this.ball.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const isSonic = (this.audioEngine?.kickPulse || 0) > 0.5;

    this.ball.kick((dx / dist) * (isSonic ? 22 : 14), (dy / dist) * (isSonic ? 22 : 14), isSonic, 'blue');

    if (isSonic) {
      this.triggerSonicStrikeBanner('blue', this.ball.x, this.ball.y);
    } else if (this.audioEngine) {
      this.audioEngine.playKickSound(1.2);
    }

    const sparkCount = this.reducedMotion ? 6 : 18;
    for (let i = 0; i < sparkCount; i++) {
      this.pushParticle(new Particle(this.ball.x, this.ball.y, isSonic ? '#ffe600' : '#00f0ff', 'spark', 10));
    }
  }

  update(now = performance.now()) {
    let dtScale = 1;
    if (this.lastTime > 0) {
      const rawDt = (now - this.lastTime) / 1000;
      const clampedDt = Number.isFinite(rawDt) ? Math.min(0.05, Math.max(0.004, rawDt)) : 0.016;
      dtScale = clampedDt * 60;
    }
    this.lastTime = now;
    this.reducedMotion = isReducedMotionPreferred();

    let energyLevel = 1.0;
    let aggression = 0.3;
    let beatPulse = 0;
    let kickPulse = 0;

    if (this.audioEngine) {
      this.audioEngine.updateAnalysis();
      energyLevel = 0.5 + this.audioEngine.bands.rawAverage * 2.5;
      aggression = 0.2 + this.audioEngine.bands.kick * 2.8;
      beatPulse = this.audioEngine.beatPulse;
      kickPulse = this.audioEngine.kickPulse;
    }

    this.screenShake = this.reducedMotion ? 0 : this.screenShake * Math.pow(0.86, dtScale);
    if (this.screenShake < 0.2) this.screenShake = 0;

    for (let i = this.gridWaves.length - 1; i >= 0; i--) {
      const w = this.gridWaves[i];
      w.radius += 12 * dtScale;
      w.power *= Math.pow(0.92, dtScale);
      if (w.power < 0.5 || w.radius > 600) {
        this.gridWaves.splice(i, 1);
      }
    }

    if (this.bannerAlpha > 0) {
      this.bannerAlpha = Math.max(0, this.bannerAlpha - 0.025 * dtScale);
    }

    if (this.isResetting) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        this.particles[i].update(dtScale);
        if (this.particles[i].life <= 0) this.particles.splice(i, 1);
      }
      this.leftGoalNet?.update(dtScale);
      this.rightGoalNet?.update(dtScale);
      return;
    }

    const goal = this.ball.update(
      this.width,
      this.height,
      energyLevel,
      dtScale,
      (bx, by) => {
        if (!this.reducedMotion && this.gridWaves.length < 8) {
          this.gridWaves.push({ x: bx, y: by, radius: 0, power: 10 });
        }
        this.audioEngine?.playBounceSound();
      }
    );

    if (goal) {
      this.score[goal]++;
      const isBlue = goal === 'blue';
      const scoringColor = isBlue ? '#00f0ff' : '#ff0055';

      if (isBlue) {
        this.rightGoalNet.impact(1.5);
      } else {
        this.leftGoalNet.impact(1.5);
      }

      this.audioEngine?.playGoalBlast(isBlue);
      if (!this.reducedMotion) this.screenShake = 14;
      this.bannerText = isBlue ? '⚽ BLUE GOAL! ⚽' : '💥 RED GOAL! 💥';
      this.bannerColor = scoringColor;
      this.bannerAlpha = 1.0;

      const sparkCount = this.reducedMotion ? 16 : 65;
      for (let i = 0; i < sparkCount; i++) {
        this.pushParticle(new Particle(this.ball.x, this.ball.y, scoringColor, 'spark', 13));
      }
      this.pushParticle(new Particle(this.ball.x, this.ball.y, scoringColor, 'ring'));

      this.isResetting = true;
      if (this.resetTimer) clearTimeout(this.resetTimer);
      this.resetTimer = setTimeout(() => {
        this.resetTimer = null;
        this.resetPitch();
      }, 2200);
      this.ball.x = -2000;
      return;
    }

    this.players.forEach(p => {
      p.update(
        this.ball,
        this.width,
        this.height,
        energyLevel,
        aggression,
        kickPulse,
        beatPulse,
        dtScale,
        this.pushParticle,
        (isSonic, team, kx, ky) => {
          if (isSonic) {
            this.triggerSonicStrikeBanner(team, kx, ky);
          } else {
            this.audioEngine?.playKickSound(1.0);
            if (!this.reducedMotion && this.gridWaves.length < 8) {
              this.gridWaves.push({ x: kx, y: ky, radius: 0, power: 8 });
            }
          }
        }
      );
    });

    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dtScale);
      if (this.particles[i].life <= 0) this.particles.splice(i, 1);
    }

    this.leftGoalNet?.update(dtScale);
    this.rightGoalNet?.update(dtScale);
  }

  draw() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const beatPulse = this.reducedMotion ? 0 : (this.audioEngine?.beatPulse || 0);
    const kickPulse = this.reducedMotion ? 0 : (this.audioEngine?.kickPulse || 0);

    ctx.save();

    if (this.screenShake > 0 && !this.reducedMotion) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // Steady clear without full-screen strobe flashing (>3 Hz photosensitivity safe)
    if (this.reducedMotion) {
      ctx.clearRect(0, 0, w, h);
    } else {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }

    this.drawPitchGrid(ctx, w, h, beatPulse);

    this.leftGoalNet?.draw(ctx, beatPulse, '#00f0ff');
    this.rightGoalNet?.draw(ctx, beatPulse, '#ff0055');

    this.drawStadiumVisualizers(ctx, w, h, beatPulse);

    this.particles.forEach(p => p.draw(ctx));
    this.players.forEach(p => p.draw(ctx, beatPulse, kickPulse, this.reducedMotion));
    if (!this.isResetting) {
      this.ball.draw(ctx, beatPulse, this.reducedMotion);
    }

    if (this.bannerAlpha > 0 && this.bannerText) {
      ctx.save();
      ctx.globalAlpha = this.bannerAlpha;
      ctx.shadowBlur = this.reducedMotion ? 8 : 22;
      ctx.shadowColor = this.bannerColor;
      ctx.fillStyle = this.bannerColor;
      ctx.font = '900 clamp(28px, 6vw, 56px) "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.bannerText, w / 2, h / 2 - 70);
      ctx.restore();
    }

    ctx.restore();
  }

  drawPitchGrid(ctx, w, h, beatPulse) {
    const margin = 50;
    const pitchW = Math.max(100, w - margin * 2);
    const pitchH = Math.max(100, h - margin * 2);
    const cellW = pitchW / this.gridCols;
    const cellH = pitchH / this.gridRows;

    ctx.save();
    ctx.strokeStyle = `rgba(0, 240, 255, ${0.1 + beatPulse * 0.06})`;
    ctx.lineWidth = 1;

    for (let r = 0; r <= this.gridRows; r++) {
      ctx.beginPath();
      for (let c = 0; c <= this.gridCols; c++) {
        let gx = margin + c * cellW;
        let gy = margin + r * cellH;

        if (!this.reducedMotion) {
          for (const wave of this.gridWaves) {
            const d = Math.hypot(gx - wave.x, gy - wave.y);
            const diff = Math.abs(d - wave.radius);
            if (diff < 40) {
              const ripple = Math.sin((diff / 40) * Math.PI) * wave.power;
              const angle = Math.atan2(gy - wave.y, gx - wave.x);
              gx += Math.cos(angle) * ripple;
              gy += Math.sin(angle) * ripple;
            }
          }
        }

        if (c === 0) ctx.moveTo(gx, gy);
        else ctx.lineTo(gx, gy);
      }
      ctx.stroke();
    }

    const pitchColor = `hsl(${185 + beatPulse * 15}, 100%, 55%)`;
    ctx.strokeStyle = pitchColor;
    ctx.lineWidth = 3 + beatPulse * 1.5;
    ctx.shadowBlur = this.reducedMotion ? 0 : 12 + beatPulse * 8;
    ctx.shadowColor = pitchColor;
    ctx.strokeRect(margin, margin, pitchW, pitchH);

    ctx.beginPath();
    ctx.moveTo(w / 2, margin);
    ctx.lineTo(w / 2, h - margin);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.min(pitchH * 0.35, 95 + beatPulse * 8), 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = pitchColor;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 8 + beatPulse * 3, 0, Math.PI * 2);
    ctx.fill();

    const penaltyW = Math.min(140, pitchW * 0.22);
    const penaltyH = Math.min(280, pitchH * 0.65);
    ctx.strokeRect(margin, h / 2 - penaltyH / 2, penaltyW, penaltyH);
    ctx.strokeRect(w - margin - penaltyW, h / 2 - penaltyH / 2, penaltyW, penaltyH);

    ctx.restore();
  }

  drawStadiumVisualizers(ctx, w, h, beatPulse) {
    if (!this.audioEngine || !this.audioEngine.frequencyData) return;
    const freq = this.audioEngine.frequencyData;
    const bars = 64;
    const barWidth = Math.max(2, (w - 100) / bars);

    ctx.save();
    ctx.shadowBlur = this.reducedMotion ? 0 : 10;

    for (let i = 0; i < bars; i++) {
      const idx = Math.floor((i / bars) * (freq.length / 2));
      const val = freq[idx] / 255.0;
      const barH = val * 48 + beatPulse * 10;
      const bx = 50 + i * barWidth;

      const hue = 180 + (i / bars) * 120;
      ctx.fillStyle = `hsla(${hue}, 100%, 60%, ${0.22 + val * 0.5})`;
      ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;

      ctx.fillRect(bx, 50 - barH - 4, Math.max(1, barWidth - 2), barH);
      ctx.fillRect(bx, h - 50 + 4, Math.max(1, barWidth - 2), barH);
    }
    ctx.restore();
  }

  destroy() {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }
}
