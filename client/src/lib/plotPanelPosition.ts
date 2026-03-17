/**
 * Smart positioning logic for the desktop floating plot panel.
 *
 * Given a screen-space hint (where the selected plot appears on screen),
 * returns CSS style values so the panel:
 *  - stays fully visible (no clipping at screen edges)
 *  - avoids covering the selected tile when possible
 *  - adapts based on which screen quadrant the plot falls in
 */

export interface PanelPositionHint {
  /** Normalised X position of selected plot (0 = left, 1 = right) */
  nx?: number;
  /** Normalised Y position of selected plot (0 = top, 1 = bottom) */
  ny?: number;
}

export interface PanelPosition {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  transform?: string;
}

/** Panel dimensions in pixels (approximate) */
const PANEL_W = 320;
const PANEL_H = 420;
const MARGIN = 16;

/**
 * Returns absolute CSS positioning for the desktop plot panel.
 * Defaults to top-right corner when no screen hint is provided.
 */
export function getDesktopPanelPosition(
  hint: PanelPositionHint = {},
  viewport: { w: number; h: number } = {
    w: typeof window !== "undefined" ? window.innerWidth : 1280,
    h: typeof window !== "undefined" ? window.innerHeight : 800,
  }
): PanelPosition {
  const { nx = 0.7, ny = 0.4 } = hint;

  // Determine horizontal side: place panel on the opposite side of the plot
  const placeOnRight = nx < 0.55;
  // Determine vertical position: if plot is near the bottom, pin panel higher
  const placeNearBottom = ny > 0.65;

  const position: PanelPosition = {};

  if (placeOnRight) {
    // Panel on the right side
    const rightPx = viewport.w - (viewport.w * nx) - PANEL_W - MARGIN;
    position.left = `${Math.max(MARGIN, Math.min(viewport.w - PANEL_W - MARGIN, viewport.w * nx + MARGIN))}px`;
  } else {
    // Panel on the left side
    position.right = `${Math.max(MARGIN, Math.min(viewport.w - PANEL_W - MARGIN, viewport.w * (1 - nx) + MARGIN))}px`;
  }

  if (placeNearBottom) {
    position.bottom = `${MARGIN + 16}px`; // above any potential desktop toolbar
  } else {
    const topPx = Math.max(MARGIN + 60, viewport.h * ny - PANEL_H / 2);
    position.top = `${Math.min(topPx, viewport.h - PANEL_H - MARGIN)}px`;
  }

  return position;
}

/**
 * Default desktop panel position — top-right, clear of map centre.
 */
export const DEFAULT_DESKTOP_POSITION: PanelPosition = {
  top: "80px",
  right: "16px",
};
