type IconProps = { className?: string };

// Minimal inline icon set used across the app. All are decorative
// (aria-hidden) — the accessible name always comes from surrounding text.

export function BoltIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path d="M11.3 1.3a.75.75 0 0 1 .4.86l-1.3 5.6h4.35a.75.75 0 0 1 .55 1.26l-7.5 8.1a.75.75 0 0 1-1.3-.63l1.3-5.62H3.45a.75.75 0 0 1-.55-1.26l7.5-8.1a.75.75 0 0 1 .9-.21Z" />
    </svg>
  );
}

export function DownloadIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M10 3v9.5M10 12.5 6.5 9M10 12.5 13.5 9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 14.5v.75A1.75 1.75 0 0 0 5.75 17h8.5A1.75 1.75 0 0 0 16 15.25v-.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SpinnerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`animate-spin ${className ?? ""}`} aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="2.2" opacity="0.25" />
      <path d="M17.5 10a7.5 7.5 0 0 0-7.5-7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function AlertIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M8.48 2.5c.66-1.14 2.38-1.14 3.04 0l6.54 11.3c.66 1.14-.2 2.57-1.52 2.57H3.46c-1.32 0-2.18-1.43-1.52-2.57L8.48 2.5ZM10 6.75a.75.75 0 0 1 .75.75v3.25a.75.75 0 0 1-1.5 0V7.5A.75.75 0 0 1 10 6.75Zm0 7a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function CheckCircleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.78-9.72a.75.75 0 0 0-1.06-1.06L9 10.94 7.28 9.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.25-4.25Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function EyeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EyeOffIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M2.5 2.5l15 15" strokeLinecap="round" />
      <path
        d="M8.4 4.7A8.9 8.9 0 0 1 10 4.5c5.5 0 8.5 5.5 8.5 5.5a15.6 15.6 0 0 1-2.9 3.6M5.6 5.9C3.2 7.4 1.5 10 1.5 10S4.5 15.5 10 15.5c1.1 0 2.1-.2 3-.6M11.6 11.6a2.25 2.25 0 0 1-3.2-3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SparkleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path d="M10 2.5c.28 0 .52.18.6.45l1.1 3.6 3.6 1.1a.63.63 0 0 1 0 1.2l-3.6 1.1-1.1 3.6a.63.63 0 0 1-1.2 0l-1.1-3.6-3.6-1.1a.63.63 0 0 1 0-1.2l3.6-1.1 1.1-3.6c.08-.27.32-.45.6-.45Z" />
      <path d="M16 12.5c.2 0 .38.13.44.32l.4 1.34 1.34.4a.47.47 0 0 1 0 .9l-1.34.4-.4 1.34a.47.47 0 0 1-.9 0l-.4-1.34-1.34-.4a.47.47 0 0 1 0-.9l1.34-.4.4-1.34c.06-.19.24-.32.44-.32Z" />
    </svg>
  );
}

export function DocumentIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M6 2.5h5.5L16 7v9.75a.75.75 0 0 1-.75.75h-9.5A.75.75 0 0 1 5 16.75V3.25a.75.75 0 0 1 .75-.75Z" strokeLinejoin="round" />
      <path d="M11.5 2.5V7H16" strokeLinejoin="round" />
      <path d="M7.5 10.5h5M7.5 13h5M7.5 8h2" strokeLinecap="round" />
    </svg>
  );
}
