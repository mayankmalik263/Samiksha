"use client";

/**
 * The Samiksha "Cited" mark, in 3D. Built from the logo's own 256-unit grid (brand/build.py), so it IS the logo:
 * ink brackets, Neel folds that really fold on a hinge, and three source lines whose haldi middle line is the quote.
 *
 * mode "hero":    the mark assembles (brackets slide in, folds close, lines grow), then floats, tilts toward the
 *                 cursor and turns with scroll. Annual-report pages drift behind it; quote sparks fly from a page
 *                 into the brackets: the product's whole idea, sources becoming cited lines.
 * mode "working": the three lines are live progress: top = research, bottom = debate, middle (haldi) = verdict.
 */
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Float, Lightformer, RoundedBox } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

export const INK = "#1B1835";
export const NEEL = "#4338CA";
export const HALDI = "#D97706";
const U = 1 / 64; // logo units -> world units: the 256-unit mark is 4 world units tall
const X = (x: number) => (x - 128) * U;
const Y = (y: number) => (128 - y) * U;
const DEPTH = 0.42;
const FOLD = 0.42; // resting fold angle of the Neel corners (radians)
const damp = THREE.MathUtils.damp;

export type Progress = { research: number; debate: number; verdict: number };

type Props = {
  mode?: "hero" | "working";
  progress?: Progress;
  done?: boolean;
  still?: boolean; // prefers-reduced-motion: no intro, no float, no particles
};

/* ---------- geometry ---------- */

function armShape(points: [number, number][]) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0] * U, -points[0][1] * U);
  for (const [x, y] of points.slice(1)) s.lineTo(x * U, -y * U);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: DEPTH, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3 });
  g.translate(0, 0, -DEPTH / 2);
  return g;
}

// Hinge-local outlines (logo units, y down). Top arm: (60,36) (92,36) (76,60) (60,60) relative to its hinge (60,36).
const TOP_ARM: [number, number][] = [[0, 0], [32, 0], [16, 24], [0, 24]];
const BOTTOM_ARM: [number, number][] = [[0, 0], [16, 0], [32, 24], [0, 24]];
const mirror = (pts: [number, number][]) => pts.map(([x, y]) => [-x, y] as [number, number]).reverse();

const LINES = [
  { y: Y(88), w: 64 * U, quote: false }, // research
  { y: Y(126), w: 72 * U, quote: true }, // verdict: the haldi quote line
  { y: Y(164), w: 40 * U, quote: false }, // debate
];
const LINE_H = 20 * U;
const LINE_LEFT = X(92);

/* ---------- a paper page with ruled lines and one highlighted line (the source) ---------- */

export function usePageTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 340;
    const g = c.getContext("2d")!;
    g.fillStyle = "#FFFFFF";
    g.fillRect(0, 0, 256, 340);
    g.fillStyle = "#1B1835";
    g.globalAlpha = 0.9;
    g.fillRect(24, 26, 120, 12);
    g.globalAlpha = 0.18;
    for (let i = 0; i < 15; i++) {
      const y = 62 + i * 17;
      const w = 208 - ((i * 37) % 70);
      if (i === 6) {
        g.globalAlpha = 0.55;
        g.fillStyle = HALDI;
        g.fillRect(22, y - 3, w + 4, 11);
        g.fillStyle = "#1B1835";
        g.globalAlpha = 0.18;
      }
      g.fillRect(24, y, w, 5);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, []);
}

const PAGES: { p: [number, number, number]; r: [number, number, number]; s: number }[] = [
  { p: [-4.2, 1.6, -3.2], r: [0.1, 0.5, -0.12], s: 1.0 },
  { p: [-3.4, -1.9, -2.4], r: [-0.15, 0.35, 0.1], s: 0.85 },
  { p: [4.0, 1.9, -3.6], r: [0.12, -0.45, 0.14], s: 1.05 },
  { p: [3.6, -1.6, -2.2], r: [-0.08, -0.3, -0.08], s: 0.8 },
  { p: [0.4, 3.1, -4.6], r: [0.3, 0.05, 0.05], s: 0.9 },
  { p: [-1.2, -3.2, -4.2], r: [-0.3, 0.1, -0.1], s: 0.75 },
];

