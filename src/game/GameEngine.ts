import Ball from './Ball';
import Block from './Block';
import SoundManager from './SoundManager';

class GameEngine {
  ball: Ball;
  blocks: Block[];
  canvasWidth: number;
  canvasHeight: number;
  money: number = 0;
  
  gameState: 'MENU' | 'PLAYING' | 'PAUSED' = 'MENU';
  menuState: 'MAIN' | 'SETTINGS' = 'MAIN'; // Sub-menu state for Pause/Title
  activeButton: string | null = null; // Track active button for animation
  isHoveringButton: boolean = false; // Track hover state for cursor
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
  
  // Save State Key
  readonly SAVE_KEY = 'gravity_miner_save_v1';

  // Notification System
  notificationText: string = "";
  notificationTimer: number = 0;

  // Auto-Save System
  autoSaveTimer: number = 0;
  readonly AUTO_SAVE_INTERVAL: number = 5 * 60 * 1000; // 5 Minutes
  
  // Settings
  settings = {
      showHp: true,
      volume: 0.5,
      sfxBlocks: true,
      sfxBounce: true
  };

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
    const groundY = this.getGroundY();
    const hoverDist = Math.min(this.canvasHeight * 0.3, 250);
    
    this.ball = new Ball(
      width / 2, 
      groundY - hoverDist,   
      radius * 0.3,  // Dynamic ball radius (reduced by 50%)
      '#ff4444', 
      (Math.random() - 0.5) * 4, 
      0, 
      radius * 0.02, // Dynamic Gravity 
      0.95  
    );
    
    // Set initial offset to center the view
    this.offsetY = groundY - (this.canvasHeight * 0.75);


    // Create Pattern
    this.initDirtPattern();

    // Try to load save for background preview
    if (this.loadGame()) {
        this.gameState = 'MENU';
    } else {
        // Initial generation if no save
        this.generateRows(0, 40);
    }
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

  saveGame() {
      const data = {
          money: this.money,
          settings: this.settings,
          offsetY: this.offsetY,
          maxRowGenerated: this.maxRowGenerated,
          rowHeight: this.rowHeight,
          canvasWidth: this.canvasWidth,
          canvasHeight: this.canvasHeight,
          ball: {
              x: this.ball.x,
              y: this.ball.y,
              dx: this.ball.dx,
              dy: this.ball.dy,
              radius: this.ball.radius
          },
          blocks: this.blocks.map(b => ({
              x: b.x,
              y: b.y,
              row: b.row,
              col: b.col,
              hp: b.hp,
              maxHp: b.maxHp,
              value: b.value,
              color: b.color,
              radius: b.radius
          }))
      };
      
      try {
          // Encode to Base64 to obfuscate
          const json = JSON.stringify(data);
          const encoded = btoa(json);
          localStorage.setItem(this.SAVE_KEY, encoded);
          console.log("Game Saved!");
          this.showNotification("Game Saved!");
      } catch (e) {
          console.error("Failed to save game:", e);
          this.showNotification("Save Failed!");
      }
  }

  showNotification(text: string) {
      this.notificationText = text;
      this.notificationTimer = 2000; // 2 seconds
  }

  loadGame(): boolean {
      const encoded = localStorage.getItem(this.SAVE_KEY);
      if (!encoded) return false;
      
      try {
          // Decode from Base64
          const json = atob(encoded);
          const data = JSON.parse(json);
          
          this.money = data.money;
          if (data.settings) {
              this.settings = { ...this.settings, ...data.settings };
          }
          // Sync SoundManager
          SoundManager.volume = this.settings.volume;
          SoundManager.muteBlocks = !this.settings.sfxBlocks;
          SoundManager.muteBounce = !this.settings.sfxBounce;

          this.offsetY = data.offsetY;
          this.maxRowGenerated = data.maxRowGenerated;
          this.rowHeight = data.rowHeight; // Temporarily set to saved value for resize logic
          
          // Restore Ball
          this.ball.x = data.ball.x;
          this.ball.y = data.ball.y;
          this.ball.dx = data.ball.dx;
          this.ball.dy = data.ball.dy;
          this.ball.radius = data.ball.radius;
          
          // Restore Blocks
          this.blocks = data.blocks.map((b: any) => {
              const block = new Block(b.x, b.y, b.radius, b.hp, b.value, b.color, b.row, b.col);
              block.maxHp = b.maxHp;
              return block;
          });

          // Handle Resize if saved dimensions differ from current
          // We set current dims to Saved dims, then call resize to Current Actual dims
          const savedW = data.canvasWidth;
          const savedH = data.canvasHeight;
          
          // Force engine to think it is the saved size
          this.canvasWidth = savedW;
          this.canvasHeight = savedH;
          this.holeWidth = savedW / 2;
          this.holeLeft = (savedW - this.holeWidth) / 2;

          // Now resize to the real window size
          // We need to pass the real dimensions which we want to target.
          // Since we are inside loadGame, we can assume 'this.canvasWidth' WAS the current size before we overwrote it.
          // Wait, we need to know the *target* size. 
          // Implementation detail: loadGame is called from MENU. 
          // The engine instance already has the *current* window size in this.canvasWidth/Height before we overwrite it.
          // So let's capture real dims first.
          
          // Actually, we can just grab window innerWidth/Height or pass it in?
          // Simpler: The caller (handleInput) calls loadGame. 
          // The engine *already* has the correct current dimensions in properties.
          const targetW = this.canvasWidth;
          const targetH = this.canvasHeight;

          if (savedW !== targetW || savedH !== targetH) {
             // We pretend we are the old size
             this.canvasWidth = savedW;
             this.canvasHeight = savedH;
             this.updateGeometry(); // Reset hole geometry to saved
             
             // Now call resize to update to target
             this.resize(targetW, targetH);
          } else {
             // Just ensure geometry is correct for current size
             this.updateGeometry();
          }
          
          return true;
      } catch (e) {
          console.error("Failed to load save:", e);
          return false;
      }
  }
  
