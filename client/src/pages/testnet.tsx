import { useState, useEffect } from "react";
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  Bug,
  Radio,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  Wifi,
  Zap,
  BarChart3,
  Package,
  Trophy,
  Star,
  Pickaxe,
  Shield,
  Swords,
  Link2,
  ClipboardList,
  Terminal,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
type Category = "gameplay" | "blockchain" | "ui" | "performance" | "economy" | "other";
type Severity = "critical" | "high" | "medium" | "low";

interface Mission {
  id: string;
  priority: Priority;
  title: string;
  objective: string;
  whatToWatch: string[];
  icon: React.ElementType;
}

const PRIORITY_CONFIG: Record<Priority, { color: string; bg: string; border: string }> = {
  CRITICAL: { color: "text-red-400",            bg: "bg-red-500/10",   border: "border-red-500/30"   },
  HIGH:     { color: "text-amber-400",          bg: "bg-amber-500/10", border: "border-amber-500/30" },
  MEDIUM:   { color: "text-primary",            bg: "bg-primary/10",   border: "border-primary/30"   },
  LOW:      { color: "text-muted-foreground",   bg: "bg-muted/30",     border: "border-border"       },
};

const MISSIONS: Mission[] = [
  {
    id: "wallet-connect",
    priority: "CRITICAL",
    title: "WALLET CONNECTION",
    objective: "Connect your Pera or LUTE wallet to Algorand TestNet via the wallet button in the top-right corner of the game.",
    whatToWatch: [
      "Does the connection dialog open immediately?",
      "Is your wallet address displayed correctly after connecting?",
      "Does the connection persist after a full page refresh?",
    ],
    icon: Wifi,
  },
  {
    id: "asa-optin",
    priority: "CRITICAL",
    title: "FRONTIER TOKEN OPT-IN",
    objective: "Opt your wallet into the FRONTIER ASA (Algorand Standard Asset). The game should prompt or guide you through this step.",
    whatToWatch: [
      "Is the opt-in prompt clear and actionable?",
      "Does the transaction confirm on-chain without errors?",
      "Is your FRONTIER token balance visible after opt-in?",
    ],
    icon: Link2,
  },
  {
    id: "purchase-land",
    priority: "HIGH",
    title: "CLAIM TERRITORY",
    objective: "Purchase your first land parcel. Tap an unclaimed tile on the map and complete the ALGO transaction.",
    whatToWatch: [
      "Is the purchase flow intuitive and clearly explained?",
      "Does ALGO deduct correctly from your wallet balance?",
      "Does the tile update to show your ownership immediately after confirmation?",
    ],
    icon: Package,
  },
  {
    id: "mine-resources",
    priority: "HIGH",
    title: "MINE RESOURCES",
    objective: "Mine Iron, Fuel, and Crystal from your territory using the Mine button in the tile action panel.",
    whatToWatch: [
      "Does the 5-minute mining cooldown timer display and function correctly?",
      "Are resource yields consistent with the tile's biome type?",
      "Does the Resource HUD update in real-time after mining?",
    ],
    icon: Pickaxe,
  },
  {
    id: "build-improvement",
    priority: "HIGH",
    title: "BUILD IMPROVEMENT",
    objective: "Construct a turret, drill, shield generator, or storage depot on one of your owned parcels.",
    whatToWatch: [
      "Is the build menu easy to navigate and understand?",
      "Do resource costs deduct accurately when building?",
      "Does the improvement icon appear on the map tile after construction?",
    ],
    icon: Zap,
  },
  {
    id: "claim-frontier",
    priority: "HIGH",
    title: "CLAIM FRONTIER TOKENS",
    objective: "Accumulate passive FRONTIER token earnings from your territory, then claim them to your wallet.",
    whatToWatch: [
      "Is the accumulation rate visible and consistent with expectations?",
      "Does the on-chain claim transaction confirm without errors?",
      "Is the claimed amount reflected in your Algorand wallet?",
    ],
    icon: Star,
  },
  {
    id: "pve-combat",
    priority: "MEDIUM",
    title: "PvE COMBAT",
    objective: "Initiate an attack against an AI-controlled parcel. Allocate troops and resources, then confirm the battle.",
    whatToWatch: [
      "Is the attack confirmation dialog clear and informative?",
      "Does battle resolution trigger correctly after the 10-minute window?",
      "Are battle outcomes logged in the War Room event feed?",
    ],
    icon: Swords,
  },
  {
    id: "upgrade-defenses",
    priority: "MEDIUM",
    title: "UPGRADE BASE DEFENSES",
    objective: "Upgrade a parcel's defense level from the Command Center panel.",
    whatToWatch: [
      "Does the defense level increase and persist between sessions?",
      "Is the upgrade cost clearly displayed before confirming?",
      "Does the defensive bonus appear to affect battle outcomes?",
    ],
    icon: Shield,
  },
  {
    id: "collect-all",
    priority: "MEDIUM",
    title: "COLLECT ALL RESOURCES",
    objective: "Use the Collect All button to gather resources from all your territories simultaneously.",
    whatToWatch: [
      "Does Collect All work correctly when owning multiple parcels?",
      "Are all tiles' stored resources transferred to your balance?",
      "Is there any noticeable lag or partial collection failures?",
    ],
    icon: Package,
  },
  {
    id: "leaderboard",
    priority: "LOW",
    title: "LEADERBOARD ACCURACY",
    objective: "Check the Rankings tab and verify your player statistics are represented correctly.",
    whatToWatch: [
      "Is your rank accurate relative to other players?",
      "Do territory counts and token balances match your actual in-game state?",
      "Does the leaderboard refresh after major events?",
    ],
    icon: BarChart3,
  },
  {
    id: "commander-mint",
    priority: "LOW",
    title: "MINT COMMANDER AVATAR",
    objective: "Navigate to the Commander tab and attempt to mint a Commander NFT by burning FRONTIER tokens.",
    whatToWatch: [
      "Is the token burn amount clearly shown before confirming?",
      "Does the Commander appear in the Commander panel after minting?",
      "Can you deploy a recon drone with the Commander afterward?",
    ],
    icon: Trophy,
  },
];

