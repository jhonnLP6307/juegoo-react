import { create } from 'zustand';

export const ARENA_W        = 36;
export const ARENA_H        = 16;
export const TUNNEL_Z       = 90;
export const OBS_COUNT      = 20;
export const RESHUFFLE_MS   = 30_000;
export const PLAYER_SPEED   = 10;
export const PLAYER_R       = 0.7;
export const GOAL_R         = 2.4;
export const COLLISION_CD   = 1.2;

const useMovement = create((set, get) => ({
  screen: 'menu',

  hits:         0,
  elapsed:      0,
  reshufflePct: 1,

  // ── End-game summary ───────────────────────────────────────────────────────
  finalHits:    0,
  finalElapsed: 0,
  finalScore:   0,

  // ── Flash feedback ─────────────────────────────────────────────────────────
  flash: false,

  // ── Actions ───────────────────────────────────────────────────────────────
  setScreen: (screen) => set({ screen }),

  startGame: () =>
    set({
      screen:       'playing',
      hits:         0,
      elapsed:      0,
      reshufflePct: 1,
      flash:        false,
    }),

  pauseGame: () => set({ screen: 'paused' }),

  resumeGame: () => set({ screen: 'playing' }),

  /** Called each rAF tick by the game loop to push fresh HUD numbers. */
  tickHud: (elapsed, reshufflePct) =>
    set({ elapsed, reshufflePct }),

  /** Called when the player touches an obstacle. */
  registerHit: () => {
    set((s) => ({ hits: s.hits + 1, flash: true }));
    // auto-clear flash after 140 ms
    setTimeout(() => set({ flash: false }), 140);
  },

  /** Called when the player reaches the goal. */
  endGame: (hits, elapsed) => {
    const score = Math.max(0, 10_000 - hits * 400 - Math.floor(elapsed) * 8);
    set({
      screen:       'ended',
      finalHits:    hits,
      finalElapsed: elapsed,
      finalScore:   score,
    });
  },

  goToMenu: () => set({ screen: 'menu' }),
}));

export default useMovement;