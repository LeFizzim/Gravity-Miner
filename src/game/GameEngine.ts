import Ball from './Ball';
import Block from './Block';

class GameEngine {
  ball: Ball;
  blocks: Block[];
  canvasWidth: number;
  canvasHeight: number;
  money: number = 0;
  
  gameState: 'MENU' | 'PLAYING' = 'MENU';

  // Camera/Scroll offset
  offsetY: number = -300; 
  
  // Level Generation State
  maxRowGenerated: number = 0;
  rowHeight: number = 0;

  // Geometry
  holeWidth: number = 0;
  holeLeft: number = 0;
  holeRight: number = 0;
  
  // Visuals
  dirtPattern: CanvasPattern | null = null;
  
  constructor(width: number, height: number) {
    this.canvasWidth = width;
    this.canvasHeight = height;
    
    // Define Hole Geometry
    this.updateGeometry();

    this.blocks = [];
    
    // Initialize Ball high above centered
    this.ball = new Ball(
      width / 2, 
      -200,   
      12,  
      '#ff4444', 
      (Math.random() - 0.5) * 4, 
      0, 
      0.3, 
      0.8  
    );

    // Calc constants for generation based on Hole Width
    const numColumns = 10;
    const dx = this.holeWidth / (numColumns - 1);
    const radius = dx / Math.sqrt(3);
    this.rowHeight = radius * 1.5;

    // Create Pattern
    this.initDirtPattern();

    // Initial generation
    this.generateRows(0, 40);
  }
  
  initDirtPattern() {
      const pCanvas = document.createElement('canvas');
      pCanvas.width = 64;
      pCanvas.height = 64;
      const ctx = pCanvas.getContext('2d');
      if (!ctx) return;

      // Base
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(0, 0, 64, 64);

      // Noise
      for (let i = 0; i < 40; i++) {
          const x = Math.random() * 64;
          const y = Math.random() * 64;
          const size = Math.random() * 3 + 1;
          // Dark specks
          ctx.fillStyle = 'rgba(0,0,0,0.1)';
          ctx.fillRect(x, y, size, size);
          
          // Light specks
          const x2 = Math.random() * 64;
          const y2 = Math.random() * 64;
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(x2, y2, size, size);
      }
      
      this.dirtPattern = ctx.createPattern(pCanvas, 'repeat');
  }
  
  updateGeometry() {
    this.holeWidth = this.canvasWidth / 3;
    this.holeLeft = this.canvasWidth / 3;
    this.holeRight = this.holeLeft + this.holeWidth;
  }

  generateRows(startRow: number, count: number) {
    const numColumns = 10;
    // dx and radius based on holeWidth
    const dx = this.holeWidth / (numColumns - 1);
    const radius = dx / Math.sqrt(3);
    const dy = this.rowHeight;
    const startY = 250; // Started lower (below grass line at 200)

    for (let r = startRow; r < startRow + count; r++) {
        for (let c = 0; c < numColumns; c++) {
            const xOffset = (r % 2 === 0) ? 0 : -dx / 2;
            
            // cx is relative to hole start
            let cx = c * dx + xOffset;
            
            // Shift to hole position
            let finalX = cx + this.holeLeft;
            let finalY = startY + r * dy;

            // Ensure we stay within visual bounds of the hole mostly
            // Allow slightly outside for the "half block" effect
            if (finalX < this.holeLeft - dx || finalX > this.holeRight + dx) continue;

            const hue = (r * 10) % 360;
            const color = `hsl(${hue}, 60%, 50%)`;

            this.blocks.push(new Block(
                finalX,
                finalY,
                radius - 1, 
                1 + Math.floor(r * 0.2), 
                10 + Math.floor(r * 0.5), 
                color
            ));
        }
    }
    this.maxRowGenerated = startRow + count;
  }

  update() {
    if (this.gameState === 'MENU') {
        return;
    }

    this.ball.update({ width: this.canvasWidth, height: this.canvasHeight } as HTMLCanvasElement);
    
    // Hole Wall Collisions
    if (this.ball.x - this.ball.radius < this.holeLeft) {
        this.ball.x = this.holeLeft + this.ball.radius;
        this.ball.dx *= -this.ball.elasticity;
    }
    if (this.ball.x + this.ball.radius > this.holeRight) {
        this.ball.x = this.holeRight - this.ball.radius;
        this.ball.dx *= -this.ball.elasticity;
    }

    // Camera follow
    const targetY = this.ball.y - this.canvasHeight / 3;
    if (targetY > this.offsetY) {
         this.offsetY = this.offsetY + (targetY - this.offsetY) * 0.1;
    }
    
    // Infinite Generation
    let currentDeepestY = 250 + this.maxRowGenerated * this.rowHeight;
    while (this.offsetY + this.canvasHeight * 5 > currentDeepestY) {
        this.generateRows(this.maxRowGenerated, 50);
        currentDeepestY = 250 + this.maxRowGenerated * this.rowHeight;
    }

    // Check collisions
    for (let i = this.blocks.length - 1; i >= 0; i--) {
      const block = this.blocks[i];
      if (Math.abs(block.y - this.ball.y) > 200 || Math.abs(block.x - this.ball.x) > 200) continue;

      if (this.checkCollision(this.ball, block)) {
        const destroyed = block.takeDamage(1);
        if (destroyed) {
          this.blocks.splice(i, 1);
          this.money += block.value;
        }
      }
    }
  }

