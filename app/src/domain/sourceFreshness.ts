export const SOURCE_REVIEW_MAX_AGE_DAYS = 180
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000

export function isSourceCurrent(sourceChecked: string, now = new Date()): boolean {
  const checkedAt = Date.parse(sourceChecked)
  if (!Number.isFinite(checkedAt) || !Number.isFinite(now.getTime())) return false
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const checkedDay = Date.UTC(new Date(checkedAt).getUTCFullYear(), new Date(checkedAt).getUTCMonth(), new Date(checkedAt).getUTCDate())
  const ageInDays = Math.floor((today - checkedDay) / DAY_IN_MILLISECONDS)
  return ageInDays >= 0 && ageInDays <= SOURCE_REVIEW_MAX_AGE_DAYS
}
