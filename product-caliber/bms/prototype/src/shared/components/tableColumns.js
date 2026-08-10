function resolveTableInstance(root) {
  const rootElement = root?.$el || root
  const tableElement = rootElement?.matches?.('.el-table')
    ? rootElement
    : rootElement?.querySelector?.('.el-table')
  let instance = tableElement?.__vueParentComponent

  while (instance) {
    const table = instance.exposed || instance.proxy
    if (table?.store?.states?._columns) return table
    instance = instance.parent
  }

  return null
}

function columnLabel(column) {
  return String(column?.label || '').trim()
}

function isReorderable(column) {
  const label = columnLabel(column)
  return Boolean(label && label !== '操作' && !column.fixed && column.type === 'default')
}

export function readTableColumnOrder(root) {
  const table = resolveTableInstance(root)
  const columns = table?.store?.states?.columns?.value || []
  return columns.filter(isReorderable).map(columnLabel)
}

export function applyTableColumnOrder(root, labels) {
  const table = resolveTableInstance(root)
  const store = table?.store
  const source = [...(store?.states?._columns?.value || [])]
  if (!source.length) return false

  const reorderable = source.filter(isReorderable)
  const byLabel = new Map(reorderable.map((column) => [columnLabel(column), column]))
  const ordered = labels.map((label) => byLabel.get(label)).filter(Boolean)
  const included = new Set(ordered)
  ordered.push(...reorderable.filter((column) => !included.has(column)))

  let orderedIndex = 0
  const next = source.map((column) => (isReorderable(column) ? ordered[orderedIndex++] : column))
  store.states._columns.value = next
  store.updateColumns()
  store.scheduleLayout(false, true)
  return true
}
