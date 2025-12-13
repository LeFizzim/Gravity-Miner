# Gravity Miner

**Gravity Miner** is an infinite, physics-based idle game where you watch a powerful drilling ball descend into the depths of the earth.

## How It Works

The game operates on a simple but satisfying premise: a ball is dropped into a hole filled with layers of hexagonal blocks. Using a custom physics engine, the ball bounces off the walls and blocks, dealing damage with every collision.

*   **Destruction**: Blocks have health points. When the ball hits them enough times, they break.
*   **Progression**: Breaking blocks earns you money and clears the path deeper underground.
*   **Infinite Depth**: The world is procedurally generated as you fall. There is no bottom, only deeper and tougher layers to uncover.
*   **Idle Gameplay**: Once started, the ball does the work for you. Sit back and watch the mining happen.

## Technology Stack

This project was built using modern web technologies to ensure high performance and smooth visuals:

*   **React**: Used for the application framework and managing the game's user interface overlay.
*   **TypeScript**: Provides type safety and robust code structure for the game logic.
*   **Vite**: A fast build tool that powers the development environment and optimizes the final application.
*   **HTML5 Canvas**: The core of the game engine. All rendering, from the textured dirt walls to the bouncing ball and hexagonal grid, is drawn directly to the canvas for maximum performance and visual control.