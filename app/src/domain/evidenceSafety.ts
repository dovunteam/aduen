export type EvidenceRisk = { code: 'card_number' | 'authentication_secret' | 'identity_number'; message: string }

function passesLuhn(value: string): boolean {
  let sum = 0; let alternate = false
  for (let index = value.length - 1; index >= 0; index -= 1) {
    let digit = Number(value[index])
    if (alternate) { digit *= 2; if (digit > 9) digit -= 9 }
    sum += digit; alternate = !alternate
  }
  return sum % 10 === 0
}

export function detectEvidenceRisks(text: string): EvidenceRisk[] {
  const risks: EvidenceRisk[] = []
  const numberCandidates = text.match(/(?:\d[ -]?){13,19}/g) ?? []
  if (numberCandidates.some((candidate) => { const digits = candidate.replace(/\D/g, ''); return digits.length >= 13 && digits.length <= 19 && passesLuhn(digits) })) {
    risks.push({ code: 'card_number', message: 'A possible full payment-card number appears in this file.' })
  }
  if (/\b(?:password|passcode|pin|otp|one[ -]time password|recovery code|security answer)\b/i.test(text)) {
    risks.push({ code: 'authentication_secret', message: 'The file mentions a password, PIN, OTP, recovery code, or similar secret.' })
  }
  if (/\b(?:mykad|passport|identity card|national registration identity card|nric)\b/i.test(text)) {
    risks.push({ code: 'identity_number', message: 'The file may contain an identity-document number.' })
  }
  return risks
}

export async function scanEvidenceFile(file: File): Promise<EvidenceRisk[]> {
  if (file.type !== 'text/plain') return []
  return detectEvidenceRisks((await file.text()).slice(0, 500_000))
}
