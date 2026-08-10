import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = pdfWorker

const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
const parseAmount = value => Number(String(value).replace(/\./g, '').replace(',', '.'))
const amountPattern = /^-?\d{1,3}(?:\.\d{3})*,\d{2}$/
const round = value => Math.round((value + Number.EPSILON) * 100) / 100

const categoryFor = description => {
  const text = normalize(description).toLowerCase()
  if (/drog|saude|hospital|mater/.test(text)) return 'Saúde'
  if (/mercado|supermercado|pague/.test(text)) return 'Mercado'
  if (/viagem|hotel|ehtl/.test(text)) return 'Viagem'
  if (/spotify|prime|apple|google one|chatgpt/.test(text)) return 'Assinaturas'
  if (/amazon|mobly/.test(text)) return 'Casa'
  return 'Outros'
}

const pageRows = items => {
  const rows = []
  for (const item of items) {
    const text = item.str?.trim()
    if (!text) continue
    const x = item.transform[4]
    const y = item.transform[5]
    let row = rows.find(current => Math.abs(current.y - y) < 2.5)
    if (!row) { row = { y, items: [] }; rows.push(row) }
    row.items.push({ text, x })
  }
  return rows.map(row => ({ ...row, items: row.items.sort((a, b) => a.x - b.x) })).sort((a, b) => b.y - a.y)
}

const entriesFromRows = rows => {
  const entries = []
  for (const row of rows) {
    const dateCells = row.items.filter(item => /^\d{2}\/\d{2}$/.test(item.text))
    for (let index = 0; index < dateCells.length; index += 1) {
      const date = dateCells[index]
      const nextDateX = dateCells[index + 1]?.x ?? Number.POSITIVE_INFINITY
      const cells = row.items.filter(item => item.x >= date.x - 1 && item.x < nextDateX - 1)
      const amounts = cells.filter(item => amountPattern.test(item.text)).sort((a, b) => b.x - a.x)
      if (!amounts.length) continue
      const amount = parseAmount(amounts[0].text)
      const description = cells.filter(item => item !== date && !amountPattern.test(item.text)).map(item => item.text).join(' ').replace(/\s+/g, ' ').trim()
      if (!description || /^pagamento$/i.test(normalize(description))) continue
      const installment = description.match(/\s(\d{2})\s*\/\s*(\d{2})\s*$/)
      const cleanDescription = description.replace(/\s\d{2}\s*\/\s*\d{2}\s*$/, '').trim()
      entries.push({
        id: crypto.randomUUID(),
        date,
        description: cleanDescription,
        value: amount,
        installmentsLeft: installment ? Math.max(1, Number(installment[2]) - Number(installment[1]) + 1) : 1,
        installmentLabel: installment ? `${installment[1]}/${installment[2]}` : '',
        category: categoryFor(cleanDescription),
        included: true,
      })
    }
  }
  return entries.filter((entry, index, all) => all.findIndex(item => item.date === entry.date && item.description === entry.description && item.value === entry.value) === index)
}

const findAfter = (text, expression) => {
  const match = text.match(expression)
  return match?.[1] || ''
}

export async function parseCreditCardInvoicePdf(file, { onProgress } = {}) {
  if (file.type && file.type !== 'application/pdf') throw new Error('Selecione um arquivo PDF de fatura.')
  onProgress?.({ current: 0, total: 0, label: 'Abrindo o PDF com segurança…' })
  const document = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pages = []
  const textParts = []
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    onProgress?.({ current: pageNumber - 1, total: document.numPages, label: `Lendo página ${pageNumber} de ${document.numPages}…` })
    const content = await (await document.getPage(pageNumber)).getTextContent()
    pages.push(pageRows(content.items))
    textParts.push(content.items.map(item => item.str).join(' '))
  }
  onProgress?.({ current: document.numPages, total: document.numPages, label: 'Identificando compras, parcelas e total…' })
  const text = normalize(textParts.join(' '))
  const total = parseAmount(findAfter(text, /Total desta fatura\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})/i) || findAfter(text, /O total da sua fatura[^\d]*(\d{1,3}(?:\.\d{3})*,\d{2})/i))
  const dueDate = findAfter(text, /Com vencimento em:?\s*(\d{2}\/\d{2}\/\d{4})/i)
  if (!total || !dueDate) throw new Error('Não foi possível identificar o total ou o vencimento desta fatura. Confira se o PDF não possui senha.')
  const [day, month, year] = dueDate.split('/')
  const period = `${year}-${month}`
  const entries = entriesFromRows(pages.flat())
  const parsedTotal = round(entries.reduce((sum, entry) => sum + entry.value, 0))
  const difference = round(total - parsedTotal)
  if (Math.abs(difference) >= 0.01) entries.push({ id: crypto.randomUUID(), date: '', description: 'Ajuste identificado na fatura', value: difference, installmentsLeft: 1, installmentLabel: '', category: 'Ajustes', included: true })
  const issuer = /itau/i.test(text) ? 'Itaú' : 'Cartão de crédito'
  return {
    issuer,
    dueDate,
    dueDay: Number(day),
    period,
    total,
    entries,
    invoiceKey: `${normalize(issuer).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${year}${month}-${day}-${Math.round(total * 100)}`,
  }
}
