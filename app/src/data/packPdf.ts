import { jsPDF } from 'jspdf'
import type { ComplaintPack } from '../domain/complaintPack'
import { packFileName } from '../domain/complaintPack'

export function downloadComplaintPackPdf(pack: ComplaintPack): void {
  if (!pack.approvedAt) throw new Error('Approve the pack before exporting it.')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const left = 18
  const width = 174
  let y = 20

  const line = (text: string, size = 10, bold = false) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(size)
    const rows = pdf.splitTextToSize(text || 'Not provided', width) as string[]
    if (y + rows.length * 5 > 278) { pdf.addPage(); y = 20 }
    pdf.text(rows, left, y); y += rows.length * 5 + 2
  }
  const heading = (text: string) => { y += 4; line(text.toUpperCase(), 11, true); pdf.setDrawColor(190); pdf.line(left, y - 1, 192, y - 1); y += 3 }

  pdf.setTextColor(23, 58, 54)
  line('TUNTIVA CASE PACK', 18, true)
  line(`Version ${pack.version} | Approved ${new Date(pack.approvedAt).toLocaleString('en-MY')}`, 8)
  heading('Transaction')
  line(`Seller: ${pack.transaction.seller}`, 10, true)
  line(`Platform: ${pack.transaction.platform || 'Not provided'}\nPurchase date: ${pack.transaction.purchaseDate}\nAmount: RM ${Number(pack.transaction.amount).toFixed(2)}\nPayment method: ${pack.transaction.paymentMethod}\nOrder reference: ${pack.transaction.orderReference || 'Not provided'}`)
  heading('Problem and requested remedy')
  line(`Issue: ${pack.issue}\nRequested remedy: ${pack.remedy}${pack.remedyAmount ? `\nRequested amount: RM ${Number(pack.remedyAmount).toFixed(2)}` : ''}`)
  heading('Chronology')
  pack.timeline.forEach((item) => line(`${item.date || 'Date unknown'} | ${item.label}\n${item.detail} (${item.source})`))
  heading('Evidence index')
  pack.evidence.forEach((item, index) => line(`${index + 1}. ${item.fileName} | ${item.sourceType.replaceAll('_', ' ')} | ${item.eventDate || 'Date unknown'}\nSHA-256: ${item.sha256}`))
  heading('Route record')
  line(`${pack.route.routeName}\nRule version: ${pack.route.ruleVersion}\nSource checked: ${pack.route.sourceChecked}`)
  heading('Important notice')
  line(pack.disclaimer, 8)
  pdf.save(packFileName(pack))
}
