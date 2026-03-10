/**
 * GlobeEventOverlays — renders replay world events on the Three.js globe.
 * Mount this INSIDE a <Canvas> scene alongside the existing globe.
 */
import * as THREE from "three";
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { WorldEvent } from "@shared/worldEvents";

const GLOBE_RADIUS = 2;

function latLngToVec3(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi   = (90 - lat)  * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta)
  );
}

const EVENT_COLORS: Record<string, string> = {
  land_claimed:       "#00ff6a",
  battle_started:     "#ff1744",
  battle_resolved:    "#ff9800",
  commander_deployed: "#00e5ff",
  commander_minted:   "#00e5ff",
  scan_ping:          "#2196f3",
  jammer_zone:        "#9c27b0",
  faction_movement:   "#ffeb3b",
  resource_pulse:     "#4caf50",
  mine_action:        "#78909c",
};

const EVENT_LABELS: Partial<Record<string, string>> = {
  land_claimed:       "TERRITORY CLAIMED",
  battle_started:     "BATTLE INITIATED",
  battle_resolved:    "BATTLE RESOLVED",
  commander_deployed: "COMMANDER ACTIVE",
  commander_minted:   "COMMANDER MINTED",
  scan_ping:          "SCAN PING",
  jammer_zone:        "JAMMING ZONE",
  faction_movement:   "FACTION MOVEMENT",
  resource_pulse:     "RESOURCE PULSE",
  mine_action:        "MINING OP",
};

const EVENT_SIZES: Partial<Record<string, number>> = {
  battle_started:     0.022,
  battle_resolved:    0.016,
  land_claimed:       0.012,
  mine_action:        0.008,
  commander_minted:   0.014,
  commander_deployed: 0.014,
  scan_ping:          0.018,
  jammer_zone:        0.020,
  resource_pulse:     0.010,
  faction_movement:   0.012,
};

interface PulseMarkerProps {
  event: WorldEvent;
  replayTime: number;
  size?: number;
}

