export type EvidenceRisk = { code: 'card_number' | 'authentication_secret' | 'identity_number' | 'third_party_data' | 'contact_details' | 'binary_unscanned'; message: string }

function passesLuhn(value: string): boolean {
  let sum = 0; let alternate = false
  for (let index = value.length - 1; index >= 0; index -= 1) {
    let digit = Number(value[index])
    if (alternate) { digit *= 2; if (digit > 9) digit -= 9 }
    sum += digit; alternate = !alternate
  }
  return sum % 10 === 0
}

function containsPossibleMalaysianIdentityNumber(text: string): boolean {
  const candidates = text.match(/(?<!\d)\d{6}[- ]?\d{2}[- ]?\d{4}(?!\d)/g) ?? []
  return candidates.some((candidate) => {
    const digits = candidate.replace(/\D/g, '')
    const month = Number(digits.slice(2, 4))
    const day = Number(digits.slice(4, 6))
    return month >= 1 && month <= 12 && day >= 1 && day <= 31
  })
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
  if (/\b(?:mykad|passport|identity card|national registration identity card|nric)\b/i.test(text) || containsPossibleMalaysianIdentityNumber(text)) {
    risks.push({ code: 'identity_number', message: 'The file may contain an identity-document number.' })
  }
  if (/\b(?:third[- ]party|someone\s+else(?:['’]s)?|another\s+person(?:['’]s)?|other\s+person(?:['’]s)?)\b/i.test(text)) {
    risks.push({ code: 'third_party_data', message: 'The file appears to mention another person’s information. Review whether it is necessary to include.' })
  }
  if (/[\w.+-]+@[\w.-]+\.[A-Z]{2,}/i.test(text) || /(?<!\d)(?:\+?60[ -]?|0)1\d(?:[ ()-]?\d){7,8}(?!\d)/.test(text)) {
    risks.push({ code: 'contact_details', message: 'The file may contain an email address or Malaysian mobile number. Check whose details they are and whether they are needed.' })
  }
  return risks
}

export async function scanEvidenceFile(file: File): Promise<EvidenceRisk[]> {
  if (file.type !== 'text/plain') return [{ code: 'binary_unscanned', message: 'This image or PDF was not scanned for sensitive content. Review it manually before storing or sharing.' }]
  return detectEvidenceRisks(await file.text())
}
