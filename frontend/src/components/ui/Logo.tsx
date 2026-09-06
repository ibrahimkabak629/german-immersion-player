interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * Brand mark: a tilted duo of caption bars (full-length "original" line over
 * a shorter "translated" line) inside a rounded square — the dual-subtitle
 * idea rendered as a shape, in the app's gold/red (accent / de-red) pairing.
 */
export function Logo({ size = 22, className }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="0.5" y="0.5" width="23" height="23" rx="6.5" fill="url(#logo-bg)" />
      <rect x="0.5" y="0.5" width="23" height="23" rx="6.5" stroke="white" strokeOpacity="0.12" />
      <rect x="5" y="8.5" width="14" height="2.4" rx="1.2" fill="white" fillOpacity="0.95" />
      <rect x="5" y="13.1" width="8.5" height="2.4" rx="1.2" fill="black" fillOpacity="0.55" />
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="oklch(78% 0.16 75)" />
          <stop offset="1" stopColor="oklch(58% 0.22 25)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
