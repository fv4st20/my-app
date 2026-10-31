export class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 6;
    this.vy = (Math.random() - 0.5) * 6;
    this.life = 1.0;
    this.color = color;
    this.size = Math.random() * 4 + 2;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= 0.05;
  }
  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

export class Ball {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = 12;
    this.friction = 0.985;
    this.trail = [];
  }
  
  update(width, height, energyLevel, beatPulse) {
    this.trail.push({x: this.x, y: this.y});
    if (this.trail.length > 20) this.trail.shift();

    this.x += this.vx * energyLevel;
    this.y += this.vy * energyLevel;
    this.vx *= this.friction;
    this.vy *= this.friction;

    if (this.y < 50) { this.y = 50; this.vy *= -1; }
    if (this.y > height - 50) { this.y = height - 50; this.vy *= -1; }
    
    const goalTop = height / 2 - 100;
    const goalBottom = height / 2 + 100;
    
    if (this.x < 50) {
      if (this.y > goalTop && this.y < goalBottom) return 'red';
      this.x = 50; this.vx *= -1;
    }
    if (this.x > width - 50) {
      if (this.y > goalTop && this.y < goalBottom) return 'blue';
      this.x = width - 50; this.vx *= -1;
    }
    
    return null;
  }

  draw(ctx, beatPulse) {
    // Dynamic distortion on beat
    const currentRadius = this.radius + (beatPulse * 15);

    // Trail
    if (this.trail.length > 0) {
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for(let i=1; i<this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 + beatPulse * 0.4})`;
      ctx.lineWidth = currentRadius * 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowBlur = 10 + (beatPulse * 20);
      ctx.shadowColor = '#fff';
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.shadowBlur = 20 + (beatPulse * 40);
    ctx.shadowColor = '#ffffff';
  }
}

export class Player {
  constructor(x, y, team) {
    this.x = x;
    this.y = y;
    this.team = team;
    this.radius = 16;
    this.vx = 0;
    this.vy = 0;
    this.baseSpeed = 2.5;
    this.homeX = x;
    this.homeY = y;
    this.color = team === 'blue' ? '#00f0ff' : '#ff003c';
    this.kickCooldown = 0;
  }

  update(ball, energyLevel, aggression, particles, beatPulse) {
    const chaseRange = 150 + (aggression * 400);
    const dxBall = ball.x - this.x;
    const dyBall = ball.y - this.y;
    const distBall = Math.sqrt(dxBall*dxBall + dyBall*dyBall);
    const distHome = Math.sqrt((this.homeX - this.x)**2 + (this.homeY - this.y)**2);

    let targetX = this.homeX;
    let targetY = this.homeY;

    if (distBall < chaseRange) {
      targetX = ball.x;
      targetY = ball.y;
    } else {
      // Snapping to the beat instead of smooth dancing
      if (beatPulse > 0.5) {
        targetX = this.homeX + (Math.random() - 0.5) * 100 * energyLevel;
        targetY = this.homeY + (Math.random() - 0.5) * 100 * energyLevel;
      }
    }

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    if (dist > 5) {
      // Snap harder on beat
      const snapSteer = beatPulse > 0.5 ? 0.4 : 0.1;
      this.vx += ((dx / dist) * this.baseSpeed * energyLevel - this.vx) * snapSteer;
      this.vy += ((dy / dist) * this.baseSpeed * energyLevel - this.vy) * snapSteer;
    } else {
      this.vx *= 0.8;
      this.vy *= 0.8;
    }

    this.x += this.vx;
    this.y += this.vy;

    if (this.kickCooldown > 0) this.kickCooldown--;

    // Kick mechanics
    if (distBall < this.radius + ball.radius && this.kickCooldown <= 0) {
      this.kickCooldown = 15; // Prevent kick spam and lag
      
      const kickPower = 8 + (energyLevel * 6) + (aggression * 15) + (beatPulse * 10);
      
      const goalX = this.team === 'blue' ? 1200 : -200; 
      const goalY = 300 + (Math.random() - 0.5) * 400; // Aim randomly along the Y axis
      
      let kx = (goalX - this.x);
      let ky = (goalY - this.y) * aggression; // More aggression = wilder Y angles
      
      const kDist = Math.sqrt(kx*kx + ky*ky);
      
      ball.vx = (kx / kDist) * kickPower;
      ball.vy = (ky / kDist) * kickPower;

      // Spawn impact particles
      for(let i=0; i<10 + (beatPulse*10); i++) {
        particles.push(new Particle(ball.x, ball.y, '#ffffff'));
      }
      
      if (particles.length > 200) {
        particles.splice(0, particles.length - 200);
      }
    }
  }

  draw(ctx, beatPulse) {
    ctx.beginPath();
    // Size pops on beat
    ctx.arc(this.x, this.y, this.radius + (beatPulse * 6), 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 15 + (beatPulse * 20);
    ctx.shadowColor = this.color;
    ctx.fill();
    ctx.lineWidth = 3 + (beatPulse * 2);
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  }
}

export class GameEngine {
  constructor(canvas, analyser) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.analyser = analyser;
    this.width = canvas.width;
    this.height = canvas.height;
    
    if (this.analyser) {
      this.analyser.fftSize = 256; // Higher resolution for better bass detection
      this.analyser.smoothingTimeConstant = 0.8;
      this.analyser.minDecibels = -90;
      this.analyser.maxDecibels = -10;
      this.bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(this.bufferLength);
    }

    this.score = { blue: 0, red: 0 };
    this.particles = [];
    this.hue = 130; // Starts green
    
    // Beat Detection state
    this.beatPulse = 0;
    this.bassHistory = new Array(30).fill(0);
    this.lastBeatTime = 0;

    this.resetPitch();
  }

  resetPitch() {
    this.isResetting = false;
    this.ball = new Ball(this.width / 2, this.height / 2);
    this.players = [];
    this.particles = [];
    
    const h = this.height;
    const w = this.width;

    const bluePositions = [
      [100, h/2], 
      [300, h/4], [250, h/2], [300, h*3/4], 
      [w/2 - 200, h/3], [w/2 - 200, h*2/3],
    ];
    
    const redPositions = [
      [w - 100, h/2],
      [w - 300, h/4], [w - 250, h/2], [w - 300, h*3/4], 
      [w/2 + 200, h/3], [w/2 + 200, h*2/3],
    ];

    bluePositions.forEach(p => this.players.push(new Player(p[0], p[1], 'blue')));
    redPositions.forEach(p => this.players.push(new Player(p[0], p[1], 'red')));
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.resetPitch(); 
  }

  update() {
    let energyLevel = 1; 
    let aggression = 0.2; 
    
    if (this.analyser) {
      this.analyser.getByteFrequencyData(this.dataArray);
      let sum = 0;
      let highFrequencies = 0;
      let bass = 0;

      for(let i = 0; i < this.bufferLength; i++) {
        const val = Math.sqrt(this.dataArray[i] / 255.0) * 255.0;
        sum += val;
        
        // Bins 0-6 represent deep bass (kick drums, 808s)
        if (i < 6) bass += val;
        
        if (i > this.bufferLength / 2) highFrequencies += val; 
      }
      
      const avg = sum / this.bufferLength;
      const avgHigh = highFrequencies / (this.bufferLength / 2);
      const avgBass = bass / 6;
      
      // Beat Detection
      this.bassHistory.push(avgBass);
      this.bassHistory.shift();
      const rollingBassAvg = this.bassHistory.reduce((a, b) => a + b) / this.bassHistory.length;
      
      const now = Date.now();
      // If bass is 1.4x louder than rolling average, and a minimum volume, trigger a beat
      if (avgBass > rollingBassAvg * 1.4 && avgBass > 120 && (now - this.lastBeatTime > 250)) {
        this.beatPulse = 1.0;
        this.lastBeatTime = now;
      }
      
      this.beatPulse *= 0.85; // Rapid decay
      if (this.beatPulse < 0.01) this.beatPulse = 0;

      // Normalize to 0.0 - 1.0 range, then scale smoothly
      const normalizedAvg = avg / 255.0;
      const normalizedHigh = avgHigh / 255.0;
      
      energyLevel = 0.2 + (normalizedAvg * 2.5); 
      aggression = 0.2 + (normalizedHigh * 3.0); 
      
      // Shift hue based on bass/volume (more volume = shifts towards red/hot)
      this.hue = 130 - (normalizedAvg * 180);
      if (this.hue < 0) this.hue += 360;
    }

    if (this.isResetting) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        this.particles[i].update();
        if (this.particles[i].life <= 0) this.particles.splice(i, 1);
      }
      return;
    }

    const goal = this.ball.update(this.width, this.height, energyLevel, this.beatPulse);
    if (goal) {
      this.score[goal]++;
      // Massive particle explosion on goal
      for(let i=0; i<100; i++) {
        this.particles.push(new Particle(this.ball.x, this.ball.y, goal === 'blue' ? '#00f0ff' : '#ff003c'));
      }
      this.isResetting = true;
      setTimeout(() => {
        this.resetPitch();
      }, 2000);
      this.ball.vx = 0; this.ball.vy = 0;
      this.ball.x = -1000; // hide ball momentarily
      return;
    }

    this.players.forEach(p => p.update(this.ball, energyLevel, aggression, this.particles, this.beatPulse));

    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (this.particles[i].life <= 0) this.particles.splice(i, 1);
    }
  }

  draw() {
    // Mathematically flawless motion blur without gray ghosting
    this.ctx.globalCompositeOperation = 'destination-out';
    // Clear slightly faster on beat drops to emphasize sharp motion
    this.ctx.fillStyle = `rgba(0, 0, 0, ${0.4 + (this.beatPulse * 0.4)})`;
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.globalCompositeOperation = 'source-over'; // Reset to default for drawing
    
    // The pitch glows insanely bright on beat
    const pitchColor = `hsl(${this.hue}, 100%, ${50 + (this.beatPulse * 30)}%)`;

    // Draw audio visualizers as smooth curves
    if (this.analyser) {
      this.ctx.beginPath();
      const sliceWidth = this.width / this.bufferLength;
      let x = 0;

      // Top curve
      this.ctx.moveTo(0, 0);
      for(let i = 0; i < this.bufferLength; i++) {
        const raw = this.dataArray[i] / 255.0;
        const v = Math.sqrt(raw); // Apply non-linear curve
        const y = v * 150 + (this.beatPulse * 50); // Jump on beat
        this.ctx.lineTo(x, y);
        x += sliceWidth;
      }
      this.ctx.lineTo(this.width, 0);
      this.ctx.fillStyle = `hsla(${this.hue}, 100%, 50%, ${0.15 + (this.beatPulse * 0.2)})`;
      this.ctx.fill();

      // Bottom curve
      x = 0;
      this.ctx.beginPath();
      this.ctx.moveTo(0, this.height);
      for(let i = 0; i < this.bufferLength; i++) {
        const raw = this.dataArray[i] / 255.0;
        const v = Math.sqrt(raw); // Apply non-linear curve
        const y = this.height - (v * 150) - (this.beatPulse * 50);
        this.ctx.lineTo(x, y);
        x += sliceWidth;
      }
      this.ctx.lineTo(this.width, this.height);
      this.ctx.fillStyle = `hsla(${this.hue}, 100%, 50%, ${0.15 + (this.beatPulse * 0.2)})`;
      this.ctx.fill();
    }

    // Draw glowing pitch lines
    this.ctx.strokeStyle = pitchColor;
    this.ctx.lineWidth = 4 + (this.beatPulse * 6);
    this.ctx.shadowBlur = 15 + (this.beatPulse * 30);
    this.ctx.shadowColor = pitchColor;
    
    this.ctx.strokeRect(50, 50, this.width - 100, this.height - 100);
    this.ctx.beginPath();
    this.ctx.moveTo(this.width/2, 50);
    this.ctx.lineTo(this.width/2, this.height - 50);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.arc(this.width/2, this.height/2, 100 + (this.beatPulse * 20), 0, Math.PI*2);
    this.ctx.stroke();
    
    // Goals
    const goalH = 200 + (this.beatPulse * 50);
    this.ctx.strokeRect(0, this.height/2 - goalH/2, 50, goalH);
    this.ctx.strokeRect(this.width - 50, this.height/2 - goalH/2, 50, goalH);

    // TURN OFF SHADOW to fix massive performance lag for particles!
    this.ctx.shadowBlur = 0;
    this.particles.forEach(p => p.draw(this.ctx));
    
    this.players.forEach(p => p.draw(this.ctx, this.beatPulse));
    this.ball.draw(this.ctx, this.beatPulse);
  }
}
