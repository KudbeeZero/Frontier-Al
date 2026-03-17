import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { LandingNav, LandingFooter, CookieConsentBanner, Starfield, SHARED_CSS } from "./landing-shared";

const CARD: React.CSSProperties = {
  background: "rgba(10,12,30,0.82)", border: "1px solid rgba(60,90,180,0.25)",
  borderRadius: 8, padding: 20,
};

const MONO: React.CSSProperties = {
  fontFamily: "'Courier New', 'SF Mono', monospace", color: "#e0eaff",
};

// ─── Roadmap Data (player-facing) ─────────────────────────────────────────────

const ACTIVE_UPDATES = [
  {
    label: "Testing Economy Unlock — FRNTR-First Pricing",
    status: "complete" as const,
    date: "Mar 2026",
    detail: "Commander minting now uses FRNTR as primary currency (no ALGO game-level charge). All testing prices are centralized in a single economy config. Sentinel: 10 FRNTR · Phantom: 25 FRNTR · Reaper: 50 FRNTR. Land purchases reduced to 0.1 ALGO (minimum viable) for testing. Unavoidable ALGO network fee (~0.001) is the only remaining chain cost.",
  },
  {
    label: "Centralized Economy Config",
    status: "complete" as const,
    date: "Mar 2026",
    detail: "All gameplay prices (commander mint, land purchase, facility builds, special attacks, drones, satellites) are now controlled from a single shared/economy-config.ts. Testing and production profiles are cleanly separated. Set ECONOMY_MODE=production to switch to live tokenomics.",
  },
  {
    label: "Tutorial Restart Button",
    status: "complete" as const,
    date: "Mar 2026",
    detail: "A 'TUTORIAL' button now appears in the lower-left of the game screen. Partners and testers can replay the onboarding tutorial at any time without clearing browser storage.",
  },
  {
    label: "Economics Panel — Testing Price Clarity",
    status: "complete" as const,
    date: "Mar 2026",
    detail: "The in-game Economics panel now shows a dedicated 'Testing Economy Prices' section listing current FRNTR costs per action, land ALGO prices, and the unavoidable network fee. Currency per action is clearly labeled.",
  },
  {
    label: "Sub-Parcel Archetype System",
    status: "in_progress" as const,
    date: "Mar 2026",
    detail: "Players can assign one of 4 strategic archetypes to each sub-parcel: Resource, Trade, Fortress, or Energy. Each archetype grants faction-specific bonuses and interacts with surrounding tiles.",
  },
  {
    label: "Biome-Differentiated Parcel Costs",
    status: "complete" as const,
    date: "Mar 2026",
    detail: "Biome discounts and premiums now apply to all sub-parcel improvements. Desert parcels cost less to upgrade — volcanic and tundra biomes offer higher yield multipliers.",
  },
  {
    label: "On-Chain Upgrade Recording",
    status: "complete" as const,
    date: "Mar 2026",
    detail: "Every sub-parcel upgrade is permanently recorded as an Algorand transaction note. Your land history is immutable and publicly verifiable on-chain.",
  },
  {
    label: "Real-Time Territory Broadcasts",
    status: "complete" as const,
    date: "Mar 2026",
    detail: "WebSocket events now fire live when any player purchases, upgrades, or assigns an archetype to a sub-parcel. The world feels alive and reactive.",
  },
];

const UPCOMING = [
  { phase: "Next",   label: "Archetype UI Panel",         detail: "In-game selector panel for choosing and confirming sub-parcel archetypes — coming to the 3D globe interface." },
  { phase: "Next",   label: "Power Dependency Indicators", detail: "Fortress sub-parcels will show an 'offline' warning when no Energy parcel exists in the same grid." },
  { phase: "Soon",   label: "Fortress Siege System",       detail: "3-phase siege battles: Breach → Interior → Extraction. Armour loot drops and commander XP rewards." },
  { phase: "Soon",   label: "Resource Depth & Depletion",  detail: "Mining rigs will deplete over time and require replanting. Regrowth curves based on biome type." },
  { phase: "Q3",     label: "Rare Mineral Drops",          detail: "New tier of rare resources: Xenorite, Void Shard, Plasma Core. Biome-specific drop rates from conflict zones." },
  { phase: "Q3",     label: "Mega-Structure Landmarks",    detail: "4 giant structures available to construct: Launchpad, Orbital Dome, Quantum Forge, Ancient Relay." },
  { phase: "Q4",     label: "Commander Analytics Hub",     detail: "In-game dashboard showing territory metrics, income charts, archetype breakdown, and faction rank history." },
  { phase: "Q4",     label: "Guilds & Territory Alliances",detail: "Form guilds with other commanders. Coordinate siege campaigns and share resource routes." },
];

