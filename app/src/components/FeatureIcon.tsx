export function FeatureIcon({ index }: { index: number }) {
  return <svg className="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {index === 0 ? <><path d="M8 3h8l4 4v13H8V3Z" /><path d="M16 3v5h4M4 7v14M11 12h6m-6 4h4" /></> : index === 1 ? <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="m8 8 1 1 2-2m2 1h3m-8 5 1 1 2-2m2 1h3M8 18h8" /></> : <><path d="M5 19V9a4 4 0 0 1 4-4h10m-5-4 5 4-5 4" /><circle cx="5" cy="19" r="2" /><path d="M11 19h8m-3-3 3 3-3 3" /></>}
  </svg>
}
