class Ball {
  x: number;
  y: number;
  radius: number;
  color: string;
  dx: number; // velocity x
  dy: number; // velocity y
  gravity: number;
  elasticity: number; // bounciness
  damage: number;

  constructor(x: number, y: number, radius: number, color: string, dx: number, dy: number, gravity: number, elasticity: number, damage: number = 1) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.color = color;
    this.dx = dx;
    this.dy = dy;
    this.gravity = gravity;
    this.elasticity = elasticity;
    this.damage = damage;
  }

  update(canvas: HTMLCanvasElement, timeScale: number = 1) {
    // Apply gravity scaled by time
    this.dy += this.gravity * timeScale;
    
    // Apply velocity scaled by time
    this.y += this.dy * timeScale;
    this.x += this.dx * timeScale;

    // Boundary collision detection and response (walls)
    if (this.x + this.radius > canvas.width || this.x - this.radius < 0) {
      this.dx *= -this.elasticity;
      // Keep ball within bounds
      if (this.x + this.radius > canvas.width) {
        this.x = canvas.width - this.radius;
      } else if (this.x - this.radius < 0) {
        this.x = this.radius;
      }
    }
  }

  draw(context: CanvasRenderingContext2D) {
    context.beginPath();
    context.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
    context.fillStyle = this.color;
    context.fill();
    context.closePath();
  }
}

export default Ball;