function SourcePages({ still }: { still: boolean }) {
  const tex = usePageTexture();
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    if (still) return;
    const t = clock.elapsedTime;
    refs.current.forEach((m, i) => {
      if (!m) return;
      const base = PAGES[i];
      m.position.y = base.p[1] + Math.sin(t * 0.35 + i * 1.7) * 0.18;
      m.rotation.z = base.r[2] + Math.sin(t * 0.25 + i) * 0.05;
    });
  });
  return (
    <group>
      {PAGES.map((pg, i) => (
        <mesh key={i} ref={(m) => { refs.current[i] = m; }} position={pg.p} rotation={pg.r} scale={pg.s}>
          <planeGeometry args={[1.25, 1.66]} />
          <meshStandardMaterial map={tex} roughness={0.9} transparent opacity={0.92} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/** Quote sparks: small haldi pills that leave a page's highlighted line and land on the mark's quote line. */
function QuoteSparks({ target }: { target: React.RefObject<THREE.Object3D | null> }) {
  const N = 4;
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const to = useMemo(() => new THREE.Vector3(), []);
  const from = useMemo(() => new THREE.Vector3(), []);
  const mid = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime - 2.2; // after the intro
    if (target.current) target.current.getWorldPosition(to); // read each frame: the line mounts after us
    refs.current.forEach((m, i) => {
      if (!m) return;
      const period = 3.6;
      const k = ((t + i * (period / N)) % period) / period; // 0..1 along the flight
      const page = PAGES[(i * 2 + Math.floor((t + i) / period)) % PAGES.length];
      if (t < 0) { m.visible = false; return; }
      m.visible = true;
      from.set(page.p[0], page.p[1] - 0.15, page.p[2] + 0.05);
      mid.copy(from).lerp(to, 0.5).add(new THREE.Vector3(0, 0.9, 1.2)); // arc toward the viewer
      const e = 1 - Math.pow(1 - k, 3);
      // quadratic bezier from -> mid -> to
      const a = from.clone().lerp(mid, e);
      const b = mid.clone().lerp(to, e);
      m.position.copy(a.lerp(b, e));
      const s = Math.sin(Math.PI * Math.min(1, k * 1.15));
      m.scale.setScalar(0.25 + 0.75 * s);
      (m.material as THREE.MeshStandardMaterial).opacity = Math.min(1, s * 1.6);
    });
  });
  return (
    <group>
      {Array.from({ length: N }, (_, i) => (
        <mesh key={i} ref={(m) => { refs.current[i] = m; }} visible={false}>
          <capsuleGeometry args={[0.07, 0.34, 6, 12]} />
          <meshStandardMaterial color={HALDI} emissive={HALDI} emissiveIntensity={0.9} transparent toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- the mark ---------- */

export function Mark({ mode, progress, done, still, onQuoteLine }: Required<Omit<Props, "progress">> & { progress?: Progress; onQuoteLine: (o: THREE.Object3D) => void }) {
  const root = useRef<THREE.Group>(null);
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const arms = useRef<(THREE.Mesh | null)[]>([]);
  const lines = useRef<(THREE.Group | null)[]>([]);
  const quoteMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const born = useRef<number | null>(null);

  const geo = useMemo(
    () => ({ top: armShape(TOP_ARM), bottom: armShape(BOTTOM_ARM), topR: armShape(mirror(TOP_ARM)), bottomR: armShape(mirror(BOTTOM_ARM)) }),
    [],
  );

  useFrame(({ clock, pointer }, dt) => {
    if (born.current === null) born.current = clock.elapsedTime;
    const t = still ? 99 : clock.elapsedTime - born.current; // seconds since the mark appeared
    const ease = (a: number, b: number) => THREE.MathUtils.smoothstep(t, a, b);

    // 1. Brackets slide in from the sides and settle.
    const slide = 1 - ease(0, 1.1);
    if (left.current && right.current) {
      left.current.position.x = -3.2 * slide;
      right.current.position.x = 3.2 * slide;
      left.current.rotation.y = 0.9 * slide;
      right.current.rotation.y = -0.9 * slide;
    }

    // 2. The Neel corners fold closed on their hinges (they start flat-on to the viewer).
    const fold = THREE.MathUtils.lerp(Math.PI / 2, FOLD, ease(0.55, 1.6));
    arms.current.forEach((m, i) => {
      if (m) m.rotation.y = i < 2 ? -fold : fold;
    });

    // 3. The lines: grow in on intro (hero) or show live progress (working).
    const p = progress ?? { research: 1, debate: 1, verdict: 1 };
    const targets = mode === "working" ? [p.research, p.verdict, p.debate] : [1, 1, 1];
    lines.current.forEach((g, i) => {
      if (!g) return;
      const gate = mode === "working" ? 1 : ease(1.15 + i * 0.16, 1.75 + i * 0.16);
      const want = Math.max(0.06, targets[i]) * gate;
      g.scale.x = still ? want : damp(g.scale.x, want, 6, dt);
    });

    // 4. The quote line glows: a slow breath in the hero, brighter as the verdict lands.
    if (quoteMat.current) {
      const breath = 0.5 + 0.5 * Math.sin(clock.elapsedTime * (mode === "working" && !done ? 3.2 : 1.4));
      const base = mode === "working" ? (done ? 0.9 : 0.15 + 0.35 * breath) : 0.2 + 0.25 * breath;
      quoteMat.current.emissiveIntensity = still ? 0.35 : damp(quoteMat.current.emissiveIntensity, base, 4, dt);
    }

    // 5. Tilt toward the cursor; in the hero, also turn a little as the page scrolls.
    if (root.current && !still) {
      const scroll = mode === "hero" && typeof window !== "undefined" ? Math.min(1.5, window.scrollY / window.innerHeight) : 0;
      const spin = mode === "working" && !done ? Math.sin(clock.elapsedTime * 0.6) * 0.18 : 0;
      root.current.rotation.y = damp(root.current.rotation.y, pointer.x * 0.38 + scroll * 0.9 + spin, 3, dt);
      root.current.rotation.x = damp(root.current.rotation.x, -pointer.y * 0.22 + scroll * 0.25, 3, dt);
      root.current.position.y = damp(root.current.position.y, -scroll * 0.6, 3, dt);
    }
  });

  const ink = <meshPhysicalMaterial color={INK} roughness={0.38} metalness={0.05} clearcoat={0.7} clearcoatRoughness={0.25} />;
  const neel = <meshPhysicalMaterial color={NEEL} roughness={0.22} metalness={0.05} clearcoat={1} clearcoatRoughness={0.12} />;

  return (
    <group ref={root}>
      {/* left bracket: stem + two folds hinged at x = 60 */}
      <group ref={left}>
        <RoundedBox args={[28 * U, 184 * U, DEPTH]} radius={0.04} smoothness={4} position={[X(46), Y(128), 0]}>{ink}</RoundedBox>
        <mesh ref={(m) => { arms.current[0] = m; }} geometry={geo.top} position={[X(60), Y(36), 0]}>{neel}</mesh>
        <mesh ref={(m) => { arms.current[1] = m; }} geometry={geo.bottom} position={[X(60), Y(196), 0]}>{neel}</mesh>
      </group>
      {/* right bracket: mirrored, hinged at x = 196 */}
      <group ref={right}>
        <RoundedBox args={[28 * U, 184 * U, DEPTH]} radius={0.04} smoothness={4} position={[X(210), Y(128), 0]}>{ink}</RoundedBox>
        <mesh ref={(m) => { arms.current[2] = m; }} geometry={geo.topR} position={[X(196), Y(36), 0]}>{neel}</mesh>
        <mesh ref={(m) => { arms.current[3] = m; }} geometry={geo.bottomR} position={[X(196), Y(196), 0]}>{neel}</mesh>
      </group>
      {/* the three source lines, growing from their left edge */}
      {LINES.map((l, i) => (
        <group key={i} ref={(g) => { lines.current[i] = g; }} position={[LINE_LEFT, l.y, 0]} scale={[still ? 1 : 0.0001, 1, 1]}>
          <RoundedBox
            args={[l.w, LINE_H, 0.3]}
            radius={LINE_H / 2 - 0.002}
            smoothness={6}
            position={[l.w / 2, 0, 0]}
            ref={l.quote ? (m: THREE.Mesh | null) => { if (m) onQuoteLine(m); } : undefined}
          >
            {l.quote ? (
              <meshPhysicalMaterial ref={quoteMat} color={HALDI} emissive={HALDI} emissiveIntensity={0.2} roughness={0.3} clearcoat={1} />
            ) : (
              ink
            )}
          </RoundedBox>
        </group>
      ))}
    </group>
  );
}

export function Studio() {
  // A local light rig instead of a downloaded HDR: no network request, consistent reflections on the clearcoat.
  return (
    <Environment resolution={256} frames={1}>
      <Lightformer form="rect" intensity={2.4} color="#FFFFFF" position={[0, 4, -6]} scale={[10, 2, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#ECEBFB" position={[-6, 1, 1]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#FDF1DD" position={[6, -1, 1]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
      <Lightformer form="circle" intensity={2} color="#FFFFFF" position={[0, 0, 8]} scale={3} />
    </Environment>
  );
}

export default function CitedMark({ mode = "hero", progress, done = false, still = false }: Props) {
  const quoteLine = useRef<THREE.Object3D | null>(null);
  const hero = mode === "hero";
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, hero ? 11.5 : 8.2], fov: 35 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      frameloop={still ? "demand" : "always"}
      aria-hidden="true"
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 5, 6]} intensity={1.4} />
      <directionalLight position={[-4, -2, 3]} intensity={0.4} color="#C7C3F4" />
      <Studio />
      {hero && <SourcePages still={still} />}
      <Float enabled={!still} speed={1.4} rotationIntensity={0.18} floatIntensity={0.35} floatingRange={[-0.08, 0.08]}>
        <Mark mode={mode} progress={progress} done={done} still={still} onQuoteLine={(o) => (quoteLine.current = o)} />
      </Float>
      {hero && !still && <QuoteSparks target={quoteLine} />}
      <ContactShadows position={[0, -2.55, 0]} opacity={0.28} scale={9} blur={2.6} far={4} color={INK} />
    </Canvas>
  );
}
