import { Vector2, Matrix2 } from './math';

export interface Renderable {
  draw(ctx: CanvasRenderingContext2D): void;
}

export interface Updatable {
  update(dt: number, projectiles?: Projectile[]): void;
}

export abstract class Entity implements Renderable, Updatable {
  position: Vector2;
  velocity: Vector2;
  radius: number;
  color: string;
  markedForDeletion: boolean = false;

  constructor(x: number, y: number, radius: number, color: string) {
    this.position = new Vector2(x, y);
    this.velocity = new Vector2(0, 0);
    this.radius = radius;
    this.color = color;
  }

  update(dt: number, _projectiles?: Projectile[]): void {
    this.position = this.position.add(this.velocity.mult(dt));
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2, false);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 0; // Disabled for performance
    ctx.fill();
    ctx.closePath();
  }

  checkCollision(other: Entity): boolean {
    const dist = this.position.sub(other.position).mag();
    return dist < this.radius + other.radius;
  }
}

export class Player extends Entity {
  angle: number = 0;
  
  constructor(x: number, y: number) {
    super(x, y, 15, '#00f3ff');
  }

  updateAngle(mouseX: number, mouseY: number) {
    const dy = mouseY - this.position.y;
    const dx = mouseX - this.position.x;
    this.angle = Math.atan2(dy, dx);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.position.x, this.position.y);
    ctx.rotate(this.angle);
    
    // Draw player ship (triangle)
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-10, 15);
    ctx.lineTo(-10, -15);
    ctx.closePath();
    
    ctx.fillStyle = this.color;
    ctx.fill();
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.restore();
  }
}

export class Projectile extends Entity {
  constructor(x: number, y: number, velocity: Vector2) {
    super(x, y, 5, '#00f3ff');
    this.velocity = velocity;
  }
}

export class Enemy extends Entity {
  health: number = 1;
  value: number = 10;
  payload: string = '';
  matrix: Matrix2;
  target: Vector2;
  speed: number;
  history: Vector2[] = [];
  
  constructor(x: number, y: number, target: Vector2, speed: number, radius: number, color: string, payload: string = '', dataSize: number = 500) {
    super(x, y, radius, color);
    this.target = target;
    this.speed = speed;
    const dir = target.sub(this.position).normalize();
    this.velocity = dir.mult(speed);
    this.payload = payload;
    
    // Scale matrix strength by the raw data size of the Wikipedia edit
    const scale = Math.max(0.5, dataSize / 1000); // 1.0 is ~1KB edit
    
    // Initialize with a Transformation Matrix for combat
    this.matrix = new Matrix2(
      (Math.random() * 2 - 1) * scale,
      (Math.random() * 2 - 1) * scale,
      (Math.random() * 2 - 1) * scale,
      (Math.random() * 2 - 1) * scale
    );
  }

  update(dt: number, projectiles?: Projectile[]): void {
    // Gradient Descent Evasion
    // Loss = Distance to Core (minimize) - Distance to Projectiles (maximize)
    let gradX = 0;
    let gradY = 0;

    // Gradient pulling towards target (Core)
    const toTarget = this.target.sub(this.position);
    gradX += toTarget.x * 0.05;
    gradY += toTarget.y * 0.05;

    // Gradient pushing away from projectiles
    if (projectiles) {
      for (const p of projectiles) {
        const toProj = p.position.sub(this.position);
        const dist = toProj.mag();
        if (dist < 150) { // Only evade if close
          // Inverse square law repulsion for gradient
          const repelForce = 1000 / (dist * dist + 1);
          gradX -= toProj.x * repelForce;
          gradY -= toProj.y * repelForce;
        }
      }
    }

    // Apply gradient to velocity
    const desiredVelocity = new Vector2(gradX, gradY).normalize().mult(this.speed);
    
    // Smooth turning (learning rate)
    this.velocity.x += (desiredVelocity.x - this.velocity.x) * 0.1;
    this.velocity.y += (desiredVelocity.y - this.velocity.y) * 0.1;

    // Track path history for infinite trail rendering
    if (this.history.length === 0 || this.position.sub(this.history[0]).mag() > 2) {
      this.history.unshift(new Vector2(this.position.x, this.position.y));
    }

    super.update(dt);
  }
}

