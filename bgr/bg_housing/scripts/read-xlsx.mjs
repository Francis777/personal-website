import { execFileSync } from 'node:child_process'

const [workbookPath, sheetPath = 'xl/worksheets/sheet1.xml'] = process.argv.slice(2)

if (!workbookPath) {
  console.error('Usage: node scripts/read-xlsx.mjs <workbook.xlsx> [sheet.xml]')
  process.exit(1)
}

const readEntry = (entry) =>
  execFileSync('unzip', ['-p', workbookPath, entry], { encoding: 'utf8' })

const decodeXml = (value = '') =>
  value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")

const sharedXml = readEntry('xl/sharedStrings.xml')
const sharedStrings = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
  [...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
    .map((textMatch) => decodeXml(textMatch[1]))
    .join(''),
)

const columnNumber = (reference) =>
  [...reference.match(/^[A-Z]+/)?.[0] ?? ''].reduce(
    (total, character) => total * 26 + character.charCodeAt(0) - 64,
    0,
  )

const sheetXml = readEntry(sheetPath)
const rows = [...sheetXml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)].map(
  ([, rowNumber, rowXml]) => {
    const valuedCellsXml = rowXml.replace(/<c\b[^>]*\/>/g, '')
    const cells = [...valuedCellsXml.matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)]
      .map(([, attributes, cellXml]) => {
        const reference = attributes.match(/r="([A-Z]+\d+)"/)?.[1] ?? ''
        const raw = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? ''
        const value = /t="s"/.test(attributes) ? sharedStrings[Number(raw)] : raw
        return [columnNumber(reference), value]
      })
      .filter(([, value]) => value !== '' && value !== undefined)

    return { row: Number(rowNumber), cells }
  },
)

for (const { row, cells } of rows) {
  console.log(`${row}\t${cells.map(([column, value]) => `${column}:${value}`).join('\t')}`)
}
