// Types for the upstream React Bits JS variant (props: see reactbits.dev / the component's prop table).
// Without this file TypeScript infers every defaulted prop of the .jsx as required.
import type { FC, ReactNode } from "react";

declare const FoldText: FC<{ children?: ReactNode; className?: string; style?: React.CSSProperties; [prop: string]: unknown }>;
export default FoldText;
