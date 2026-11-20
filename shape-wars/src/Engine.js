const MAX_UNITS = 400;
const MAX_TEXTS = 150;

function isReducedMotionPreferred() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export class FloatingText {
  constructor(x, y, text, color, life = 100, size = 18) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.life = life;
    this.maxLife = Math.max(1, life);
    this.size = size;
    this.vy = -1.5 - Math.random();
    this.vx = (Math.random() - 0.5) * 3;
  }

  update(dtScale = 1) {
    this.x += this.vx * dtScale;
    this.y += this.vy * dtScale;
    this.life -= dtScale;
  }

  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, this.life / this.maxLife));
    ctx.fillStyle = this.color;
    ctx.font = `bold ${this.size}px 'Georgia', serif`;
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

export class Unit {
  constructor(x, y, team) {
    this.x = x;
    this.y = y;
    this.team = team;
    this.size = team === 'blue' ? 24 : 16;
    this.hp = team === 'blue' ? 100 : 40;
    this.maxHp = this.hp;
    this.speed = team === 'blue' ? 1.5 : 3;
    this.baseSpeed = this.speed;
    this.vx = 0;
    this.vy = 0;
    this.emotion = 'neutral';
    this.emotionTimer = 0;
    this.attackCooldown = 0;
  }

  setEmotion(emotion, duration) {
    this.emotion = emotion;
    this.emotionTimer = duration;

    if (emotion === 'anger') this.speed = this.baseSpeed * 2.5;
    else if (emotion === 'grief') this.speed = this.baseSpeed * 0.3;
    else if (emotion === 'fear') this.speed = this.baseSpeed * 2;
    else this.speed = this.baseSpeed;
  }

  update(units, pushText, width, height, dtScale = 1) {
    if (this.emotionTimer > 0) {
      this.emotionTimer -= dtScale;
      if (this.emotionTimer <= 0) this.setEmotion('neutral', 0);
    }
    if (this.attackCooldown > 0) this.attackCooldown -= dtScale;

    let target = null;
    let minDist = Infinity;
    let allies = 0;
    let enemies = 0;

    for (const u of units) {
      if (u === this) continue;
      const dx = u.x - this.x;
      const dy = u.y - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 200) {
        if (u.team === this.team) allies++;
        else enemies++;
      }

      if (u.team !== this.team && dist < minDist) {
        minDist = dist;
        target = u;
      }
    }

    if (enemies > allies + 8 && this.emotion !== 'fear' && Math.random() < 0.005 * dtScale) {
      this.setEmotion('fear', 300);
      pushText(new FloatingText(this.x, this.y, 'Trembles before the void...', '#aaa', 80, 14));
    }

    if (target) {
      let dx = target.x - this.x;
      let dy = target.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.0001) {
        dx /= dist;
        dy /= dist;
      } else {
        const randAngle = Math.random() * Math.PI * 2;
        dx = Math.cos(randAngle);
        dy = Math.sin(randAngle);
      }