  draw(context: CanvasRenderingContext2D) {
    context.save();
    context.translate(0, -this.offsetY);

    this.drawEnvironment(context);

    // Clip to hole for blocks and ball
    context.save();
    context.beginPath();
    // Clip rect: Hole area, extended infinitely up and down (in world space)
    context.rect(this.holeLeft, -100000, this.holeWidth, 200000);
    context.clip();

    this.blocks.forEach(block => {
        if (block.y - this.offsetY > this.canvasHeight + 500 || block.y - this.offsetY < -500) return;
        // Pass bounds for text hiding
        block.draw(context, 0, this.holeLeft, this.holeRight);
    });
    this.ball.draw(context);
    
    context.restore(); // Remove clip
    
    context.restore(); // Remove translate
    
    if (this.gameState === 'MENU') {
        this.drawTitleScreen(context);
    } else {
        // Draw HUD (Top Right)
        const hudW = 200;
        const hudH = 80;
        const hudX = this.canvasWidth - hudW - 20;
        const hudY = 20;

        // Rounded Rect Background
        context.fillStyle = 'rgba(50, 50, 50, 0.8)';
        context.beginPath();
        context.roundRect(hudX, hudY, hudW, hudH, 10);
        context.fill();

        // Text
        context.fillStyle = 'white';
        context.font = '20px Arial';
        context.textAlign = 'left';
        context.fillText(`Depth: ${Math.max(0, Math.floor((this.ball.y - 200) / 100))}m`, hudX + 20, hudY + 35);
        context.fillText(`Money: $${this.money}`, hudX + 20, hudY + 65);
    }
  }

  drawEnvironment(context: CanvasRenderingContext2D) {
    const groundY = 200;
    const cornerRadius = 20;
    const borderColor = '#333333'; // Dark grey for borders
    const borderWidth = 2;
    
    // Sky (Full Width)
    context.fillStyle = '#87CEEB';
    context.fillRect(0, -10000, this.canvasWidth, 10000 + groundY + 100); 

    // Hole Background (Darker Brown - textured)
    context.fillStyle = this.dirtPattern || '#4A2C2A'; // Use pattern, fallback to solid dark brown
    context.fillRect(this.holeLeft, groundY, this.holeWidth, 1000000);
    // Overlay a semi-transparent dark color to make it darker than the walls
    context.fillStyle = 'rgba(0, 0, 0, 0.3)'; // Adjust alpha for desired darkness
    context.fillRect(this.holeLeft, groundY, this.holeWidth, 1000000);

    // Dirt Walls (Straight, no rounding)
    context.fillStyle = this.dirtPattern || '#5d4037'; 
    context.fillRect(0, groundY, this.holeLeft, 1000000); 
    context.fillRect(this.holeRight, groundY, this.canvasWidth - this.holeRight, 1000000);

    // Dirt Wall Borders (Vertical lines emphasizing the hole)
    context.strokeStyle = borderColor;
    context.lineWidth = borderWidth;
    context.beginPath();
    context.moveTo(this.holeLeft, groundY);
    context.lineTo(this.holeLeft, 1000000); // Left wall inner border
    context.moveTo(this.holeRight, groundY);
    context.lineTo(this.holeRight, 1000000); // Right wall inner border
    context.stroke();
    
    // Grass Top (with rounded corners and borders)
    context.fillStyle = '#4caf50'; // Green
    context.strokeStyle = borderColor; 
    context.lineWidth = borderWidth;
    
    // Left Grass Fill and Stroke
    context.beginPath();
    context.moveTo(0, groundY - 20); // Top-left of grass
    context.lineTo(this.holeLeft - cornerRadius, groundY - 20); // To start of curve
    // The rounded part: from (holeLeft - cornerRadius, groundY - 20) to (holeLeft, groundY)
    // Control point at (holeLeft, groundY - 20)
    context.quadraticCurveTo(this.holeLeft, groundY - 20, this.holeLeft, groundY); 
    context.lineTo(0, groundY); // Bottom-left corner
    context.closePath();
    context.fill();
    context.stroke(); // Apply border to the entire shape

    // Right Grass Fill and Stroke
    context.beginPath();
    context.moveTo(this.canvasWidth, groundY - 20); // Top-right of grass
    context.lineTo(this.holeRight + cornerRadius, groundY - 20); // To start of curve
    // The rounded part: from (holeRight + cornerRadius, groundY - 20) to (holeRight, groundY)
    // Control point at (holeRight, groundY - 20)
    context.quadraticCurveTo(this.holeRight, groundY - 20, this.holeRight, groundY);
    context.lineTo(this.canvasWidth, groundY); // Bottom-right corner
    context.closePath();
    context.fill();
    context.stroke(); // Apply border to the entire shape

    // Top horizontal border segments (above grass sections)
    context.beginPath();
    context.moveTo(0, groundY - 20);
    context.lineTo(this.holeLeft - cornerRadius, groundY - 20);
    context.stroke();
    
    context.beginPath();
    context.moveTo(this.holeRight + cornerRadius, groundY - 20);
    context.lineTo(this.canvasWidth, groundY - 20);
    context.stroke();
  }

