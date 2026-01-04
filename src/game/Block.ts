class Block {
  x: number; // Center x
  y: number; // Center y
  radius: number;
  hp: number;
  maxHp: number;
  value: number;
  color: string;
  row: number;
  col: number;
  type: 'normal' | 'bitBooster' | 'explosive';
  typeRolled: boolean; // Whether this block has been checked for special type

  constructor(x: number, y: number, radius: number, hp: number, value: number, color: string, row: number, col: number, type: 'normal' | 'bitBooster' | 'explosive' = 'normal') {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.hp = hp;
    this.maxHp = hp;
    this.value = value;
    this.color = color;
    this.row = row;
    this.col = col;
    this.type = type;
    this.typeRolled = false;
  }

  draw(context: CanvasRenderingContext2D, offsetY: number = 0, minX: number = -Infinity, maxX: number = Infinity, showHp: boolean = true) {
    const { x, y, radius, color } = this;
    const drawY = y - offsetY;

    context.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i + 30); // 30 degrees offset for flat-topped
      const vx = x + radius * Math.cos(angle);
      const vy = drawY + radius * Math.sin(angle);
      if (i === 0) {
        context.moveTo(vx, vy);
      } else {
        context.lineTo(vx, vy);
      }
    }
    context.closePath();

    context.fillStyle = color;
    context.fill();

    // Border
    context.strokeStyle = 'rgba(0,0,0,0.1)';
    context.lineWidth = 2;
    context.stroke();

    // Special block glowing outlines
    if (this.type === 'bitBooster') {
      // Draw multiple strokes for glow effect
      context.save();
      context.lineWidth = 6;
      context.strokeStyle = 'rgba(255, 165, 0, 0.5)'; // Outer glow
      context.stroke();
      context.lineWidth = 4;
      context.strokeStyle = '#FF8C00'; // Main orange border
      context.stroke();
      context.lineWidth = 2;
      context.strokeStyle = '#FFD700'; // Inner bright line
      context.stroke();
      context.restore();
    } else if (this.type === 'explosive') {
      // Draw multiple strokes for glow effect
      context.save();
      context.lineWidth = 6;
      context.strokeStyle = 'rgba(255, 0, 0, 0.5)'; // Outer glow
      context.stroke();
      context.lineWidth = 4;
      context.strokeStyle = '#FF0000'; // Main red border
      context.stroke();
      context.lineWidth = 2;
      context.strokeStyle = '#FF6666'; // Inner bright line
      context.stroke();
      context.restore();
    }

    // Damage overlay
    const damageRatio = 1 - (this.hp / this.maxHp);
    if (damageRatio > 0) {
      context.fillStyle = `rgba(0, 0, 0, ${damageRatio * 0.6})`;
      context.fill();
    }
    
    // HP Text
    // Only draw if center is within bounds (with a small buffer so text doesn't clip awkwardly)
    if (showHp && this.radius > 15 && x > minX + 10 && x < maxX - 10) {
        context.fillStyle = 'rgba(255,255,255,0.8)';
        context.font = `${Math.floor(this.radius/2.5)}px Arial`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(Math.ceil(this.hp).toString(), x, drawY);
    }
  }

  takeDamage(amount: number): boolean {
    this.hp -= amount;
    return this.hp <= 0;
  }

  // Returns array of 6 vertices {x, y}
  getVertices(): {x: number, y: number}[] {
    const vertices = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i + 30);
      vertices.push({
        x: this.x + this.radius * Math.cos(angle),
        y: this.y + this.radius * Math.sin(angle)
      });
    }
    return vertices;
  }
}

export default Block;
