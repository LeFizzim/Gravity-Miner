import Ball from './Ball';
import Block from './Block';
import SoundManager from './SoundManager';

interface MenuLayout {
    scale: number;
    margin: number;
    gap: number;
    btnW: number;
    btnHeight: number;
    btnX: number;
    boxX: number;
    boxY: number;
    boxW: number;
    boxH: number;
    titleY: number;
    resumeBtnY: number;
    shopBtnY: number;
    settingsBtnY: number;
    saveBtnY: number;
    backBtnY: number;
}

interface SaveData {
    money: number;
    settings: {
        showHp: boolean;
        volume: number;
        sfxBlocks: boolean;
        sfxBounce: boolean;
    };
    upgrades: {
        damage: number;
        gravity: number;
        efficiency: number;
        bitBoosters: number;
        explosiveBlocks: number;
        cashBoosters: number;
    };
    bitBoosterTimer: number;
    cashBoosterTimer?: number;
    prestigeCount: number;
    offsetY: number;
    maxRowGenerated: number;
    rowHeight: number;
    canvasWidth: number;
    canvasHeight: number;
    lastActiveTime?: number; // Timestamp when game was last active
    balls: Array<{
        x: number;
        y: number;
        dx: number;
        dy: number;
        radius: number;
        damage?: number;
    }>;
    blocks: Array<{
        x: number;
        y: number;
        row: number;
        col: number;
        hp: number;
        maxHp: number;
        value: number;
        color: string;
        radius: number;
        type: 'normal' | 'bitBooster' | 'explosive' | 'cashBooster';
        typeRolled?: boolean;
    }>;
}

class GameEngine {
  balls: Ball[]; // Array of balls (starts with 1, increases with prestige)
  blocks: Block[];
  canvasWidth: number;
  canvasHeight: number;
  money: number = 0;
  
  gameState: 'MENU' | 'PLAYING' | 'PAUSED' = 'MENU';
  menuState: 'MAIN' | 'SETTINGS' | 'SHOP' = 'MAIN'; // Sub-menu state for Pause/Title
  activeButton: string | null = null; // Track active button for animation
  isHoveringButton: boolean = false; // Track hover state for cursor
  isResizing: boolean = false; // Track resize state
  shopOpenedFromHUD: boolean = false; // Track if shop was opened via HUD click

  // Upgrades State
  upgrades = {
      damage: 1,
      gravity: 1,
      efficiency: 1,
      bitBoosters: 0,      // 0-10 levels (0 = locked)
      explosiveBlocks: 0,  // 0-10 levels (0 = locked)
      cashBoosters: 0      // 0-10 levels (0 = locked)
  };

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

  // Bit Booster Effect State
  bitBoosterTimer: number = 0;
  readonly BIT_BOOSTER_DURATION: number = 5000; // 5 seconds

  // Cash Booster Effect State
  cashBoosterTimer: number = 0;
  readonly CASH_BOOSTER_DURATION: number = 5000; // 5 seconds

  // Prestige System
  prestigeCount: number = 0; // Number of prestiges (starts at 0 = 1 ball, 1 = 2 balls, etc.)
  prestigeButtonHovered: boolean = false; // Track if prestige button is hovered

  // Offline Progress
  lastActiveTime: number = Date.now(); // Timestamp when game was last active

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

    // Initialize Ball(s) - start with one ball
    const groundY = this.getGroundY();
    const hoverDist = Math.min(this.canvasHeight * 0.3, 250);

    this.balls = [new Ball(
      width / 2,
      groundY - hoverDist,
      radius * 0.3,  // Dynamic ball radius (reduced by 50%)
      '#ff4444',
      (Math.random() - 0.5) * 4,
      0,
      radius * 0.02, // Dynamic Gravity
      0.98
    )];
    
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

