import { useState, useEffect, useRef } from "react";

export function useCountUp(target: number, duration = 900, enabled = true) {
  const [count, setCount] = useState(0);
  const prevTarget = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) { setCount(target); return; }
    if (target === prevTarget.current) return;
    const start = prevTarget.current;
    prevTarget.current = target;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(start + (target - start) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, enabled]);

  return count;
}
