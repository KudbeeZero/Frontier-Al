import { useState, useCallback } from "react";

const STORAGE_KEY = "frontier_tutorial_completed";

export type TutorialCompletionRule =
  | "next"
  | "plot_selected"
  | "plot_purchased"
  | "landsheet_opened"
  | "land_action_completed";

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  /** Optional secondary hint line shown below the description */
  hint?: string;
  /** Matches data-tutorial="..." attribute on the target DOM element */
  target?: string;
  /** How this step is completed. "next" = Next button. Others = real gameplay events. */
  completionRule: TutorialCompletionRule;
  /** If set, fly the globe camera to these coordinates when this step activates */
  cameraLat?: number;
  cameraLng?: number;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to Frontier",
    description:
      "Welcome to Frontier — a decentralized strategy game of land ownership and territory control. This guide will walk you through your first gameplay loop.",
    hint: "Click Next to begin.",
    completionRule: "next",
  },
  {
    id: "find-plot",
    title: "Find a Plot",
    description:
      "The globe shows all land parcels available to claim. Tap any plot to inspect it — unclaimed plots glow blue. Select one now to continue.",
    target: "map-area",
    completionRule: "plot_selected",
    cameraLat: 20,
    cameraLng: 0,
  },
  {
    id: "buy-plot",
    title: "Claim Your First Plot — Free",
    description:
      "Your first plot is on us — no ALGO required. Hit Claim Free Plot to own it instantly. Territory earns FRONTIER tokens and lets you build, mine, and defend.",
    target: "acquire-territory",
    completionRule: "plot_purchased",
  },
  {
    id: "open-controls",
    title: "Open Your Parcel Controls",
    description:
      "Great — you own land! Select your newly acquired plot on the globe to open the Land Management panel.",
    target: "land-sheet",
    completionRule: "landsheet_opened",
  },
  {
    id: "first-action",
    title: "Try Your First Land Action",
    description:
      "Use Extract to mine resources from your land. Resources fuel upgrades, construction, and your FRONTIER token earnings. Give it a try.",
    target: "land-sheet",
    completionRule: "land_action_completed",
  },
];

function persistCompleted() {
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // ignore storage errors
  }
}

export function useTutorial() {
  const [step, setStep] = useState(0);
  const [isOpen, setIsOpen] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== "true";
    } catch {
      return true;
    }
  });

  const complete = useCallback(() => {
    persistCompleted();
    setIsOpen(false);
  }, []);

  const resetAndOpen = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
    setStep(0);
    setIsOpen(true);
  }, []);

  const next = useCallback(() => {
    setStep((s) => Math.min(s + 1, TUTORIAL_STEPS.length - 1));
  }, []);

  const back = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  /**
   * Called by gameplay systems when a real event occurs.
   * Advances only if current step's completionRule matches the fired rule.
   * If the last step completes, closes and persists completion.
   */
  const notifyEvent = useCallback(
    (rule: TutorialCompletionRule) => {
      if (!isOpen) return;
      setStep((s) => {
        if (TUTORIAL_STEPS[s]?.completionRule !== rule) return s;
        const next = s + 1;
        if (next >= TUTORIAL_STEPS.length) {
          // All done — schedule close outside render
          setTimeout(() => {
            persistCompleted();
            setIsOpen(false);
          }, 0);
          return s;
        }
        return next;
      });
    },
    [isOpen]
  );

  return {
    step,
    isOpen,
    next,
    back,
    complete,
    resetAndOpen,
    notifyEvent,
    currentStepDef: TUTORIAL_STEPS[step] ?? null,
  };
}
