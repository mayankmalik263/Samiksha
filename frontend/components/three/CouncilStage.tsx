"use client";

/**
 * The live council stage: the 3D Cited mark in the middle (it IS the Chief), eight agent seats around it like a
 * round table seen from the front, each linked to the mark by a dashed line.
 *
 *  waiting  -> the seat is a pale paper tile, its link faint.
 *  running  -> the seat lights up in its colour, its link flows, and source pages fly from the seat into the brackets.
 *  done     -> a burst of haldi quote lines (one per verified finding) shoots from the seat onto the mark's quote line.
 *
 * The mark's own three lines are the progress bars (research / verdict / debate); the haldi line glows at the verdict.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Line, RoundedBox } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { HALDI, INK, Mark, NEEL, Studio, usePageTexture, type Progress } from "./CitedMark";
import StatusMark from "@/components/reactbits/StatusMark";
import type { AgentKey, AgentState } from "@/lib/council";

type SeatKey = Exclude<AgentKey, "chief">;

const SEATS: { key: SeatKey; name: string; angle: number; color: string }[] = [
  { key: "fundamentals", name: "Fundamentals", angle: 130, color: INK },
  { key: "earnings_call", name: "Earnings call", angle: 90, color: INK },
  { key: "news", name: "News", angle: 50, color: INK },
  { key: "bull_case", name: "The Bull", angle: 168, color: NEEL },
  { key: "bear_case", name: "The Bear", angle: 12, color: HALDI },
  { key: "bull_rebuttals", name: "Bull replies", angle: 208, color: "#6D63E0" },
  { key: "bear_rebuttals", name: "Bear replies", angle: 332, color: "#E9A23B" },
  { key: "risks", name: "Risk", angle: 270, color: "#3D3955" },
];
const RX = 4.9; // the "table" ellipse around the mark
const RY = 3.05;
const PAPER = "#E7E4DA";
const seatAt = (deg: number) => {
  const r = THREE.MathUtils.degToRad(deg);
  return new THREE.Vector3(Math.cos(r) * RX, Math.sin(r) * RY, 0.3);
};
const damp = THREE.MathUtils.damp;

/** The dashed ellipse the seats sit on. */
function Table() {
  const pts = useMemo(
    () => Array.from({ length: 97 }, (_, i) => {
      const t = (i / 96) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(t) * RX, Math.sin(t) * RY, -0.2);
    }),
    [],
  );
  return <Line points={pts} color={INK} lineWidth={1} dashed dashSize={0.12} gapSize={0.12} transparent opacity={0.14} />;
}

type SeatProps = {
  seat: (typeof SEATS)[number];
  state: AgentState;
  count: number; // verified findings this agent produced: the size of its quote burst
  quote: React.RefObject<THREE.Object3D | null>;
  still: boolean;
  tex: THREE.Texture;
  anchor: (o: THREE.Object3D | null) => void; // where this seat's DOM label is pinned
};

