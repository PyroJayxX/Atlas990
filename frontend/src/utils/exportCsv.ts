export type CsvColumn<T> = {
  header: string
  value: (row: T) => string | number | null | undefined
}

function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''

  const text = String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((column) => escapeCsvValue(column.header)).join(',')
  const body = rows.map((row) => columns.map((column) => escapeCsvValue(column.value(row))).join(','))
  return [header, ...body].join('\r\n')
}

export function downloadCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  const csv = buildCsv(rows, columns)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}