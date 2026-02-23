import { useState } from "react";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";

interface GamerTagModalProps {
  playerId: string;
  walletAddress: string;
  onComplete: (name: string) => void;
  onSkip: () => void;
}

export function GamerTagModal({ playerId, walletAddress, onComplete, onSkip }: GamerTagModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 20) {
      setError("Name must be 2-20 characters");
      return;
    }
    if (!/^[a-zA-Z0-9_\-. ]+$/.test(trimmed)) {
      setError("Letters, numbers, spaces, dashes, dots, and underscores only");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/actions/set-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, name: trimmed, address: walletAddress }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to set name");
        setSubmitting(false);
        return;
      }
      onComplete(data.name);
    } catch {
      setError("Network error. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-md">
      <div className="max-w-sm w-full mx-4">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-lg mx-auto flex items-center justify-center bg-card border border-primary/50 text-primary">
            <User className="w-8 h-8" />
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold uppercase tracking-wider">
              Choose Your Tag
            </h2>
            <p className="text-sm text-primary font-display uppercase tracking-wide mt-1">
              Commander Identity
            </p>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed px-2">
            Enter a name or gamertag so other players can recognize you on the battlefield.
          </p>

          <div className="relative">
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim().length >= 2) handleSubmit();
              }}
              placeholder="Enter gamertag..."
              maxLength={20}
              className="w-full px-4 py-3 bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground font-display text-center text-lg tracking-wide uppercase focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              autoFocus
            />
            <div className="text-xs text-muted-foreground mt-1 text-right pr-1">
              {name.length}/20
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>

        <div className="mt-6 space-y-3">
          <Button
            onClick={handleSubmit}
            disabled={name.trim().length < 2 || submitting}
            className="w-full font-display uppercase tracking-wide"
          >
            {submitting ? "Saving..." : "Confirm Tag"}
          </Button>

          <button
            onClick={onSkip}
            className="block w-full text-xs text-muted-foreground font-display uppercase tracking-wide text-center"
          >
            Skip - Use Wallet Address
          </button>
        </div>
      </div>
    </div>
  );
}
