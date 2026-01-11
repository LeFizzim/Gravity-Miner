# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gravity Miner is an infinite, physics-based idle game where a drilling ball descends through procedurally generated hexagonal blocks. Built with React + TypeScript + Vite, rendered entirely via HTML5 Canvas.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:5173/Gravity-Miner/)
npm run build        # Type-check and build for production
npm run lint         # Run ESLint
npm run preview      # Preview production build locally
```

## Architecture

**React Shell vs Game Engine separation:**
- `src/App.tsx`, `src/components/GameCanvas.tsx` - React container, canvas setup, input listeners, game loop initialization
- `src/game/GameEngine.ts` - Core game logic: state management (MENU/PLAYING/PAUSED), upgrades/shop system, physics, collision detection, procedural generation, and all Canvas rendering
- `src/game/Ball.ts` - Player physics entity with damage/gravity scaling from upgrades
- `src/game/Block.ts` - Destructible hexagonal grid elements with special types (normal, bitBooster, cashBooster, explosive)
- `src/game/SoundManager.ts` - Web Audio API procedural sound synthesis

**Key principle:** React is strictly for the container. All game logic, menus, and HUD are drawn directly to Canvas via `GameEngine.draw()`.

## Development Conventions

- **UI via Canvas:** Menus and HUD are rendered in Canvas, not React components
- **Settings:** Add new options to `settings` object in `GameEngine.ts`, implement in `drawSettings`/`handleInput`
- **Input handling:** For lists (Shop), use math-based index calculation over individual hitbox checks
- **Block Upgrades:** Special block types are rolled via `typeRolled` flag when blocks come near the player; only blocks within the hole area (`holeLeft` to `holeRight`) are eligible
- **Shop Menu Spacing:** When adding/removing shop items, ALWAYS update the `boxH` calculation in `getPauseMenuLayout()` to prevent overlapping with the back button. The formula counts section headers, items, and spacing.
- **Safety:** Wrap state-heavy operations in try-catch; ensure all rendering variables are defined to avoid crashing the game loop
- **Performance:** Game loop uses time-delta (`dt`) for frame-rate independent physics

## Persistence

Save data stored in `localStorage` key `gravity_miner_save_v1` as Base64-encoded JSON. Auto-saves every 5 minutes and after Shop purchases.

## Git Policy

NEVER run git commands. The user handles all git operations manually.
