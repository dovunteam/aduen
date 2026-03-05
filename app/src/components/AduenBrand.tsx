type Props = { compact?: boolean }

export function AduenBrand({ compact = false }: Props) {
  return <svg className={`aduen-brand${compact ? ' aduen-brand-compact' : ''}`} viewBox="0 0 176 48" role="img" aria-label="Aduen" focusable="false">
    <defs>
      <linearGradient id="aduen-mark-gradient" x1="24" y1="8" x2="56" y2="43" gradientUnits="userSpaceOnUse">
        <stop stopColor="#0b555b" />
        <stop offset="1" stopColor="#56aeb1" />
      </linearGradient>
    </defs>
    <g fill="url(#aduen-mark-gradient)">
      <path d="M4 42 20 11c2-5 9-7 13-2l7 14-7 11-6-12-9 20H4Z" />
      <path d="m32 42 9-19c2-5 8-6 11-1l12 20H50l-6-11-5 11H32Z" />
    </g>
    <text x="72" y="34" fill="#0b3f4b" fontFamily="Inter, Segoe UI, Arial, sans-serif" fontSize="27" fontWeight="700" letterSpacing="-1.4">Aduen</text>
  </svg>
}
