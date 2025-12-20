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
    *   **State Management:** Handles game states (`MENU`, `PLAYING`, `PAUSED`) and sub-menu states (e.g., `SETTINGS`).
    *   **Settings:** Manages player preferences (like `showHp`) via a centralized `settings` object.
    *   **Logic:** Updates physics, collisions, and procedural generation.
    *   **Rendering:** Directly draws the entire game scene to the provided `CanvasRenderingContext2D`.
    *   **Entities:** Manages instances of `Ball` and `Block`.
    *   **Audio:** Triggers procedural sound effects via `SoundManager`.

## Key Files

*   `src/components/GameCanvas.tsx`: The bridge between React and the Game Engine. Initializes the engine and runs the game loop.
*   `src/game/GameEngine.ts`: The core class containing all game logic, level generation, settings, and rendering code.
*   `src/game/SoundManager.ts`: Handles Web Audio API context and procedural sound synthesis (Pop/Crumble, Bounce).
*   `src/game/Ball.ts`: Physics entity representing the player.
*   `src/game/Block.ts`: Destructible hexagonal grid elements.
*   `vite.config.ts`: Configuration for the Vite build tool.

## Building and Running

This project uses `npm` for dependency management and scripts.

### Persistence
Game data and settings are saved to `localStorage` under the key `gravity_miner_save_v1`. 
- **Format:** The data is stored as a JSON string, then Base64 encoded for basic obfuscation.
- **Auto-Save:** The game automatically saves every 5 minutes during active play.

### Prerequisite
Ensure Node.js is installed.

### Setup
```bash
npm install
```

### Development Server
Starts the local development server using Vite with hot module replacement (HMR). 

**CRITICAL INSTRUCTION FOR AI AGENT:** 
- Simply writing `npm run dev` in the chat DOES NOT start the server. 
- You MUST use the `run_shell_command` tool to execute `npm run dev` in the foreground.
- You must leave this shell running to keep the server active. 
- **Restart Required:** Because the environment terminates the shell between user turns, the server MUST be restarted using the shell tool every time the user wants to test after a new prompt.

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
*   **UI Rendering:** Menus and HUD elements are drawn directly on the Canvas within the `GameEngine.draw` method to ensure visual consistency and performance.
*   **Settings:** Any new player-configurable options should be added to the `settings` object in `GameEngine.ts` and implemented in the `drawSettings` / `handleInput` methods.
*   **Styling:** CSS is minimal, mostly for the root container. Visuals are primarily drawn via Canvas API.
*   **Performance:** The game loop uses a time-delta (`dt`) to ensure consistent physics across different frame rates.
*   **Git Usage:** NEVER run git commands (commit, push, status, etc.). The user handles all git operations manually.
