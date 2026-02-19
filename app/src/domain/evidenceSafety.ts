export type EvidenceRisk = { code: 'card_number' | 'authentication_secret' | 'identity_number' | 'third_party_data' | 'contact_details' | 'binary_unscanned' | 'pdf_text_partial' | 'ocr_partial'; message: string }

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
  if (/\b(?:password|passcode|pin|otp|one[ -]time password|recovery code|security answer|kata\s+laluan|katalaluan|kod\s+(?:laluan|pengesahan|sekali\s+guna|pemulihan|keselamatan)|jawapan\s+keselamatan)\b/i.test(text)) {
    risks.push({ code: 'authentication_secret', message: 'The file mentions a password, PIN, OTP, recovery code, or similar secret.' })
  }
  if (/\b(?:mykad|passport|pasport|identity card|national registration identity card|nric|kad\s+pengenalan|nombor\s+(?:kad\s+pengenalan|kp)|no\.?\s*kp)\b/i.test(text) || containsPossibleMalaysianIdentityNumber(text)) {
    risks.push({ code: 'identity_number', message: 'The file may contain an identity-document number.' })
  }
  if (/\b(?:third[- ]party|someone\s+else(?:['’]s)?|another\s+person(?:['’]s)?|other\s+person(?:['’]s)?)\b/i.test(text) || /\b(?:pihak\s+ketiga|maklumat\s+orang\s+lain|butiran\s+orang\s+lain|milik\s+orang\s+lain)\b/i.test(text)) {
    risks.push({ code: 'third_party_data', message: 'The file appears to mention another person’s information. Review whether it is necessary to include.' })
  }
  if (/[\w.+-]+@[\w.-]+\.[A-Z]{2,}/i.test(text) || /(?<!\d)(?:\+?60[ -]?|0)1\d(?:[ ()-]?\d){7,8}(?!\d)/.test(text)) {
    risks.push({ code: 'contact_details', message: 'The file may contain an email address or Malaysian mobile number. Check whose details they are and whether they are needed.' })
  }
  return risks
}

export async function scanEvidenceFile(file: File): Promise<EvidenceRisk[]> {
  if (file.type === 'text/plain') return detectEvidenceRisks(await file.text())
  if (file.type === 'application/pdf') {
    try {
      const { extractPdfText, PDF_TEXT_MAX_CHARACTERS, PDF_TEXT_MAX_PAGES } = await import('./pdfTextExtraction')
      let text = await extractPdfText(file)
      const { extractLocalOcrText, OCR_MAX_PDF_PAGES, OCR_MAX_TEXT_CHARACTERS } = await import('./localOcr')
      const hybrid = await extractLocalOcrText(file, file.type)
      if (hybrid.usedOcr && hybrid.text) return [...detectEvidenceRisks(hybrid.text), { code: 'ocr_partial', message: `Local OCR checked image-bearing pages up to ${OCR_MAX_TEXT_CHARACTERS.toLocaleString('en-MY')} characters across ${OCR_MAX_PDF_PAGES} pages. OCR may miss sensitive content; review every page manually.` }]
      if (text) return [...detectEvidenceRisks(text), { code: 'pdf_text_partial', message: `Searchable PDF text (up to ${PDF_TEXT_MAX_CHARACTERS.toLocaleString('en-MY')} characters across ${PDF_TEXT_MAX_PAGES} pages) was checked for common sensitive patterns. Scanned, image-only, and remaining content may not be covered; review every page manually.` }]
    } catch { /* Keep the manual-review warning if the PDF cannot be parsed. */ }
  }
  if (file.type.startsWith('image/')) {
    try {
      const { extractLocalOcrText, OCR_MAX_TEXT_CHARACTERS } = await import('./localOcr')
      const result = await extractLocalOcrText(file, file.type)
      if (result.text) return [...detectEvidenceRisks(result.text), { code: 'ocr_partial', message: `Local OCR checked up to ${OCR_MAX_TEXT_CHARACTERS.toLocaleString('en-MY')} characters. OCR may miss sensitive content; review the image manually.` }]
    } catch { /* Keep the manual-review warning if OCR is unavailable. */ }
  }
  return [{ code: 'binary_unscanned', message: 'This image or PDF was not scanned for sensitive content. Review it manually before storing or sharing.' }]
}
