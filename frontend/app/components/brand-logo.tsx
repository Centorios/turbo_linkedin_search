export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="CV8"
    >
      <rect x="2" y="4" width="28" height="28" rx="6" fill="#2563EB" />
      <path d="M11 12H21M11 18H18M11 24H15" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
      <text
        x="36"
        y="24"
        fill="#0F172A"
        fontFamily="var(--font-sans), system-ui, sans-serif"
        fontSize="20"
        fontWeight="700"
        letterSpacing="-0.03em"
      >
        CV8
      </text>
    </svg>
  );
}
