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
      {/* Dimming overlay */}
      <div
        className="fixed inset-0 bg-black/65"
        style={{ zIndex: 9000 }}
        aria-hidden="true"
      />

      {/* Tutorial card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Tutorial step ${step + 1}: ${currentStep.title}`}
        style={{
          position: "fixed",
          zIndex: 9002,
          left: "50%",
          transform: "translateX(-50%)",
          bottom: "clamp(16px, 4vh, 40px)",
          width: "min(580px, calc(100vw - 32px))",
          background: "rgba(4, 8, 22, 0.97)",
          border: "1px solid rgba(0, 229, 255, 0.35)",
          borderTop: "2px solid rgba(0, 229, 255, 0.6)",
          borderRadius: 16,
          boxShadow:
            "0 0 0 1px rgba(0,229,255,0.06), 0 8px 48px rgba(0,0,0,0.7), 0 0 60px rgba(0,229,255,0.1)",
          backdropFilter: "blur(20px)",
          fontFamily: "inherit",
          padding: "clamp(20px, 3vw, 28px)",
        }}
      >
        {/* Header row: step counter + skip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontFamily: "monospace",
              letterSpacing: "0.2em",
              color: "rgba(0,229,255,0.55)",
              textTransform: "uppercase",
            }}
          >
            Step {step + 1} / {steps.length}
          </span>
          <button
            onClick={onSkip}
            aria-label="Skip tutorial"
            style={{
              fontSize: 11,
              fontFamily: "inherit",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontWeight: 500,
              color: "rgba(140, 145, 170, 0.85)",
              background: "none",
              border: "1px solid rgba(80,85,110,0.4)",
              borderRadius: 6,
              cursor: "pointer",
              padding: "4px 12px",
              lineHeight: 1.4,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "rgba(200,205,230,1)";
              e.currentTarget.style.borderColor = "rgba(120,125,155,0.7)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(140,145,170,0.85)";
              e.currentTarget.style.borderColor = "rgba(80,85,110,0.4)";
            }}
          >
            Skip
          </button>
        </div>

        {/* Progress dots */}
        <div
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 18,
            alignItems: "center",
          }}
        >
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                height: 6,
                width: i === step ? 28 : 7,
                borderRadius: 3,
                background:
                  i === step
                    ? "rgba(0,229,255,0.95)"
                    : i < step
                    ? "rgba(0,229,255,0.38)"
                    : "rgba(70,75,100,0.55)",
                transition: "all 0.3s ease",
                flexShrink: 0,
              }}
            />
          ))}
        </div>

        {/* Title */}
        <h2
          style={{
            margin: "0 0 10px 0",
            fontSize: "clamp(16px, 2.5vw, 20px)",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "rgba(0,229,255,0.97)",
            lineHeight: 1.2,
          }}
        >
          {currentStep.title}
        </h2>

        {/* Description */}
        <p
          style={{
            margin: "0 0 24px 0",
            fontSize: "clamp(13px, 1.8vw, 15px)",
            lineHeight: 1.65,
            color: "rgba(185,190,215,0.92)",
          }}
        >
          {currentStep.description}
        </p>

        {/* Hint line (optional) */}
        {currentStep.hint && (
          <p
            style={{
              margin: "-16px 0 20px 0",
              fontSize: 12,
              lineHeight: 1.5,
              color: "rgba(120,200,180,0.75)",
              fontStyle: "italic",
            }}
          >
            {currentStep.hint}
          </p>
        )}

        {/* Action buttons */}
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          {!isFirst && (
            <button
              onClick={onBack}
              style={{
                minHeight: 42,
                padding: "8px 22px",
                fontSize: 12,
                fontFamily: "inherit",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                borderRadius: 8,
                border: "1px solid rgba(80,85,110,0.65)",
                background: "rgba(255,255,255,0.03)",
                color: "rgba(160,165,190,0.9)",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(140,145,175,0.9)";
                e.currentTarget.style.color = "rgba(210,215,240,1)";
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(80,85,110,0.65)";
                e.currentTarget.style.color = "rgba(160,165,190,0.9)";
                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
              }}
            >
              ← Back
            </button>
          )}

          {isLast ? (
            <button
              onClick={onFinish}
              style={{
                minHeight: 42,
                padding: "8px 28px",
                fontSize: 12,
                fontFamily: "inherit",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                borderRadius: 8,
                border: "none",
                background: "linear-gradient(135deg, rgba(0,229,255,0.95), rgba(0,180,220,0.9))",
                color: "#000d14",
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: "0 0 20px rgba(0,229,255,0.3)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  "linear-gradient(135deg, rgba(0,240,255,1), rgba(0,210,250,1))";
                e.currentTarget.style.boxShadow =
                  "0 0 30px rgba(0,229,255,0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  "linear-gradient(135deg, rgba(0,229,255,0.95), rgba(0,180,220,0.9))";
                e.currentTarget.style.boxShadow =
                  "0 0 20px rgba(0,229,255,0.3)";
              }}
            >
              Let&apos;s Go!
            </button>
          ) : (
            <button
              onClick={onNext}
              style={{
                minHeight: 42,
                padding: "8px 28px",
                fontSize: 12,
                fontFamily: "inherit",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                borderRadius: 8,
                border: "none",
                background: "linear-gradient(135deg, rgba(0,229,255,0.9), rgba(0,180,220,0.85))",
                color: "#000d14",
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: "0 0 16px rgba(0,229,255,0.25)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  "linear-gradient(135deg, rgba(0,240,255,1), rgba(0,210,250,1))";
                e.currentTarget.style.boxShadow =
                  "0 0 28px rgba(0,229,255,0.45)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  "linear-gradient(135deg, rgba(0,229,255,0.9), rgba(0,180,220,0.85))";
                e.currentTarget.style.boxShadow =
                  "0 0 16px rgba(0,229,255,0.25)";
              }}
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </>
  );
}