const BACKLOG = [
  { phase: "Season 2", label: "Season Expansion",   detail: "Expanded 3-phase seasons with conflict events, territory lockdown, and enhanced leaderboard rewards." },
  { phase: "Season 2", label: "Visual Overhaul",    detail: "Multi-layer biome blending, landmark 3D models, animated sub-parcel grid overlays at close zoom." },
  { phase: "Season 3", label: "Community Seasons",  detail: "Player-voted seasonal themes, guild wars, and a battle replay sharing system." },
  { phase: "Mainnet",  label: "MainNet Migration",  detail: "All parcels, commanders, and token balances transition to Algorand MainNet. Permanent ownership commences." },
];

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: "in_progress" | "complete" | "planned" }) {
  const cfg = {
    in_progress: { label: "IN PROGRESS", color: "#eab308", bg: "rgba(234,179,8,0.1)", border: "rgba(234,179,8,0.3)" },
    complete:    { label: "COMPLETE",    color: "#10b981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.3)" },
    planned:     { label: "PLANNED",     color: "#6b7280", bg: "rgba(107,114,128,0.1)", border: "rgba(107,114,128,0.3)" },
  }[status];
  return (
    <span style={{
      fontSize: 9, letterSpacing: "0.15em", fontWeight: 700, padding: "2px 7px",
      borderRadius: 3, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
      textTransform: "uppercase",
    }}>{cfg.label}</span>
  );
}

