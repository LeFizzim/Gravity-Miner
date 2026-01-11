# Gravity Miner

**Gravity Miner** is an infinite, physics-based idle game where you watch a powerful drilling ball descend into the depths of the earth.

## How It Works

The game operates on a simple but satisfying premise: a ball is dropped into a hole filled with layers of hexagonal blocks. Using a custom physics engine, the ball bounces off the walls and blocks, dealing damage with every collision.

*   **Destruction**: Blocks have health points. When the ball hits them enough times, they break.
*   **Progression**: Breaking blocks earns you money and clears the path deeper underground.
*   **Infinite Depth**: The world is procedurally generated as you fall. There is no bottom, only deeper and tougher layers to uncover.
*   **Idle Gameplay**: Once started, the ball does the work for you. Sit back and watch the mining happen.
*   **Offline Progress**: Earn money even when the tab is minimized or unfocused. The game calculates your earnings based on your current depth and upgrades.

## Core Features

### Upgrades & Shop
Spend your hard-earned money on powerful upgrades:
*   **Drill Bit**: Increase damage dealt to blocks
*   **Engine**: Speed up the ball's descent with increased gravity
*   **Scanner**: Boost the value of blocks you destroy

### Special Block Types
Discover rare special blocks as you dig deeper:
*   **Bit Boosters** (Orange glow): Activate a 5-second 2x damage multiplier
*   **Cash Boosters** (Green glow): Activate a 5-second 2x money multiplier
*   **Explosive Blocks** (Red glow): Destroy all neighboring blocks in a chain reaction

### Prestige System
Reach extreme depths (1000m+) to prestige and gain additional drilling balls, multiplying your destruction potential.

## Technology Stack

This project was built using modern web technologies to ensure high performance and smooth visuals:

*   **React**: Used for the application framework and managing the game's user interface overlay.
*   **TypeScript**: Provides type safety and robust code structure for the game logic.
*   **Vite**: A fast build tool that powers the development environment and optimizes the final application.
*   **HTML5 Canvas**: The core of the game engine. All rendering, from the textured dirt walls to the bouncing ball and hexagonal grid, is drawn directly to the canvas for maximum performance and visual control.