function Seat({ seat, state, count, quote, still, tex, anchor }: SeatProps) {
  const pos = useMemo(() => seatAt(seat.angle), [seat.angle]);
  const inward = useMemo(() => pos.clone().multiplyScalar(0.46).setZ(0.2), [pos]); // where the link meets the mark
  const tile = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshPhysicalMaterial>(null);
  const link = useRef<{ material: THREE.Material & { dashOffset: number; opacity: number } } | null>(null);
  const pages = useRef<(THREE.Mesh | null)[]>([]);
  const sparks = useRef<(THREE.Mesh | null)[]>([]);
  const burst = useRef<number | null>(null);
  const prev = useRef(state.status);
  const target = useMemo(() => new THREE.Vector3(), []);
  const lit = useMemo(() => new THREE.Color(seat.color), [seat.color]);
  const pale = useMemo(() => new THREE.Color(PAPER), []);
  const N = Math.min(6, Math.max(1, count));

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const running = state.status === "running";
    const done = state.status === "done";
    if (prev.current !== state.status) {
      if (state.status === "done") burst.current = t; // fire the quote burst once, on the transition
      prev.current = state.status;
    }

    // the seat tile: pale while waiting, its colour once working, a heartbeat while running
    if (mat.current && tile.current) {
      mat.current.color.lerp(state.status === "waiting" ? pale : lit, 1 - Math.exp(-6 * dt));
      mat.current.emissive.copy(lit);
      const pulse = running && !still ? 0.35 + 0.35 * Math.sin(t * 5) : done ? 0.08 : 0;
      mat.current.emissiveIntensity = damp(mat.current.emissiveIntensity, pulse, 6, dt);
      const s = running && !still ? 1.08 + 0.04 * Math.sin(t * 5) : 1;
      tile.current.scale.setScalar(damp(tile.current.scale.x, s, 8, dt));
    }

    // the link: faint, flowing while running, steady once done
    if (link.current) {
      const m = link.current.material;
      m.opacity = damp(m.opacity, state.status === "waiting" ? 0.12 : running ? 0.85 : 0.45, 5, dt);
      if (running && !still) m.dashOffset -= dt * 1.6;
    }

    // source pages flying from the seat into the brackets while the agent reads
    pages.current.forEach((p, i) => {
      if (!p) return;
      if (!running || still) {
        p.visible = false;
        return;
      }
      p.visible = true;
      const k = ((t * 0.7 + i / pages.current.length) % 1 + 1) % 1;
      const e = k * k * (3 - 2 * k);
      p.position.lerpVectors(pos, inward, e);
      p.position.z += Math.sin(Math.PI * k) * 0.9; // arc toward the viewer
      p.rotation.set(0.3 * Math.sin(t + i), (1 - e) * 1.2, (1 - e) * 0.6 * (i % 2 ? 1 : -1));
      p.scale.setScalar(0.42 * (1 - 0.65 * e));
      (p.material as THREE.MeshStandardMaterial).opacity = Math.min(1, Math.sin(Math.PI * k) * 2.2);
    });

    // the quote burst: one haldi line per verified finding, landing on the mark's quote line
    if (quote.current) quote.current.getWorldPosition(target);
    sparks.current.forEach((sp, i) => {
      if (!sp) return;
      const start = burst.current;
      const k = start === null || still ? -1 : (t - start - i * 0.14) / 1.15;
      if (k < 0 || k > 1) {
        sp.visible = false;
        return;
      }
      sp.visible = true;
      const e = 1 - Math.pow(1 - k, 3);
      sp.position.lerpVectors(pos, target, e);
      sp.position.y += Math.sin(Math.PI * k) * 0.8;
      sp.position.z += Math.sin(Math.PI * k) * 1.2;
      sp.rotation.z = Math.PI / 2 + (1 - e) * 2;
      sp.scale.setScalar(0.3 + 0.7 * Math.sin(Math.PI * Math.min(1, k * 1.1)));
    });
  });

  return (
    <group>
      <Line
        ref={link as never}
        points={[pos, inward]}
        color={seat.color}
        lineWidth={1.6}
        dashed
        dashSize={0.18}
        gapSize={0.12}
        transparent
        opacity={0.12}
      />
      <RoundedBox ref={tile} args={[1.05, 0.7, 0.14]} radius={0.08} smoothness={4} position={pos}>
        <meshPhysicalMaterial ref={mat} color={PAPER} roughness={0.35} clearcoat={0.8} clearcoatRoughness={0.2} emissiveIntensity={0} />
      </RoundedBox>
      {Array.from({ length: 3 }, (_, i) => (
        <mesh key={i} ref={(m) => { pages.current[i] = m; }} visible={false}>
          <planeGeometry args={[1, 1.33]} />
          <meshStandardMaterial map={tex} transparent side={THREE.DoubleSide} roughness={0.9} />
        </mesh>
      ))}
      {Array.from({ length: N }, (_, i) => (
        <mesh key={i} ref={(m) => { sparks.current[i] = m; }} visible={false}>
          <capsuleGeometry args={[0.06, 0.3, 6, 12]} />
          <meshStandardMaterial color={HALDI} emissive={HALDI} emissiveIntensity={1.1} toneMapped={false} />
        </mesh>
      ))}
      <object3D ref={anchor} position={[pos.x, pos.y - 0.62, pos.z]} />
    </group>
  );
}

