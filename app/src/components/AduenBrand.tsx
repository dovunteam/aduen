import { useId } from 'react'

type Props = { compact?: boolean }

export function AduenBrand({ compact = false }: Props) {
  const gradientId = useId().replace(/:/g, '')
  return <svg className={`aduen-brand${compact ? ' aduen-brand-compact' : ''}`} viewBox="0 0 176 48" role="img" aria-label="Aduen" focusable="false">
    <defs>
      <linearGradient id={`${gradientId}-mark-dark`} x1="0" y1="0" x2="0" y2="48" gradientUnits="userSpaceOnUse"><stop className="aduen-mark-dark-start" /><stop className="aduen-mark-dark-end" offset="1" /></linearGradient>
      <linearGradient id={`${gradientId}-mark-light`} x1="27" y1="15" x2="53" y2="45" gradientUnits="userSpaceOnUse"><stop className="aduen-mark-light-start" /><stop className="aduen-mark-light-end" offset="1" /></linearGradient>
    </defs>
    <g transform="translate(1 2) scale(.064)">
      <path fill={`url(#${gradientId}-mark-dark)`} d="M475 24 C444 5 401 0 363 0 C307 0 267 18 241 62 L5 548 C-13 585 -2 626 25 646 C46 664 63 670 110 670 L129 670 C174 670 205 647 226 608 L431 218 C456 170 485 149 533 149 L555 149 L503 48 C496 37 485 30 475 24 Z" />
      <path fill={`url(#${gradientId}-mark-light)`} d="M521 224 C488 224 464 241 447 273 L369 429 C403 422 432 428 450 439 C464 447 475 460 486 479 L556 608 C576 647 605 670 648 670 L698 670 C752 670 778 626 762 577 L603 249 C588 231 564 224 521 224 Z" />
    </g>
    <text className="aduen-wordmark" x="57" y="35" fontFamily="Inter, Aptos, Segoe UI, Arial, sans-serif" fontSize="29" fontWeight="750" letterSpacing="-1.7">Aduen</text>
  </svg>
}
