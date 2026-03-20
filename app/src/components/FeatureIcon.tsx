import { iconPaths, type FeatureIconName } from './featureIcons'

export function FeatureIcon({ name }: { name: FeatureIconName }) {
  return <svg className="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {iconPaths[name]}
  </svg>
}
