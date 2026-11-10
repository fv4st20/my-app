/**
 * Sonic Soccer Next-Gen Cybernetic Game & Physics Engine
 * Features:
 * - Cyber-Droid player models with plasma thrusters, armor rings, and aiming reticles
 * - Multi-band audio-reactive holographic pitch grid with impact wave ripples
 * - Physics-based elastic laser goal nets
 * - Plasma comet ball trail with "SONIC STRIKE" on-beat hyperkick mechanics
 * - Audio-reactive stadium lighting & visualizer waves
 * - Screen shake and geometric shockwave rings
 */

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
    this.type = type; // 'spark', 'ring', 'laserDebris'
    this.radius = 2;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.94;
    this.vy *= 0.94;
    this.life -= this.decay;
    if (this.type === 'ring') {
      this.radius += 5.5;
    }
  }

  draw(ctx) {
    if (this.life <= 0) return;
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;

    if (this.type === 'ring') {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2.5 * alpha;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = this.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
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
    this.side = side; // 'left' or 'right'
    this.tension = 0;
    this.cols = 5;
    this.rows = 8;
  }

  impact(intensity = 1.0) {
    this.tension = Math.min(30, this.tension + 25 * intensity);
  }

  update() {
    this.tension *= 0.88;
    if (this.tension < 0.2) this.tension = 0;
  }

  draw(ctx, beatPulse, teamColor) {
    ctx.save();
    const cellW = this.width / this.cols;
    const cellH = this.height / this.rows;
    const netGlow = teamColor;

    ctx.strokeStyle = netGlow;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 10 + beatPulse * 15;
    ctx.shadowColor = netGlow;

    // Horizontal grid cables with displacement
    for (let r = 0; r <= this.rows; r++) {
      const cy = this.y + r * cellH;
      const bulge = Math.sin((r / this.rows) * Math.PI) * this.tension * (this.side === 'left' ? -1 : 1);
      ctx.beginPath();
      ctx.moveTo(this.x, cy);
      ctx.quadraticCurveTo(this.x + this.width / 2 + bulge, cy, this.x + this.width, cy);
      ctx.stroke();
    }

    // Vertical grid cables
    for (let c = 0; c <= this.cols; c++) {
      const cx = this.x + c * cellW;
      ctx.beginPath();
      ctx.moveTo(cx, this.y);
      ctx.lineTo(cx, this.y + this.height);
      ctx.stroke();
    }

    // Goal Post Framing
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

  update(width, height, energyLevel, beatPulse, onBounce) {
    // Record comet trail
    this.trail.unshift({
      x: this.x,
      y: this.y,
      isSonic: this.isSonic,
      team: this.lastKickerTeam
    });
    if (this.trail.length > 24) this.trail.pop();

    if (this.sonicTimer > 0) {
      this.sonicTimer--;
      if (this.sonicTimer <= 0) this.isSonic = false;
    }

    const effectiveEnergy = Math.max(0.6, energyLevel);
    this.x += this.vx * effectiveEnergy;
    this.y += this.vy * effectiveEnergy;
    this.vx *= this.friction;
    this.vy *= this.friction;

    // Pitch Wall Collisions
    const margin = 50;
    if (this.y < margin + this.radius) {
      this.y = margin + this.radius;
      this.vy = -this.vy * 0.9;
      if (onBounce) onBounce(this.x, this.y);
    }
    if (this.y > height - margin - this.radius) {
      this.y = height - margin - this.radius;
      this.vy = -this.vy * 0.9;
      if (onBounce) onBounce(this.x, this.y);
    }

    const goalTop = height / 2 - 110;
    const goalBottom = height / 2 + 110;

    // Left Goal
    if (this.x < margin) {
      if (this.y > goalTop && this.y < goalBottom) {
        return 'red'; // Red scores on Blue goal
      }
      this.x = margin;
      this.vx = -this.vx * 0.92;
      if (onBounce) onBounce(this.x, this.y);
    }

    // Right Goal
    if (this.x > width - margin) {
      if (this.y > goalTop && this.y < goalBottom) {
        return 'blue'; // Blue scores on Red goal
      }
      this.x = width - margin;
      this.vx = -this.vx * 0.92;
      if (onBounce) onBounce(this.x, this.y);
    }

    return null;
  }

  draw(ctx, beatPulse) {
    ctx.save();
    const currentRadius = this.baseRadius + beatPulse * 8 + (this.isSonic ? 5 : 0);

    // Multi-Layer Plasma Comet Trail
    if (this.trail.length > 1) {
      for (let i = this.trail.length - 1; i >= 1; i--) {
        const pt = this.trail[i];
        const nextPt = this.trail[i - 1];
        const progress = 1 - i / this.trail.length;
        const trailColor = pt.isSonic
          ? `rgba(255, 230, 0, ${progress * 0.85})`
          : pt.team === 'blue'
          ? `rgba(0, 240, 255, ${progress * 0.7})`
          : `rgba(255, 0, 85, ${progress * 0.7})`;

        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(nextPt.x, nextPt.y);
        ctx.strokeStyle = trailColor;
        ctx.lineWidth = currentRadius * 2.2 * progress;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }

    // Outer Sonic Shock Glow
    if (this.isSonic) {
      ctx.shadowBlur = 35 + beatPulse * 25;
      ctx.shadowColor = '#ffe600';
      ctx.fillStyle = 'rgba(255, 230, 0, 0.35)';
      ctx.beginPath();
      ctx.arc(this.x, this.y, currentRadius * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ball Core Glow
    const coreGlow = this.isSonic
      ? '#ffe600'
      : this.lastKickerTeam === 'blue'
      ? '#00f0ff'
      : '#ff0055';

    ctx.shadowBlur = 20 + beatPulse * 30;
    ctx.shadowColor = coreGlow;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
    ctx.fill();

    // Inner Cyber Core Ring
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
    this.accentColor = team === 'blue' ? '#6366f1' : '#ec4899';
    this.kickCooldown = 0;
    this.thrustPower = 0;
  }

  update(ball, energyLevel, aggression, kickPulse, beatPulse, particles, onKick) {
    if (this.kickCooldown > 0) this.kickCooldown--;

    const dxBall = ball.x - this.x;
    const dyBall = ball.y - this.y;
    const distBall = Math.hypot(dxBall, dyBall);

    let targetX = this.homeX;
    let targetY = this.homeY;

    // Tactical Positioning by Role
    if (this.role === 'goalkeeper') {
      const goalX = this.team === 'blue' ? 100 : this.homeX;
      targetX = goalX;
      targetY = Math.max(220, Math.min(500, ball.y));
    } else if (this.role === 'striker') {
      // Aggressive chase towards opponent goal
      targetX = ball.x + (this.team === 'blue' ? -25 : 25);
      targetY = ball.y;
    } else {
      // Midfielders support the play
      const chaseRadius = 260 + aggression * 220;
      if (distBall < chaseRadius) {
        targetX = ball.x;
        targetY = ball.y;
      } else {
        // Dance in formation on heavy beats
        const shift = beatPulse > 0.4 ? (Math.sin(this.number * 2) * 45) : 0;
        targetX = this.homeX + shift;
        targetY = this.homeY + (beatPulse > 0.4 ? Math.cos(this.number * 2) * 35 : 0);
      }
    }

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 4) {
      const snapSteer = beatPulse > 0.5 ? 0.35 : 0.16;
      const speed = this.baseSpeed * (0.85 + energyLevel * 0.4);
      this.vx += ((dx / dist) * speed - this.vx) * snapSteer;
      this.vy += ((dy / dist) * speed - this.vy) * snapSteer;
      this.thrustPower = Math.min(1.0, this.thrustPower + 0.15);
      this.angle = Math.atan2(this.vy, this.vx);
    } else {
      this.vx *= 0.85;
      this.vy *= 0.85;
      this.thrustPower *= 0.8;
    }

    this.x += this.vx;
    this.y += this.vy;

    // Kick Collision Logic
    if (distBall < this.radius + ball.radius && this.kickCooldown <= 0) {
      this.kickCooldown = 18;

      // On-Beat "Sonic Strike" detection
      const isSonic = kickPulse > 0.55 || beatPulse > 0.65;
      const basePower = 9 + energyLevel * 5 + aggression * 10;
      const kickPower = isSonic ? basePower * 1.6 : basePower;

      const targetGoalX = this.team === 'blue' ? 1400 : -200;
      const targetGoalY = 360 + (Math.random() - 0.5) * 220;

      const kx = targetGoalX - this.x;
      const ky = (targetGoalY - this.y) * 0.65;
      const kDist = Math.max(1, Math.hypot(kx, ky));

      ball.kick((kx / kDist) * kickPower, (ky / kDist) * kickPower, isSonic, this.team);

      // Spawn impact particles
      const sparkCount = isSonic ? 35 : 16;
      for (let i = 0; i < sparkCount; i++) {
        particles.push(new Particle(ball.x, ball.y, isSonic ? '#ffe600' : this.color, 'spark', isSonic ? 12 : 7));
      }
      if (isSonic) {
        particles.push(new Particle(ball.x, ball.y, '#ffe600', 'ring'));
      }

      if (onKick) {
        onKick(isSonic, this.team, this.x, this.y);
      }
    }
  }

  draw(ctx, beatPulse, kickPulse) {
    ctx.save();
    ctx.translate(this.x, this.y);

    const pulseSize = this.radius + beatPulse * 4;

    // 1. Plasma Thruster Exhaust
    if (this.thrustPower > 0.1) {
      const exhaustLen = 14 * this.thrustPower + (kickPulse * 15);
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
      ctx.shadowBlur = 15;
      ctx.shadowColor = this.color;
      ctx.fill();
      ctx.restore();
    }

    // 2. Tactical Aiming Reticle (Subtle laser vector)
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

    // 3. Chassis Armor Outer Ring
    ctx.shadowBlur = 15 + beatPulse * 20;
    ctx.shadowColor = this.color;
    ctx.fillStyle = '#060a14';
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 4. Team Core Gem & Number
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(0, 0, pulseSize * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Number font
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
    this.width = canvas.width;
    this.height = canvas.height;

    this.score = { blue: 0, red: 0 };
    this.sonicStrikes = 0;
    this.particles = [];
    this.isResetting = false;

    // Screen Shake & Flash
    this.screenShake = 0;
    this.bannerText = null;
    this.bannerColor = '#00f0ff';
    this.bannerAlpha = 0;

    // Pitch Grid Ripple Matrix
    this.gridCols = 24;
    this.gridRows = 14;
    this.gridWaves = []; // { x, y, radius, power }

    this.resetPitch();
  }

  resetPitch() {
    this.isResetting = false;
    this.ball = new Ball(this.width / 2, this.height / 2);
    this.players = [];
    this.particles = [];
    this.gridWaves = [];

    const w = this.width;
    const h = this.height;

    // Laser Nets
    const goalH = 220;
    this.leftGoalNet = new LaserNet(0, h / 2 - goalH / 2, 50, goalH, 'left');
    this.rightGoalNet = new LaserNet(w - 50, h / 2 - goalH / 2, 50, goalH, 'right');

    // Blue Team (Left)
    this.players.push(new Player(120, h / 2, 'blue', 'goalkeeper', 1));
    this.players.push(new Player(320, h / 3, 'blue', 'defender', 2));
    this.players.push(new Player(320, (h * 2) / 3, 'blue', 'defender', 3));
    this.players.push(new Player(w / 2 - 160, h / 4, 'blue', 'midfielder', 4));
    this.players.push(new Player(w / 2 - 160, (h * 3) / 4, 'blue', 'midfielder', 5));
    this.players.push(new Player(w / 2 - 80, h / 2, 'blue', 'striker', 9));

    // Red Team (Right)
    this.players.push(new Player(w - 120, h / 2, 'red', 'goalkeeper', 1));
    this.players.push(new Player(w - 320, h / 3, 'red', 'defender', 2));
    this.players.push(new Player(w - 320, (h * 2) / 3, 'red', 'defender', 3));
    this.players.push(new Player(w / 2 + 160, h / 4, 'red', 'midfielder', 4));
    this.players.push(new Player(w / 2 + 160, (h * 3) / 4, 'red', 'midfielder', 5));
    this.players.push(new Player(w / 2 + 80, h / 2, 'red', 'striker', 9));
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.resetPitch();
  }

  triggerSonicStrikeBanner(team, x, y) {
    this.sonicStrikes++;
    this.bannerText = '⚡ SONIC STRIKE ⚡';
    this.bannerColor = '#ffe600';
    this.bannerAlpha = 1.0;
    this.screenShake = 16;
    this.gridWaves.push({ x, y, radius: 0, power: 25 });

    if (this.audioEngine) {
      this.audioEngine.playSonicStrikeSound();
    }
  }

  touchKick(x, y) {
    if (!this.ball) return;
    const dx = x - this.ball.x;
    const dy = y - this.ball.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const isSonic = this.audioEngine?.kickPulse > 0.5;

    this.ball.kick((dx / dist) * (isSonic ? 22 : 14), (dy / dist) * (isSonic ? 22 : 14), isSonic, 'blue');

    if (isSonic) {
      this.triggerSonicStrikeBanner('blue', this.ball.x, this.ball.y);
    } else if (this.audioEngine) {
      this.audioEngine.playKickSound(1.2);
    }

    for (let i = 0; i < 20; i++) {
      this.particles.push(new Particle(this.ball.x, this.ball.y, isSonic ? '#ffe600' : '#00f0ff', 'spark', 10));
    }
  }

  update() {
    // 1. Audio DSP Analysis
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

      if (this.audioEngine.isKickBeat) {
        this.screenShake = Math.max(this.screenShake, 5);
      }
    }

    // 2. Screen Shake Decay
    this.screenShake *= 0.88;
    if (this.screenShake < 0.2) this.screenShake = 0;

    // 3. Grid Wave Ripples
    for (let i = this.gridWaves.length - 1; i >= 0; i--) {
      const w = this.gridWaves[i];
      w.radius += 12;
      w.power *= 0.92;
      if (w.power < 0.5 || w.radius > 600) {
        this.gridWaves.splice(i, 1);
      }
    }

    // 4. Banner Decay
    if (this.bannerAlpha > 0) {
      this.bannerAlpha -= 0.025;
      if (this.bannerAlpha < 0) this.bannerAlpha = 0;
    }

    if (this.isResetting) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        this.particles[i].update();
        if (this.particles[i].life <= 0) this.particles.splice(i, 1);
      }
      this.leftGoalNet?.update();
      this.rightGoalNet?.update();
      return;
    }

    // 5. Ball Physics & Goal Detection
    const goal = this.ball.update(
      this.width,
      this.height,
      energyLevel,
      beatPulse,
      (bx, by) => {
        // Bounce callback
        this.gridWaves.push({ x: bx, y: by, radius: 0, power: 12 });
        this.audioEngine?.playBounceSound();
      }
    );

    if (goal) {
      this.score[goal]++;
      const isBlue = goal === 'blue';
      const scoringColor = isBlue ? '#00f0ff' : '#ff0055';

      // Goal impact on nets
      if (isBlue) {
        this.rightGoalNet.impact(1.5);
      } else {
        this.leftGoalNet.impact(1.5);
      }

      this.audioEngine?.playGoalBlast(isBlue);
      this.screenShake = 24;
      this.bannerText = isBlue ? '⚽ BLUE GOAL! ⚽' : '💥 RED GOAL! 💥';
      this.bannerColor = scoringColor;
      this.bannerAlpha = 1.0;

      // Massive goal particle shockwave
      for (let i = 0; i < 90; i++) {
        this.particles.push(new Particle(this.ball.x, this.ball.y, scoringColor, 'spark', 14));
      }
      this.particles.push(new Particle(this.ball.x, this.ball.y, scoringColor, 'ring'));
      this.particles.push(new Particle(this.ball.x, this.ball.y, '#ffffff', 'ring'));

      this.isResetting = true;
      setTimeout(() => this.resetPitch(), 2200);
      this.ball.x = -2000; // hide ball during celebration
      return;
    }

    // 6. Players Update
    this.players.forEach(p => {
      p.update(
        this.ball,
        energyLevel,
        aggression,
        kickPulse,
        beatPulse,
        this.particles,
        (isSonic, team, kx, ky) => {
          if (isSonic) {
            this.triggerSonicStrikeBanner(team, kx, ky);
          } else {
            this.audioEngine?.playKickSound(1.0);
            this.gridWaves.push({ x: kx, y: ky, radius: 0, power: 10 });
          }
        }
      );
    });

    // 7. Particles Update
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (this.particles[i].life <= 0) this.particles.splice(i, 1);
    }

    this.leftGoalNet?.update();
    this.rightGoalNet?.update();
  }

  draw() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const beatPulse = this.audioEngine?.beatPulse || 0;
    const kickPulse = this.audioEngine?.kickPulse || 0;

    ctx.save();

    // 1. Screen Shake Matrix
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // 2. High-Tech Motion Trail (Fade out)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0, 0, 0, ${0.35 + beatPulse * 0.25})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    // 3. Draw Holographic Reactive Pitch Grid
    this.drawPitchGrid(ctx, w, h, beatPulse);

    // 4. Draw Laser Goal Nets
    this.leftGoalNet?.draw(ctx, beatPulse, '#00f0ff');
    this.rightGoalNet?.draw(ctx, beatPulse, '#ff0055');

    // 5. Draw Stadium Audio Equalizer Floodlights
    this.drawStadiumVisualizers(ctx, w, h, beatPulse);

    // 6. Draw Ball, Players, and Particles
    this.particles.forEach(p => p.draw(ctx));
    this.players.forEach(p => p.draw(ctx, beatPulse, kickPulse));
    if (!this.isResetting) {
      this.ball.draw(ctx, beatPulse);
    }

    // 7. Holographic Banner (Sonic Strike / Goal)
    if (this.bannerAlpha > 0 && this.bannerText) {
      ctx.save();
      ctx.globalAlpha = this.bannerAlpha;
      ctx.shadowBlur = 30;
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
    const pitchW = w - margin * 2;
    const pitchH = h - margin * 2;
    const cellW = pitchW / this.gridCols;
    const cellH = pitchH / this.gridRows;

    ctx.save();
    ctx.strokeStyle = `rgba(0, 240, 255, ${0.08 + beatPulse * 0.15})`;
    ctx.lineWidth = 1;

    // Grid nodes displacement by shockwaves
    for (let r = 0; r <= this.gridRows; r++) {
      ctx.beginPath();
      for (let c = 0; c <= this.gridCols; c++) {
        let gx = margin + c * cellW;
        let gy = margin + r * cellH;

        // Apply wave ripple distortion
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

        if (c === 0) ctx.moveTo(gx, gy);
        else ctx.lineTo(gx, gy);
      }
      ctx.stroke();
    }

    // Outer Pitch Glowing Boundary Lines
    const pitchColor = `hsl(${180 + beatPulse * 40}, 100%, 55%)`;
    ctx.strokeStyle = pitchColor;
    ctx.lineWidth = 3 + beatPulse * 4;
    ctx.shadowBlur = 15 + beatPulse * 25;
    ctx.shadowColor = pitchColor;
    ctx.strokeRect(margin, margin, pitchW, pitchH);

    // Halfway Line
    ctx.beginPath();
    ctx.moveTo(w / 2, margin);
    ctx.lineTo(w / 2, h - margin);
    ctx.stroke();

    // Center Cyber Circle & Core Ring
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 95 + beatPulse * 20, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = pitchColor;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 8 + beatPulse * 6, 0, Math.PI * 2);
    ctx.fill();

    // Penalty Areas
    const penaltyW = 140;
    const penaltyH = 280;
    ctx.strokeRect(margin, h / 2 - penaltyH / 2, penaltyW, penaltyH);
    ctx.strokeRect(w - margin - penaltyW, h / 2 - penaltyH / 2, penaltyW, penaltyH);

    ctx.restore();
  }

  drawStadiumVisualizers(ctx, w, h, beatPulse) {
    if (!this.audioEngine || !this.audioEngine.frequencyData) return;
    const freq = this.audioEngine.frequencyData;
    const bars = 64;
    const barWidth = (w - 100) / bars;

    ctx.save();
    ctx.shadowBlur = 12 + beatPulse * 15;

    for (let i = 0; i < bars; i++) {
      const idx = Math.floor((i / bars) * (freq.length / 2));
      const val = (freq[idx] / 255.0);
      const barH = val * 55 + (beatPulse * 20);
      const bx = 50 + i * barWidth;

      const hue = 180 + (i / bars) * 120;
      ctx.fillStyle = `hsla(${hue}, 100%, 60%, ${0.25 + val * 0.6})`;
      ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;

      // Top stadium floodlight bar
      ctx.fillRect(bx, 50 - barH - 4, barWidth - 2, barH);

      // Bottom stadium floodlight bar
      ctx.fillRect(bx, h - 50 + 4, barWidth - 2, barH);
    }
    ctx.restore();
  }
}
