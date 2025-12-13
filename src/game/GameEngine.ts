import Ball from './Ball';
import Block from './Block';

class GameEngine {
  ball: Ball;
  blocks: Block[];
  canvasWidth: number;
  canvasHeight: number;
  money: number = 0;
  
  gameState: 'MENU' | 'PLAYING' | 'PAUSED' = 'MENU';
  isMouseDown: boolean = false; // Track mouse state
  isResizing: boolean = false; // Track resize state

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
    
    // Calc constants for generation based on Hole Width
    const numColumns = 10;
    const dx = this.holeWidth / (numColumns - 1);
    const radius = dx / Math.sqrt(3); // Base radius of block hex
    this.rowHeight = radius * 1.5;

    // Initialize Ball high above centered
    this.ball = new Ball(
      width / 2, 
      -200,   
      radius * 0.3,  // Dynamic ball radius (reduced by 50%)
      '#ff4444', 
      (Math.random() - 0.5) * 4, 
      0, 
      radius * 0.02, // Dynamic Gravity 
      0.8  
    );


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
    this.holeWidth = this.canvasWidth / 2; // 50% width
    this.holeLeft = (this.canvasWidth - this.holeWidth) / 2; // Centered
    this.holeRight = this.holeLeft + this.holeWidth;
  }

  resize(width: number, height: number) {
      // Store old metrics
      const oldRowHeight = this.rowHeight;
      const oldRadius = oldRowHeight / 1.5;
      const oldStartY = 200 + oldRadius + 20;
      
      const oldHoleLeft = this.holeLeft;
      const oldHoleWidth = this.holeWidth;
      const oldCanvasWidth = this.canvasWidth; // Store old width

      // Update Dimensions
      this.canvasWidth = width;
      this.canvasHeight = height;
      this.updateGeometry();

      // Recalculate new constants
      const numColumns = 10;
      const dx = this.holeWidth / (numColumns - 1);
      const radius = dx / Math.sqrt(3);
      this.rowHeight = radius * 1.5;
      
      const newStartY = 200 + radius + 20;

      // Update Ball radius
      this.ball.radius = radius * 0.3;

      // Precise Remapping
      if (oldRowHeight > 1) {
          // Vertical
          const ballRowIndex = (this.ball.y - oldStartY) / oldRowHeight;
          this.ball.y = newStartY + ballRowIndex * this.rowHeight;

          // Horizontal (Ball)
          if (oldHoleWidth > 0) {
              const ballRelX = this.ball.x - oldHoleLeft;
              const ratioX = this.holeWidth / oldHoleWidth;
              this.ball.x = this.holeLeft + ballRelX * ratioX;
          }

          // Scale Velocity based on Radius change
          // Instead of simple ratio scaling which can drift, we Normalize energy relative to block size.
          if (oldRadius > 0) {
              const currentSpeed = Math.sqrt(this.ball.dx * this.ball.dx + this.ball.dy * this.ball.dy);
              const normalizedSpeed = currentSpeed / oldRadius;
              
              // New target speed
              let newSpeed = normalizedSpeed * radius;
              
              // Clamp speed to prevent explosions (Max speed = 1 block radius per frame)
              const maxSafeSpeed = radius * 1.0;
              if (newSpeed > maxSafeSpeed) newSpeed = maxSafeSpeed;

              // Preserve direction
              if (currentSpeed > 0.001) {
                  this.ball.dx = (this.ball.dx / currentSpeed) * newSpeed;
                  this.ball.dy = (this.ball.dy / currentSpeed) * newSpeed;
              }
          }
          
          this.ball.gravity = radius * 0.02; // Increased gravity for better feel

          // Reset camera to follow ball immediately to prevent culling issues
          this.offsetY = this.ball.y - this.canvasHeight / 3;
      }

      // Update existing blocks
      this.blocks.forEach(block => {
          block.radius = radius - 1; 
          
          const xOffset = (block.row % 2 === 0) ? 0 : -dx / 2;
          const cx = block.col * dx + xOffset;
          
          block.x = cx + this.holeLeft;
          block.y = newStartY + block.row * this.rowHeight;
      });
  }

  generateRows(startRow: number, count: number) {
    const numColumns = 10;
    // dx and radius based on holeWidth
    const dx = this.holeWidth / (numColumns - 1);
    const radius = dx / Math.sqrt(3);
    const dy = this.rowHeight;
    // Ensure blocks start below the ground (200) + radius buffer
    const startY = 200 + radius + 20; 

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
                color,
                r, // Row
                c  // Col
            ));
        }
    }
    this.maxRowGenerated = startRow + count;
  }

  update(dt: number) {
    if (this.gameState === 'MENU' || this.gameState === 'PAUSED' || this.isResizing) {
        return;
    }

    const timeScale = dt / 16.667; // Normalize to 60fps (16.667ms per frame)

    this.ball.update({ width: this.canvasWidth, height: this.canvasHeight } as HTMLCanvasElement, timeScale);
    
    // Clamp velocity to prevent physics instability
    // Limit speed to roughly 80% of a block radius per frame
    const maxVelocity = (this.rowHeight / 1.5) * 0.8; 
    if (this.ball.dy > maxVelocity) this.ball.dy = maxVelocity;
    if (this.ball.dy < -maxVelocity) this.ball.dy = -maxVelocity;
    if (this.ball.dx > maxVelocity) this.ball.dx = maxVelocity;
    if (this.ball.dx < -maxVelocity) this.ball.dx = -maxVelocity;

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
    } else if (this.gameState === 'PAUSED') {
        this.drawPauseScreen(context);
    } else {
        // Draw HUD (Top Right)
        const hudW = 200;
        const hudH = 80;
        const hudX = this.canvasWidth - hudW - 20;
        const hudY = 20;

        // Rounded Rect Background for Stats
        context.fillStyle = 'rgba(50, 50, 50, 0.8)';
        context.beginPath();
        context.roundRect(hudX, hudY, hudW, hudH, 10);
        context.fill();

        // Stats Text
        context.fillStyle = 'white';
        context.font = '20px "Fredoka One", cursive';
        context.textAlign = 'left';
        context.fillText(`Depth: ${Math.max(0, Math.floor((this.ball.y - 200) / 100))}m`, hudX + 20, hudY + 35);
        context.fillText(`Money: $${this.money}`, hudX + 20, hudY + 65);

        // Draw Pause Button (Top Left)
        const pauseBtnSize = 60;
        const pauseBtnX = 20;
        const pauseBtnY = 20;

        // Rounded Rect Background for Pause
        context.fillStyle = 'rgba(50, 50, 50, 0.8)';
        context.beginPath();
        context.roundRect(pauseBtnX, pauseBtnY, pauseBtnSize, pauseBtnSize, 10);
        context.fill();

        // Pause Icon (Two vertical bars)
        context.fillStyle = 'white';
        const barW = 8;
        const barH = 24;
        const barGap = 10;
        const centerX = pauseBtnX + pauseBtnSize / 2;
        const centerY = pauseBtnY + pauseBtnSize / 2;
        
        context.beginPath();
        context.roundRect(centerX - barGap/2 - barW, centerY - barH/2, barW, barH, 2);
        context.roundRect(centerX + barGap/2, centerY - barH/2, barW, barH, 2);
        context.fill();
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
    const boxH = 250; // Increased height
    const boxX = this.canvasWidth / 2 - boxW / 2;
    const boxY = this.canvasHeight / 2 - boxH / 2 - 180;

    // Rounded Grey Box with Border
    const borderColor = '#1A1A1A'; // Darker grey for border
    const borderWidth = 2;
    context.fillStyle = 'rgba(50, 50, 50, 0.9)';
    context.strokeStyle = borderColor;
    context.lineWidth = borderWidth;
    
    context.beginPath();
    context.roundRect(boxX, boxY, boxW, boxH, 15);
    context.fill();
    context.stroke(); // Draw border

    // Layout Calculations for Centering
    const title1 = "LeFizzim's";
    const title2 = "Gravity Miner";
    const titleLineHeight = 50; 
    const btnHeight = 55; // 50 button + 5 shadow
    const gap = 25; // Space between title block and button
    
    // Calculate total height of content
    const totalContentHeight = titleLineHeight * 2 + gap + btnHeight; 
    
    const centerY = boxY + boxH / 2;
    // Visual correction: Shift content UP to reduce top margin
    const startY = centerY - totalContentHeight / 2 - 15; 
    
    const title1Y = startY + titleLineHeight / 2 + 10; 
    const title2Y = startY + titleLineHeight + titleLineHeight / 2 + 10; 
    const btnY = startY + titleLineHeight * 2 + gap;

    // Title Text (Split and Shadowed)
    context.fillStyle = 'white';
    context.textAlign = 'center';
    
    // LeFizzim's (Fredoka One, Italic, Lighter)
    context.font = 'italic 24px "Fredoka One", cursive';
    context.fillStyle = '#dddddd';
    context.fillText(title1, this.canvasWidth / 2, title1Y);

    // Gravity Miner (Fredoka One, Big, Shadowed)
    context.shadowColor = 'rgba(0, 0, 0, 0.8)';
    context.shadowBlur = 8; 
    context.shadowOffsetX = 3; 
    context.shadowOffsetY = 3; 
    
    context.font = '48px "Fredoka One", cursive';
    context.strokeStyle = borderColor; 
    context.lineWidth = borderWidth;   
    context.strokeText(title2, this.canvasWidth / 2, title2Y); // Draw outline first
    context.fillStyle = 'white'; // Set fill style to white
    context.fillText(title2, this.canvasWidth / 2, title2Y); // Then draw the white fill

    context.shadowBlur = 0; // Reset shadow
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;

    // Start Button
    const btnW = 200;
    const btnH = 50;
    const btnX = this.canvasWidth / 2 - btnW / 2;
    
    const btnOffset = this.isMouseDown ? 3 : 0; // Shift button down if pressed

    // 3D Shadow (Darker Green)
    context.fillStyle = '#2e7d32'; 
    context.beginPath();
    context.roundRect(btnX, btnY + 5, btnW, btnH, 5); // Shadow always there
    context.fill();

    // Main Button Face (Lighter Green)
    context.fillStyle = '#4caf50';
    context.beginPath();
    context.roundRect(btnX, btnY + btnOffset, btnW, btnH, 5); // Apply offset if pressed
    context.fill();
    
    context.fillStyle = 'white';
    context.font = '30px "Fredoka One", cursive';
    context.shadowColor = 'rgba(0,0,0,0.5)';
    context.shadowBlur = 2;
    context.fillText("START", this.canvasWidth / 2, btnY + 35 + btnOffset); // Apply offset to text
    context.shadowBlur = 0;
  }

  drawPauseScreen(context: CanvasRenderingContext2D) {
    context.fillStyle = 'rgba(0, 0, 0, 0.5)'; // Darken background less than main menu
    context.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Box dimensions (Same as Title Screen)
    const boxW = 500;
    const boxH = 250; 
    const boxX = this.canvasWidth / 2 - boxW / 2;
    const boxY = this.canvasHeight / 2 - boxH / 2 - 100; // Keep slightly higher position

    // Rounded Grey Box
    const borderColor = '#1A1A1A'; 
    const borderWidth = 2;
    context.fillStyle = 'rgba(50, 50, 50, 0.9)';
    context.strokeStyle = borderColor;
    context.lineWidth = borderWidth;
    
    context.beginPath();
    context.roundRect(boxX, boxY, boxW, boxH, 15);
    context.fill();
    context.stroke();

    // Text "PAUSED"
    const titleText = "PAUSED";
    const titleLineHeight = 60; // Single line title here
    const btnHeight = 55; 
    const gap = 30; 
    
    // Content Height: Title + Gap + Button
    const totalContentHeight = titleLineHeight + gap + btnHeight; 
    
    const centerY = boxY + boxH / 2;
    const startY = centerY - totalContentHeight / 2; // Center it vertically
    
    const titleY = startY + titleLineHeight / 2 + 10;
    const btnY = startY + titleLineHeight + gap;

    context.textAlign = 'center';
    context.shadowColor = 'rgba(0, 0, 0, 0.8)';
    context.shadowBlur = 8; 
    context.shadowOffsetX = 3; 
    context.shadowOffsetY = 3; 
    
    context.font = '48px "Fredoka One", cursive';
    context.strokeStyle = borderColor; 
    context.lineWidth = borderWidth;   
    context.strokeText(titleText, this.canvasWidth / 2, titleY); 
    context.fillStyle = 'white'; 
    context.fillText(titleText, this.canvasWidth / 2, titleY); 

    context.shadowBlur = 0; 
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;

    // Resume Button
    const btnW = 200;
    const btnH = 50;
    const btnX = this.canvasWidth / 2 - btnW / 2;
    
    const btnOffset = this.isMouseDown ? 3 : 0; 

    // Shadow
    context.fillStyle = '#2e7d32'; 
    context.beginPath();
    context.roundRect(btnX, btnY + 5, btnW, btnH, 5); 
    context.fill();

    // Face
    context.fillStyle = '#4caf50';
    context.beginPath();
    context.roundRect(btnX, btnY + btnOffset, btnW, btnH, 5); 
    context.fill();
    
    context.fillStyle = 'white';
    context.font = '30px "Fredoka One", cursive';
    context.shadowColor = 'rgba(0,0,0,0.5)';
    context.shadowBlur = 2;
    context.fillText("RESUME", this.canvasWidth / 2, btnY + 35 + btnOffset); 
    context.shadowBlur = 0;
  }

  togglePause() {
      if (this.gameState === 'PLAYING') {
          this.gameState = 'PAUSED';
      } else if (this.gameState === 'PAUSED') {
          this.gameState = 'PLAYING';
          this.isMouseDown = false; // Reset mouse state on resume
      }
  }

  handleInput(type: string, x: number, y: number) {
    if (this.gameState === 'MENU') {
        const btnW = 200;
        const btnH = 50;
        const boxH = 250;
        const boxY = this.canvasHeight / 2 - boxH / 2 - 180;
        
        const titleLineHeight = 50;
        const btnHeight = 55;
        const gap = 25;
        const totalContentHeight = titleLineHeight * 2 + gap + btnHeight;
        const centerY = boxY + boxH / 2;
        const startY = centerY - totalContentHeight / 2 - 15;
        const btnY = startY + titleLineHeight * 2 + gap;

        const btnX = this.canvasWidth / 2 - btnW / 2;

        if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH + 5) {
            if (type === 'mousedown') {
                this.isMouseDown = true;
            } else if (type === 'mouseup' && this.isMouseDown) {
                this.gameState = 'PLAYING';
                
                // Scale initial velocity by radius to keep gameplay consistent across sizes
                const radius = this.rowHeight / 1.5; 
                this.ball.dx = (Math.random() - 0.5) * (radius * 0.15); // Scaled horizontal speed
                this.ball.dy = radius * 0.4; // Stronger vertical speed (0.4)
                
                this.isMouseDown = false;
            }
        } else {
            if (type === 'mouseup') this.isMouseDown = false;
        }
    } else if (this.gameState === 'PAUSED') {
        // Pause Menu Button Logic
        const btnW = 200;
        const btnH = 50;
        const boxH = 250;
        // Same BoxY as Menu? 
        // In drawPauseScreen: const boxY = this.canvasHeight / 2 - boxH / 2 - 100;
        const boxY = this.canvasHeight / 2 - boxH / 2 - 100;

        const titleLineHeight = 60;
        const btnHeight = 55; 
        const gap = 30; 
        const totalContentHeight = titleLineHeight + gap + btnHeight; 
        const centerY = boxY + boxH / 2;
        const startY = centerY - totalContentHeight / 2;
        const btnY = startY + titleLineHeight + gap;
        const btnX = this.canvasWidth / 2 - btnW / 2;

        if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH + 5) {
            if (type === 'mousedown') {
                this.isMouseDown = true;
            } else if (type === 'mouseup' && this.isMouseDown) {
                this.togglePause();
            }
        } else {
            if (type === 'mouseup') this.isMouseDown = false;
        }
    } else if (this.gameState === 'PLAYING') {
        // Check for Pause Button click
        const pauseBtnSize = 60;
        const pauseBtnX = 20;
        const pauseBtnY = 20;

        if (x >= pauseBtnX && x <= pauseBtnX + pauseBtnSize && y >= pauseBtnY && y <= pauseBtnY + pauseBtnSize) {
            if (type === 'mousedown') {
                this.isMouseDown = true;
            } else if (type === 'mouseup' && this.isMouseDown) {
                this.togglePause();
                this.isMouseDown = false;
            }
        } else {
             if (type === 'mouseup') this.isMouseDown = false;
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
        // Only bounce if moving towards the wall (dot < 0)
        if (dot < 0) {
            ball.dx = (ball.dx - 2 * dot * nx) * ball.elasticity;
            ball.dy = (ball.dy - 2 * dot * ny) * ball.elasticity;
            
            // Add slight jitter scaled by block size
            ball.dx += (Math.random() - 0.5) * (block.radius * 0.02);
        }
        return true;
    }
    return false;
  }
}

export default GameEngine;