/** Fit the ring to the viewport (phones are narrow), and push in a little when the verdict lands. */
function Rig({ done, children }: { done: boolean; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  const { viewport } = useThree();
  const fit = Math.min(1, (viewport.width / 2) / (RX + 1.25), (viewport.height / 2) / (RY + 1.15));
  useFrame(({ camera }, dt) => {
    if (g.current) g.current.scale.setScalar(damp(g.current.scale.x, fit, 6, dt));
    camera.position.z = damp(camera.position.z, done ? 12.2 : 13, 1.5, dt);
  });
  return <group ref={g}>{children}</group>;
}

/** Pins each DOM label to its seat: project the seat's anchor to screen space every frame (no React re-render).
 *  (drei's <Html> gives every label its own React root, which breaks under React 19's dev double-mount.) */
function Labels({ anchors, labels }: { anchors: React.RefObject<(THREE.Object3D | null)[]>; labels: React.RefObject<(HTMLElement | null)[]> }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    anchors.current.forEach((a, i) => {
      const el = labels.current[i];
      if (!a || !el) return;
      a.getWorldPosition(v).project(camera);
      el.style.transform = `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px) translate(-50%, -50%)`;
    });
  });
  return null;
}

function Scene({ agents, counts, progress, done, still, labels }: StageProps & { still: boolean; labels: React.RefObject<(HTMLElement | null)[]> }) {
  const quote = useRef<THREE.Object3D | null>(null);
  const anchors = useRef<(THREE.Object3D | null)[]>([]);
  const tex = usePageTexture();
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 6]} intensity={1.4} />
      <directionalLight position={[-4, -2, 3]} intensity={0.4} color="#C7C3F4" />
      <Studio />
      <Rig done={done}>
        <Table />
        {SEATS.map((s, i) => (
          <Seat key={s.key} seat={s} state={agents[s.key]} count={counts[s.key] ?? 0} quote={quote} still={still} tex={tex} anchor={(o) => { anchors.current[i] = o; }} />
        ))}
        <Mark mode="working" progress={progress} done={done} still={still} onQuoteLine={(o) => (quote.current = o)} />
      </Rig>
      <ContactShadows position={[0, -3.9, 0]} opacity={0.22} scale={14} blur={2.8} far={5} color={INK} />
      <Labels anchors={anchors} labels={labels} />
    </>
  );
}

export type StageProps = {
  agents: Record<AgentKey, AgentState>;
  counts: Partial<Record<AgentKey, number>>;
  progress: Progress;
  done: boolean;
};

export default function CouncilStage({ still = false, ...props }: StageProps & { still?: boolean }) {
  const labels = useRef<(HTMLElement | null)[]>([]);
  return (
    <div className="relative h-full w-full">
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 13], fov: 38 }} gl={{ antialias: true, alpha: true }} frameloop={still ? "demand" : "always"}>
        <Scene {...props} still={still} labels={labels} />
      </Canvas>
      {/* seat labels: real DOM (crisp text, screen readers), positioned by <Labels> */}
      <ol className="pointer-events-none absolute inset-0" aria-label="Council seats">
        {SEATS.map((seat, i) => {
          const s = props.agents[seat.key];
          const count = props.counts[seat.key] ?? 0;
          const status = s.status === "waiting" ? "pending" : s.status === "running" ? "running" : s.status === "done" ? "done" : "failed";
          return (
            <li
              key={seat.key}
              ref={(el) => { labels.current[i] = el; }}
              className="absolute top-0 left-0 flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-paper/90 px-2.5 py-1 font-mono text-[11px] text-ink shadow-sm backdrop-blur will-change-transform"
              style={{ transform: "translate(-9999px, 0)" }}
            >
              <StatusMark status={status} size={12} strokeWidth={2.6} color={seat.color === INK ? "#4338CA" : seat.color} doneColor="#15803D" errorColor="#92400E" />
              {seat.name}
              {s.status === "done" && count > 0 && <span className="text-haldi-text">· {count}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