      if (this.emotion === 'fear') {
        this.vx = -dx * this.speed;
        this.vy = -dy * this.speed;
      } else if (this.emotion === 'grief') {
        this.vx += (Math.random() - 0.5) * 0.3 * dtScale;
        this.vy += (Math.random() - 0.5) * 0.3 * dtScale;
      } else {
        this.vx = dx * this.speed;
        this.vy = dy * this.speed;

        if (dist < this.size + target.size + 10 && this.attackCooldown <= 0) {
          const dmg = this.team === 'blue' ? 25 : 12;
          const finalDmg = this.emotion === 'anger' ? dmg * 2 : dmg;
          target.takeDamage(finalDmg, pushText);
          this.attackCooldown = this.team === 'blue' ? 70 : 25;
        }
      }
    } else {
      this.vx += (Math.random() - 0.5) * 0.5 * dtScale;
      this.vy += (Math.random() - 0.5) * 0.5 * dtScale;
    }

    const currentSpeed = Math.hypot(this.vx, this.vy);
    if (currentSpeed > this.speed && currentSpeed > 0.0001) {
      this.vx = (this.vx / currentSpeed) * this.speed;
      this.vy = (this.vy / currentSpeed) * this.speed;
    }

    this.x += this.vx * dtScale;
    this.y += this.vy * dtScale;

    if (!Number.isFinite(this.x)) this.x = width / 2;
    if (!Number.isFinite(this.y)) this.y = height / 2;

    if (this.x < 0) this.x = 0;
    if (this.x > width) this.x = width;
    if (this.y < 0) this.y = 0;
    if (this.y > height) this.y = height;

    if (this.emotion === 'grief' && Math.random() < 0.04 * dtScale) {
      pushText(new FloatingText(this.x, this.y, '💧', '#38bdf8', 40, 20));
    }
  }

  takeDamage(amt, pushText) {
    this.hp -= amt;
    const hitWords = ['Strikes!', 'Tears!', 'Shatters!', 'Pierces!'];
    const word = hitWords[Math.floor(Math.random() * hitWords.length)];
    pushText(new FloatingText(this.x, this.y, `${word} -${amt}`, this.team === 'blue' ? '#7dd3fc' : '#fca5a5', 60, 20));

    if (this.hp > 0 && this.emotion !== 'anger' && Math.random() < 0.15) {
      this.setEmotion('anger', 400);
      pushText(new FloatingText(this.x, this.y, 'BURNING WRATH', '#ff3300', 90, 24));
    }
  }

  draw(ctx, reducedMotion = false) {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (!reducedMotion) {
      if (this.emotion === 'anger') {
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 20;
      } else if (this.emotion === 'fear') {
        ctx.globalAlpha = 0.45;
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 5;
      } else if (this.emotion === 'grief') {
        ctx.shadowColor = '#0066ff';
        ctx.shadowBlur = 10;
        ctx.globalAlpha = 0.8;
      } else {
        ctx.shadowColor = this.team === 'blue' ? '#38bdf8' : '#ef4444';
        ctx.shadowBlur = 12;
      }
    }

    ctx.fillStyle = this.team === 'blue' ? '#38bdf8' : '#ef4444';

    if (this.team === 'blue') {
      ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, this.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-15, -this.size - 12, 30, 6);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(-15, -this.size - 12, 30 * Math.max(0, Math.min(1, this.hp / this.maxHp)), 6);

    ctx.restore();
  }
}

export class GameEngine {
  constructor(canvas, muted = false) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.units = [];
    this.texts = [];
    this.bombs = [];
    this.width = Math.max(320, canvas.clientWidth || window.innerWidth);
    this.height = Math.max(240, canvas.clientHeight || window.innerHeight);

    this.blueDeaths = 0;
    this.redDeaths = 0;
    this.totalCasualties = 0;