export class Core extends Entity {
  constructor(x: number, y: number) {
    super(x, y, 30, '#9d00ff');
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Pulse effect
    const pulse = Math.sin(Date.now() * 0.005) * 5;
    
    ctx.beginPath();
    ctx.arc(this.position.x, this.position.y, this.radius + pulse, 0, Math.PI * 2, false);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 30 + pulse * 2;
    ctx.shadowColor = this.color;
    ctx.fill();
    ctx.closePath();
    
    // Inner core
    ctx.beginPath();
    ctx.arc(this.position.x, this.position.y, this.radius - 10, 0, Math.PI * 2, false);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.closePath();
    ctx.shadowBlur = 0;
  }
}

export interface Electron {
  angle: number;
  shell: number;
  distance: number;
  speed: number;
  bindingEnergy: number;
  maxBindingEnergy: number;
}

export const PERIODIC_TABLE = [
  { z: 1, symbol: 'H' }, { z: 2, symbol: 'He' }, { z: 3, symbol: 'Li' }, { z: 4, symbol: 'Be' },
  { z: 5, symbol: 'B' }, { z: 6, symbol: 'C' }, { z: 7, symbol: 'N' }, { z: 8, symbol: 'O' },
  { z: 9, symbol: 'F' }, { z: 10, symbol: 'Ne' }, { z: 11, symbol: 'Na' }, { z: 12, symbol: 'Mg' },
  { z: 13, symbol: 'Al' }, { z: 14, symbol: 'Si' }, { z: 15, symbol: 'P' }, { z: 16, symbol: 'S' },
  { z: 17, symbol: 'Cl' }, { z: 18, symbol: 'Ar' }, { z: 19, symbol: 'K' }, { z: 20, symbol: 'Ca' },
  { z: 21, symbol: 'Sc' }, { z: 22, symbol: 'Ti' }, { z: 23, symbol: 'V' }, { z: 24, symbol: 'Cr' },
  { z: 25, symbol: 'Mn' }, { z: 26, symbol: 'Fe' } // Stop at Iron for reasonable difficulty
];

export class AtomicBoss extends Entity {
  atomicNumber: number;
  symbol: string;
  electrons: Electron[] = [];
  target: Vector2;
  pixiText?: any;
  value: number;
  
  constructor(x: number, y: number, target: Vector2, atomicNumber: number, symbol: string) {
    super(x, y, 70, '#ff0055');
    this.value = 10 * atomicNumber;
    this.atomicNumber = atomicNumber;
    this.symbol = symbol;
    this.target = target;
    this.velocity = target.sub(this.position).normalize().mult(15); // Slow, imposing movement
    
    // Populate shells based on atomic number
    let remaining = atomicNumber;
    const shellCapacities = [2, 8, 18, 32];
    let currentShell = 0;
    
    while (remaining > 0) {
      const capacity = shellCapacities[currentShell] || 32;
      const inThisShell = Math.min(remaining, capacity);
      
      // Calculate binding energy for this shell: Math.ceil( Z / (n) )
      const n = currentShell + 1; // Principal quantum number
      const energy = Math.max(1, Math.ceil(atomicNumber / n));
      
      for (let i = 0; i < inThisShell; i++) {
        this.electrons.push({
          angle: (Math.PI * 2 / inThisShell) * i,
          shell: currentShell,
          distance: 90 + currentShell * 35, // Distance from nucleus
          speed: (1.5 - currentShell * 0.2) * (i % 2 === 0 ? 1 : -1), // Alternate orbit directions
          bindingEnergy: energy,
          maxBindingEnergy: energy
        });
      }
      
      remaining -= inThisShell;
      currentShell++;
    }
  }

  update(dt: number): void {
    // Basic straight movement towards core (relentless force)
    super.update(dt);
    
    // Update electron orbits
    for (const e of this.electrons) {
      e.angle += e.speed * dt;
    }
  }
}
