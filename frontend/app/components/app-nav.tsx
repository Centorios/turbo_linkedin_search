"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const LINKS = [
  { href: "/generate", label: "Crear CV", testId: "generate-navigation" },
  { href: "/history", label: "Historial", testId: "history-navigation" },
  { href: "/jobs", label: "Empleos", testId: "jobs-navigation" },
] as const;

type Indicator = { left: number; width: number };

// Every page mounts its own header, so the indicator's last position lives at
// module level: on the next page it starts there and slides to the new section.
let lastIndicator: Indicator | null = null;

export function AppNav() {
  const pathname = usePathname();
  const activeIndex = LINKS.findIndex((link) => pathname === link.href || pathname.startsWith(`${link.href}/`));
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const targetIndex = hoverIndex ?? (activeIndex >= 0 ? activeIndex : null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicator, setIndicator] = useState<Indicator | null>(lastIndicator);

  const measure = useCallback(() => {
    if (targetIndex === null) return;
    const link = linkRefs.current[targetIndex];
    if (!link) return;
    const next = { left: link.offsetLeft, width: link.offsetWidth };
    lastIndicator = next;
    setIndicator(next);
  }, [targetIndex]);

  // Wait a frame so a freshly mounted header first paints the previous
  // position; the CSS transition then slides it to the current section.
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [measure]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <nav aria-label="Navegación de cuenta" className="relative flex items-center gap-1 sm:gap-3" onMouseLeave={() => setHoverIndex(null)}>
      {LINKS.map((link, index) => (
        <Link
          key={link.href}
          ref={(element) => { linkRefs.current[index] = element; }}
          href={link.href}
          data-testid={link.testId}
          aria-current={index === activeIndex ? "page" : undefined}
          onMouseEnter={() => setHoverIndex(index)}
          onFocus={() => setHoverIndex(index)}
          onBlur={() => setHoverIndex(null)}
          className="focus-ring rounded-lg px-2 py-2 text-caption-xs font-semibold text-primary transition-colors hover:bg-subtle sm:text-body-sm"
        >
          {link.label}
        </Link>
      ))}
      <span
        aria-hidden="true"
        data-testid="nav-indicator"
        data-target={targetIndex === null ? "" : LINKS[targetIndex].testId}
        className={`pointer-events-none absolute -bottom-1 h-0.5 rounded-full bg-primary transition-[left,width,opacity] duration-300 ease-out motion-reduce:transition-none ${
          indicator && targetIndex !== null ? "opacity-100" : "opacity-0"
        }`}
        style={indicator ? { left: indicator.left, width: indicator.width } : undefined}
      />
    </nav>
  );
}
