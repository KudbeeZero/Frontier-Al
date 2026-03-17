import { useEffect, useRef } from "react";
import type { TutorialStep } from "@/hooks/useTutorial";

const HIGHLIGHT_CLASS = "tutorial-highlight";

interface TutorialOverlayProps {
  isOpen: boolean;
  step: number;
  steps: TutorialStep[];
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onFinish: () => void;
}

export function TutorialOverlay({
  isOpen,
  step,
  steps,
  onNext,
  onBack,
  onSkip,
  onFinish,
}: TutorialOverlayProps) {
  const prevTargetRef = useRef<HTMLElement | null>(null);

  // Apply/remove highlight on the targeted element
  useEffect(() => {
    // Clean up previous target
    if (prevTargetRef.current) {
      prevTargetRef.current.classList.remove(HIGHLIGHT_CLASS);
      prevTargetRef.current.style.zIndex = "";
      prevTargetRef.current.style.position = "";
      prevTargetRef.current = null;
    }

    if (!isOpen) return;

    const currentStep = steps[step];
    if (!currentStep?.target) return;

    const el = document.querySelector<HTMLElement>(
      `[data-tutorial="${currentStep.target}"]`
    );
    if (el) {
      el.classList.add(HIGHLIGHT_CLASS);
      el.style.zIndex = "9001";
      // Ensure the element creates a stacking context so z-index applies
      const pos = getComputedStyle(el).position;
      if (pos === "static") {
        el.style.position = "relative";
      }
      prevTargetRef.current = el;
    }

    return () => {
      if (prevTargetRef.current) {
        prevTargetRef.current.classList.remove(HIGHLIGHT_CLASS);
        prevTargetRef.current.style.zIndex = "";
        prevTargetRef.current.style.position = "";
        prevTargetRef.current = null;
      }
    };
  }, [isOpen, step, steps]);

  if (!isOpen) return null;

  const currentStep = steps[step];
  const isFirst = step === 0;
  const isLast = step === steps.length - 1;

  return (
    <>
      {/* Dimming overlay — pointer-events blocks background interaction */}
      <div
        className="fixed inset-0 bg-black/60"
        style={{ zIndex: 9000 }}
        aria-hidden="true"
      />

      {/* Tutorial popup */}
      <div
        className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[min(400px,90vw)] rounded-xl border border-cyan-400/40 shadow-[0_0_40px_rgba(0,229,255,0.12)] backdrop-blur-xl p-5"
        style={{
          zIndex: 9002,
          background: "rgba(4,8,20,0.96)",
          fontFamily: "inherit",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={`Tutorial step ${step + 1}: ${currentStep.title}`}
      >
        {/* Header row: step counter + skip */}
        <div className="flex items-center justify-between mb-2">
          <span
            style={{
              fontSize: 10,
              fontFamily: "monospace",
              letterSpacing: "0.2em",
              color: "rgba(0,229,255,0.6)",
              textTransform: "uppercase",
            }}
          >
            Step {step + 1} / {steps.length}
          </span>
          <button
            onClick={onSkip}
            style={{
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(150,150,170,0.8)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px 6px",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "rgba(200,200,220,1)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "rgba(150,150,170,0.8)")
            }
          >
            Skip tutorial
          </button>
        </div>

        {/* Step dots */}
        <div className="flex gap-1.5 mb-3">
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background:
                  i === step
                    ? "rgba(0,229,255,0.9)"
                    : i < step
                    ? "rgba(0,229,255,0.4)"
                    : "rgba(80,80,100,0.5)",
                transition: "all 0.3s ease",
              }}
            />
          ))}
        </div>

        {/* Title */}
        <h2
          style={{
            fontFamily: "inherit",
            fontSize: 15,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "rgba(0,229,255,0.95)",
            marginBottom: 8,
          }}
        >
          {currentStep.title}
        </h2>

        {/* Description */}
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: "rgba(180,185,210,0.9)",
            marginBottom: 20,
          }}
        >
          {currentStep.description}
        </p>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {!isFirst && (
            <button
              onClick={onBack}
              style={{
                padding: "6px 16px",
                fontSize: 11,
                fontFamily: "inherit",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                borderRadius: 6,
                border: "1px solid rgba(80,85,110,0.6)",
                background: "none",
                color: "rgba(160,165,190,0.9)",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(120,125,150,0.9)";
                e.currentTarget.style.color = "rgba(200,205,230,1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(80,85,110,0.6)";
                e.currentTarget.style.color = "rgba(160,165,190,0.9)";
              }}
            >
              Back
            </button>
          )}

          {isLast ? (
            <button
              onClick={onFinish}
              style={{
                padding: "6px 22px",
                fontSize: 11,
                fontFamily: "inherit",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                borderRadius: 6,
                border: "none",
                background: "rgba(0,229,255,0.9)",
                color: "#000",
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(0,229,255,1)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "rgba(0,229,255,0.9)")
              }
            >
              Let&apos;s Go!
            </button>
          ) : (
            <button
              onClick={onNext}
              style={{
                padding: "6px 22px",
                fontSize: 11,
                fontFamily: "inherit",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                borderRadius: 6,
                border: "none",
                background: "rgba(0,229,255,0.9)",
                color: "#000",
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(0,229,255,1)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "rgba(0,229,255,0.9)")
              }
            >
              Next
            </button>
          )}
        </div>
      </div>
    </>
  );
}
