import type { Locale } from './i18n'

const eventLabels: Record<string, string> = {
  purchase: 'pembelian',
  'promised performance': 'prestasi yang dijanjikan',
  delivery: 'penghantaran',
  'merchant contact': 'hubungan dengan peniaga',
}

const remedies: Record<string, string> = {
  delivery: 'penghantaran',
  replacement: 'penggantian',
  repair: 'pembaikan',
  cancellation: 'pembatalan',
  refund: 'bayaran balik',
}

export function localizeFactConflict(conflict: string, locale: Locale): string {
  if (locale === 'en') return conflict
  const fixed: Record<string, string> = {
    'Confirmed evidence contains different transaction amounts.': 'Bukti yang disahkan menunjukkan jumlah transaksi yang berbeza.',
    'Confirmed evidence contains different refund amounts.': 'Bukti yang disahkan menunjukkan jumlah bayaran balik yang berbeza.',
    'The requested refund amount is greater than the recorded transaction amount.': 'Jumlah bayaran balik yang diminta lebih besar daripada jumlah transaksi yang direkodkan.',
    'Confirmed evidence contains different order or reference numbers.': 'Bukti yang disahkan mengandungi nombor pesanan atau rujukan yang berbeza.',
    'Confirmed evidence contains different invoice numbers.': 'Bukti yang disahkan mengandungi nombor invois yang berbeza.',
    'A confirmed extracted reference differs from the entered order or reference number.': 'Nombor rujukan yang diekstrak dan disahkan berbeza daripada nombor pesanan atau rujukan yang dimasukkan.',
    'Confirmed evidence contains different requested remedies.': 'Bukti yang disahkan menunjukkan penyelesaian diminta yang berbeza.',
    'Confirmed evidence contains different consumer names.': 'Bukti yang disahkan mengandungi nama pengguna yang berbeza.',
    'A confirmed extracted consumer name differs from the entered case name.': 'Nama pengguna yang diekstrak dan disahkan berbeza daripada nama kes yang dimasukkan.',
    'A confirmed promised performance date occurs before the recorded purchase date.': 'Tarikh prestasi yang dijanjikan berlaku sebelum tarikh pembelian yang direkodkan.',
    'A confirmed delivery date occurs before the recorded purchase date.': 'Tarikh penghantaran yang disahkan berlaku sebelum tarikh pembelian yang direkodkan.',
    'A confirmed delivery date occurs before the promised performance date.': 'Tarikh penghantaran yang disahkan berlaku sebelum tarikh prestasi yang dijanjikan.',
    'The entered claim-accrual date occurs before the recorded purchase date.': 'Tarikh tuntutan bermula yang dimasukkan berlaku sebelum tarikh pembelian yang direkodkan.',
  }
  if (fixed[conflict]) return fixed[conflict]

  const amountMismatch = conflict.match(/^A confirmed extracted amount differs from the entered transaction amount of MYR ([\d.]+)\.$/)
  if (amountMismatch) return `Jumlah yang diekstrak dan disahkan berbeza daripada jumlah transaksi yang dimasukkan sebanyak MYR ${amountMismatch[1]}.`
  const refundMismatch = conflict.match(/^A confirmed extracted refund amount differs from the entered requested refund amount of MYR ([\d.]+)\.$/)
  if (refundMismatch) return `Jumlah bayaran balik yang diekstrak dan disahkan berbeza daripada jumlah bayaran balik yang diminta sebanyak MYR ${refundMismatch[1]}.`

  const multipleDates = conflict.match(/^Confirmed evidence contains multiple dates labelled for (purchase|promised performance|delivery|merchant contact)\.$/)
  if (multipleDates) return `Bukti yang disahkan mengandungi beberapa tarikh yang dilabel untuk ${eventLabels[multipleDates[1]]}.`

  const dateMismatch = conflict.match(/^A confirmed date labelled for (purchase|promised performance|delivery|merchant contact) differs from the entered .+ date of (\d{4}-\d{2}-\d{2})\.$/)
  if (dateMismatch) {
    const event = eventLabels[dateMismatch[1]]
    return `Tarikh yang disahkan dan dilabel untuk ${event} berbeza daripada tarikh ${event} yang dimasukkan, iaitu ${dateMismatch[2]}.`
  }

  const remedyMismatch = conflict.match(/^A confirmed extracted remedy differs from the entered requested remedy of (delivery|replacement|repair|cancellation|refund)\.$/)
  if (remedyMismatch) return `Penyelesaian yang diekstrak dan disahkan berbeza daripada penyelesaian yang diminta, iaitu ${remedies[remedyMismatch[1]]}.`
  return conflict
}