  updateGeometry() {
    this.holeWidth = this.canvasWidth / 2; // 50% width
    this.holeLeft = (this.canvasWidth - this.holeWidth) / 2; // Centered
    this.holeRight = this.holeLeft + this.holeWidth;
  }

  // Helper to calculate ground Y position dynamically
  getGroundY() {
      return Math.max(200, this.canvasHeight * 0.3);
  }

  resize(width: number, height: number) {
      // Store old metrics
      const oldRowHeight = this.rowHeight;
      const oldRadius = oldRowHeight / 1.5;
      const oldGroundY = Math.max(200, this.canvasHeight * 0.3); // Re-calculate old groundY
      const oldStartY = oldGroundY + oldRadius + 20;
      
      const oldHoleLeft = this.holeLeft;
      const oldHoleWidth = this.holeWidth;

      // Update Dimensions
      this.canvasWidth = width;
      this.canvasHeight = height;
      this.updateGeometry();

      // Recalculate new constants
      const numColumns = 10;
      const dx = this.holeWidth / (numColumns - 1);
      const radius = dx / Math.sqrt(3);
      this.rowHeight = radius * 1.5;
      
      const newGroundY = this.getGroundY();
      const newStartY = newGroundY + radius + 20;

      // Update Ball radius
      this.ball.radius = radius * 0.3;

      // Safe Reset if in MENU
      if (this.gameState === 'MENU') {
          this.ball.x = this.canvasWidth / 2;
          
          // Position ball relative to ground (hovering above)
          // Scale hover distance slightly with height but cap it
          const hoverDist = Math.min(this.canvasHeight * 0.3, 250);
          this.ball.y = newGroundY - hoverDist; 
          
          this.ball.dx = (Math.random() - 0.5) * 4;
          this.ball.dy = 0;
          
          // Position camera so ground is at ~75% of screen height
          // ScreenY = WorldY - OffsetY  =>  OffsetY = WorldY - ScreenY
          this.offsetY = newGroundY - (this.canvasHeight * 0.75);
      } else if (oldRowHeight > 1) {
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
          if (oldRadius > 0) {
              const currentSpeed = Math.sqrt(this.ball.dx * this.ball.dx + this.ball.dy * this.ball.dy);
              const normalizedSpeed = currentSpeed / oldRadius;
              
              let newSpeed = normalizedSpeed * radius;
              
              const maxSafeSpeed = radius * 1.0;
              if (newSpeed > maxSafeSpeed) newSpeed = maxSafeSpeed;

              if (currentSpeed > 0.001) {
                  this.ball.dx = (this.ball.dx / currentSpeed) * newSpeed;
                  this.ball.dy = (this.ball.dy / currentSpeed) * newSpeed;
              }
          }

          // Reset camera to follow ball immediately
          this.offsetY = this.ball.y - this.canvasHeight / 3;
      }
      
      // Always update gravity based on new radius
      this.ball.gravity = radius * 0.02; 

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
    const dx = this.holeWidth / (numColumns - 1);
    const radius = dx / Math.sqrt(3);
    const dy = this.rowHeight;
    
    // Use dynamic ground Y
    const groundY = this.getGroundY();
    const startY = groundY + radius + 20; 

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
    if (this.notificationTimer > 0) {
        this.notificationTimer -= dt;
    }

    if (this.gameState === 'PLAYING') {
        this.autoSaveTimer += dt;
        if (this.autoSaveTimer >= this.AUTO_SAVE_INTERVAL) {
            this.saveGame();
            this.autoSaveTimer = 0;
        }
    }

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
        if (Math.abs(this.ball.dx) > 1) SoundManager.playBounce(Math.abs(this.ball.dx) / 5);
        this.ball.dx *= -this.ball.elasticity;
    }
    if (this.ball.x + this.ball.radius > this.holeRight) {
        this.ball.x = this.holeRight - this.ball.radius;
        if (Math.abs(this.ball.dx) > 1) SoundManager.playBounce(Math.abs(this.ball.dx) / 5);
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
          SoundManager.playPop();
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
        block.draw(context, 0, this.holeLeft, this.holeRight, this.settings.showHp);
    });
    this.ball.draw(context);
    
    context.restore(); // Remove clip
    
    context.restore(); // Remove translate
    
    if (this.gameState === 'MENU') {
        this.drawTitleScreen(context);
    } else if (this.gameState === 'PAUSED') {
        this.drawPauseScreen(context);
    } else {
        this.togglePause = this.togglePause.bind(this); // Ensure 'this' context if needed, though arrow functions are better.
        // Actually, just fixing the draw logic:
        
        const scale = Math.min(this.canvasWidth, this.canvasHeight) / 1000;
        
        // Draw HUD (Top Right)
        const hudW = 200 * scale;
        const hudH = 80 * scale;
        const hudMargin = 20 * scale;
        const hudX = this.canvasWidth - hudW - hudMargin;
        const hudY = hudMargin;

        // Rounded Rect Background for Stats
        context.fillStyle = 'rgba(50, 50, 50, 0.8)';
        context.beginPath();
        context.roundRect(hudX, hudY, hudW, hudH, 10 * scale);
        context.fill();

        // Stats Text
        context.fillStyle = 'white';
        context.font = `${20 * scale}px "Fredoka One", cursive`;
        context.textAlign = 'left';

        // Calculate depth based on row index to be scale-invariant
        const radius = this.rowHeight / 1.5;
        const groundY = this.getGroundY();
        const startY = groundY + radius + 20;
        const depth = Math.max(0, Math.floor((this.ball.y - startY) / this.rowHeight * 2)); // 2m per row

        context.fillText(`Depth: ${depth}m`, hudX + 20 * scale, hudY + 35 * scale);
        context.fillText(`Money: $${this.money}`, hudX + 20 * scale, hudY + 65 * scale);

        // Draw Pause Button (Top Left)
        const pauseBtnSize = 60 * scale;
        const pauseBtnX = hudMargin;
        const pauseBtnY = hudMargin;

        // Rounded Rect Background for Pause
        context.fillStyle = 'rgba(50, 50, 50, 0.8)';
        context.beginPath();
        context.roundRect(pauseBtnX, pauseBtnY, pauseBtnSize, pauseBtnSize, 10 * scale);
        context.fill();

        // Pause Icon (Two vertical bars)
        context.fillStyle = 'white';
        const barW = 8 * scale;
        const barH = 24 * scale;
        const barGap = 10 * scale;
        const centerX = pauseBtnX + pauseBtnSize / 2;
        const centerY = pauseBtnY + pauseBtnSize / 2;
        
        context.beginPath();
        context.roundRect(centerX - barGap/2 - barW, centerY - barH/2, barW, barH, 2 * scale);
        context.roundRect(centerX + barGap/2, centerY - barH/2, barW, barH, 2 * scale);
        context.fill();
        
        // Draw Save Button (Bottom Left)
        const saveBtnSize = 60 * scale;
        const saveBtnX = hudMargin;
        const saveBtnY = this.canvasHeight - saveBtnSize - hudMargin;

        // Rounded Rect Background for Save
        context.fillStyle = 'rgba(50, 50, 50, 0.8)';
        context.beginPath();
        context.roundRect(saveBtnX, saveBtnY, saveBtnSize, saveBtnSize, 10 * scale);
        context.fill();

        // Save Icon (Floppy Disk-ish)
        context.fillStyle = 'white';
        const iconSize = saveBtnSize * 0.6;
        const iconX = saveBtnX + (saveBtnSize - iconSize) / 2;
        const iconY = saveBtnY + (saveBtnSize - iconSize) / 2;

        context.beginPath();
        // Main body
        context.moveTo(iconX, iconY);
        context.lineTo(iconX + iconSize - (5 * scale), iconY); // Top right cut
        context.lineTo(iconX + iconSize, iconY + (5 * scale));
        context.lineTo(iconX + iconSize, iconY + iconSize);
        context.lineTo(iconX, iconY + iconSize);
        context.closePath();
        context.fill();
        
        // White space (shutter?)
        context.fillStyle = '#333'; // Dark grey hole
        context.fillRect(iconX + iconSize * 0.2, iconY + iconSize * 0.55, iconSize * 0.6, iconSize * 0.35);
        context.fillStyle = 'white'; // Slider
        context.fillRect(iconX + iconSize * 0.3, iconY + iconSize * 0.6, iconSize * 0.2, iconSize * 0.2);

        // Draw Notification
        if (this.notificationTimer > 0) {
            context.save();
            const alpha = Math.min(1, this.notificationTimer / 500); // Fade out in last 500ms
            context.globalAlpha = alpha;
            
            context.fillStyle = 'white';
            context.font = `${20 * scale}px "Fredoka One", cursive`;
            context.textAlign = 'left';
            context.fillText(this.notificationText, saveBtnX + saveBtnSize + (15 * scale), saveBtnY + saveBtnSize / 2 + (7 * scale));
            
            context.restore();
        }
    }
  }

  drawEnvironment(context: CanvasRenderingContext2D) {
    const groundY = this.getGroundY();
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

    this.drawBrickWalls(context, groundY);
  }

  drawBrickWalls(context: CanvasRenderingContext2D, groundY: number) {
      // Scale wall dimensions based on rowHeight
      const wallWidth = this.rowHeight * 0.8; 
      const wallHeight = Math.max(this.canvasHeight, 1000); // Always cover screen height at least

      const brickColor = '#A05A2C';
      const mortarColor = '#5a2d0c';
      
      const drawSide = (x: number) => {
        // Main Wall Body
        context.fillStyle = brickColor;
        context.fillRect(x, groundY - wallHeight, wallWidth, wallHeight);
        
        context.strokeStyle = mortarColor;
        context.lineWidth = Math.max(1, this.rowHeight * 0.03); // Scale line width
        context.beginPath();
        
        const bH = this.rowHeight * 0.4; // Scale brick height
        const bW = bH; // Square-ish bricks
        
        // Draw bricks
        for (let y = groundY - wallHeight; y < groundY; y += bH) {
            // Horizontal line
            context.moveTo(x, y);
            context.lineTo(x + wallWidth, y);
            
            // Vertical lines (staggered)
            const offset = (Math.floor((y - (groundY - wallHeight)) / bH) % 2) * (bW / 2);
            for (let bx = x + offset; bx < x + wallWidth; bx += bW) {
                 context.moveTo(bx, y);
                 context.lineTo(bx, y + bH);
            }
        }
        context.stroke();
        
        // Heavy Border around the wall
        context.lineWidth = Math.max(2, this.rowHeight * 0.05);
        context.strokeStyle = '#333';
        context.strokeRect(x, groundY - wallHeight, wallWidth, wallHeight);
      };

      // Draw Left Wall (Shifted left by width so right edge aligns with holeLeft)
      drawSide(this.holeLeft - wallWidth);
      
      // Draw Right Wall (Left edge aligns with holeRight)
      drawSide(this.holeRight);
  }

  drawTitleScreen(context: CanvasRenderingContext2D) {
    const scale = Math.min(this.canvasWidth, this.canvasHeight) / 1000;

    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Box dimensions
    const boxW = 500 * scale;
    const boxH = 250 * scale; 
    const boxX = this.canvasWidth / 2 - boxW / 2;
    const boxY = this.canvasHeight / 2 - boxH / 2 - (180 * scale);

    // Rounded Grey Box with Border
    const borderColor = '#1A1A1A'; // Darker grey for border
    const borderWidth = 2 * scale;
    context.fillStyle = 'rgba(50, 50, 50, 0.9)';
    context.strokeStyle = borderColor;
    context.lineWidth = borderWidth;
    
    context.beginPath();
    context.roundRect(boxX, boxY, boxW, boxH, 15 * scale);
    context.fill();
    context.stroke(); // Draw border

    // Layout Calculations for Centering
    const title1 = "LeFizzim's";
    const title2 = "Gravity Miner";
    const titleLineHeight = 50 * scale; 
    const btnHeight = 55 * scale; // 50 button + 5 shadow
    const gap = 25 * scale; // Space between title block and button
    
    // Calculate total height of content
    const totalContentHeight = titleLineHeight * 2 + gap + btnHeight; 
    
    const centerY = boxY + boxH / 2;
    // Visual correction: Shift content UP to reduce top margin
    const startY = centerY - totalContentHeight / 2 - (15 * scale); 
    
    const title1Y = startY + titleLineHeight / 2 + (10 * scale); 
    const title2Y = startY + titleLineHeight + titleLineHeight / 2 + (10 * scale); 
    const btnY = startY + titleLineHeight * 2 + gap;

    // Title Text (Split and Shadowed)
    context.fillStyle = 'white';
    context.textAlign = 'center';
    
    // LeFizzim's (Fredoka One, Italic, Lighter)
    context.font = `italic ${24 * scale}px "Fredoka One", cursive`;
    context.fillStyle = '#dddddd';
    context.fillText(title1, this.canvasWidth / 2, title1Y);

    // Gravity Miner (Fredoka One, Big, Shadowed)
    context.shadowColor = 'rgba(0, 0, 0, 0.8)';
    context.shadowBlur = 8 * scale; 
    context.shadowOffsetX = 3 * scale; 
    context.shadowOffsetY = 3 * scale; 
    
    context.font = `${48 * scale}px "Fredoka One", cursive`;
    context.strokeStyle = borderColor; 
    context.lineWidth = borderWidth;   
    context.strokeText(title2, this.canvasWidth / 2, title2Y); // Draw outline first
    context.fillStyle = 'white'; // Set fill style to white
    context.fillText(title2, this.canvasWidth / 2, title2Y); // Then draw the white fill

    context.shadowBlur = 0; // Reset shadow
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;

    // Start Button
    const btnW = 200 * scale;
    const btnH = 50 * scale;
    const btnX = this.canvasWidth / 2 - btnW / 2;
    
    const btnOffset = (this.activeButton === 'start') ? 3 * scale : 0; // Shift button down if pressed

    // Check for Save
    const hasSave = !!localStorage.getItem(this.SAVE_KEY);
    const btnText = hasSave ? "CONTINUE" : "START";

    // 3D Shadow (Darker Green)
    context.fillStyle = '#2e7d32'; 
    context.beginPath();
    context.roundRect(btnX, btnY + (5 * scale), btnW, btnH, 5 * scale); // Shadow always there
    context.fill();

    // Main Button Face (Lighter Green)
    context.fillStyle = '#4caf50';
    context.beginPath();
    context.roundRect(btnX, btnY + btnOffset, btnW, btnH, 5 * scale); // Apply offset if pressed
    context.fill();
    
    context.fillStyle = 'white';
    context.font = `${30 * scale}px "Fredoka One", cursive`;
    context.textBaseline = 'middle'; // Vertically center text
    context.shadowColor = 'rgba(0,0,0,0.5)';
    context.shadowBlur = 2 * scale;
    context.fillText(btnText, this.canvasWidth / 2, btnY + (btnH / 2) + btnOffset); 
    context.shadowBlur = 0;
    context.textBaseline = 'alphabetic'; // Reset for other text
  }

  getPauseMenuLayout() {
      const scale = Math.min(this.canvasWidth, this.canvasHeight) / 1000;
      const margin = 50 * scale; // Increased margin
      const btnW = 200 * scale;
      const btnHeight = 55 * scale;
      const gap = 25 * scale;
      const titleLineHeight = 60 * scale;

      const btnX = this.canvasWidth / 2 - btnW / 2;
      
      let boxH = 0;
      if (this.menuState === 'MAIN') {
          // Extra space at bottom for notification (approx 30 * scale)
          boxH = margin + titleLineHeight + gap + (btnHeight * 3) + (gap * 2) + (30 * scale) + margin;
      } else {
          // Settings Height: Title + Volume + 3 Toggles + Back + Spacing
          // Recalculated for larger margins: ~485+ needed. Setting to 520 for safety.
          boxH = 520 * scale; 
      }
      
      const boxW = btnW + (margin * 2);
      const boxX = this.canvasWidth / 2 - boxW / 2;
      const boxY = this.canvasHeight / 2 - boxH / 2;

      // Y positions relative to canvas
      const titleY = boxY + margin + titleLineHeight / 2;
      const resumeBtnY = boxY + margin + titleLineHeight + gap;
      const settingsBtnY = resumeBtnY + btnHeight + gap;
      const saveBtnY = settingsBtnY + btnHeight + gap;
      const backBtnY = boxY + boxH - btnHeight - margin;

      return {
          scale, margin, gap, btnW, btnHeight, btnX,
          boxX, boxY, boxW, boxH,
          titleY, resumeBtnY, settingsBtnY, saveBtnY, backBtnY
      };
  }

  drawPauseScreen(context: CanvasRenderingContext2D) {
    const layout = this.getPauseMenuLayout();
    const { scale, boxX, boxY, boxW, boxH } = layout;

    context.fillStyle = 'rgba(0, 0, 0, 0.5)'; // Darken background
    context.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Rounded Grey Box
    context.fillStyle = 'rgba(50, 50, 50, 0.9)';
    context.strokeStyle = '#1A1A1A';
    context.lineWidth = 2 * scale;
    
    context.beginPath();
    context.roundRect(boxX, boxY, boxW, boxH, 15 * scale);
    context.fill();
    context.stroke();

    if (this.menuState === 'MAIN') {
        this.drawPauseMain(context, layout);
    } else if (this.menuState === 'SETTINGS') {
        this.drawSettings(context, layout);
    }
  }

  drawPauseMain(context: CanvasRenderingContext2D, layout: any) {
    const { btnX, btnW, btnHeight, resumeBtnY, settingsBtnY, saveBtnY, titleY, scale, boxY, boxH } = layout;
    const titleText = "PAUSED";

    // Title
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.shadowColor = 'rgba(0, 0, 0, 0.8)';
    context.shadowBlur = 8 * scale; 
    context.shadowOffsetX = 3 * scale; 
    context.shadowOffsetY = 3 * scale; 
    
    context.font = `${48 * scale}px "Fredoka One", cursive`;
    context.strokeStyle = '#1A1A1A'; 
    context.lineWidth = 2 * scale;   
    context.strokeText(titleText, this.canvasWidth / 2, titleY); 
    context.fillStyle = 'white'; 
    context.fillText(titleText, this.canvasWidth / 2, titleY); 

    context.shadowBlur = 0; 
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;

    // --- Buttons ---
    const drawButton = (text: string, y: number, id: string, color: string, shadowColor: string) => {
        const offset = (this.activeButton === id) ? 3 * scale : 0; 
        
        // Shadow
        context.fillStyle = shadowColor; 
        context.beginPath();
        context.roundRect(btnX, y + (5 * scale), btnW, btnHeight, 5 * scale); 
        context.fill();

        // Face
        context.fillStyle = color;
        context.beginPath();
        context.roundRect(btnX, y + offset, btnW, btnHeight, 5 * scale); 
        context.fill();
        
        context.fillStyle = 'white';
        context.font = `${30 * scale}px "Fredoka One", cursive`;
        context.shadowColor = 'rgba(0,0,0,0.5)';
        context.shadowBlur = 2 * scale;
        context.textBaseline = 'middle';
        context.fillText(text, this.canvasWidth / 2, y + (btnHeight / 2) + offset); 
        context.shadowBlur = 0;
        context.textBaseline = 'alphabetic';
    };

    drawButton("RESUME", resumeBtnY, 'resume', '#4caf50', '#2e7d32');
    drawButton("SETTINGS", settingsBtnY, 'settings', '#ff9800', '#f57c00');
    drawButton("SAVE GAME", saveBtnY, 'save', '#2196f3', '#1565c0');

    // Notification Text
    if (this.notificationTimer > 0) {
        context.save();
        const alpha = Math.min(1, this.notificationTimer / 500); 
        context.globalAlpha = alpha;
        
        context.fillStyle = '#4caf50'; 
        context.font = `${20 * scale}px "Fredoka One", cursive`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Positioned below the Save button (centered in the remaining space)
        // remaining space starts at saveBtnY + btnHeight
        // box ends at boxY + boxH
        const bottomSpaceStart = saveBtnY + btnHeight;
        const bottomSpaceEnd = boxY + boxH;
        const notifY = (bottomSpaceStart + bottomSpaceEnd) / 2;

        context.fillText(this.notificationText, this.canvasWidth / 2, notifY);
        
        context.restore();
    }
    
    context.textBaseline = 'alphabetic';
  }

  drawSettings(context: CanvasRenderingContext2D, layout: any) {
    const { btnX, btnW, btnHeight, backBtnY, titleY, scale, boxY, margin, gap } = layout;
    const titleText = "SETTINGS";
    const titleLineHeight = 60 * scale;

    // Title
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.shadowColor = 'rgba(0, 0, 0, 0.8)';
    context.shadowBlur = 8 * scale; 
    context.shadowOffsetX = 3 * scale; 
    context.shadowOffsetY = 3 * scale; 
    
    context.font = `${48 * scale}px "Fredoka One", cursive`;
    context.strokeStyle = '#1A1A1A'; 
    context.lineWidth = 2 * scale;   
    context.strokeText(titleText, this.canvasWidth / 2, titleY); 
    context.fillStyle = 'white'; 
    context.fillText(titleText, this.canvasWidth / 2, titleY); 

    context.shadowBlur = 0; 
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;

    // --- Controls Layout ---
    const startY = boxY + margin + titleLineHeight + gap;
    const btnHeightSmall = 45 * scale;
    const gapSmall = 15 * scale;

    // 1. Volume Slider
    const volLabelY = startY + 20 * scale; // Center of the volume row
    context.fillStyle = 'white';
    context.font = `${24 * scale}px "Fredoka One", cursive`;
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.fillText("Volume:", btnX, volLabelY);

    const sliderX = btnX + 105 * scale;
    const sliderH = 12 * scale;
    const sliderY = volLabelY - sliderH / 2;
    const sliderW = btnW - 105 * scale;

    // Bar
    context.fillStyle = '#444';
    context.beginPath();
    context.roundRect(sliderX, sliderY, sliderW, sliderH, sliderH / 2);
    context.fill();
    
    // Fill
    context.fillStyle = '#4caf50';
    context.beginPath();
    context.roundRect(sliderX, sliderY, sliderW * this.settings.volume, sliderH, sliderH / 2);
    context.fill();
    
    // Knob
    const knobX = sliderX + sliderW * this.settings.volume;
    context.fillStyle = 'white';
    context.beginPath();
    context.arc(knobX, volLabelY, 10 * scale, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#2e7d32';
    context.lineWidth = 2 * scale;
    context.stroke();

    context.textBaseline = 'alphabetic'; // Reset

    // 2. Toggles
    const toggleW = btnW;
    const toggleH = btnHeightSmall;
    
    const drawToggle = (text: string, isOn: boolean, y: number, id: string) => {
        const offset = (this.activeButton === id) ? 3 * scale : 0;
        const color = isOn ? '#4caf50' : '#f44336';
        const shadow = isOn ? '#2e7d32' : '#d32f2f';
        const status = isOn ? "ON" : "OFF";

        context.fillStyle = shadow;
        context.beginPath();
        context.roundRect(btnX, y + (5 * scale), toggleW, toggleH, 5 * scale);
        context.fill();

        context.fillStyle = color;
        context.beginPath();
        context.roundRect(btnX, y + offset, toggleW, toggleH, 5 * scale);
        context.fill();

        context.fillStyle = 'white';
        context.font = `${24 * scale}px "Fredoka One", cursive`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(`${text}: ${status}`, this.canvasWidth/2, y + toggleH/2 + offset);
    };

    const hpY = startY + 40 * scale + gapSmall;
    drawToggle("HP Text", this.settings.showHp, hpY, 'toggle_hp');

    const blocksY = hpY + toggleH + gapSmall;
    drawToggle("Block SFX", this.settings.sfxBlocks, blocksY, 'toggle_blocks');

    const bounceY = blocksY + toggleH + gapSmall;
    drawToggle("Bounce SFX", this.settings.sfxBounce, bounceY, 'toggle_bounce');


    // Back Button (Bottom)
    const offset = (this.activeButton === 'back') ? 3 * scale : 0; 

    // Shadow
    context.fillStyle = '#d32f2f'; // Dark Red
    context.beginPath();
    context.roundRect(btnX, backBtnY + (5 * scale), btnW, btnHeight, 5 * scale); 
    context.fill();

    // Face
    context.fillStyle = '#f44336'; // Red
    context.beginPath();
    context.roundRect(btnX, backBtnY + offset, btnW, btnHeight, 5 * scale); 
    context.fill();
    
    context.fillStyle = 'white';
    context.font = `${30 * scale}px "Fredoka One", cursive`;
    context.shadowColor = 'rgba(0,0,0,0.5)';
    context.shadowBlur = 2 * scale;
    context.textBaseline = 'middle';
    context.fillText("BACK", this.canvasWidth / 2, backBtnY + (btnHeight / 2) + offset); 
    context.shadowBlur = 0;
    
    context.textBaseline = 'alphabetic';
  }

  togglePause() {
      if (this.gameState === 'PLAYING') {
          this.gameState = 'PAUSED';
          this.menuState = 'MAIN'; // Always open to main menu
      } else if (this.gameState === 'PAUSED') {
          this.gameState = 'PLAYING';
          this.activeButton = null; // Reset mouse state on resume
      }
  }

  handleInput(type: string, x: number, y: number) {
    const scale = Math.min(this.canvasWidth, this.canvasHeight) / 1000;
    
    // Reset hover state by default (will be set to true if inside a button)
    if (type === 'mousemove') {
        this.isHoveringButton = false;
    }

    if (this.gameState === 'MENU') {
        const btnW = 200 * scale;
        const btnH = 50 * scale;
        const boxH = 250 * scale;
        const boxY = this.canvasHeight / 2 - boxH / 2 - (180 * scale);
        
        const titleLineHeight = 50 * scale;
        const btnHeight = 55 * scale;
        const gap = 25 * scale;
        const totalContentHeight = titleLineHeight * 2 + gap + btnHeight; 
        const centerY = boxY + boxH / 2;
        const startY = centerY - totalContentHeight / 2 - (15 * scale);
        const btnY = startY + titleLineHeight * 2 + gap;

        const btnX = this.canvasWidth / 2 - btnW / 2;

        const insideBtn = x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH + (5 * scale);

        if (insideBtn) {
            if (type === 'mousemove') this.isHoveringButton = true;
            
            if (type === 'mousedown') {
                this.activeButton = 'start';
            } else if (type === 'mouseup' && this.activeButton === 'start') {
                // Initialize Audio
                SoundManager.resume();

                // Try Load first
                const loaded = this.loadGame();
                
                if (!loaded) {
                    this.gameState = 'PLAYING';
                    
                    // Scale initial velocity by radius to keep gameplay consistent across sizes
                    const radius = this.rowHeight / 1.5; 
                    this.ball.dx = (Math.random() - 0.5) * (radius * 0.15); // Scaled horizontal speed
                    this.ball.dy = radius * 0.4; // Stronger vertical speed (0.4)
                } else {
                    this.gameState = 'PLAYING';
                }
                
                this.activeButton = null;
            }
        } else {
            if (type === 'mouseup') this.activeButton = null;
        }
            } else if (this.gameState === 'PAUSED') {
                const layout = this.getPauseMenuLayout();
                const { btnX, btnW, btnHeight, resumeBtnY, settingsBtnY, saveBtnY, backBtnY, scale, boxY, margin, gap } = layout;
        
                if (this.menuState === 'MAIN') {
                    // Check Resume
                    const insideResume = x >= btnX && x <= btnX + btnW && y >= resumeBtnY && y <= resumeBtnY + btnHeight + (5 * scale);
                    // Check Settings
                    const insideSettings = x >= btnX && x <= btnX + btnW && y >= settingsBtnY && y <= settingsBtnY + btnHeight + (5 * scale);
                    // Check Save
                    const insideSave = x >= btnX && x <= btnX + btnW && y >= saveBtnY && y <= saveBtnY + btnHeight + (5 * scale);
        
                    if (insideResume) {
                        if (type === 'mousemove') this.isHoveringButton = true;
                        if (type === 'mousedown') {
                            this.activeButton = 'resume';
                        } else if (type === 'mouseup' && this.activeButton === 'resume') {
                            this.togglePause();
                            this.activeButton = null;
                        }
                    }
                    else if (insideSettings) {
                        if (type === 'mousemove') this.isHoveringButton = true;
                        if (type === 'mousedown') {
                            this.activeButton = 'settings';
                        } else if (type === 'mouseup' && this.activeButton === 'settings') {
                            this.menuState = 'SETTINGS';
                            this.activeButton = null;
                        }
                    } 
                    else if (insideSave) {
                        if (type === 'mousemove') this.isHoveringButton = true;
                        if (type === 'mousedown') {
                            this.activeButton = 'save';
                        } else if (type === 'mouseup' && this.activeButton === 'save') {
                            this.saveGame();
                            this.activeButton = null;
                        }
                    }
                    else {
                        if (type === 'mouseup') this.activeButton = null;
                    }
                } else if (this.menuState === 'SETTINGS') {
                    const startY = boxY + margin + (60 * scale) + gap; // Matches drawSettings titleLineHeight
                    const btnHeightSmall = 45 * scale;
                    const gapSmall = 15 * scale;

                    // 1. Volume Interaction
                    const volLabelY = startY + 20 * scale;
                    const sliderX = btnX + 105 * scale;
                    const sliderW = btnW - 105 * scale;
                    const sliderH = 24 * scale; // Slightly larger hitbox height
                    const sliderY = volLabelY - sliderH / 2;
                    
                    if ((type === 'mousedown' || (type === 'mousemove' && this.isResizing)) && 
                        x >= sliderX - 10 && x <= sliderX + sliderW + 10 && 
                        y >= sliderY - 10 && y <= sliderY + sliderH + 10) {
                        
                        this.isResizing = true; // Hijacking resize flag for drag interaction
                        let vol = (x - sliderX) / sliderW;
                        if (vol < 0) vol = 0;
                        if (vol > 1) vol = 1;
                        this.settings.volume = vol;
                        SoundManager.volume = vol;
                        if (type === 'mousedown') this.activeButton = 'volume';
                    }
                    if (type === 'mouseup') this.isResizing = false;

                    // 2. Toggles
                    const hpY = startY + 40 * scale + gapSmall;
                    const insideHp = x >= btnX && x <= btnX + btnW && y >= hpY && y <= hpY + btnHeightSmall + (5 * scale);
                    
                    const blocksY = hpY + btnHeightSmall + gapSmall;
                    const insideBlocks = x >= btnX && x <= btnX + btnW && y >= blocksY && y <= blocksY + btnHeightSmall + (5 * scale);

                    const bounceY = blocksY + btnHeightSmall + gapSmall;
                    const insideBounce = x >= btnX && x <= btnX + btnW && y >= bounceY && y <= bounceY + btnHeightSmall + (5 * scale);

                    if (insideHp) {
                        if (type === 'mousemove') this.isHoveringButton = true;
                        if (type === 'mousedown') this.activeButton = 'toggle_hp';
                        else if (type === 'mouseup' && this.activeButton === 'toggle_hp') {
                            this.settings.showHp = !this.settings.showHp;
                            this.activeButton = null;
                        }
                    } else if (insideBlocks) {
                        if (type === 'mousemove') this.isHoveringButton = true;
                        if (type === 'mousedown') this.activeButton = 'toggle_blocks';
                        else if (type === 'mouseup' && this.activeButton === 'toggle_blocks') {
                            this.settings.sfxBlocks = !this.settings.sfxBlocks;
                            SoundManager.muteBlocks = !this.settings.sfxBlocks;
                            this.activeButton = null;
                        }
                    } else if (insideBounce) {
                        if (type === 'mousemove') this.isHoveringButton = true;
                        if (type === 'mousedown') this.activeButton = 'toggle_bounce';
                        else if (type === 'mouseup' && this.activeButton === 'toggle_bounce') {
                            this.settings.sfxBounce = !this.settings.sfxBounce;
                            SoundManager.muteBounce = !this.settings.sfxBounce;
                            this.activeButton = null;
                        }
                    }

                    // Back Button
                    const insideBack = x >= btnX && x <= btnX + btnW && y >= backBtnY && y <= backBtnY + btnHeight + (5 * scale);
                    if (insideBack) {
                        if (type === 'mousemove') this.isHoveringButton = true;
                        if (type === 'mousedown') {
                            this.activeButton = 'back';
                        } else if (type === 'mouseup' && this.activeButton === 'back') {
                            this.menuState = 'MAIN';
                            this.activeButton = null;
                        }
                    } else {
                        if (type === 'mouseup' && !this.isResizing) this.activeButton = null;
                    }
                }
            } else if (this.gameState === 'PLAYING') {        // Check for Pause Button click
        const hudMargin = 20 * scale;
        const pauseBtnSize = 60 * scale;
        const pauseBtnX = hudMargin;
        const pauseBtnY = hudMargin;

        const insidePause = x >= pauseBtnX && x <= pauseBtnX + pauseBtnSize && y >= pauseBtnY && y <= pauseBtnY + pauseBtnSize;

        // Check for Save Button click (Bottom Left)
        const saveBtnSize = 60 * scale;
        const saveBtnX = hudMargin;
        const saveBtnY = this.canvasHeight - saveBtnSize - hudMargin;
        
        const insideSaveIcon = x >= saveBtnX && x <= saveBtnX + saveBtnSize && y >= saveBtnY && y <= saveBtnY + saveBtnSize;

        if (insidePause) {
            if (type === 'mousemove') this.isHoveringButton = true;
            if (type === 'mousedown') {
                this.activeButton = 'pause_icon';
            } else if (type === 'mouseup' && this.activeButton === 'pause_icon') {
                this.togglePause();
                this.activeButton = null;
            }
            return;
        }

        if (insideSaveIcon) {
            if (type === 'mousemove') this.isHoveringButton = true;
            if (type === 'mousedown') {
                this.activeButton = 'save_icon';
            } else if (type === 'mouseup' && this.activeButton === 'save_icon') {
                this.saveGame();
                this.activeButton = null;
            }
            return;
        }

        if (type === 'mouseup') this.activeButton = null;
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
            // Play sound based on impact speed (approximated by dot product)
            const impactSpeed = Math.abs(dot);
            if (impactSpeed > 1) SoundManager.playBounce(impactSpeed / 5);

            ball.dx = (ball.dx - 2 * dot * nx) * ball.elasticity;
            ball.dy = (ball.dy - 2 * dot * ny) * ball.elasticity;
            
            // Add slight jitter scaled by block size
            ball.dx += (Math.random() - 0.5) * (block.radius * 0.05);
        }
        return true;
    }
    return false;
  }
}

export default GameEngine;
