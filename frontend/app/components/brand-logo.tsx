export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 132 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="CV8"
      data-testid="brand-logo"
    >
      <rect width="48" height="48" rx="12" fill="#312E81" />
      {/* Written CV sheet with a folded corner. */}
      <path d="M10 7H25L32 14V37H10V7Z" fill="white" />
      <path d="M25 7V14H32" fill="#C7D2FE" />
      <circle cx="16" cy="15" r="2.5" fill="#4338CA" />
      <path d="M21 16H25M14 22H26M14 27H22M14 32H19" stroke="#4338CA" strokeWidth="2" strokeLinecap="round" />
      {/* Engine block, cylinder head, drive and exhaust. */}
      <path d="M28 25V22H37V25L41 29V36H37L34 39H26L22 35V28L25 25H28Z" fill="#6EE7B7" stroke="#312E81" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M28 22V19H37M25 30H21M21 28V34M41 30H44V35H41" stroke="#6EE7B7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M32 27L28 32H32L30 36L36 30H32L34 27H32Z" fill="#312E81" />
      <text
        x="58"
        y="34"
        fill="#0F172A"
        fontFamily="var(--font-sans), system-ui, sans-serif"
        fontSize="30"
        fontWeight="700"
        letterSpacing="-0.03em"
      >
        CV8
      </text>
    </svg>
  );
}