  saveGame(showNotification: boolean = false) {
      const data = {
          money: this.money,
          settings: this.settings,
          upgrades: this.upgrades,
          bitBoosterTimer: this.bitBoosterTimer,
          cashBoosterTimer: this.cashBoosterTimer,
          prestigeCount: this.prestigeCount,
          offsetY: this.offsetY,
          maxRowGenerated: this.maxRowGenerated,
          rowHeight: this.rowHeight,
          canvasWidth: this.canvasWidth,
          canvasHeight: this.canvasHeight,
          lastActiveTime: Date.now(),
          balls: this.balls.map(ball => ({
              x: ball.x,
              y: ball.y,
              dx: ball.dx,
              dy: ball.dy,
              radius: ball.radius,
              damage: ball.damage
          })),
          blocks: this.blocks.map(b => ({
              x: b.x,
              y: b.y,
              row: b.row,
              col: b.col,
              hp: b.hp,
              maxHp: b.maxHp,
              value: b.value,
              color: b.color,
              radius: b.radius,
              type: b.type,
              typeRolled: b.typeRolled
          }))
      };

      try {
          // Encode to Base64 to obfuscate
          const json = JSON.stringify(data);
          const encoded = btoa(json);
          localStorage.setItem(this.SAVE_KEY, encoded);
          console.log("Game Saved!");
          if (showNotification) {
              this.showNotification("Game Saved!");
          }
      } catch (e) {
          console.error("Failed to save game:", e);
          if (showNotification) {
              this.showNotification("Save Failed!");
          }
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
          const data: SaveData = JSON.parse(json);
          
          this.money = data.money;
          if (data.settings) {
              this.settings = { ...this.settings, ...data.settings };
          }
          if (data.upgrades) {
              // Merge with defaults for backwards compatibility
              this.upgrades = {
                  damage: data.upgrades.damage || 1,
                  gravity: data.upgrades.gravity || 1,
                  efficiency: data.upgrades.efficiency || 1,
                  bitBoosters: data.upgrades.bitBoosters || 0,
                  explosiveBlocks: data.upgrades.explosiveBlocks || 0,
                  cashBoosters: data.upgrades.cashBoosters || 0
              };

              // Apply Gravity Upgrade to all balls (this runs before balls are loaded)
              const radius = this.rowHeight / 1.5;
              const gravityMult = 1 + (this.upgrades.gravity - 1) * 0.1;
              // Note: Balls will have gravity applied after they're loaded below
              const targetGravity = radius * 0.02 * gravityMult;
              // Apply to existing balls if any
              for (const ball of this.balls) {
                  ball.gravity = targetGravity;
              }
          }

          // Load bit booster timer (with backwards compatibility)
          this.bitBoosterTimer = data.bitBoosterTimer || 0;

          // Load cash booster timer (with backwards compatibility)
          this.cashBoosterTimer = data.cashBoosterTimer || 0;

          // Load prestige count (with backwards compatibility)
          this.prestigeCount = data.prestigeCount || 0;

          // Load last active time (with backwards compatibility)
          this.lastActiveTime = data.lastActiveTime || Date.now();

          // Sync SoundManager
          SoundManager.volume = this.settings.volume;
          SoundManager.muteBlocks = !this.settings.sfxBlocks;
          SoundManager.muteBounce = !this.settings.sfxBounce;

          this.offsetY = data.offsetY;
          this.maxRowGenerated = data.maxRowGenerated;
          this.rowHeight = data.rowHeight; // Temporarily set to saved value for resize logic

          // Restore Balls (with backwards compatibility for old single-ball saves)
          if (data.balls && Array.isArray(data.balls)) {
              const radius = this.rowHeight / 1.5;
              this.balls = data.balls.map(b => {
                  const ball = new Ball(b.x, b.y, b.radius, '#ff4444', b.dx, b.dy, radius * 0.02, 0.98);
                  if (b.damage) ball.damage = b.damage;
                  return ball;
              });
          } else if ((data as any).ball) {
              // Backwards compatibility: convert old single ball save
              const b = (data as any).ball;
              const radius = this.rowHeight / 1.5;
              const ball = new Ball(b.x, b.y, b.radius, '#ff4444', b.dx, b.dy, radius * 0.02, 0.98);
              if (b.damage) ball.damage = b.damage;
              this.balls = [ball];
          }
          
          // Restore Blocks (with backwards compatibility for type and typeRolled)
          this.blocks = data.blocks.map(b => {
              const block = new Block(b.x, b.y, b.radius, b.hp, b.value, b.color, b.row, b.col, b.type || 'normal');
              block.maxHp = b.maxHp;
              // Backwards compatibility: if typeRolled is undefined, assume it hasn't been rolled
              // This gives old saves a chance to roll existing blocks for special types
              block.typeRolled = b.typeRolled ?? false;
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

  onTabHidden() {
      // Only track time if actively playing (not paused, not in menu)
      if (this.gameState === 'PLAYING') {
          this.lastActiveTime = Date.now();
          console.log('[Offline Progress] Tab hidden at:', new Date(this.lastActiveTime).toLocaleTimeString(), 'GameState:', this.gameState);
          this.saveGame();
      } else {
          console.log('[Offline Progress] Tab hidden but game not playing - no offline progress will be tracked. GameState:', this.gameState);
      }
  }

  onTabVisible() {
      // Calculate elapsed time and simulate offline progress
      const now = Date.now();
      const elapsed = now - this.lastActiveTime;

      console.log('[Offline Progress] Tab visible at:', new Date(now).toLocaleTimeString());
      console.log('[Offline Progress] Elapsed time:', (elapsed / 1000).toFixed(1), 'seconds');
      console.log('[Offline Progress] GameState:', this.gameState);

      // Only simulate if game is actively playing (not paused, not menu) and enough time has passed
      if (this.gameState === 'PLAYING' && elapsed > 1000) {
          this.simulateOfflineProgress(elapsed);
      } else {
          console.log('[Offline Progress] Skipped - GameState:', this.gameState, 'Elapsed:', elapsed);
      }

      // Update lastActiveTime
      this.lastActiveTime = now;
  }

  simulateOfflineProgress(elapsedMs: number) {
      console.log('[Offline Progress] Simulating progress for', elapsedMs, 'ms');

      // Cap offline progress to 24 hours to prevent abuse
      const MAX_OFFLINE_TIME = 24 * 60 * 60 * 1000; // 24 hours
      const cappedElapsed = Math.min(elapsedMs, MAX_OFFLINE_TIME);
      const elapsedSeconds = cappedElapsed / 1000;

      // Calculate average depth based on deepest ball
      const radius = this.rowHeight / 1.5;
      const groundY = this.getGroundY();
      const startY = groundY + radius + 20;
      const deepestBall = this.balls.reduce((deepest, ball) => ball.y > deepest.y ? ball : deepest, this.balls[0]);
      const currentRow = Math.max(0, Math.floor((deepestBall.y - startY) / this.rowHeight * 2));

      console.log('[Offline Progress] Current depth:', currentRow, 'rows');

      // Calculate average block stats at current depth
      const avgBlockHp = 1 + Math.floor(currentRow * 0.2);
      const avgBlockValue = 10 + Math.floor(currentRow * 0.5);

      // Calculate damage per second
      // Assume each ball hits ~2 blocks per second on average (rough estimate)
      const hitsPerSecond = 2;
      const totalDamage = this.balls.length * this.balls[0].damage * hitsPerSecond;

      // Calculate blocks destroyed per second
      const blocksPerSecond = totalDamage / avgBlockHp;

      // Calculate money earned per second (with efficiency multiplier)
      const efficiencyMult = 1 + (this.upgrades.efficiency - 1) * 0.2;
      const moneyPerSecond = blocksPerSecond * avgBlockValue * efficiencyMult;

      console.log('[Offline Progress] Money per second:', moneyPerSecond.toFixed(2));

      // Calculate total offline earnings
      const offlineEarnings = Math.floor(moneyPerSecond * elapsedSeconds);

      console.log('[Offline Progress] Total earnings:', offlineEarnings);

      // Add earnings to money (only if positive)
      if (offlineEarnings > 0) {
          this.money += offlineEarnings;

          // Show notification about offline progress
          const timeAway = this.formatTime(cappedElapsed);
          this.showNotification(`Welcome back! Earned $${offlineEarnings} while away (${timeAway})`);

          console.log('[Offline Progress] Notification shown:', `Earned $${offlineEarnings} (${timeAway})`);

          // Save the updated state
          this.saveGame();
      } else {
          console.log('[Offline Progress] No earnings (0 or negative)');
      }

      // Decay bit booster timer
      if (this.bitBoosterTimer > 0) {
          this.bitBoosterTimer = Math.max(0, this.bitBoosterTimer - cappedElapsed);
      }

      // Decay cash booster timer
      if (this.cashBoosterTimer > 0) {
          this.cashBoosterTimer = Math.max(0, this.cashBoosterTimer - cappedElapsed);
      }
  }

  formatTime(ms: number): string {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);

      if (hours > 0) {
          return `${hours}h ${minutes % 60}m`;
      } else if (minutes > 0) {
          return `${minutes}m ${seconds % 60}s`;
      } else {
          return `${seconds}s`;
      }
  }

  prestige() {
      // Increment prestige count (adds one more ball)
      this.prestigeCount++;

      // Reset money
      this.money = 0;

      // Reset all upgrades to level 1 (or 0 for block upgrades)
      this.upgrades = {
          damage: 1,
          gravity: 1,
          efficiency: 1,
          bitBoosters: 0,
          explosiveBlocks: 0,
          cashBoosters: 0
      };

      // Reset bit booster timer
      this.bitBoosterTimer = 0;

      // Reset cash booster timer
      this.cashBoosterTimer = 0;

      // Clear all blocks
      this.blocks = [];

      // Reset generation state
      this.maxRowGenerated = 0;

      // Reset balls - spawn multiple balls based on prestige count
      const groundY = this.getGroundY();
      const hoverDist = Math.min(this.canvasHeight * 0.3, 250);
      const radius = this.rowHeight / 1.5;
      const baseGravity = radius * 0.02;

      const numberOfBalls = this.prestigeCount + 1; // 1 ball + prestige count
      this.balls = [];

      // Spawn balls in a spread pattern
      for (let i = 0; i < numberOfBalls; i++) {
          const spreadX = (i - (numberOfBalls - 1) / 2) * (radius * 2); // Spread horizontally
          const spreadY = Math.random() * 30 - 15; // Small vertical variance

          this.balls.push(new Ball(
              this.canvasWidth / 2 + spreadX,
              groundY - hoverDist + spreadY,
              radius * 0.3,
              '#ff4444',
              (Math.random() - 0.5) * 4,
              0,
              baseGravity,
              0.98
          ));
      }

      // Reset camera offset
      this.offsetY = groundY - (this.canvasHeight * 0.75);

      // Generate initial blocks
      this.generateRows(0, 40);

      // Save the new prestige state
      this.saveGame();

      // Show notification
      this.showNotification(`Prestige ${this.prestigeCount}! You now have ${numberOfBalls} ball${numberOfBalls > 1 ? 's' : ''}!`);
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

      // Update all balls' radius
      for (const ball of this.balls) {
          ball.radius = radius * 0.3;
      }

      // Safe Reset if in MENU
      if (this.gameState === 'MENU') {
          // Reset first ball to center
          if (this.balls.length > 0) {
              this.balls[0].x = this.canvasWidth / 2;

              // Position ball relative to ground (hovering above)
              // Scale hover distance slightly with height but cap it
              const hoverDist = Math.min(this.canvasHeight * 0.3, 250);
              this.balls[0].y = newGroundY - hoverDist;

              this.balls[0].dx = (Math.random() - 0.5) * 4;
              this.balls[0].dy = 0;
          }

          // Position camera so ground is at ~75% of screen height
          // ScreenY = WorldY - OffsetY  =>  OffsetY = WorldY - ScreenY
          this.offsetY = newGroundY - (this.canvasHeight * 0.75);
      } else if (oldRowHeight > 1) {
          // Update all balls
          for (const ball of this.balls) {
              // Vertical
              const ballRowIndex = (ball.y - oldStartY) / oldRowHeight;
              ball.y = newStartY + ballRowIndex * this.rowHeight;

              // Horizontal (Ball)
              if (oldHoleWidth > 0) {
                  const ballRelX = ball.x - oldHoleLeft;
                  const ratioX = this.holeWidth / oldHoleWidth;
                  ball.x = this.holeLeft + ballRelX * ratioX;
              }

              // Scale Velocity based on Radius change
              if (oldRadius > 0) {
                  const currentSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
                  const normalizedSpeed = currentSpeed / oldRadius;

                  let newSpeed = normalizedSpeed * radius;

                  const maxSafeSpeed = radius * 1.0;
                  if (newSpeed > maxSafeSpeed) newSpeed = maxSafeSpeed;

                  if (currentSpeed > 0.001) {
                      ball.dx = (ball.dx / currentSpeed) * newSpeed;
                      ball.dy = (ball.dy / currentSpeed) * newSpeed;
                  }
              }
          }

          // Reset camera to follow deepest ball immediately
          const deepestBall = this.balls.reduce((deepest, ball) => ball.y > deepest.y ? ball : deepest, this.balls[0]);
          this.offsetY = deepestBall.y - this.canvasHeight / 3;
      }
      
      // Always update gravity based on new radius for all balls
      const gravityMult = 1 + (this.upgrades.gravity - 1) * 0.1;
      for (const ball of this.balls) {
          ball.gravity = radius * 0.02 * gravityMult;
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
            const cx = c * dx + xOffset;
            
            // Shift to hole position
            const finalX = cx + this.holeLeft;
            const finalY = startY + r * dy;

            // Ensure we stay within visual bounds of the hole mostly
            // Allow slightly outside for the "half block" effect
            if (finalX < this.holeLeft - dx || finalX > this.holeRight + dx) continue;

            const hue = (r * 10) % 360;
            const color = `hsl(${hue}, 60%, 50%)`;

            // Determine block type based on upgrade levels
            // Only roll for special types if block is within the playable hole area
            let blockType: 'normal' | 'bitBooster' | 'explosive' | 'cashBooster' = 'normal';
            if (finalX >= this.holeLeft && finalX <= this.holeRight) {
                const bitBoosterChance = this.upgrades.bitBoosters * 0.01; // 1% per level
                const explosiveChance = this.upgrades.explosiveBlocks * 0.01; // 1% per level
                const cashBoosterChance = this.upgrades.cashBoosters * 0.01; // 1% per level
                const roll = Math.random();
                if (roll < bitBoosterChance) {
                    blockType = 'bitBooster';
                } else if (roll < bitBoosterChance + explosiveChance) {
                    blockType = 'explosive';
                } else if (roll < bitBoosterChance + explosiveChance + cashBoosterChance) {
                    blockType = 'cashBooster';
                }
            }

            const block = new Block(
                finalX,
                finalY,
                radius - 1,
                1 + Math.floor(r * 0.2),
                10 + Math.floor(r * 0.5),
                color,
                r, // Row
                c, // Col
                blockType
            );
            block.typeRolled = true; // Mark as rolled since we already determined its type
            this.blocks.push(block);
        }
    }
    this.maxRowGenerated = startRow + count;
  }

  rerollExistingBlocks() {
      // Re-roll all existing blocks in the playable area for special types
      const bitBoosterChance = this.upgrades.bitBoosters * 0.01;
      const explosiveChance = this.upgrades.explosiveBlocks * 0.01;
      const cashBoosterChance = this.upgrades.cashBoosters * 0.01;

      if (bitBoosterChance === 0 && explosiveChance === 0 && cashBoosterChance === 0) return;

      for (const block of this.blocks) {
          // Only re-roll blocks within the playable hole area
          if (block.x < this.holeLeft || block.x > this.holeRight) continue;

          // Reset the roll flag and re-roll the block
          block.typeRolled = false;
          const roll = Math.random();

          if (roll < bitBoosterChance) {
              block.type = 'bitBooster';
          } else if (roll < bitBoosterChance + explosiveChance) {
              block.type = 'explosive';
          } else if (roll < bitBoosterChance + explosiveChance + cashBoosterChance) {
              block.type = 'cashBooster';
          } else {
              // Reset to normal if it doesn't roll as special
              block.type = 'normal';
          }
          // Keep the original color based on depth

          block.typeRolled = true;
      }
  }

  destroyAdjacentBlocks(centerBlock: Block, processedBlocks: Set<string> = new Set()) {
    const { row, col } = centerBlock;
    const efficiencyMult = 1 + (this.upgrades.efficiency - 1) * 0.2;
    const cashMultiplier = this.cashBoosterTimer > 0 ? 2 : 1;

    // Create unique ID for this block to prevent infinite recursion
    const blockId = `${row},${col}`;
    if (processedBlocks.has(blockId)) return;
    processedBlocks.add(blockId);

    // Hexagonal neighbors depend on whether row is even or odd
    // For flat-topped hexagons with offset coordinates:
    const evenRowOffsets = [
        [-1, 0], [-1, 1],  // Top-left, Top-right
        [0, -1], [0, 1],   // Left, Right
        [1, 0], [1, 1]     // Bottom-left, Bottom-right
    ];
    const oddRowOffsets = [
        [-1, -1], [-1, 0], // Top-left, Top-right
        [0, -1], [0, 1],   // Left, Right
        [1, -1], [1, 0]    // Bottom-left, Bottom-right
    ];

    const offsets = (row % 2 === 0) ? evenRowOffsets : oddRowOffsets;

    for (const [dRow, dCol] of offsets) {
        const targetRow = row + dRow;
        const targetCol = col + dCol;

        // Find and destroy matching block
        const idx = this.blocks.findIndex(b => b.row === targetRow && b.col === targetCol);
        if (idx !== -1) {
            const adjacentBlock = this.blocks[idx];
            const blockType = adjacentBlock.type;

            // Give money for destroying this block
            this.money += Math.ceil(adjacentBlock.value * efficiencyMult * cashMultiplier);

            // Remove the block from the array
            this.blocks.splice(idx, 1);
            SoundManager.playPop();

            // Trigger special block effects AFTER destroying
            if (blockType === 'bitBooster') {
                // Refresh bit booster timer
                this.bitBoosterTimer = this.BIT_BOOSTER_DURATION;
            } else if (blockType === 'cashBooster') {
                // Refresh cash booster timer
                this.cashBoosterTimer = this.CASH_BOOSTER_DURATION;
            } else if (blockType === 'explosive') {
                // Chain explosion - destroy this block's neighbors too
                this.destroyAdjacentBlocks(adjacentBlock, processedBlocks);
            }
        }
    }
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

        // Update Bit Booster timer
        if (this.bitBoosterTimer > 0) {
            this.bitBoosterTimer -= dt;
            if (this.bitBoosterTimer < 0) this.bitBoosterTimer = 0;
        }

        // Update Cash Booster timer
        if (this.cashBoosterTimer > 0) {
            this.cashBoosterTimer -= dt;
            if (this.cashBoosterTimer < 0) this.cashBoosterTimer = 0;
        }

        // Roll existing blocks for special types when they come near any ball
        const bitBoosterChance = this.upgrades.bitBoosters * 0.01;
        const explosiveChance = this.upgrades.explosiveBlocks * 0.01;
        const cashBoosterChance = this.upgrades.cashBoosters * 0.01;

        if (bitBoosterChance > 0 || explosiveChance > 0 || cashBoosterChance > 0) {
            // Only roll blocks within ~2 screens of any ball
            const rollDistance = this.canvasHeight * 2;

            for (const block of this.blocks) {
                // Skip if already rolled
                if (block.typeRolled) continue;

                // Only roll blocks within the playable hole area
                // Blocks halfway sticking out (center near edge) are still eligible
                if (block.x < this.holeLeft || block.x > this.holeRight) continue;

                // Check if block is close to ANY ball vertically
                const isNearAnyBall = this.balls.some(ball => Math.abs(block.y - ball.y) <= rollDistance);
                if (!isNearAnyBall) continue;

                // Roll the dice
                block.typeRolled = true;
                const roll = Math.random();
                if (roll < bitBoosterChance) {
                    block.type = 'bitBooster';
                } else if (roll < bitBoosterChance + explosiveChance) {
                    block.type = 'explosive';
                } else if (roll < bitBoosterChance + explosiveChance + cashBoosterChance) {
                    block.type = 'cashBooster';
                }
            }
        }
    }

    if (this.gameState === 'MENU' || this.gameState === 'PAUSED' || this.isResizing) {
        return;
    }

    const timeScale = dt / 16.667; // Normalize to 60fps (16.667ms per frame)

    // Update all balls
    for (const ball of this.balls) {
        ball.update({ width: this.canvasWidth, height: this.canvasHeight } as HTMLCanvasElement, timeScale);

        // Clamp velocity to prevent physics instability
        // Limit speed to roughly 80% of a block radius per frame
        const maxVelocity = (this.rowHeight / 1.5) * 0.8;
        if (ball.dy > maxVelocity) ball.dy = maxVelocity;
        if (ball.dy < -maxVelocity) ball.dy = -maxVelocity;
        if (ball.dx > maxVelocity) ball.dx = maxVelocity;
        if (ball.dx < -maxVelocity) ball.dx = -maxVelocity;

        // Hole Wall Collisions
        if (ball.x - ball.radius < this.holeLeft) {
            ball.x = this.holeLeft + ball.radius;
            if (Math.abs(ball.dx) > 1) SoundManager.playBounce(Math.abs(ball.dx) / 5);
            ball.dx *= -ball.elasticity;
        }
        if (ball.x + ball.radius > this.holeRight) {
            ball.x = this.holeRight - ball.radius;
            if (Math.abs(ball.dx) > 1) SoundManager.playBounce(Math.abs(ball.dx) / 5);
            ball.dx *= -ball.elasticity;
        }
    }

    // Camera follow deepest ball
    const deepestBall = this.balls.reduce((deepest, ball) => ball.y > deepest.y ? ball : deepest, this.balls[0]);
    const targetY = deepestBall.y - this.canvasHeight / 3;
    // Smoothly interpolate camera position towards target (up or down)
    this.offsetY = this.offsetY + (targetY - this.offsetY) * 0.1;
    
    // Infinite Generation
    let currentDeepestY = 250 + this.maxRowGenerated * this.rowHeight;
    while (this.offsetY + this.canvasHeight * 1.5 > currentDeepestY) {
        this.generateRows(this.maxRowGenerated, 50);
        currentDeepestY = 250 + this.maxRowGenerated * this.rowHeight;
    }

    // Check collisions for all balls
    for (let i = this.blocks.length - 1; i >= 0; i--) {
      const block = this.blocks[i];

      // Check collision with each ball
      for (const ball of this.balls) {
        // Skip if ball is too far from block
        if (Math.abs(block.y - ball.y) > 200 || Math.abs(block.x - ball.x) > 200) continue;

        if (this.checkCollision(ball, block)) {
          // Calculate effective damage (with bit booster multiplier)
          const damageMultiplier = this.bitBoosterTimer > 0 ? 2 : 1;
          const effectiveDamage = ball.damage * damageMultiplier;

          const destroyed = block.takeDamage(effectiveDamage);
          if (destroyed) {
            this.blocks.splice(i, 1);
            const efficiencyMult = 1 + (this.upgrades.efficiency - 1) * 0.2;
            const cashMultiplier = this.cashBoosterTimer > 0 ? 2 : 1;
            this.money += Math.ceil(block.value * efficiencyMult * cashMultiplier);
            SoundManager.playPop();

            // Handle special block effects
            if (block.type === 'bitBooster') {
              // Refresh timer (no stacking, just reset)
              this.bitBoosterTimer = this.BIT_BOOSTER_DURATION;
            } else if (block.type === 'cashBooster') {
              // Refresh cash booster timer
              this.cashBoosterTimer = this.CASH_BOOSTER_DURATION;
            } else if (block.type === 'explosive') {
              // Destroy adjacent blocks
              this.destroyAdjacentBlocks(block);
            }
            break; // Block destroyed, stop checking other balls
          }
        }
      }
    }
  }

  draw(context: CanvasRenderingContext2D) {
    context.save();
    context.translate(0, -this.offsetY);

    this.drawEnvironment(context, this.offsetY);

    // Draw depth markers (in world space, before clipping)
    if (this.gameState === 'PLAYING') {
        this.drawDepthMarkers(context);
    }

    // Clip to hole for blocks and ball
    context.save();
    context.beginPath();
    // Clip rect: Hole area with dynamic bounds for infinite depth support
    // Create clip region relative to current camera position
    const clipTop = this.offsetY - this.canvasHeight;
    const clipHeight = this.canvasHeight * 3;
    context.rect(this.holeLeft, clipTop, this.holeWidth, clipHeight);
    context.clip();

    this.blocks.forEach(block => {
        if (block.y - this.offsetY > this.canvasHeight + 500 || block.y - this.offsetY < -500) return;
        // Pass bounds for text hiding
        block.draw(context, 0, this.holeLeft, this.holeRight, this.settings.showHp);
    });

    // Draw all balls
    for (const ball of this.balls) {
        ball.draw(context);
    }
    
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

        // Calculate depth based on row index to be scale-invariant (use deepest ball)
        const radius = this.rowHeight / 1.5;
        const groundY = this.getGroundY();
        const startY = groundY + radius + 20;
        const deepestBall = this.balls.reduce((deepest, ball) => ball.y > deepest.y ? ball : deepest, this.balls[0]);
        const depth = Math.max(0, Math.floor((deepestBall.y - startY) / this.rowHeight * 2)); // 2m per row

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

        // Draw Bit Booster Timer Bar (Top Center)
        if (this.bitBoosterTimer > 0) {
            const barWidth = 200 * scale;
            const barHeight = 24 * scale;
            const barX = (this.canvasWidth - barWidth) / 2;
            const barY = hudMargin;
            const fillRatio = this.bitBoosterTimer / this.BIT_BOOSTER_DURATION;

            // Background
            context.fillStyle = 'rgba(50, 50, 50, 0.8)';
            context.beginPath();
            context.roundRect(barX, barY, barWidth, barHeight, 5 * scale);
            context.fill();

            // Fill (orange gradient for boost effect)
            const gradient = context.createLinearGradient(barX, barY, barX + barWidth * fillRatio, barY);
            gradient.addColorStop(0, '#FF8C00');
            gradient.addColorStop(1, '#FFA500');
            context.fillStyle = gradient;
            context.beginPath();
            context.roundRect(barX, barY, barWidth * fillRatio, barHeight, 5 * scale);
            context.fill();

            // Border
            context.strokeStyle = '#FF6600';
            context.lineWidth = 2 * scale;
            context.beginPath();
            context.roundRect(barX, barY, barWidth, barHeight, 5 * scale);
            context.stroke();

            // "2x DAMAGE" text
            context.fillStyle = 'white';
            context.font = `${12 * scale}px "Fredoka One", cursive`;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText('2x DAMAGE', barX + barWidth / 2, barY + barHeight / 2);
            context.textBaseline = 'alphabetic';
        }

        // Draw Cash Booster Timer Bar (Top Center, below bit booster)
        if (this.cashBoosterTimer > 0) {
            const barWidth = 200 * scale;
            const barHeight = 24 * scale;
            const barX = (this.canvasWidth - barWidth) / 2;
            const barGap = 5 * scale;
            const barY = hudMargin + (this.bitBoosterTimer > 0 ? barHeight + barGap : 0);
            const fillRatio = this.cashBoosterTimer / this.CASH_BOOSTER_DURATION;

            // Background
            context.fillStyle = 'rgba(50, 50, 50, 0.8)';
            context.beginPath();
            context.roundRect(barX, barY, barWidth, barHeight, 5 * scale);
            context.fill();

            // Fill (green gradient for cash boost effect)
            const gradient = context.createLinearGradient(barX, barY, barX + barWidth * fillRatio, barY);
            gradient.addColorStop(0, '#00AA00');
            gradient.addColorStop(1, '#00FF00');
            context.fillStyle = gradient;
            context.beginPath();
            context.roundRect(barX, barY, barWidth * fillRatio, barHeight, 5 * scale);
            context.fill();

            // Border
            context.strokeStyle = '#00CC00';
            context.lineWidth = 2 * scale;
            context.beginPath();
            context.roundRect(barX, barY, barWidth, barHeight, 5 * scale);
            context.stroke();

            // "2x MONEY" text
            context.fillStyle = 'white';
            context.font = `${12 * scale}px "Fredoka One", cursive`;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText('2x MONEY', barX + barWidth / 2, barY + barHeight / 2);
            context.textBaseline = 'alphabetic';
        }

        // Draw Notification (Top-Center, below HUD)
        if (this.notificationTimer > 0) {
            context.save();
            const alpha = Math.min(1, this.notificationTimer / 500); // Fade out in last 500ms
            context.globalAlpha = alpha;

            // Position below the pause button and HUD
            const notifY = hudMargin + (80 * scale) + (30 * scale); // Below HUD with 30px gap

            // Background box for better readability
            context.font = `${22 * scale}px "Fredoka One", cursive`;
            context.textAlign = 'center';
            context.textBaseline = 'middle';

            // Measure text width for background
            const textMetrics = context.measureText(this.notificationText);
            const textWidth = textMetrics.width;
            const padding = 20 * scale;
            const boxWidth = textWidth + padding * 2;
            const boxHeight = 40 * scale;
            const boxX = (this.canvasWidth - boxWidth) / 2;
            const boxY = notifY - boxHeight / 2;

            // Draw background with shadow
            context.shadowColor = 'rgba(0, 0, 0, 0.5)';
            context.shadowBlur = 10 * scale;
            context.shadowOffsetY = 3 * scale;

            context.fillStyle = 'rgba(76, 175, 80, 0.95)'; // Green background
            context.beginPath();
            context.roundRect(boxX, boxY, boxWidth, boxHeight, 8 * scale);
            context.fill();

            // Reset shadow for text
            context.shadowColor = 'rgba(0, 0, 0, 0.8)';
            context.shadowBlur = 4 * scale;
            context.shadowOffsetY = 2 * scale;

            // Draw text
            context.fillStyle = 'white';
            context.fillText(this.notificationText, this.canvasWidth / 2, notifY);

            context.restore();
        }

        // Draw Prestige Button (Bottom Center)
        const prestigeBtnW = 180 * scale;
        const prestigeBtnH = 50 * scale;
        const prestigeBtnX = (this.canvasWidth - prestigeBtnW) / 2;
        const prestigeBtnY = this.canvasHeight - prestigeBtnH - hudMargin;

        const canPrestige = depth >= 1000;
        const offset = (this.activeButton === 'prestige' && canPrestige) ? 3 * scale : 0;

        // Shadow
        context.fillStyle = canPrestige ? '#7b1fa2' : '#555'; // Purple or grey
        context.beginPath();
        context.roundRect(prestigeBtnX, prestigeBtnY + (5 * scale), prestigeBtnW, prestigeBtnH, 5 * scale);
        context.fill();

        // Face
        context.fillStyle = canPrestige ? '#9c27b0' : '#777'; // Lighter purple or grey
        context.beginPath();
        context.roundRect(prestigeBtnX, prestigeBtnY + offset, prestigeBtnW, prestigeBtnH, 5 * scale);
        context.fill();

        // Text
        context.fillStyle = canPrestige ? 'white' : '#999';
        context.font = `${22 * scale}px "Fredoka One", cursive`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.shadowColor = 'rgba(0,0,0,0.5)';
        context.shadowBlur = 2 * scale;
        context.fillText('PRESTIGE', prestigeBtnX + prestigeBtnW / 2, prestigeBtnY + (prestigeBtnH / 2) + offset);
        context.shadowBlur = 0;

        // Show tooltip above button if hovered and not available
        if (this.prestigeButtonHovered && !canPrestige) {
            context.font = `${16 * scale}px "Fredoka One", cursive`;
            context.fillStyle = 'white';
            context.textAlign = 'center';
            context.textBaseline = 'bottom';
            context.shadowColor = 'rgba(0, 0, 0, 0.9)';
            context.shadowBlur = 6 * scale;
            context.shadowOffsetX = 2 * scale;
            context.shadowOffsetY = 2 * scale;
            context.fillText('Reach 1000m to prestige', prestigeBtnX + prestigeBtnW / 2, prestigeBtnY - (10 * scale));
            context.shadowBlur = 0;
            context.shadowOffsetX = 0;
            context.shadowOffsetY = 0;
        }

        context.textBaseline = 'alphabetic';
    }
  }