function PulseMarker({ event, replayTime, size = 0.012 }: PulseMarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);
  const t       = useRef(0);

  const pos = useMemo(
    () => latLngToVec3(event.lat, event.lng, GLOBE_RADIUS * 1.005),
    [event.lat, event.lng]
  );
  const lookAt = useMemo(() => pos.clone().multiplyScalar(2), [pos]);
  const color  = useMemo(() => new THREE.Color(EVENT_COLORS[event.type] ?? "#ffffff"), [event.type]);

  const age        = (replayTime - event.timestamp) / 1000;
  const isRecent   = age < 30;
  const isBattle   = event.type === "battle_started";
  const isRingOnly = event.type === "scan_ping";
  const pulseSpeed = isBattle ? (isRecent ? 5 : 3) : (isRecent ? 3 : 1.5);

  useFrame((_, delta) => {
    t.current += delta * pulseSpeed;
    const pulse = 0.7 + Math.sin(t.current) * 0.3;

    if (meshRef.current && !isRingOnly) {
      (meshRef.current.material as THREE.MeshBasicMaterial).opacity = pulse * 0.85;
    }
    if (ringRef.current) {
      const ringPulse = (Math.sin(t.current * 0.7) + 1) * 0.5;
      ringRef.current.scale.setScalar(1.0 + ringPulse * 0.6);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - ringPulse) * 0.6;
    }
  });

  const ringInner = size ?? 0.012;
  const ringOuter = (size ?? 0.012) * 1.8;

  return (
    <group position={pos}>
      {!isRingOnly && (
        <mesh ref={meshRef} onUpdate={self => self.lookAt(lookAt)}>
          <circleGeometry args={[size ?? 0.012, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.85} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      <mesh ref={isRingOnly ? meshRef : ringRef} onUpdate={self => self.lookAt(lookAt)}>
        <ringGeometry args={[ringInner, ringOuter, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

interface ArcMarkerProps {
  event: WorldEvent;
  isBattle?: boolean;
}

function ArcMarker({ event, isBattle = false }: ArcMarkerProps) {
  const t = useRef(0);

  const fromLat = (event.metadata.fromLat as number) ?? event.lat;
  const fromLng = (event.metadata.fromLng as number) ?? event.lng;

  const points = useMemo(() => {
    const start = latLngToVec3(fromLat, fromLng, GLOBE_RADIUS * 1.01);
    const end   = latLngToVec3(event.lat, event.lng, GLOBE_RADIUS * 1.01);
    const mid   = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(GLOBE_RADIUS * 1.25);
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    return curve.getPoints(30);
  }, [fromLat, fromLng, event.lat, event.lng]);

  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

  const arcColor = useMemo(
    () => new THREE.Color(isBattle ? "#ff1744" : EVENT_COLORS.faction_movement),
    [isBattle]
  );

  const mat = useMemo(() => new THREE.LineBasicMaterial({
    color: arcColor,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  }), [arcColor]);

  const lineObj = useMemo(() => new THREE.Line(geometry, mat), [geometry, mat]);

  const animSpeed = isBattle ? 4 : 2;
  useFrame((_, delta) => {
    t.current += delta;
    mat.opacity = 0.5 + Math.sin(t.current * animSpeed) * 0.3;
  });

  return <primitive object={lineObj} />;
}

function EventCard({ event, replayTime }: { event: WorldEvent; replayTime: number }) {
  const pos = useMemo(
    () => latLngToVec3(event.lat, event.lng, GLOBE_RADIUS * 1.06),
    [event.lat, event.lng]
  );

  const color = EVENT_COLORS[event.type] ?? "#ffffff";
  const label = EVENT_LABELS[event.type] ?? event.type.toUpperCase();
  const age   = Math.round((replayTime - event.timestamp) / 1000);
  const ageStr = age < 60 ? `${age}s` : age < 3600 ? `${Math.round(age / 60)}m` : `${Math.round(age / 3600)}h`;

  const detail = (() => {
    const m = event.metadata;
    if (event.type === "battle_started")   return `${m.attacker ?? "?"} → ${m.defender ?? "?"}`;
    if (event.type === "battle_resolved")  return m.outcome === "attacker_wins" ? "ATTACKER WINS" : "DEFENDER WINS";
    if (event.type === "land_claimed")     return m.playerName ? String(m.playerName) : `#${event.plotId}`;
    if (event.type === "faction_movement") return `${event.factionId ?? "?"} ADVANCING`;
    if (event.type === "jammer_zone")      return `${event.factionId ?? "?"} r=${(m.radius as number) ?? 0}`;
    if (event.type === "resource_pulse")   return `Fe:${m.iron ?? 0} Fu:${m.fuel ?? 0}`;
    return `${event.lat.toFixed(1)}°, ${event.lng.toFixed(1)}°`;
  })();

  const isCritical = event.severity === "critical" || event.severity === "high";

  return (
    <Html position={pos} center distanceFactor={4} zIndexRange={[10, 20]} occlude={false}>
      <div
        style={{
          pointerEvents: "none",
          userSelect: "none",
          fontFamily: "monospace",
          fontSize: "9px",
          letterSpacing: "0.12em",
          lineHeight: "1.4",
          whiteSpace: "nowrap",
          padding: "4px 7px",
          borderRadius: "3px",
          background: `rgba(2, 4, 14, 0.82)`,
          border: `1px solid ${color}50`,
          boxShadow: `0 0 12px ${color}30`,
          color: color,
          opacity: 0.92,
          transform: "translateY(-4px)",
        }}
      >
        {isCritical && (
          <span style={{ color: "#ff1744", marginRight: "4px" }}>⬤</span>
        )}
        <span style={{ color: `${color}99`, marginRight: "4px" }}>
          {label}
        </span>
        <span style={{ color: "#ffffff" }}>{detail}</span>
        <span style={{ color: `${color}60`, marginLeft: "6px" }}>{ageStr}</span>
      </div>
    </Html>
  );
}

interface GlobeEventOverlaysProps {
  events: WorldEvent[];
  replayTime: number;
  visibleTypes: Set<string>;
}

export function GlobeEventOverlays({ events, replayTime, visibleTypes }: GlobeEventOverlaysProps) {
  const visible = useMemo(() => {
    return events.filter(e => {
      if (!visibleTypes.has(e.type)) return false;
      const start = e.timestamp;
      const end   = e.endTimestamp ?? e.timestamp + 120_000;
      return replayTime >= start - 5000 && replayTime <= end;
    });
  }, [events, replayTime, visibleTypes]);

  // Show cards only for the 8 most recent visible events to avoid clutter
  const cardEvents = useMemo(() => {
    return [...visible]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 8);
  }, [visible]);

  return (
    <>
      {visible.map(event => {
        const size = EVENT_SIZES[event.type] ?? 0.012;
        if (event.type === "faction_movement") {
          return (
            <group key={event.id}>
              <ArcMarker event={event} />
              <PulseMarker event={event} replayTime={replayTime} size={0.010} />
            </group>
          );
        }
        return (
          <PulseMarker key={event.id} event={event} replayTime={replayTime} size={size} />
        );
      })}
      {cardEvents.map(event => (
        <EventCard key={`card-${event.id}`} event={event} replayTime={replayTime} />
      ))}
    </>
  );
}
