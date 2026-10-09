/**
 * Adapted from https://www.rareui.com/components/matrixorb
 * Copyright (c) 2026 Swami Malode. MIT + Commons Clause + Attribution.
 * See ../../docs/RARE_UI_LICENSE.txt. SVG/CSS thinking-only adaptation, no canvas loop.
 */
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion";
import "./MatrixThinkingOrb.css";

export interface MatrixThinkingOrbProps {
  /** Render only while an actual operation is thinking; false removes the status and graphic. */
  active?: boolean;
  label?: string;
  /** Turn off when the parent already announces this operation in a live region. */
  announce?: boolean;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

// Rare UI's round 11×11 grid and radial falloff, rendered once instead of every frame.
const dots = Array.from({ length: 121 }, (_, index) => {
  const x = index % 11 - 5;
  const y = Math.floor(index / 11) - 5;
  const distance = Math.hypot(x / 5, y / 5);
  return { x: 50 + x * 7.4, y: 50 + y * 7.4, radius: 4.44 * Math.exp(-distance * distance * 1.7), distance };
}).filter((dot) => dot.distance <= 1.12);

export function MatrixThinkingOrb({
  active = true, label = "Analizando imagen…", announce = true, size = 112, className = "", style,
}: MatrixThinkingOrbProps) {
  const id = useId().replace(/:/g, "");
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(() => typeof document === "undefined" || !document.hidden);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    if (!active) return;
    const updateVisibility = () => setVisible(!document.hidden);
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
      setInView(entries.some((entry) => entry.isIntersecting));
    });
    if (rootRef.current) observer?.observe(rootRef.current);
    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
      observer?.disconnect();
    };
  }, [active]);

  if (!active) return null;
  const diameter = Number.isFinite(size) ? Math.min(320, Math.max(48, size)) : 112;
  return <div ref={rootRef} className={`matrix-thinking-orb ${className}`.trim()}
    style={{ "--orb-size": `${diameter}px`, ...style } as CSSProperties}
    data-state="thinking" data-animated={!reducedMotion && visible && inView}>
    <svg viewBox="0 0 100 100" className="matrix-thinking-orb__matrix" aria-hidden="true" focusable="false">
      <defs>
        <mask id={`${id}-dots`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          {dots.map((dot, index) => <circle key={index} cx={dot.x} cy={dot.y} r={dot.radius} fill="white" />)}
        </mask>
        <radialGradient id={`${id}-heat`}>
          <stop stopColor="currentColor" stopOpacity="1" />
          <stop offset=".45" stopColor="currentColor" stopOpacity=".8" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g mask={`url(#${id}-dots)`}>
        <rect width="100" height="100" fill="currentColor" opacity=".26" />
        <g className="matrix-thinking-orb__orbit matrix-thinking-orb__orbit--one"><circle cx="72" cy="50" r="24" fill={`url(#${id}-heat)`} /></g>
        <g className="matrix-thinking-orb__orbit matrix-thinking-orb__orbit--two"><circle cx="39" cy="66" r="22" fill={`url(#${id}-heat)`} /></g>
        <g className="matrix-thinking-orb__orbit matrix-thinking-orb__orbit--three"><circle cx="30" cy="28" r="20" fill={`url(#${id}-heat)`} /></g>
      </g>
    </svg>
    <span className="matrix-thinking-orb__label" role={announce ? "status" : undefined}
      aria-live={announce ? "polite" : undefined} aria-atomic={announce ? true : undefined}>{label}</span>
  </div>;
}
