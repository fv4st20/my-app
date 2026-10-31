import { Vector2 } from './math';

export class Particle {
  position: Vector2;
  velocity: Vector2;
  radius: number;
  color: string;
  alpha: number = 1;
  decay: number;
  markedForDeletion: boolean = false;

  constructor(x: number, y: number, velocity: Vector2, radius: number, color: string, decay: number = 0.02) {
    this.position = new Vector2(x, y);
    this.velocity = velocity;
    this.radius = radius;
    this.color = color;
    this.decay = decay;
  }

  update(dt: number) {
    this.position = this.position.add(this.velocity.mult(dt));
    this.velocity = this.velocity.mult(0.95); // Friction
    this.alpha -= this.decay;
    if (this.alpha <= 0) {
      this.markedForDeletion = true;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.beginPath();
    ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2, false);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.fill();
    ctx.closePath();
    ctx.restore();
  }
}

export function createExplosion(x: number, y: number, color: string, count: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 200 + 50;
    const velocity = new Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed);
    const radius = Math.random() * 3 + 1;
    particles.push(new Particle(x, y, velocity, radius, color, Math.random() * 0.02 + 0.01));
  }
  return particles;
}