    this.synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
    this.muted = muted;
    this.lastAnnouncement = 0;
    this.mood = 'neutral';
    this.lastTime = 0;
    this.reducedMotion = isReducedMotionPreferred();
  }

  pushText = (ft) => {
    if (this.texts.length >= MAX_TEXTS) {
      this.texts.shift();
    }
    this.texts.push(ft);
  };

  setMuted(muted) {
    this.muted = muted;
    if (muted && this.synth) {
      try {
        this.synth.cancel();
      } catch {
        // Ignore speech cancel error
      }
    }
  }

  resize(w, h) {
    const safeW = Math.max(320, w);
    const safeH = Math.max(240, h);
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    this.width = safeW;
    this.height = safeH;
    this.canvas.width = Math.floor(safeW * dpr);
    this.canvas.height = Math.floor(safeH * dpr);
    if (this.ctx) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    for (const u of this.units) {
      u.x = Math.max(0, Math.min(safeW, u.x));
      u.y = Math.max(0, Math.min(safeH, u.y));
    }
  }

  spawn(team, count) {
    const available = Math.max(0, MAX_UNITS - this.units.length);
    const toSpawn = Math.min(count, available);
    for (let i = 0; i < toSpawn; i++) {
      const x = team === 'blue' ? Math.random() * Math.min(300, this.width * 0.4) : this.width - Math.random() * Math.min(300, this.width * 0.4);
      const y = Math.random() * this.height;
      this.units.push(new Unit(x, y, team));
    }
    if (toSpawn > 0) {
      const teamName = team === 'blue' ? 'The Sapphire Cubes' : 'The Crimson Spheres';
      this.announce(`${teamName} arise from the aether! A poetic tragedy begins.`);
    }
  }

  spawnAt(team, x, y, count = 1) {
    const available = Math.max(0, MAX_UNITS - this.units.length);
    const toSpawn = Math.min(count, available);
    for (let i = 0; i < toSpawn; i++) {
      const ox = (Math.random() - 0.5) * 40;
      const oy = (Math.random() - 0.5) * 40;
      const sx = Math.max(10, Math.min(this.width - 10, x + ox));
      const sy = Math.max(10, Math.min(this.height - 10, y + oy));
      this.units.push(new Unit(sx, sy, team));
    }
  }

  mathBomb() {
    this.announce('A brilliant equation rips through the fabric of reality! Behold the majesty of math!');
    const x = this.width / 2;
    const y = this.height / 2;
    this.pushText(new FloatingText(x, y - 50, 'E = mc²', '#d946ef', 150, 48));

    if (this.bombs.length < 5) {
      this.bombs.push({
        x,
        y,
        radius: 0,
        maxRadius: Math.max(100, Math.max(this.width, this.height) * 0.8)
      });
    }
  }

  announce(text) {
    if (this.muted || !this.synth || typeof SpeechSynthesisUtterance === 'undefined') return;
    const now = Date.now();
    if (now - this.lastAnnouncement < 6000) return;

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.volume = 0.5;
      utterance.rate = 0.9;
      utterance.pitch = 0.85;
      const voices = this.synth.getVoices();
      const voice = voices.find(v => v.name.includes('Google UK English Male') || v.name.includes('Daniel'));
      if (voice) utterance.voice = voice;

      this.synth.speak(utterance);
      this.lastAnnouncement = now;
    } catch {
      // Speech synthesis unavailable or blocked
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

    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      b.radius += 15 * dtScale;

      for (const u of this.units) {
        const dx = u.x - b.x;
        const dy = u.y - b.y;
        if (Math.hypot(dx, dy) < b.radius) {
          if (Math.random() < 0.1 * dtScale) u.takeDamage(15, this.pushText);
        }
      }

      if (b.radius > b.maxRadius) this.bombs.splice(i, 1);
    }

    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      u.update(this.units, this.pushText, this.width, this.height, dtScale);

      if (u.hp <= 0) {
        const words = ['Fades to dust...', 'A beautiful end.', 'Returns to the void.', 'Weeps and shatters.'];
        const w = words[Math.floor(Math.random() * words.length)];
        this.pushText(new FloatingText(u.x, u.y, w, '#fff', 100, 16));

        this.totalCasualties++;
        if (u.team === 'blue') this.blueDeaths++;
        else this.redDeaths++;

        for (const ally of this.units) {
          if (ally !== u && ally.team === u.team && Math.random() < 0.4) {
            const dx = ally.x - u.x;
            const dy = ally.y - u.y;
            if (Math.hypot(dx, dy) < 200) {
              ally.setEmotion('grief', 250);
              this.pushText(new FloatingText(ally.x, ally.y, 'Mourning...', '#60a5fa', 80, 18));
            }
          }
        }

        this.units.splice(i, 1);
      }
    }

    for (let i = this.texts.length - 1; i >= 0; i--) {
      this.texts[i].update(dtScale);
      if (this.texts[i].life <= 0) this.texts.splice(i, 1);
    }

    if (this.redDeaths > 25 && this.mood !== 'blue-winning') {
      this.mood = 'blue-winning';
      this.announce('Alas! The Crimson Spheres fall upon the canvas of war.');
      this.redDeaths = 0;
    } else if (this.blueDeaths > 25 && this.mood !== 'red-winning') {
      this.mood = 'red-winning';
      this.announce('The Sapphire Cubes crack and shatter beneath the crimson tide.');
      this.blueDeaths = 0;
    }
  }

  draw() {
    if (!this.ctx) return;

    if (this.reducedMotion) {
      this.ctx.fillStyle = '#0f0f19';
    } else if (this.mood === 'blue-winning') {
      this.ctx.fillStyle = 'rgba(5, 20, 35, 0.45)';
    } else if (this.mood === 'red-winning') {
      this.ctx.fillStyle = 'rgba(35, 5, 5, 0.45)';
    } else {
      this.ctx.fillStyle = 'rgba(15, 15, 25, 0.45)';
    }

    this.ctx.fillRect(0, 0, this.width, this.height);

    for (const b of this.bombs) {
      const alpha = Math.max(0, Math.min(0.65, 1 - b.radius / b.maxRadius));
      this.ctx.beginPath();
      this.ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(217, 70, 239, ${this.reducedMotion ? alpha * 0.5 : alpha})`;
      this.ctx.lineWidth = this.reducedMotion ? 5 : 8;
      this.ctx.stroke();
    }

    for (const u of this.units) u.draw(this.ctx, this.reducedMotion);
    for (const t of this.texts) t.draw(this.ctx);
  }

  destroy() {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch {
        // Ignore cancel errors
      }
    }
  }
}
