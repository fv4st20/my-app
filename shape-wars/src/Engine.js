export class FloatingText {
  constructor(x, y, text, color, life = 100, size = 18) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.size = size;
    this.vy = -1.5 - Math.random();
    this.vx = (Math.random() - 0.5) * 3;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
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

  update(units, texts, width, height) {
    if (this.emotionTimer > 0) {
      this.emotionTimer--;
      if (this.emotionTimer <= 0) this.setEmotion('neutral', 0);
    }
    if (this.attackCooldown > 0) this.attackCooldown--;

    let target = null;
    let minDist = Infinity;
    let allies = 0;
    let enemies = 0;
    
    for (const u of units) {
      if (u === this) continue;
      const dx = u.x - this.x;
      const dy = u.y - this.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      if (dist < 200) {
        if (u.team === this.team) allies++;
        else enemies++;
      }
      
      if (u.team !== this.team && dist < minDist) {
        minDist = dist;
        target = u;
      }
    }

    if (enemies > allies + 8 && this.emotion !== 'fear' && Math.random() < 0.005) {
      this.setEmotion('fear', 300);
      texts.push(new FloatingText(this.x, this.y, "Trembles before the void...", "#aaa", 80, 14));
    }

    if (target) {
      let dx = target.x - this.x;
      let dy = target.y - this.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      dx /= dist; dy /= dist;
      
      if (this.emotion === 'fear') {
        this.vx = -dx * this.speed;
        this.vy = -dy * this.speed;
      } else if (this.emotion === 'grief') {
        this.vx += (Math.random() - 0.5) * 0.3;
        this.vy += (Math.random() - 0.5) * 0.3;
      } else {
        this.vx = dx * this.speed;
        this.vy = dy * this.speed;
        
        if (dist < this.size + target.size + 10 && this.attackCooldown <= 0) {
          const dmg = this.team === 'blue' ? 25 : 12;
          const finalDmg = this.emotion === 'anger' ? dmg * 2 : dmg;
          target.takeDamage(finalDmg, texts);
          this.attackCooldown = this.team === 'blue' ? 70 : 25;
        }
      }
    } else {
      this.vx += (Math.random() - 0.5) * 0.5;
      this.vy += (Math.random() - 0.5) * 0.5;
    }

    const currentSpeed = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
    if (currentSpeed > this.speed) {
      this.vx = (this.vx / currentSpeed) * this.speed;
      this.vy = (this.vy / currentSpeed) * this.speed;
    }

    this.x += this.vx;
    this.y += this.vy;

    if (this.x < 0) this.x = 0;
    if (this.x > width) this.x = width;
    if (this.y < 0) this.y = 0;
    if (this.y > height) this.y = height;
    
    if (this.emotion === 'grief' && Math.random() < 0.05) {
      texts.push(new FloatingText(this.x, this.y, "💧", "#38bdf8", 40, 20));
    }
  }

  takeDamage(amt, texts) {
    this.hp -= amt;
    const hitWords = ["Strikes!", "Tears flesh!", "Shatters!", "Pierces!"];
    const word = hitWords[Math.floor(Math.random() * hitWords.length)];
    texts.push(new FloatingText(this.x, this.y, `${word} -${amt}`, this.team === 'blue' ? '#7dd3fc' : '#fca5a5', 60, 20));
    
    if (this.hp > 0 && this.emotion !== 'anger' && Math.random() < 0.15) {
      this.setEmotion('anger', 400);
      texts.push(new FloatingText(this.x, this.y, "BURNING WRATH", "#ff3300", 90, 24));
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    
    if (this.emotion === 'anger') {
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 25;
    } else if (this.emotion === 'fear') {
      ctx.globalAlpha = 0.4;
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 5;
    } else if (this.emotion === 'grief') {
      ctx.shadowColor = '#0066ff';
      ctx.shadowBlur = 10;
      ctx.globalAlpha = 0.8;
    } else {
      ctx.shadowColor = this.team === 'blue' ? '#38bdf8' : '#ef4444';
      ctx.shadowBlur = 15;
    }

    ctx.fillStyle = this.team === 'blue' ? '#38bdf8' : '#ef4444';
    
    if (this.team === 'blue') {
      ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-15, -this.size - 12, 30, 6);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(-15, -this.size - 12, 30 * Math.max(0, this.hp / this.maxHp), 6);
    
    ctx.restore();
  }
}

export class GameEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.units = [];
    this.texts = [];
    this.bombs = [];
    this.width = canvas.width;
    this.height = canvas.height;
    
    this.blueDeaths = 0;
    this.redDeaths = 0;
    
    this.synth = window.speechSynthesis;
    this.lastAnnouncement = 0;
    this.mood = 'neutral';
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
  }

  spawn(team, count) {
    for (let i = 0; i < count; i++) {
      const x = team === 'blue' ? Math.random() * 300 : this.width - Math.random() * 300;
      const y = Math.random() * this.height;
      this.units.push(new Unit(x, y, team));
    }
    const teamName = team === 'blue' ? 'The Sapphire Cubes' : 'The Crimson Spheres';
    this.announce(`${teamName} arise from the æther! A poetic tragedy begins.`);
  }

  spawnAt(team, x, y, count = 1) {
    for (let i = 0; i < count; i++) {
      const ox = (Math.random() - 0.5) * 40;
      const oy = (Math.random() - 0.5) * 40;
      this.units.push(new Unit(Math.max(10, Math.min(this.width - 10, x + ox)), Math.max(10, Math.min(this.height - 10, y + oy)), team));
    }
  }

  mathBomb() {
    this.announce("A brilliant equation rips through the fabric of reality! Behold the majesty of math!");
    const x = this.width / 2;
    const y = this.height / 2;
    this.texts.push(new FloatingText(x, y - 50, "E = mc²", "#d946ef", 150, 48));
    
    this.bombs.push({
      x, y, radius: 0, maxRadius: Math.max(this.width, this.height) * 0.8
    });
  }

  announce(text) {
    if (!this.synth) return;
    const now = Date.now();
    if (now - this.lastAnnouncement < 6000) return;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 0.8;
    // Find a dramatic voice if available
    const voices = this.synth.getVoices();
    const voice = voices.find(v => v.name.includes('Google UK English Male') || v.name.includes('Daniel'));
    if (voice) utterance.voice = voice;
    
    this.synth.speak(utterance);
    this.lastAnnouncement = now;
  }

  update() {
    let blueCount = 0;
    let redCount = 0;
    
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      b.radius += 15;
      
      for (const u of this.units) {
        const dx = u.x - b.x;
        const dy = u.y - b.y;
        if (Math.sqrt(dx*dx + dy*dy) < b.radius) {
          if (Math.random() < 0.1) u.takeDamage(15, this.texts);
        }
      }
      
      if (b.radius > b.maxRadius) this.bombs.splice(i, 1);
    }

    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      u.update(this.units, this.texts, this.width, this.height);
      
      if (u.team === 'blue') blueCount++;
      else redCount++;
      
      if (u.hp <= 0) {
        const words = ["Fades to dust...", "A beautiful end.", "Returns to the void.", "Weeps and shatters."];
        const w = words[Math.floor(Math.random() * words.length)];
        this.texts.push(new FloatingText(u.x, u.y, w, "#fff", 100, 16));
        
        if (u.team === 'blue') this.blueDeaths++;
        else this.redDeaths++;
        
        for (const ally of this.units) {
          if (ally !== u && ally.team === u.team && Math.random() < 0.4) {
            const dx = ally.x - u.x;
            const dy = ally.y - u.y;
            if (Math.sqrt(dx*dx + dy*dy) < 200) {
              ally.setEmotion('grief', 250);
              this.texts.push(new FloatingText(ally.x, ally.y, "Mourning...", "#60a5fa", 80, 18));
            }
          }
        }
        
        this.units.splice(i, 1);
      }
    }

    for (let i = this.texts.length - 1; i >= 0; i--) {
      this.texts[i].update();
      if (this.texts[i].life <= 0) this.texts.splice(i, 1);
    }

    if (this.redDeaths > 25 && this.mood !== 'blue-winning') {
      this.mood = 'blue-winning';
      this.announce("Alas! The Crimson Spheres bleed upon the canvas of war. A beautiful, tragic massacre.");
      this.redDeaths = 0;
    } else if (this.blueDeaths > 25 && this.mood !== 'red-winning') {
      this.mood = 'red-winning';
      this.announce("The Sapphire Cubes crack and shatter! Their rigid geometry broken by the endless crimson tide.");
      this.blueDeaths = 0;
    }
  }

  draw() {
    if (this.mood === 'blue-winning') this.ctx.fillStyle = 'rgba(5, 20, 35, 0.4)';
    else if (this.mood === 'red-winning') this.ctx.fillStyle = 'rgba(35, 5, 5, 0.4)';
    else this.ctx.fillStyle = 'rgba(15, 15, 25, 0.4)'; 
    
    this.ctx.fillRect(0, 0, this.width, this.height);

    for (const b of this.bombs) {
      this.ctx.beginPath();
      this.ctx.arc(b.x, b.y, b.radius, 0, Math.PI*2);
      this.ctx.strokeStyle = `rgba(217, 70, 239, ${Math.max(0, 1 - b.radius/b.maxRadius)})`;
      this.ctx.lineWidth = 10;
      this.ctx.stroke();
    }

    for (const u of this.units) u.draw(this.ctx);
    for (const t of this.texts) t.draw(this.ctx);
  }
}