  drawEnvironment(context: CanvasRenderingContext2D, offsetY: number) {
    const groundY = this.getGroundY();
    const cornerRadius = 20;
    const borderColor = '#333333'; // Dark grey for borders
    const borderWidth = 2;

    // Sky (Full Width)
    context.fillStyle = '#87CEEB';
    context.fillRect(0, -10000, this.canvasWidth, 10000 + groundY + 100);

    // Hole Background (Darker Brown - textured) with Parallax Effect
    // Parallax factor: 0.3 means background moves at 30% speed (more dramatic effect)
    const parallaxFactor = 0.3;
    const parallaxAdjustment = offsetY * (1 - parallaxFactor);

    context.save();
    context.translate(0, parallaxAdjustment); // Apply parallax offset

    // Start drawing well above the visible area to prevent gaps at the top
    // The parallax offset can move this up, so we need extra coverage
    const holeBackgroundStartY = groundY - 2000;

    context.fillStyle = this.dirtPattern || '#4A2C2A'; // Use pattern, fallback to solid dark brown
    context.fillRect(this.holeLeft, holeBackgroundStartY, this.holeWidth, 1002000);
    // Overlay a semi-transparent dark color to make it darker than the walls
    context.fillStyle = 'rgba(0, 0, 0, 0.3)'; // Adjust alpha for desired darkness
    context.fillRect(this.holeLeft, holeBackgroundStartY, this.holeWidth, 1002000);

    context.restore(); // Remove parallax offset

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

  drawDepthMarkers(context: CanvasRenderingContext2D) {
      const scale = Math.min(this.canvasWidth, this.canvasHeight) / 1000;

      // Calculate depth parameters (same as HUD depth calculation)
      const radius = this.rowHeight / 1.5;
      const groundY = this.getGroundY();
      const startY = groundY + radius + 20;

      // Screen bounds in world space
      const screenTop = this.offsetY;
      const screenBottom = this.offsetY + this.canvasHeight;

      // Draw markers every 50m, starting at 50m
      const markerInterval = 50; // meters

      // Calculate which markers are visible
      // depth (in meters) = (y - startY) / rowHeight * 2
      // So y = startY + (depth / 2) * rowHeight

      const minVisibleDepth = Math.max(0, Math.floor((screenTop - startY) / this.rowHeight * 2 / markerInterval)) * markerInterval;
      const maxVisibleDepth = Math.ceil((screenBottom - startY) / this.rowHeight * 2 / markerInterval) * markerInterval;

      context.fillStyle = 'white';
      context.font = `${24 * scale}px "Fredoka One", cursive`;
      context.textAlign = 'right';
      context.textBaseline = 'middle';

      // Add subtle shadow for readability
      context.shadowColor = 'rgba(0, 0, 0, 0.8)';
      context.shadowBlur = 4 * scale;
      context.shadowOffsetX = 2 * scale;
      context.shadowOffsetY = 2 * scale;

      for (let depth = minVisibleDepth; depth <= maxVisibleDepth + markerInterval; depth += markerInterval) {
          if (depth < markerInterval) continue; // Start at 50m

          // Calculate Y position in world space
          const markerY = startY + (depth / 2) * this.rowHeight;

          // Position to the left of the hole, on the dirt wall
          const markerX = this.holeLeft - 10 * scale;

          context.fillText(`${depth}m`, markerX, markerY);
      }

      // Reset shadow
      context.shadowBlur = 0;
      context.shadowOffsetX = 0;
      context.shadowOffsetY = 0;
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
      
      let btnW = 200 * scale;
      if (this.menuState === 'SHOP') {
          btnW = 400 * scale;
      }
      
      const btnHeight = 55 * scale;
      const gap = 25 * scale;
      const titleLineHeight = 60 * scale;

      const btnX = this.canvasWidth / 2 - btnW / 2;
      
      let boxH = 0;
      if (this.menuState === 'MAIN') {
          // Extra space for SHOP button (btnHeight + gap)
          boxH = margin + titleLineHeight + gap + (btnHeight * 4) + (gap * 3) + (30 * scale) + margin;
      } else if (this.menuState === 'SHOP') {
          // Shop Height: Title + 2 section headers + 6 items + back button
          const sectionHeaderH = 30 * scale;
          const itemHeight = 75 * scale;
          const gapSmall = 15 * scale;
          boxH = margin + titleLineHeight + gap  // Title area
               + sectionHeaderH + gapSmall       // "General Upgrades" header
               + (itemHeight + gapSmall) * 3     // 3 general items
               + sectionHeaderH + gapSmall       // "Block Upgrades" header
               + (itemHeight + gapSmall) * 3     // 3 block items (Bit Boosters, Cash Boosters, Explosive Blocks)
               + btnHeight + margin;             // Back button
      } else {
          // Settings Height: Title + Volume + 3 Toggles + Back + Spacing
          boxH = 520 * scale;
      }
      
      const boxW = btnW + (margin * 2);
      const boxX = this.canvasWidth / 2 - boxW / 2;
      const boxY = this.canvasHeight / 2 - boxH / 2;

      // Y positions relative to canvas
      const titleY = boxY + margin + titleLineHeight / 2;
      const resumeBtnY = boxY + margin + titleLineHeight + gap;
      const shopBtnY = resumeBtnY + btnHeight + gap;
      const settingsBtnY = shopBtnY + btnHeight + gap;
      const saveBtnY = settingsBtnY + btnHeight + gap;
      const backBtnY = boxY + boxH - btnHeight - margin;

      return {
          scale, margin, gap, btnW, btnHeight, btnX,
          boxX, boxY, boxW, boxH,
          titleY, resumeBtnY, shopBtnY, settingsBtnY, saveBtnY, backBtnY
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
    } else if (this.menuState === 'SHOP') {
        this.drawShop(context, layout);
    }
  }

  drawPauseMain(context: CanvasRenderingContext2D, layout: MenuLayout) {
    const { btnX, btnW, btnHeight, resumeBtnY, shopBtnY, settingsBtnY, saveBtnY, titleY, scale, boxY, boxH } = layout;
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
    drawButton("SHOP", shopBtnY, 'shop', '#9c27b0', '#7b1fa2');
    drawButton("SETTINGS", settingsBtnY, 'settings', '#ff9800', '#f57c00');
    drawButton("SAVE GAME", saveBtnY, 'save', '#2196f3', '#1565c0');

    // Notification Text
    if (this.notificationTimer > 0) {
        context.save();
        const alpha = Math.min(1, this.notificationTimer / 500);
        context.globalAlpha = alpha;

        // Positioned below the Save button (centered in the remaining space)
        const bottomSpaceStart = saveBtnY + btnHeight;
        const bottomSpaceEnd = boxY + boxH;
        const notifY = (bottomSpaceStart + bottomSpaceEnd) / 2;

        // Background box for better readability
        context.font = `${22 * scale}px "Fredoka One", cursive`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        // Measure text width for background
        const textMetrics = context.measureText(this.notificationText);
        const textWidth = textMetrics.width;
        const padding = 20 * scale;
        const notifBoxWidth = Math.min(textWidth + padding * 2, btnW); // Cap at button width
        const notifBoxHeight = 40 * scale;
        const notifBoxX = (this.canvasWidth - notifBoxWidth) / 2;
        const notifBoxY = notifY - notifBoxHeight / 2;

        // Draw background with shadow
        context.shadowColor = 'rgba(0, 0, 0, 0.5)';
        context.shadowBlur = 10 * scale;
        context.shadowOffsetY = 3 * scale;

        context.fillStyle = 'rgba(76, 175, 80, 0.95)'; // Green background
        context.beginPath();
        context.roundRect(notifBoxX, notifBoxY, notifBoxWidth, notifBoxHeight, 8 * scale);
        context.fill();

        // Reset shadow for text
        context.shadowColor = 'rgba(0, 0, 0, 0.8)';
        context.shadowBlur = 4 * scale;
        context.shadowOffsetY = 2 * scale;

        // Draw text
        context.fillStyle = 'white';
        context.fillText(this.notificationText, this.canvasWidth / 2, notifY);

        context.restore();
    }
    
    context.textBaseline = 'alphabetic';
  }

  drawSettings(context: CanvasRenderingContext2D, layout: MenuLayout) {
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

  getShopPrices() {
      return {
          damage: Math.floor(100 * Math.pow(1.5, this.upgrades.damage - 1)),
          gravity: Math.floor(50 * Math.pow(1.4, this.upgrades.gravity - 1)),
          efficiency: Math.floor(200 * Math.pow(1.6, this.upgrades.efficiency - 1)),
          // Block Upgrades (max level 10)
          bitBoosters: this.upgrades.bitBoosters >= 10 ? Infinity : Math.floor(150 * Math.pow(1.5, this.upgrades.bitBoosters)),
          explosiveBlocks: this.upgrades.explosiveBlocks >= 10 ? Infinity : Math.floor(150 * Math.pow(1.5, this.upgrades.explosiveBlocks)),
          cashBoosters: this.upgrades.cashBoosters >= 10 ? Infinity : Math.floor(150 * Math.pow(1.5, this.upgrades.cashBoosters))
      };
  }

  buyUpgrade(type: 'damage' | 'gravity' | 'efficiency' | 'bitBoosters' | 'explosiveBlocks' | 'cashBoosters'): boolean {
      const prices = this.getShopPrices();
      const cost = prices[type];

      // Check max level for block upgrades
      if ((type === 'bitBoosters' || type === 'explosiveBlocks' || type === 'cashBoosters') && this.upgrades[type] >= 10) {
          this.showNotification("Max level reached!");
          return false;
      }

      if (this.money >= cost) {
          this.money -= cost;
          this.upgrades[type]++;

          // Apply Upgrade Effects Immediately to all balls
          if (type === 'damage') {
              for (const ball of this.balls) {
                  ball.damage = this.upgrades.damage; // Simple linear scaling
              }
          } else if (type === 'gravity') {
              const radius = this.rowHeight / 1.5;
              const gravityMult = 1 + (this.upgrades.gravity - 1) * 0.1;
              for (const ball of this.balls) {
                  ball.gravity = radius * 0.02 * gravityMult;
              }
          } else if (type === 'bitBoosters' || type === 'explosiveBlocks' || type === 'cashBoosters') {
              // Re-roll existing blocks to apply new upgrade immediately
              this.rerollExistingBlocks();
          }

          // Map upgrade type to display name
          const upgradeNames: Record<typeof type, string> = {
              damage: 'Drill Bit',
              gravity: 'Engine',
              efficiency: 'Scanner',
              bitBoosters: 'Bit Boosters',
              explosiveBlocks: 'Explosive Blocks',
              cashBoosters: 'Cash Boosters'
          };

          this.showNotification(`Upgraded ${upgradeNames[type]}!`);
          this.saveGame(); // Auto-save on purchase
          return true;
      } else {
          this.showNotification("Not enough money!");
          return false;
      }
  }

  drawShop(context: CanvasRenderingContext2D, layout: MenuLayout) {
    const { btnX, btnW, btnHeight, backBtnY, titleY, scale, boxY, boxH, margin, gap } = layout;
    const titleText = "SHOP";

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

    // Money Display (Top Right of Box)
    context.font = `${24 * scale}px "Fredoka One", cursive`;
    context.textAlign = 'right';
    context.fillStyle = '#FFD700'; // Gold
    context.fillText(`$${this.money}`, btnX + btnW, titleY);

    // --- Layout Constants ---
    const sectionHeaderH = 30 * scale;
    const itemHeight = 75 * scale;
    const gapSmall = 15 * scale;
    const prices = this.getShopPrices();
    let currentY = boxY + margin + (60 * scale) + gap;

    // --- Helper: Draw Section Header ---
    const drawSectionHeader = (text: string) => {
        context.fillStyle = '#888';
        context.font = `${18 * scale}px "Fredoka One", cursive`;
        context.textAlign = 'left';
        context.textBaseline = 'middle';
        context.fillText(text, btnX, currentY + sectionHeaderH / 2);
        currentY += sectionHeaderH + gapSmall;
    };

    // --- Helper: Draw General Shop Item ---
    const drawGeneralItem = (name: string, type: 'damage' | 'gravity' | 'efficiency', effect: string) => {
        const btnId = `buy_${type}`;
        const offset = (this.activeButton === btnId) ? 2 * scale : 0;
        const y = currentY + offset;

        // Item Box Background
        context.fillStyle = 'rgba(255, 255, 255, 0.1)';
        context.beginPath();
        context.roundRect(btnX, y, btnW, itemHeight, 5 * scale);
        context.fill();

        if (this.activeButton === btnId) {
            context.strokeStyle = 'yellow';
            context.lineWidth = 4 * scale;
            context.stroke();
        }

        const level = this.upgrades[type];
        const cost = prices[type];
        const canAfford = this.money >= cost;

        // Name & Level
        context.textAlign = 'left';
        context.textBaseline = 'top';
        context.fillStyle = 'white';
        context.font = `${22 * scale}px "Fredoka One", cursive`;
        context.fillText(`${name} (Lvl ${level})`, btnX + 10 * scale, y + 10 * scale);

        // Effect description
        context.fillStyle = '#aaa';
        context.font = `${16 * scale}px "Fredoka One", cursive`;
        context.fillText(effect, btnX + 10 * scale, y + 40 * scale);

        // Buy Button
        const buyBtnW = 100 * scale;
        const buyBtnH = 40 * scale;
        const buyBtnX = btnX + btnW - buyBtnW - 10 * scale;
        const buyBtnY = y + (itemHeight - buyBtnH) / 2;

        context.fillStyle = canAfford ? '#4caf50' : '#555';
        context.beginPath();
        context.roundRect(buyBtnX, buyBtnY, buyBtnW, buyBtnH, 5 * scale);
        context.fill();

        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = canAfford ? 'white' : '#888';
        context.font = `${18 * scale}px "Fredoka One", cursive`;
        context.fillText(`$${cost}`, buyBtnX + buyBtnW / 2, buyBtnY + buyBtnH / 2);

        currentY += itemHeight + gapSmall;
    };

    // --- Helper: Draw Block Upgrade Item ---
    const drawBlockItem = (name: string, type: 'bitBoosters' | 'explosiveBlocks' | 'cashBoosters', description: string, glowColor: string) => {
        const btnId = `buy_${type}`;
        const offset = (this.activeButton === btnId) ? 2 * scale : 0;
        const y = currentY + offset;

        const level = this.upgrades[type];
        const maxLevel = 10;
        const isMaxed = level >= maxLevel;
        const cost = prices[type];
        const canAfford = !isMaxed && this.money >= cost;
        const spawnChance = level * 1; // 1% per level

        // Item Box Background
        context.fillStyle = 'rgba(255, 255, 255, 0.1)';
        context.beginPath();
        context.roundRect(btnX, y, btnW, itemHeight, 5 * scale);
        context.fill();

        // Glow border to indicate block type color
        context.strokeStyle = glowColor;
        context.lineWidth = 2 * scale;
        context.stroke();

        if (this.activeButton === btnId) {
            context.strokeStyle = 'yellow';
            context.lineWidth = 4 * scale;
            context.stroke();
        }

        // Name & Level
        context.textAlign = 'left';
        context.textBaseline = 'top';
        context.fillStyle = 'white';
        context.font = `${22 * scale}px "Fredoka One", cursive`;
        context.fillText(`${name} (${level}/${maxLevel})`, btnX + 10 * scale, y + 10 * scale);

        // Description and spawn chance
        context.fillStyle = '#aaa';
        context.font = `${16 * scale}px "Fredoka One", cursive`;
        const effectText = level > 0 ? `${spawnChance}% chance - ${description}` : `Unlock: ${description}`;
        context.fillText(effectText, btnX + 10 * scale, y + 40 * scale);

        // Buy Button
        const buyBtnW = 100 * scale;
        const buyBtnH = 40 * scale;
        const buyBtnX = btnX + btnW - buyBtnW - 10 * scale;
        const buyBtnY = y + (itemHeight - buyBtnH) / 2;

        context.fillStyle = isMaxed ? '#333' : (canAfford ? '#4caf50' : '#555');
        context.beginPath();
        context.roundRect(buyBtnX, buyBtnY, buyBtnW, buyBtnH, 5 * scale);
        context.fill();

        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = isMaxed ? '#666' : (canAfford ? 'white' : '#888');
        context.font = `${18 * scale}px "Fredoka One", cursive`;
        context.fillText(isMaxed ? 'MAX' : `$${cost}`, buyBtnX + buyBtnW / 2, buyBtnY + buyBtnH / 2);

        currentY += itemHeight + gapSmall;
    };

    // === GENERAL UPGRADES SECTION ===
    drawSectionHeader('GENERAL UPGRADES');
    drawGeneralItem("Drill Bit", 'damage', `Damage: ${this.upgrades.damage}`);
    drawGeneralItem("Engine", 'gravity', `Speed: +${Math.round((this.upgrades.gravity - 1) * 10)}%`);
    drawGeneralItem("Scanner", 'efficiency', `Value: +${Math.round((this.upgrades.efficiency - 1) * 20)}%`);

    // === BLOCK UPGRADES SECTION ===
    drawSectionHeader('BLOCK UPGRADES');
    drawBlockItem("Bit Boosters", 'bitBoosters', '2x damage for 5s', '#FFA500');
    drawBlockItem("Cash Boosters", 'cashBoosters', '2x money for 5s', '#00CC00');
    drawBlockItem("Explosive Blocks", 'explosiveBlocks', 'Destroy neighbors', '#FF4444');

    // Back Button (Bottom)
    const offset = (this.activeButton === 'back') ? 3 * scale : 0;

    context.fillStyle = '#d32f2f';
    context.beginPath();
    context.roundRect(btnX, backBtnY + (5 * scale), btnW, btnHeight, 5 * scale);
    context.fill();

    context.fillStyle = '#f44336';
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

    // Notification Text
    if (this.notificationTimer > 0) {
        context.save();
        const alpha = Math.min(1, this.notificationTimer / 500);
        context.globalAlpha = alpha;

        // Positioned below the Back button
        const bottomSpaceStart = backBtnY + btnHeight;
        const bottomSpaceEnd = boxY + boxH;
        const notifY = (bottomSpaceStart + bottomSpaceEnd) / 2;

        // Background box for better readability
        context.font = `${22 * scale}px "Fredoka One", cursive`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        // Measure text width for background
        const textMetrics = context.measureText(this.notificationText);
        const textWidth = textMetrics.width;
        const padding = 20 * scale;
        const notifBoxWidth = Math.min(textWidth + padding * 2, btnW); // Cap at button width
        const notifBoxHeight = 40 * scale;
        const notifBoxX = (this.canvasWidth - notifBoxWidth) / 2;
        const notifBoxY = notifY - notifBoxHeight / 2;

        // Draw background with shadow
        context.shadowColor = 'rgba(0, 0, 0, 0.5)';
        context.shadowBlur = 10 * scale;
        context.shadowOffsetY = 3 * scale;

        context.fillStyle = 'rgba(76, 175, 80, 0.95)'; // Green background
        context.beginPath();
        context.roundRect(notifBoxX, notifBoxY, notifBoxWidth, notifBoxHeight, 8 * scale);
        context.fill();

        // Reset shadow for text
        context.shadowColor = 'rgba(0, 0, 0, 0.8)';
        context.shadowBlur = 4 * scale;
        context.shadowOffsetY = 2 * scale;

        // Draw text
        context.fillStyle = 'white';
        context.fillText(this.notificationText, this.canvasWidth / 2, notifY);

        context.restore();
    }

    context.textBaseline = 'alphabetic';
  }

  togglePause() {
      if (this.gameState === 'PLAYING') {
          this.gameState = 'PAUSED';
          this.menuState = 'MAIN'; // Always open to main menu
          // Clear any in-game notifications (like offline progress) when pausing
          this.notificationTimer = 0;
          this.notificationText = "";
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
        this.prestigeButtonHovered = false;
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
                    for (const ball of this.balls) {
                        ball.dx = (Math.random() - 0.5) * (radius * 0.15); // Scaled horizontal speed
                        ball.dy = radius * 0.4; // Stronger vertical speed (0.4)
                    }
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
        const { btnX, btnW, btnHeight, resumeBtnY, shopBtnY, settingsBtnY, saveBtnY, backBtnY, scale, boxY, margin, gap } = layout;

        if (this.menuState === 'MAIN') {
            // Check Resume
            const insideResume = x >= btnX && x <= btnX + btnW && y >= resumeBtnY && y <= resumeBtnY + btnHeight + (5 * scale);
            // Check Shop
            const insideShop = x >= btnX && x <= btnX + btnW && y >= shopBtnY && y <= shopBtnY + btnHeight + (5 * scale);
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
            else if (insideShop) {
                if (type === 'mousemove') this.isHoveringButton = true;
                if (type === 'mousedown') {
                    this.activeButton = 'shop';
                } else if (type === 'mouseup' && this.activeButton === 'shop') {
                    this.shopOpenedFromHUD = false; // Opened from pause menu, not HUD
                    this.menuState = 'SHOP';
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
                    this.saveGame(true); // Show notification for manual save
                    this.activeButton = null;
                }
            }
            else {
                if (type === 'mouseup') this.activeButton = null;
            }
        } else if (this.menuState === 'SETTINGS') {
             const startY = boxY + margin + (60 * scale) + gap; 
             const btnHeightSmall = 45 * scale;
             const gapSmall = 15 * scale;

             const volLabelY = startY + 20 * scale;
             const sliderX = btnX + 105 * scale;
             const sliderW = btnW - 105 * scale;
             const sliderH = 24 * scale; 
             const sliderY = volLabelY - sliderH / 2;
             
             if ((type === 'mousedown' || (type === 'mousemove' && this.isResizing)) && 
                 x >= sliderX - 10 && x <= sliderX + sliderW + 10 && 
                 y >= sliderY - 10 && y <= sliderY + sliderH + 10) {
                 
                 this.isResizing = true; 
                 let vol = (x - sliderX) / sliderW;
                 if (vol < 0) vol = 0;
                 if (vol > 1) vol = 1;
                 this.settings.volume = vol;
                 SoundManager.volume = vol;
                 if (type === 'mousedown') this.activeButton = 'volume';
             }
             if (type === 'mouseup') this.isResizing = false;

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

             const insideBack = x >= btnX && x <= btnX + btnW && y >= backBtnY && y <= backBtnY + btnHeight + (5 * scale);
             if (insideBack) {
                 if (type === 'mousemove') this.isHoveringButton = true;
                 if (type === 'mousedown') {
                     this.activeButton = 'back';
                 } else if (type === 'mouseup' && this.activeButton === 'back') {
                     // Clear any notifications when leaving settings
                     this.notificationTimer = 0;
                     this.notificationText = "";
                     this.menuState = 'MAIN';
                     this.activeButton = null;
                 }
             } else {
                 if (type === 'mouseup' && !this.isResizing) this.activeButton = null;
             }
        } else if (this.menuState === 'SHOP') {
            const sectionHeaderH = 30 * scale;
            const itemHeight = 75 * scale;
            const gapSmall = 15 * scale;
            let currentY = boxY + margin + (60 * scale) + gap;

            // Calculate Y positions for all items (matching drawShop layout)
            // Section 1: General Upgrades
            currentY += sectionHeaderH + gapSmall; // Skip header
            const damageY = currentY;
            currentY += itemHeight + gapSmall;
            const gravityY = currentY;
            currentY += itemHeight + gapSmall;
            const efficiencyY = currentY;
            currentY += itemHeight + gapSmall;

            // Section 2: Block Upgrades
            currentY += sectionHeaderH + gapSmall; // Skip header
            const bitBoostersY = currentY;
            currentY += itemHeight + gapSmall;
            const cashBoostersY = currentY;
            currentY += itemHeight + gapSmall;
            const explosiveBlocksY = currentY;

            // Back Button (Checked first to ensure it works)
            const insideBack = x >= btnX && x <= btnX + btnW && y >= backBtnY && y <= backBtnY + btnHeight + (5 * scale);
            if (insideBack) {
                if (type === 'mousemove') this.isHoveringButton = true;

                if (type === 'mousedown') {
                    this.activeButton = 'back';
                } else if (type === 'mouseup') {
                    if (this.activeButton === 'back') {
                        // Clear any purchase notifications when leaving shop
                        this.notificationTimer = 0;
                        this.notificationText = "";

                        if (this.shopOpenedFromHUD) {
                            // Resume game directly if shop was opened from HUD
                            this.gameState = 'PLAYING';
                            this.shopOpenedFromHUD = false;
                        } else {
                            // Go back to pause menu if opened normally
                            this.menuState = 'MAIN';
                        }
                        this.activeButton = null;
                    } else {
                        // Released over back button but started elsewhere -> Clear active state
                        this.activeButton = null;
                    }
                }
                return; // Exit early if back button handled
            }

            // Check each shop item
            const items: Array<{type: 'damage' | 'gravity' | 'efficiency' | 'bitBoosters' | 'explosiveBlocks' | 'cashBoosters', y: number}> = [
                { type: 'damage', y: damageY },
                { type: 'gravity', y: gravityY },
                { type: 'efficiency', y: efficiencyY },
                { type: 'bitBoosters', y: bitBoostersY },
                { type: 'cashBoosters', y: cashBoostersY },
                { type: 'explosiveBlocks', y: explosiveBlocksY }
            ];

            for (const item of items) {
                if (y >= item.y && y <= item.y + itemHeight && x >= btnX && x <= btnX + btnW) {
                    const btnId = `buy_${item.type}`;
                    const prices = this.getShopPrices();
                    const cost = prices[item.type];
                    const canAfford = this.money >= cost;

                    // Check for max level on block upgrades
                    const isMaxed = (item.type === 'bitBoosters' || item.type === 'explosiveBlocks' || item.type === 'cashBoosters') && this.upgrades[item.type] >= 10;

                    if (type === 'mousemove') this.isHoveringButton = true;
                    // Only set active button if player can afford it and it's not maxed
                    if (type === 'mousedown' && canAfford && !isMaxed) this.activeButton = btnId;
                    if (type === 'mouseup') {
                        try {
                            const success = this.buyUpgrade(item.type);
                            this.activeButton = null;
                            if (success) {
                                SoundManager.playPop();
                            }
                        } catch (e) {
                            console.error(e);
                            this.showNotification("Error Buying!");
                            this.activeButton = null;
                        }
                    }
                    return;
                }
            }

            if (type === 'mouseup') {
                this.activeButton = null;
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

        // Check for HUD info box click (Top Right - Depth/Money display)
        const hudW = 200 * scale;
        const hudH = 80 * scale;
        const hudX = this.canvasWidth - hudW - hudMargin;
        const hudY = hudMargin;

        const insideHUD = x >= hudX && x <= hudX + hudW && y >= hudY && y <= hudY + hudH;

        if (insideHUD) {
            if (type === 'mousemove') this.isHoveringButton = true;
            if (type === 'mousedown') {
                this.activeButton = 'hud_info';
            } else if (type === 'mouseup' && this.activeButton === 'hud_info') {
                // Open shop directly from HUD
                this.shopOpenedFromHUD = true;
                this.gameState = 'PAUSED';
                this.menuState = 'SHOP';
                this.activeButton = null;
            }
            return;
        }

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
                this.saveGame(true); // Show notification for manual save
                this.activeButton = null;
            }
            return;
        }

        // Check for Prestige Button click (Bottom Center)
        const prestigeBtnW = 180 * scale;
        const prestigeBtnH = 50 * scale;
        const prestigeBtnX = (this.canvasWidth - prestigeBtnW) / 2;
        const prestigeBtnY = this.canvasHeight - prestigeBtnH - hudMargin;

        // Calculate depth to check if prestige is available (use deepest ball)
        const radius = this.rowHeight / 1.5;
        const groundY = this.getGroundY();
        const startY = groundY + radius + 20;
        const deepestBall = this.balls.reduce((deepest, ball) => ball.y > deepest.y ? ball : deepest, this.balls[0]);
        const depth = Math.max(0, Math.floor((deepestBall.y - startY) / this.rowHeight * 2));
        const canPrestige = depth >= 1000;

        const insidePrestige = x >= prestigeBtnX && x <= prestigeBtnX + prestigeBtnW && y >= prestigeBtnY && y <= prestigeBtnY + prestigeBtnH + (5 * scale);

        if (insidePrestige) {
            if (type === 'mousemove') {
                this.isHoveringButton = true;
                this.prestigeButtonHovered = true;
            }
            if (type === 'mousedown' && canPrestige) {
                this.activeButton = 'prestige';
            } else if (type === 'mouseup' && this.activeButton === 'prestige' && canPrestige) {
                this.prestige();
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