export default function LandingUpdates() {
  const [, setLocation] = useLocation();

  const { data: worldData } = useQuery<{ playerCount?: number; parcelCount?: number; totalBurned?: number; inGameCirculating?: number }>({
    queryKey: ["/api/economics"],
    queryFn: () => fetch("/api/economics").then(r => r.json()),
    staleTime: 30_000, refetchInterval: 30_000,
  });

  const { data: leaderboard } = useQuery<{ name: string; territories: number; totalFrontierEarned: number }[]>({
    queryKey: ["/api/game/leaderboard"],
    queryFn: () => fetch("/api/game/leaderboard").then(r => r.json()),
    staleTime: 60_000,
  });

  const topPlayer = leaderboard?.[0];

  return (
    <div style={{ position: "relative", minHeight: "100vh", width: "100%", overflow: "hidden", ...MONO }}>
      <Starfield />
      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 24px 80px" }}>
        <LandingNav activePath="/info/updates" />

        <div style={{ width: "100%", maxWidth: 900, textAlign: "center", marginBottom: 48, animation: "fadeInUp 0.8s ease-out forwards" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.3em", color: "rgba(100,160,255,0.55)", textTransform: "uppercase", marginBottom: 12 }}>— Live Development Log —</div>
          <h1 className="glitch-text" style={{ fontSize: "clamp(26px, 5vw, 36px)", fontWeight: 700, color: "#fff", margin: "0 0 12px", letterSpacing: "-0.01em" }}>
            Updates &amp; Roadmap
          </h1>
          <p style={{ fontSize: 14, color: "rgba(160,190,255,0.6)", maxWidth: 520, margin: "0 auto" }}>
            Built in public. Here's exactly what shipped, what's in flight, and what the frontier looks like ahead.
          </p>
        </div>

        {/* Live World Stats */}
        <div style={{ width: "100%", maxWidth: 900, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 48 }}>
          {[
            { label: "FRNTR Circulating", value: worldData?.inGameCirculating != null ? Math.round(worldData.inGameCirculating).toLocaleString() : "—" },
            { label: "FRNTR Burned",      value: worldData?.totalBurned        != null ? Math.round(worldData.totalBurned).toLocaleString()        : "—" },
            { label: "Top Commander",     value: topPlayer?.name ?? "—" },
            { label: "Build Date",        value: "March 2026" },
          ].map(({ label, value }) => (
            <div key={label} className="border-glow" style={{ ...CARD, textAlign: "center" }}>
              <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "rgba(100,150,255,0.5)", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#7eb8ff" }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ width: "100%", maxWidth: 900, display: "flex", flexDirection: "column", gap: 40 }}>

          {/* Active Updates */}
          <section>
            <h2 style={{ fontSize: 13, letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(100,160,255,0.7)", marginBottom: 16 }}>Currently Shipping</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {ACTIVE_UPDATES.map((u) => (
                <div key={u.label} style={{ ...CARD, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#c0d8ff" }}>{u.label}</span>
                    <StatusBadge status={u.status} />
                    <span style={{ fontSize: 10, color: "rgba(120,150,200,0.5)", marginLeft: "auto" }}>{u.date}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "rgba(150,180,230,0.7)", margin: 0, lineHeight: 1.6 }}>{u.detail}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Roadmap */}
          <section>
            <h2 style={{ fontSize: 13, letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(100,160,255,0.7)", marginBottom: 16 }}>Roadmap</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              {UPCOMING.map((u) => (
                <div key={u.label} style={{ ...CARD, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 9, padding: "2px 6px", background: "rgba(60,90,200,0.2)", border: "1px solid rgba(80,120,255,0.25)", borderRadius: 3, color: "rgba(120,170,255,0.7)", letterSpacing: "0.1em" }}>{u.phase}</span>
                    <StatusBadge status="planned" />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#c0d8ff" }}>{u.label}</div>
                  <div style={{ fontSize: 11, color: "rgba(140,170,220,0.6)", lineHeight: 1.5 }}>{u.detail}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Backlog */}
          <section>
            <h2 style={{ fontSize: 13, letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(100,160,255,0.7)", marginBottom: 16 }}>Long-Term Vision</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {BACKLOG.map((b) => (
                <div key={b.label} style={{ ...CARD, display: "flex", alignItems: "flex-start", gap: 16 }}>
                  <span style={{ fontSize: 9, padding: "3px 7px", background: "rgba(30,30,60,0.6)", border: "1px solid rgba(60,90,180,0.2)", borderRadius: 3, color: "rgba(100,130,200,0.6)", letterSpacing: "0.1em", whiteSpace: "nowrap", marginTop: 2 }}>{b.phase}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(180,200,240,0.8)", marginBottom: 4 }}>{b.label}</div>
                    <div style={{ fontSize: 11, color: "rgba(120,150,200,0.55)", lineHeight: 1.5 }}>{b.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Pre-buy Parcels Coming Soon */}
          <section style={{ background: "rgba(20,30,80,0.4)", border: "2px solid rgba(100,150,255,0.22)", borderRadius: 10, padding: 28, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, rgba(100,160,255,0.6), transparent)" }} />
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ display: "inline-block", background: "rgba(255,150,0,0.15)", border: "1px solid rgba(255,150,0,0.5)", borderRadius: 4, padding: "4px 14px", marginBottom: 14 }}>
                <span style={{ fontSize: 9, letterSpacing: "0.2em", color: "rgba(255,185,0,0.9)", textTransform: "uppercase", fontWeight: 700 }}>🔜 Coming Soon</span>
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: "#ffffff", marginBottom: 10 }}>Pre-Buy Land Parcels</h3>
              <p style={{ fontSize: 12, color: "rgba(150,180,230,0.7)", maxWidth: 520, margin: "0 auto" }}>
                Reserve your territory before mainnet launch. Lock in early-adopter pricing and secure your founder rank — before the land rush begins.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 18 }}>
              {[
                { icon: "🎯", label: "First-Mover Access",  desc: "Claim prime locations before they're contested by AI factions" },
                { icon: "💎", label: "Founder Pricing",     desc: "Pre-launch rates locked at your wallet before public mint" },
                { icon: "🏆", label: "Permanent Rank",      desc: "Pioneer, Vanguard, or Marshal title inscribed on-chain at launch" },
              ].map(({ icon, label, desc }) => (
                <div key={label} style={{ background: "rgba(10,20,50,0.5)", border: "1px solid rgba(60,90,180,0.22)", borderRadius: 6, padding: 14, textAlign: "center" }}>
                  <div style={{ fontSize: 26, marginBottom: 8 }}>{icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#a0d0ff", marginBottom: 5 }}>{label}</div>
                  <div style={{ fontSize: 10, color: "rgba(120,150,200,0.6)", lineHeight: 1.5 }}>{desc}</div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 10, color: "rgba(100,140,200,0.5)", marginBottom: 0 }}>Launching at mainnet activation — follow <a href="https://x.com/ascendancyalgox" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(100,180,255,0.7)", textDecoration: "none" }}>@ascendancyalgox</a> for announcement</p>
            </div>
          </section>

          {/* CTA */}
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <p style={{ fontSize: 12, color: "rgba(120,160,220,0.5)", marginBottom: 16 }}>Fully on-chain strategy — built in public.</p>
            <button onClick={() => setLocation("/game")} style={{
              background: "rgba(60,100,255,0.25)", border: "1px solid rgba(80,130,255,0.5)",
              borderRadius: 6, padding: "10px 28px", color: "rgba(160,210,255,0.95)", fontSize: 12,
              letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer", fontWeight: 600, fontFamily: "inherit",
            }}>Enter Game →</button>
          </div>
        </div>

        <LandingFooter />
      </div>

      <CookieConsentBanner />

      <style>{SHARED_CSS}</style>
    </div>
  );
}
