/**
 * Centralized z-index layering for the game UI.
 * All z-index values should reference these constants to prevent conflicts.
 */
export const Z = {
  globe: 0,
  parcels: 10,
  hud: 20,
  panels: 30,
  sidebar: 40,
  /** BottomNav fixed bar on mobile */
  bottomNav: 50,
  /** Plot action sheet — must be above bottomNav */
  plotSheet: 55,
  /** Desktop floating plot panel */
  selectedPlotPanel: 55,
  /** Toast / orbital notifications */
  toast: 60,
  /** Full-screen modals and dialogs */
  modal: 100,
  /** Tutorial overlay — must be above everything */
  tutorial: 9000,
  tutorialHighlight: 9001,
  tutorialCard: 9002,
} as const;

export type ZLayer = keyof typeof Z;

/** Tailwind class helpers for common layers */
export const ZClass = {
  bottomNav: "z-50",
  plotSheet: "z-[55]",
  selectedPlotPanel: "z-[55]",
  modal: "z-[100]",
  tutorial: "z-[9000]",
} as const;
