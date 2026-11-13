"use client";

import dynamic from "next/dynamic";
import { useReducedMotion } from "motion/react";
import type { Progress } from "./CitedMark";

// WebGL only exists in the browser: load the scene client-side, with the flat logo as the stand-in meanwhile.
const CitedMark = dynamic(() => import("./CitedMark"), {
  ssr: false,
  loading: () => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/samiksha-symbol.svg" alt="" className="mx-auto h-1/2 max-h-64 w-auto self-center opacity-90" />
  ),
});

export default function Mark3D(props: { mode?: "hero" | "working"; progress?: Progress; done?: boolean; className?: string }) {
  const still = useReducedMotion() ?? false;
  return (
    <div className={props.className ?? "relative h-full w-full"}>
      <CitedMark mode={props.mode} progress={props.progress} done={props.done} still={still} />
    </div>
  );
}