  drawTitleScreen(context: CanvasRenderingContext2D) {
    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Box dimensions
    const boxW = 500;
    const boxH = 200;
    const boxX = this.canvasWidth / 2 - boxW / 2;
    const boxY = this.canvasHeight / 2 - boxH / 2 - 100; // Moved 100px higher

    // Rounded Grey Box
    context.fillStyle = 'rgba(50, 50, 50, 0.9)';
    context.beginPath();
    context.roundRect(boxX, boxY, boxW, boxH, 15);
    context.fill();

    // Title
    context.fillStyle = 'white';
    context.font = '36px Arial';
    context.textAlign = 'center';
    context.fillText("LeFizzim's Gravity Miner", this.canvasWidth / 2, boxY + 60);

    // Start Button
    const btnW = 200;
    const btnH = 50;
    const btnX = this.canvasWidth / 2 - btnW / 2;
    const btnY = boxY + 100; // Reduced gap

    context.fillStyle = '#4caf50';
    context.beginPath();
    context.roundRect(btnX, btnY, btnW, btnH, 5);
    context.fill();
    
    context.fillStyle = 'white';
    context.font = '24px Arial';
    // Centered text in button
    context.fillText("START", this.canvasWidth / 2, btnY + 33);
  }

  handleClick(x: number, y: number) {
    if (this.gameState === 'MENU') {
        const btnW = 200;
        const btnH = 50;
        const boxH = 200;
        // Match the drawing logic:
        const boxY = this.canvasHeight / 2 - boxH / 2 - 100;
        const btnY = boxY + 100;
        const btnX = this.canvasWidth / 2 - btnW / 2;

        if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
            this.gameState = 'PLAYING';
            this.ball.dx = (Math.random() - 0.5) * 4;
            this.ball.dy = 5;
        }
    }
  }

  checkCollision(ball: Ball, block: Block): boolean {
    const vertices = block.getVertices();
    const distSq = (ball.x - block.x)**2 + (ball.y - block.y)**2;
    if (distSq > (block.radius + ball.radius)**2) return false;

    let closestDistSq = Infinity;
    let closestPoint = { x: 0, y: 0 };

    for (let i = 0; i < 6; i++) {
        const p1 = vertices[i];
        const p2 = vertices[(i + 1) % 6]; 
        const edgeX = p2.x - p1.x;
        const edgeY = p2.y - p1.y;
        const lenSq = edgeX*edgeX + edgeY*edgeY;
        const t = Math.max(0, Math.min(1, ((ball.x - p1.x) * edgeX + (ball.y - p1.y) * edgeY) / lenSq));
        const projX = p1.x + t * edgeX;
        const projY = p1.y + t * edgeY;
        const dX = ball.x - projX;
        const dY = ball.y - projY;
        const dSq = dX*dX + dY*dY;

        if (dSq < closestDistSq) {
            closestDistSq = dSq;
            closestPoint = { x: projX, y: projY };
        }
    }

    if (closestDistSq < ball.radius * ball.radius) {
        const dist = Math.sqrt(closestDistSq);
        let nx = (ball.x - closestPoint.x);
        let ny = (ball.y - closestPoint.y);
        
        if (dist === 0) { nx = 0; ny = -1; } 
        else { nx /= dist; ny /= dist; }

        const overlap = ball.radius - dist;
        ball.x += nx * overlap;
        ball.y += ny * overlap;

        const dot = ball.dx * nx + ball.dy * ny;
        if (dot < 0) {
            ball.dx = (ball.dx - 2 * dot * nx) * ball.elasticity;
            ball.dy = (ball.dy - 2 * dot * ny) * ball.elasticity;
            ball.dx += (Math.random() - 0.5) * 0.5;
        }
        return true;
    }
    return false;
  }
}

export default GameEngine;
