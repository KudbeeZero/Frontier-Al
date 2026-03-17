import { useState } from "react";

const STORAGE_KEY = "frontier_tutorial_completed";

export interface TutorialStep {
  title: string;
  description: string;
  /** Optional secondary hint line shown below the description */
  hint?: string;
  /** Matches data-tutorial="..." attribute on the target DOM element */
  target?: string;
  /**
   * Future: when set, Next is disabled until this action is confirmed externally.
   * Leave undefined for passive informational steps.
   */
  actionKey?: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: "Welcome to Frontier",
    description:
      "Welcome to Frontier. This quick guide will show you how to get started in the world of decentralized land ownership.",
  },
  {
    title: "Find a Plot",
    description:
      "This is the world map. Explore available land parcels across the globe. Tap any highlighted plot to inspect its details.",
    target: "map-area",
  },
  {
    title: "Buy Your First Plot",
    description:
      "Own your first parcel by purchasing an available plot. Use the Command Center on the left to track your territory and manage your assets.",
    target: "buy-plot",
  },
  {
    title: "Manage Your Land",
    description:
      "This is where you manage your parcel — upgrade it, terraform it, and grow your empire. Select any owned plot on the map to open this panel.",
    target: "land-sheet",
  },
];

export function useTutorial() {
  const [step, setStep] = useState(0);
  const [isOpen, setIsOpen] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== "true";
    } catch {
      return true;
    }
  });

  const complete = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // ignore storage errors
    }
    setIsOpen(false);
  };

  const next = () => {
    setStep((s) => Math.min(s + 1, TUTORIAL_STEPS.length - 1));
  };

  const back = () => {
    setStep((s) => Math.max(0, s - 1));
  };

  return { step, isOpen, next, back, complete };
}
