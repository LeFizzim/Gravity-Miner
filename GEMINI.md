# Gravity Miner

**Gravity Miner** is an infinite, physics-based idle game built with React, TypeScript, and HTML5 Canvas. The player watches a drilling ball descend into procedurally generated depths, breaking blocks and earning currency.

## Project Overview

*   **Type:** Web Application (Game)
*   **Framework:** React + Vite
*   **Language:** TypeScript
*   **Rendering:** HTML5 Canvas (2D Context)
*   **Physics:** Custom AABB/Circle collision engine with hexagon grid support.

## Architecture

The project separates the React application shell from the imperative game logic.

1.  **React Shell (`src/App.tsx`, `src/components/GameCanvas.tsx`):**
    *   Sets up the DOM and Canvas element.
    *   Manages the window resize events and input listeners (Mouse/Touch/Keyboard).
    *   Initiates the main game loop (`requestAnimationFrame`).

2.  **Game Engine (`src/game/GameEngine.ts`):**
    *   **State Management:** Handles game states (`MENU`, `PLAYING`, `PAUSED`).
    *   **Logic:** Updates physics, collisions, and procedural generation.
    *   **Rendering:** Directly draws the entire game scene to the provided `CanvasRenderingContext2D`.
    *   **Entities:** Manages instances of `Ball` and `Block`.

## Key Files

*   `src/components/GameCanvas.tsx`: The bridge between React and the Game Engine. Initializes the engine and runs the game loop.
*   `src/game/GameEngine.ts`: The core class containing all game logic, level generation, and rendering code.
*   `src/game/Ball.ts`: Physics entity representing the player.
*   `src/game/Block.ts`: Destructible hexagonal grid elements.
*   `vite.config.ts`: Configuration for the Vite build tool.

## Building and Running

This project uses `npm` for dependency management and scripts.

### Prerequisite
Ensure Node.js is installed.

### Setup
```bash
npm install
```

### Development Server
Starts the local development server using Vite with hot module replacement (HMR). **IMPORTANT:** You must leave this shell running to keep the server active. Do not background it or terminate the process until testing is complete.
```bash
npm run dev
```
The game will be accessible at: `http://localhost:5173/Gravity-Miner/`

### Production Build
Type-checks and builds the project for production.
```bash
npm run build
```

### Preview Production Build
Locally preview the built production version.
```bash
npm run preview
```

### Linting
Runs ESLint to check for code quality issues.
```bash
npm run lint
```

## Development Conventions

*   **Logic Separation:** React is used strictly for the container. Game logic should reside in `src/game/` classes, not in React components or hooks.
*   **Styling:** CSS is minimal, mostly for the root container. Visuals are primarily drawn via Canvas API.
*   **Performance:** The game loop uses a time-delta (`dt`) to ensure consistent physics across different frame rates.
*   **Git Usage:** NEVER run git commands (commit, push, status, etc.). The user handles all git operations manually.
