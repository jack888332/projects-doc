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

function isConfigurable(column) {
  const label = columnLabel(column)
  return Boolean(label && label !== '操作' && column.type === 'default')
}

function isReorderable(column) {
  return isConfigurable(column) && !column.fixed
}

const SORTED_COLUMN_CLASS = 'prototype-sorted-column'

function markSortedColumn(columns, selectedColumn) {
  columns.forEach((column) => {
    const classNames = new Set(String(column.className || '').split(/\s+/).filter(Boolean))
    if (column === selectedColumn) classNames.add(SORTED_COLUMN_CLASS)
    else classNames.delete(SORTED_COLUMN_CLASS)
    column.className = [...classNames].join(' ')
  })
}

export function readTableColumnOrder(root) {
  const table = resolveTableInstance(root)
  const columns = table?.store?.states?.columns?.value || []
  return columns.filter(isReorderable).map(columnLabel)
}

export function readTableColumns(root) {
  const table = resolveTableInstance(root)
  const columns = table?.store?.states?.columns?.value || []
  const sortingColumn = table?.store?.states?.sortingColumn?.value

  return columns.filter(isConfigurable).map((column) => ({
    label: columnLabel(column),
    reorderable: isReorderable(column),
    sortable: column.sortable === true,
    order: sortingColumn === column ? (column.order || null) : null,
  }))
}

export function applyTableSort(root, label, order) {
  const table = resolveTableInstance(root)
  if (!table) return false
  const columns = table.store?.states?.columns?.value || []

  if (!label || !order) {
    if (typeof table.clearSort !== 'function') return false
    markSortedColumn(columns, null)
    table.clearSort()
    return true
  }

  const column = columns.find((item) => columnLabel(item) === label)
  if (!column?.property || column.sortable !== true) return false

  if (typeof table.sort !== 'function') return false
  markSortedColumn(columns, column)
  table.sort(column.property, order)
  return true
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