const STORAGE_KEY = "testnet_completed_missions";

export default function TestnetPage() {
  const [completed, setCompleted] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [category, setCategory]     = useState<Category>("gameplay");
  const [severity, setSeverity]     = useState<Severity>("medium");
  const [description, setDescription] = useState("");
  const [steps, setSteps]           = useState("");
  const [expected, setExpected]     = useState("");
  const [actual, setActual]         = useState("");
  const [walletAddr, setWalletAddr] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed]));
  }, [completed]);

  const toggleMission = (id: string) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const completedCount = completed.size;
  const totalMissions  = MISSIONS.length;
  const progressPct    = Math.round((completedCount / totalMissions) * 100);

  const handleCopyReport = () => {
    const completedList = MISSIONS.filter((m) => completed.has(m.id))
      .map((m) => `- [x] ${m.title}`)
      .join("\n") || "- (none yet)";

    const report = `## FRONTIER TESTNET BUG REPORT

**Category:** ${category.toUpperCase()}
**Severity:** ${severity.toUpperCase()}
**Date:** ${new Date().toISOString().split("T")[0]}${walletAddr ? `\n**Wallet:** ${walletAddr}` : ""}

### Description
${description || "(no description provided)"}

### Steps to Reproduce
${steps || "(no steps provided)"}

### Expected Behavior
${expected || "(not specified)"}

### Actual Behavior
${actual || "(not specified)"}

### Completed Missions at Time of Report
${completedList}`;

    navigator.clipboard.writeText(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Subtle grid background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: `
            linear-gradient(hsl(var(--primary)) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Scanline overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.012]"
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 3px,
            rgba(0,255,255,0.15) 3px,
            rgba(0,255,255,0.15) 4px
          )`,
        }}
      />

      <div className="relative max-w-4xl mx-auto px-4 py-8">
        {/* Back link */}
        <div className="mb-6">
          <Link href="/">
            <a className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors font-display uppercase tracking-wider">
              <ArrowLeft className="w-4 h-4" />
              Back to Game
            </a>
          </Link>
        </div>

        {/* ═══════════════════════════════════════
            HERO HEADER
        ═══════════════════════════════════════ */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs font-display uppercase tracking-widest text-green-400">TESTNET ACTIVE</span>
            </div>
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-mono text-muted-foreground">FRONTIER v1.2 // PHASE 1</span>
          </div>

          <h1 className="font-display text-5xl sm:text-6xl font-bold uppercase tracking-widest leading-none mb-3">
            TESTNET<br />
            <span className="text-primary">OPERATIONS</span>
          </h1>

          <p className="text-muted-foreground max-w-2xl mt-4 leading-relaxed">
            You are a designated Frontier Testnet Operative. Work through the mission checklist below,
            document anomalies, and file bug reports. Your intelligence directly shapes the final product.
          </p>
        </div>

        {/* ═══════════════════════════════════════
            PROGRESS TRACKER
        ═══════════════════════════════════════ */}
        <div className="bg-card border border-border rounded-md p-5 mb-8">
          <div className="flex items-end justify-between mb-3">
            <div>
              <div className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-1">
                Mission Progress
              </div>
              <div className="font-display text-3xl font-bold leading-none">
                <span className="text-primary">{completedCount}</span>
                <span className="text-muted-foreground text-xl"> / {totalMissions}</span>
              </div>
            </div>
            <div
              className={cn(
                "font-display text-5xl font-bold leading-none",
                progressPct === 100
                  ? "text-green-400"
                  : progressPct >= 50
                  ? "text-primary"
                  : "text-muted-foreground",
              )}
            >
              {progressPct}%
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700",
                progressPct === 100 ? "bg-green-400" : "bg-primary",
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Milestone pips */}
          <div className="flex justify-between mt-1 px-0.5">
            {[0, 25, 50, 75, 100].map((pct) => (
              <span
                key={pct}
                className={cn(
                  "text-[10px] font-mono",
                  progressPct >= pct ? "text-primary" : "text-muted-foreground/40",
                )}
              >
                {pct}%
              </span>
            ))}
          </div>

          {progressPct === 100 && (
            <div className="mt-3 text-center text-sm font-display uppercase tracking-widest text-green-400 animate-pulse">
              ALL MISSIONS COMPLETE — OUTSTANDING OPERATIVE
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════
            MISSION CHECKLIST
        ═══════════════════════════════════════ */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-3">
            <ClipboardList className="w-5 h-5 text-primary" />
            <h2 className="font-display text-xl font-bold uppercase tracking-wider">Mission Objectives</h2>
            <div className="h-px flex-1 bg-border" />
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Work through each mission in the game and check it off when done. Click a mission to expand
            the detail and see exactly what to watch for. Your progress is saved automatically.
          </p>

          <div className="space-y-2">
            {MISSIONS.map((mission) => {
              const pCfg       = PRIORITY_CONFIG[mission.priority];
              const isComplete = completed.has(mission.id);
              const isOpen     = expanded === mission.id;
              const Icon       = mission.icon;

              return (
                <div
                  key={mission.id}
                  className={cn(
                    "border rounded-md transition-all duration-200",
                    isComplete
                      ? "border-green-500/30 bg-green-500/5"
                      : `${pCfg.border} ${pCfg.bg}`,
                  )}
                >
                  {/* Mission row */}
                  <div
                    className="flex items-center gap-3 p-3 sm:p-4 cursor-pointer select-none"
                    onClick={() => setExpanded(isOpen ? null : mission.id)}
                  >
                    {/* Checkbox */}
                    <button
                      className="shrink-0 transition-transform active:scale-90"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMission(mission.id);
                      }}
                      aria-label={isComplete ? "Mark incomplete" : "Mark complete"}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                      )}
                    </button>

                    {/* Category icon */}
                    <div
                      className={cn(
                        "shrink-0 w-8 h-8 rounded flex items-center justify-center border",
                        isComplete ? "bg-green-500/10 border-green-500/30" : `${pCfg.bg} ${pCfg.border}`,
                      )}
                    >
                      <Icon className={cn("w-4 h-4", isComplete ? "text-green-400" : pCfg.color)} />
                    </div>

                    {/* Title */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            "font-display font-bold uppercase tracking-wider text-sm",
                            isComplete && "line-through text-muted-foreground",
                          )}
                        >
                          {mission.title}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-display uppercase tracking-wider px-1.5 py-0.5 rounded border",
                            pCfg.color,
                            pCfg.bg,
                            pCfg.border,
                          )}
                        >
                          {mission.priority}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate hidden sm:block">
                        {mission.objective}
                      </p>
                    </div>

                    <ChevronDown
                      className={cn(
                        "w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200",
                        isOpen && "rotate-180",
                      )}
                    />
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="px-4 pb-4 pt-3 border-t border-border/40 space-y-4">
                      <div>
                        <div className="text-[10px] font-display uppercase tracking-wider text-muted-foreground mb-1">
                          Objective
                        </div>
                        <p className="text-sm leading-relaxed">{mission.objective}</p>
                      </div>

                      <div>
                        <div className="text-[10px] font-display uppercase tracking-wider text-muted-foreground mb-2">
                          What to Watch For & Report
                        </div>
                        <ul className="space-y-2">
                          {mission.whatToWatch.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <Radio className="w-3 h-3 mt-1 shrink-0 text-primary" />
                              <span className="text-muted-foreground">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <button
                        onClick={() => toggleMission(mission.id)}
                        className={cn(
                          "text-xs font-display uppercase tracking-wider px-3 py-2 rounded border transition-all",
                          isComplete
                            ? "text-green-400 border-green-500/30 bg-green-500/10 hover:bg-green-500/20"
                            : "text-primary border-primary/30 bg-primary/10 hover:bg-primary/20",
                        )}
                      >
                        {isComplete ? "✓ Marked Complete — Click to Undo" : "Mark as Complete"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ═══════════════════════════════════════
            BUG REPORT FORM
        ═══════════════════════════════════════ */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-3">
            <Bug className="w-5 h-5 text-destructive" />
            <h2 className="font-display text-xl font-bold uppercase tracking-wider">File Bug Report</h2>
            <div className="h-px flex-1 bg-border" />
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Found an issue? Fill out the fields below and click{" "}
            <span className="text-foreground font-medium">Copy Report</span> to get a formatted
            markdown report ready to paste into Discord or GitHub Issues.
          </p>

          <div className="bg-card border border-border rounded-md p-5 sm:p-6 space-y-5">
            {/* Category + Severity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-display uppercase tracking-wider text-muted-foreground mb-2">
                  Category
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["gameplay", "blockchain", "ui", "performance", "economy", "other"] as Category[]).map(
                    (cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={cn(
                          "text-[10px] font-display uppercase tracking-wide py-1.5 px-1 rounded border transition-all",
                          category === cat
                            ? "bg-primary/20 border-primary/50 text-primary"
                            : "bg-muted/20 border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                        )}
                      >
                        {cat}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-display uppercase tracking-wider text-muted-foreground mb-2">
                  Severity
                </label>
                <div className="space-y-1.5">
                  {(
                    [
                      { val: "critical", label: "CRITICAL — Blocks all play",    cls: "text-red-400   border-red-500/30   bg-red-500/10"   },
                      { val: "high",     label: "HIGH — Major feature broken",   cls: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
                      { val: "medium",   label: "MEDIUM — Noticeable issue",     cls: "text-primary   border-primary/30   bg-primary/10"   },
                      { val: "low",      label: "LOW — Cosmetic / minor",        cls: "text-muted-foreground border-border bg-muted/30"    },
                    ] as { val: Severity; label: string; cls: string }[]
                  ).map((s) => (
                    <button
                      key={s.val}
                      onClick={() => setSeverity(s.val)}
                      className={cn(
                        "w-full text-[10px] font-display uppercase tracking-wide py-1.5 px-2 rounded border text-left transition-all",
                        severity === s.val
                          ? s.cls
                          : "bg-muted/10 border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                      )}
                    >
                      {severity === s.val ? "● " : "○ "}
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Wallet address */}
            <div>
              <label className="block text-[10px] font-display uppercase tracking-wider text-muted-foreground mb-2">
                Your Wallet Address{" "}
                <span className="text-muted-foreground/50 normal-case tracking-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={walletAddr}
                onChange={(e) => setWalletAddr(e.target.value)}
                placeholder="ALGO wallet address..."
                className="w-full bg-muted/20 border border-border rounded px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-[10px] font-display uppercase tracking-wider text-muted-foreground mb-2">
                Bug Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what went wrong. Be specific — what were you doing, what did you see?"
                rows={3}
                className="w-full bg-muted/20 border border-border rounded px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-colors resize-none"
              />
            </div>

            {/* Steps */}
            <div>
              <label className="block text-[10px] font-display uppercase tracking-wider text-muted-foreground mb-2">
                Steps to Reproduce
              </label>
              <textarea
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                placeholder={`1. Connect wallet\n2. Purchase parcel #412\n3. Click Mine\n4. See error`}
                rows={4}
                className="w-full bg-muted/20 border border-border rounded px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-colors resize-none"
              />
            </div>

            {/* Expected vs Actual */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-display uppercase tracking-wider text-muted-foreground mb-2">
                  Expected Behavior
                </label>
                <textarea
                  value={expected}
                  onChange={(e) => setExpected(e.target.value)}
                  placeholder="What should have happened..."
                  rows={3}
                  className="w-full bg-muted/20 border border-border rounded px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-colors resize-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-display uppercase tracking-wider text-muted-foreground mb-2">
                  Actual Behavior
                </label>
                <textarea
                  value={actual}
                  onChange={(e) => setActual(e.target.value)}
                  placeholder="What actually happened..."
                  rows={3}
                  className="w-full bg-muted/20 border border-border rounded px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-colors resize-none"
                />
              </div>
            </div>

            {/* Copy button */}
            <div className="space-y-2">
              <Button
                onClick={handleCopyReport}
                className="w-full font-display uppercase tracking-wider"
                variant={copied ? "outline" : "default"}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2 text-green-400" />
                    Report Copied to Clipboard
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Bug Report
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Copied as formatted markdown — paste directly into Discord or GitHub Issues.
              </p>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════
            REPORTING CHANNELS
        ═══════════════════════════════════════ */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-3">
            <Terminal className="w-5 h-5 text-primary" />
            <h2 className="font-display text-xl font-bold uppercase tracking-wider">Submit Your Report</h2>
            <div className="h-px flex-1 bg-border" />
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            After copying your report above, submit it through one of the channels below.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href="https://github.com/KudbeeZero/Frontier-Al/issues/new"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 bg-card border border-border rounded-md hover:border-primary/50 transition-all group"
            >
              <div className="w-10 h-10 rounded bg-muted/40 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                <Bug className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold uppercase tracking-wide text-sm">GitHub Issues</div>
                <div className="text-xs text-muted-foreground">Paste your copied report here</div>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </a>

            <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-md">
              <div className="w-10 h-10 rounded bg-muted/40 flex items-center justify-center shrink-0">
                <Radio className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold uppercase tracking-wide text-sm">Discord</div>
                <div className="text-xs text-muted-foreground">
                  Post in{" "}
                  <span className="font-mono text-primary">#testnet-feedback</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════
            FIELD TIPS
        ═══════════════════════════════════════ */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h2 className="font-display text-xl font-bold uppercase tracking-wider">Field Intelligence</h2>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                title: "USE TESTNET ALGO ONLY",
                body: "This runs on Algorand TestNet. Fund your wallet via the official Algorand TestNet Dispenser — never use real ALGO.",
              },
              {
                title: "SCREEN RECORD BUGS",
                body: "A 15-second screen recording of the bug is 10× more useful than text alone. Attach it when filing on GitHub.",
              },
              {
                title: "NOTE YOUR BROWSER",
                body: "Include browser name and version (Chrome 121, Safari 17, Firefox 123…) and whether you're on desktop or mobile.",
              },
              {
                title: "ONE BUG PER REPORT",
                body: "File separate reports for separate issues. Don't bundle multiple unrelated bugs — it makes triage much harder.",
              },
            ].map((tip) => (
              <div key={tip.title} className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-md">
                <div className="font-display font-bold uppercase tracking-wider text-[10px] text-amber-400 mb-1">
                  {tip.title}
                </div>
                <p className="text-sm text-muted-foreground">{tip.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <div className="border-t border-border pt-6 flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground">
            FRONTIER TESTNET OPS // PHASE 1 // {new Date().getFullYear()}
          </span>
          <Link href="/">
            <a>
              <Button variant="outline" size="sm" className="font-display uppercase tracking-wider text-xs">
                Enter Game
              </Button>
            </a>
          </Link>
        </div>
      </div>
    </div>
  );
}
