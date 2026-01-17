export type Locale = 'en' | 'ms'

const STORAGE_KEY = 'tuntiva-locale'

export const messages = {
  en: {
    home: 'Tuntiva home',
    dataControls: 'Data controls',
    prototype: 'Private prototype',
    progress: ['Understand', 'Safety check', 'Case details', 'Evidence', 'Confirm facts', 'Check', 'Pack', 'Status'],
    progressLabel: 'Case setup progress',
    welcome: {
      eyebrow: 'A clearer recovery path',
      title: 'Put a failed purchase\ninto order.',
      lede: 'Tuntiva helps you organise what happened, what you can prove, and what to do next. You stay in control of every detail and every submission.',
      cards: [
        ['Build the record', 'Keep transaction details, dates, messages, and evidence together.'],
        ['Check what is missing', 'See gaps and uncertainties before approaching a merchant or official channel.'],
        ['Choose the next step', 'Review a reasoned route. Nothing is sent without your approval.'],
      ],
      before: 'Before you begin',
      notice: 'Tuntiva provides case organisation and general routing information. It does not guarantee recovery or provide legal representation.',
      consent: "I understand Tuntiva's role and confirm that I am authorised to provide the information in this case.",
      resume: 'Resume saved case',
      begin: 'Begin safety check',
    },
    triage: {
      eyebrow: 'Safety check',
      title: 'Does anything need\nimmediate action?',
      lede: 'Select everything that applies. Urgent issues should not wait while you prepare an ordinary complaint.',
      legend: 'Urgent issues',
      reasons: [
        ['unauthorised', 'A payment or transaction was not authorised by me'],
        ['account', 'Someone may still have access to my account or credentials'],
        ['scam', 'I am being asked to send more money in an active scam'],
        ['safety', 'There is an immediate safety risk'],
        ['deadline', 'I know of an official deadline that is about to expire'],
      ],
      pause: 'Pause ordinary case preparation.',
      urgent: "Contact your bank through its official hotline or Malaysia's National Scam Response Centre at 997 now if money or account access may still be at risk. For immediate danger, call Malaysian emergency services at 999. Tuntiva is not an emergency service.",
      bnm: 'Bank Negara Malaysia scam guidance ↗',
      nsrc: 'Official NSRC guidance ↗',
      source: "Use only contact details from your bank's official app, card, or website. Do not share an OTP, PIN, password, or recovery code.",
      back: '← Back',
      continue: 'No urgent issue — continue',
    },
    footer: 'Case organisation, not legal representation.',
  },
  ms: {
    home: 'Laman utama Tuntiva',
    dataControls: 'Kawalan data',
    prototype: 'Prototaip persendirian',
    progress: ['Fahami', 'Semakan keselamatan', 'Butiran kes', 'Bukti', 'Sahkan fakta', 'Semak', 'Pek', 'Status'],
    progressLabel: 'Kemajuan penyediaan kes',
    welcome: {
      eyebrow: 'Laluan pemulihan yang lebih jelas',
      title: 'Susun semula\npembelian yang bermasalah.',
      lede: 'Tuntiva membantu anda menyusun perkara yang berlaku, bukti yang ada, dan tindakan seterusnya. Anda kekal mengawal setiap butiran dan setiap penyerahan.',
      cards: [
        ['Bina rekod', 'Simpan butiran transaksi, tarikh, mesej, dan bukti bersama-sama.'],
        ['Semak perkara yang tiada', 'Lihat jurang dan ketidakpastian sebelum menghubungi peniaga atau saluran rasmi.'],
        ['Pilih langkah seterusnya', 'Semak laluan yang berasas. Tiada apa-apa dihantar tanpa kelulusan anda.'],
      ],
      before: 'Sebelum anda bermula',
      notice: 'Tuntiva menyediakan penyusunan kes dan maklumat laluan umum. Ia tidak menjamin pemulihan atau menyediakan perwakilan undang-undang.',
      consent: 'Saya memahami peranan Tuntiva dan mengesahkan bahawa saya diberi kuasa untuk memberikan maklumat dalam kes ini.',
      resume: 'Sambung kes tersimpan',
      begin: 'Mulakan semakan keselamatan',
    },
    triage: {
      eyebrow: 'Semakan keselamatan',
      title: 'Adakah apa-apa memerlukan\ntindakan segera?',
      lede: 'Pilih semua yang berkenaan. Isu mendesak tidak sepatutnya menunggu semasa anda menyediakan aduan biasa.',
      legend: 'Isu mendesak',
      reasons: [
        ['unauthorised', 'Bayaran atau transaksi tidak dibenarkan oleh saya'],
        ['account', 'Seseorang mungkin masih mempunyai akses kepada akaun atau kelayakan saya'],
        ['scam', 'Saya diminta menghantar lebih banyak wang dalam penipuan yang masih aktif'],
        ['safety', 'Terdapat risiko keselamatan serta-merta'],
        ['deadline', 'Saya tahu tentang tarikh akhir rasmi yang hampir tamat'],
      ],
      pause: 'Jeda penyediaan kes biasa.',
      urgent: 'Hubungi bank anda melalui talian rasmi atau Pusat Respons Scam Kebangsaan Malaysia di 997 sekarang jika wang atau akses akaun masih berisiko. Untuk bahaya serta-merta, hubungi perkhidmatan kecemasan Malaysia di 999. Tuntiva bukan perkhidmatan kecemasan.',
      bnm: 'Panduan penipuan Bank Negara Malaysia ↗',
      nsrc: 'Panduan rasmi NSRC ↗',
      source: 'Gunakan hanya butiran hubungan daripada aplikasi, kad, atau laman web rasmi bank anda. Jangan kongsi OTP, PIN, kata laluan, atau kod pemulihan.',
      back: '← Kembali',
      continue: 'Tiada isu mendesak — teruskan',
    },
    footer: 'Penyusunan kes, bukan perwakilan undang-undang.',
  },
} as const

export function readLocale(): Locale {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'ms' ? 'ms' : 'en'
}

export function saveLocale(locale: Locale) {
  window.localStorage.setItem(STORAGE_KEY, locale)
}
