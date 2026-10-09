/**
 * Adapted from https://www.rareui.com/components/notificationbell
 * Copyright (c) 2026 Swami Malode. MIT + Commons Clause + Attribution.
 * See ../../docs/RARE_UI_LICENSE.txt. Native button, finite CSS swing and count roll.
 */
import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion";
import "./AnimatedNotificationBell.css";

export interface AnimatedNotificationBellProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "color"> {
  count?: number;
  max?: number;
  variant?: "count" | "dot";
  size?: number;
  /** Base accessible label; the full unread count is appended. aria-label can override it. */
  label?: string;
  announce?: boolean;
  /** Render an aria-hidden span inside an existing accessible trigger (no nested button). */
  decorative?: boolean;
}

export const AnimatedNotificationBell = forwardRef<HTMLButtonElement, AnimatedNotificationBellProps>(function AnimatedNotificationBell({
  count = 0, max = 99, variant = "count", size = 44, label = "Notificaciones", announce = true, decorative = false,
  className = "", style, disabled = false, type = "button", ...props
}, ref) {
  const reducedMotion = useReducedMotion();
  const total = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const limit = Number.isFinite(max) ? Math.max(1, Math.floor(max)) : 99;
  const diameter = Number.isFinite(size) ? Math.min(96, Math.max(44, size)) : 44;
  const previous = useRef(total);
  const [ring, setRing] = useState({ version: 0, angle: 0 });

  useEffect(() => {
    const delta = total - previous.current;
    previous.current = total;
    if (delta > 0 && !reducedMotion && !disabled) {
      setRing((current) => ({ version: current.version + 1, angle: 12 + Math.min(delta, 5) * 3 }));
    }
  }, [total, reducedMotion, disabled]);

  const visualStyle = { "--bell-size": `${diameter}px`, "--bell-swing": `${ring.angle}deg`, ...style } as CSSProperties;
  const visual = <>
    <svg key={ring.version} className={`animated-notification-bell__icon${ring.version > 0 ? " is-ringing" : ""}`}
      viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3a6 6 0 0 0-6 6v5l-2 3v1h16v-1l-2-3V9a6 6 0 0 0-6-6Z" fill="currentColor" opacity=".65" />
      <path className="animated-notification-bell__clapper" d="M9 20a3 3 0 0 0 6 0Z" fill="currentColor" />
    </svg>
    <span className={`animated-notification-bell__badge animated-notification-bell__badge--${variant}`}
      data-visible={total > 0} aria-hidden="true">
      {variant === "count" && total > 0 ? <span key={total} className="animated-notification-bell__count">{total > limit ? `${limit}+` : total}</span> : null}
    </span>
  </>;
  if (decorative) return <span className={`animated-notification-bell animated-notification-bell--decorative ${className}`.trim()}
    style={visualStyle} data-motion={!reducedMotion && !disabled} aria-hidden="true">{visual}</span>;

  const accessibleLabel = props["aria-label"] ?? (total > 0 ? `${label}, ${total} sin leer` : label);
  return <button {...props} ref={ref} type={type} disabled={disabled}
    className={`animated-notification-bell ${className}`.trim()} aria-label={accessibleLabel}
    style={visualStyle} data-motion={!reducedMotion && !disabled}>
    {visual}
    <span className="animated-notification-bell__status" role={announce ? "status" : undefined}
      aria-live={announce ? "polite" : undefined} aria-atomic={announce ? true : undefined}>{accessibleLabel}</span>
  </button>;
});
