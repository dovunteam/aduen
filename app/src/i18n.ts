export type Locale = 'en' | 'ms'

const STORAGE_KEY = 'Aduen-locale'
const TUNTIVA_STORAGE_KEY = 'tuntiva-locale'

export const messages = {
  en: {
    home: 'Aduen home',
    dataControls: 'Data controls',
    prototype: 'Private prototype',
    progress: ['Understand', 'Safety check', 'Case details', 'Evidence', 'Confirm facts', 'Check', 'Pack', 'Status'],
    progressLabel: 'Case setup progress',
    welcome: {
      eyebrow: 'A clearer recovery path',
      title: 'A failed purchase.\nA clearer next step.',
      lede: 'Aduen helps you organise what happened, what you can prove, and what to do next. You stay in control of every detail and every submission.',
      cards: [
        ['Build the record', 'Keep transaction details, dates, messages, and evidence together.'],
        ['Check what is missing', 'See gaps and uncertainties before approaching a merchant or official channel.'],
        ['Choose the next step', 'Review a reasoned route. Nothing is sent without your approval.'],
      ],
      before: 'Before you begin',
      notice: 'Aduen provides case organisation and general routing information. It does not guarantee recovery or provide legal representation.',
      consent: "I understand Aduen's role and confirm that I am authorised to provide the information in this case.",
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
      urgent: "Contact your bank through its official hotline or Malaysia's National Scam Response Centre at 997 now if money or account access may still be at risk. For immediate danger, call Malaysian emergency services at 999. Aduen is not an emergency service.",
      bnm: 'Bank Negara Malaysia scam guidance ↗',
      nsrc: 'Official NSRC guidance ↗',
      source: "Use only contact details from your bank's official app, card, or website. Do not share an OTP, PIN, password, or recovery code.",
      back: '← Back',
      continue: 'No urgent issue - continue',
    },
    caseDetails: {
      eyebrow: 'Case details', title: 'Describe the purchase.', saved: 'Saved', savedDevice: 'Saved on this device', lede: 'Start with what you know. You can leave optional fields blank and return later.',
      transaction: 'Transaction', transactionCopy: 'Identify the consumer, purchase, and seller.', consumerName: 'Your name or chosen case name', consumerNamePlaceholder: 'Name used in the complaint', consumerLocation: 'Your location', selectLocation: 'Select a location', malaysia: 'Malaysia', outside: 'Outside Malaysia', seller: 'Seller or merchant', sellerPlaceholder: 'Business or seller name', sellerLocation: 'Seller location', selectKnown: 'Select if known', unknown: 'Unknown', platform: 'Platform', optional: 'Optional', platformPlaceholder: 'Website, marketplace, or app', purchaseDate: 'Purchase date', amount: 'Amount paid (MYR)', paymentMethod: 'Payment method', selectMethod: 'Select a method', methods: [['Card', 'Card'], ['Bank transfer', 'Bank transfer'], ['E-wallet', 'E-wallet'], ['Cash on delivery', 'Cash on delivery'], ['Other', 'Other']], reference: 'Order or reference number', referencePlaceholder: 'Order ID or receipt number',
      purposeProblem: 'Purpose and problem', purposeProblemCopy: 'This affects which routes may apply.', purpose: 'Purchase purpose', selectPurpose: 'Select a purpose', personal: 'Personal, household, or domestic', business: 'Business or professional', category: 'Purchase category', selectCategory: 'Select a category', categories: [['general_goods', 'General goods'], ['general_services', 'General services'], ['aviation', 'Airline or airport'], ['financial_service', 'Financial service'], ['healthcare', 'Healthcare'], ['professional_service', 'Regulated professional service'], ['land', 'Land or property'], ['personal_injury', 'Personal injury or death'], ['wills_estates', 'Will, inheritance, or estate dispute'], ['franchise', 'Franchise dispute'], ['goodwill_ip', 'Goodwill, trade secret, or intellectual property'], ['other_tribunal', 'Subject assigned to another tribunal'], ['other', 'Other or uncertain']], issue: 'What went wrong?', selectIssue: 'Select the main issue', issues: [['non_delivery', 'Goods or services not received'], ['mismatch', 'Materially different from advertised'], ['missing_refund', 'Promised refund not received'], ['cancellation', 'Cancellation or billing problem'], ['uncertain', 'I am not sure']],
      remedyTitle: 'Requested remedy', remedyCopy: 'Choose one clear outcome.', remedy: 'Primary remedy', selectRemedy: 'Select a remedy', remedies: [['delivery', 'Delivery'], ['replacement', 'Replacement'], ['repair', 'Repair'], ['cancellation', 'Cancellation'], ['refund', 'Refund']], refundAmount: 'Refund amount (RM)',
      contactTitle: 'Promise and contact', contactCopy: 'Record what was due and whether the merchant has heard from you.', promisedDate: 'Promised date', ifKnown: 'If known', merchantContact: 'Merchant contact', selectContact: 'Select contact status', contacts: [['none', 'I have not sent a clear written request'], ['contacted', 'I contacted them; no response yet'], ['responded', 'The merchant responded']], latestContact: 'Date of latest contact',
      privacyLead: 'Stored locally for this prototype.', privacy: 'Do not enter passwords, PINs, OTPs, recovery codes, full card details, or unrelated personal information.', back: '← Back', save: 'Save case draft',
    },
    draftSaved: { eyebrow: 'Draft saved', title: 'Your case record\nhas started.', lede: 'The transaction details are stored only in this browser. Next, add the original records that support the case.', seller: 'Seller', amount: 'Amount', issue: 'Issue', remedy: 'Remedy', delete: 'Delete draft', edit: 'Edit details', evidence: 'Add evidence' },
    footer: 'Case organisation, not legal representation.',
  },
  ms: {
    home: 'Laman utama Aduen',
    dataControls: 'Kawalan data',
    prototype: 'Prototaip persendirian',
    progress: ['Fahami', 'Semakan keselamatan', 'Butiran kes', 'Bukti', 'Sahkan fakta', 'Semak', 'Pek', 'Status'],
    progressLabel: 'Kemajuan penyediaan kes',
    welcome: {
      eyebrow: 'Laluan pemulihan yang lebih jelas',
      title: 'Susun semula\npembelian yang bermasalah.',
      lede: 'Aduen membantu anda menyusun perkara yang berlaku, bukti yang ada, dan tindakan seterusnya. Anda kekal mengawal setiap butiran dan setiap penyerahan.',
      cards: [
        ['Bina rekod', 'Simpan butiran transaksi, tarikh, mesej, dan bukti bersama-sama.'],
        ['Semak perkara yang tiada', 'Lihat jurang dan ketidakpastian sebelum menghubungi peniaga atau saluran rasmi.'],
        ['Pilih langkah seterusnya', 'Semak laluan yang berasas. Tiada apa-apa dihantar tanpa kelulusan anda.'],
      ],
      before: 'Sebelum anda bermula',
      notice: 'Aduen menyediakan penyusunan kes dan maklumat laluan umum. Ia tidak menjamin pemulihan atau menyediakan perwakilan undang-undang.',
      consent: 'Saya memahami peranan Aduen dan mengesahkan bahawa saya diberi kuasa untuk memberikan maklumat dalam kes ini.',
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
      urgent: 'Hubungi bank anda melalui talian rasmi atau Pusat Respons Scam Kebangsaan Malaysia di 997 sekarang jika wang atau akses akaun masih berisiko. Untuk bahaya serta-merta, hubungi perkhidmatan kecemasan Malaysia di 999. Aduen bukan perkhidmatan kecemasan.',
      bnm: 'Panduan penipuan Bank Negara Malaysia ↗',
      nsrc: 'Panduan rasmi NSRC ↗',
      source: 'Gunakan hanya butiran hubungan daripada aplikasi, kad, atau laman web rasmi bank anda. Jangan kongsi OTP, PIN, kata laluan, atau kod pemulihan.',
      back: '← Kembali',
      continue: 'Tiada isu mendesak - teruskan',
    },
    caseDetails: {
      eyebrow: 'Butiran kes', title: 'Terangkan pembelian.', saved: 'Disimpan', savedDevice: 'Disimpan pada peranti ini', lede: 'Mulakan dengan perkara yang anda tahu. Anda boleh membiarkan medan pilihan kosong dan kembali kemudian.',
      transaction: 'Transaksi', transactionCopy: 'Kenal pasti pengguna, pembelian, dan penjual.', consumerName: 'Nama anda atau nama kes pilihan', consumerNamePlaceholder: 'Nama yang digunakan dalam aduan', consumerLocation: 'Lokasi anda', selectLocation: 'Pilih lokasi', malaysia: 'Malaysia', outside: 'Di luar Malaysia', seller: 'Penjual atau peniaga', sellerPlaceholder: 'Nama perniagaan atau penjual', sellerLocation: 'Lokasi penjual', selectKnown: 'Pilih jika diketahui', unknown: 'Tidak diketahui', platform: 'Platform', optional: 'Pilihan', platformPlaceholder: 'Laman web, pasaran, atau aplikasi', purchaseDate: 'Tarikh pembelian', amount: 'Jumlah dibayar (MYR)', paymentMethod: 'Kaedah pembayaran', selectMethod: 'Pilih kaedah', methods: [['Card', 'Kad'], ['Bank transfer', 'Pindahan bank'], ['E-wallet', 'E-dompet'], ['Cash on delivery', 'Bayaran semasa penghantaran'], ['Other', 'Lain-lain']], reference: 'Nombor pesanan atau rujukan', referencePlaceholder: 'ID pesanan atau nombor resit',
      purposeProblem: 'Tujuan dan masalah', purposeProblemCopy: 'Ini mempengaruhi laluan yang mungkin terpakai.', purpose: 'Tujuan pembelian', selectPurpose: 'Pilih tujuan', personal: 'Peribadi, isi rumah, atau domestik', business: 'Perniagaan atau profesional', category: 'Kategori pembelian', selectCategory: 'Pilih kategori', categories: [['general_goods', 'Barangan am'], ['general_services', 'Perkhidmatan am'], ['aviation', 'Syarikat penerbangan atau lapangan terbang'], ['financial_service', 'Perkhidmatan kewangan'], ['healthcare', 'Penjagaan kesihatan'], ['professional_service', 'Perkhidmatan profesional terkawal'], ['land', 'Tanah atau hartanah'], ['personal_injury', 'Kecederaan diri atau kematian'], ['wills_estates', 'Wasiat, pewarisan, atau pertikaian harta pusaka'], ['franchise', 'Pertikaian francais'], ['goodwill_ip', 'Nama baik, rahsia perdagangan, atau harta intelek'], ['other_tribunal', 'Perkara di bawah bidang kuasa tribunal lain'], ['other', 'Lain-lain atau tidak pasti']], issue: 'Apakah masalahnya?', selectIssue: 'Pilih isu utama', issues: [['non_delivery', 'Barangan atau perkhidmatan tidak diterima'], ['mismatch', 'Berbeza secara ketara daripada iklan'], ['missing_refund', 'Bayaran balik yang dijanjikan tidak diterima'], ['cancellation', 'Masalah pembatalan atau pengebilan'], ['uncertain', 'Saya tidak pasti']],
      remedyTitle: 'Penyelesaian diminta', remedyCopy: 'Pilih satu hasil yang jelas.', remedy: 'Penyelesaian utama', selectRemedy: 'Pilih penyelesaian', remedies: [['delivery', 'Penghantaran'], ['replacement', 'Penggantian'], ['repair', 'Pembaikan'], ['cancellation', 'Pembatalan'], ['refund', 'Bayaran balik']], refundAmount: 'Jumlah bayaran balik (RM)',
      contactTitle: 'Janji dan hubungan', contactCopy: 'Catat perkara yang dijanjikan dan sama ada peniaga telah dihubungi.', promisedDate: 'Tarikh dijanjikan', ifKnown: 'Jika diketahui', merchantContact: 'Hubungan dengan peniaga', selectContact: 'Pilih status hubungan', contacts: [['none', 'Saya belum menghantar permintaan bertulis yang jelas'], ['contacted', 'Saya telah menghubungi mereka; belum ada respons'], ['responded', 'Peniaga telah memberi respons']], latestContact: 'Tarikh hubungan terkini',
      privacyLead: 'Disimpan secara setempat untuk prototaip ini.', privacy: 'Jangan masukkan kata laluan, PIN, OTP, kod pemulihan, butiran kad penuh, atau maklumat peribadi yang tidak berkaitan.', back: '← Kembali', save: 'Simpan draf kes',
    },
    draftSaved: { eyebrow: 'Draf disimpan', title: 'Rekod kes anda\ntelah dimulakan.', lede: 'Butiran transaksi disimpan hanya dalam pelayar ini. Seterusnya, tambah rekod asal yang menyokong kes.', seller: 'Penjual', amount: 'Jumlah', issue: 'Isu', remedy: 'Penyelesaian', delete: 'Padam draf', edit: 'Sunting butiran', evidence: 'Tambah bukti' },
    footer: 'Penyusunan kes, bukan perwakilan undang-undang.',
  },
} as const

export function readLocale(): Locale {
  try {
  const stored = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(TUNTIVA_STORAGE_KEY)
  if (!window.localStorage.getItem(STORAGE_KEY) && stored) { window.localStorage.setItem(STORAGE_KEY, stored); window.localStorage.removeItem(TUNTIVA_STORAGE_KEY) }
  return stored === 'ms' ? 'ms' : 'en'
  } catch { return 'en' }
}

export function saveLocale(locale: Locale) {
  window.localStorage.setItem(STORAGE_KEY, locale)
}
