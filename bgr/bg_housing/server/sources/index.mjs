const definitions = [
  {
    source: 'imot.bg',
    moduleUrl: new URL('./imot.mjs', import.meta.url),
    exportNames: ['discoverImotRecords', 'refreshImot'],
  },
  {
    source: 'Yavlena',
    moduleUrl: new URL('./yavlena.mjs', import.meta.url),
    exportNames: ['discoverYavlenaRecords', 'refreshYavlena'],
  },
]

const loadDiscoverer = async (definition) => {
  const module = await import(definition.moduleUrl.href)
  const discover = definition.exportNames.map((name) => module[name]).find((candidate) => typeof candidate === 'function')
  if (!discover) {
    throw new Error(`${definition.source} adapter does not export ${definition.exportNames.join(' or ')}.`)
  }
  return discover
}

export const defaultCommercialSources = definitions.map((definition) => ({
  source: definition.source,
  async discover(context) {
    const discover = await loadDiscoverer(definition)
    return discover(context)
  },
}))
