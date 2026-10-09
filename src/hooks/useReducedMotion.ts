import { useEffect, useState } from "react";

/** Keep JS-driven chart motion aligned with the same preference as CSS. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  useEffect(() => {
    const media = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}
