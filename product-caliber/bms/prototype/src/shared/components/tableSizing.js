export const DEFAULT_TABLE_COLUMN_WIDTH = 120

function numericWidth(value) {
  if (value == null || value === '') return 0
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function independentTableProps(attrs = {}) {
  return {
    ...attrs,
    fit: false,
    border: attrs.border ?? true,
    allowDragLastColumn: true,
  }
}

export function independentColumnWidth({
  declaredWidth,
  declaredMinWidth,
  headerWidth,
  contentWidth,
  fallbackWidth = DEFAULT_TABLE_COLUMN_WIDTH,
} = {}) {
  const width = numericWidth(declaredWidth)
  const minimumHeaderWidth = numericWidth(headerWidth)
  if (width) return Math.max(width, minimumHeaderWidth)

  const intrinsicWidth = Math.max(
    numericWidth(declaredMinWidth),
    minimumHeaderWidth,
    numericWidth(contentWidth),
  )
  return intrinsicWidth || numericWidth(fallbackWidth)
}

export function fittedContentWidth({
  measuredWidth,
  minimumWidth,
  maximumWidth = 260,
  fallbackWidth = DEFAULT_TABLE_COLUMN_WIDTH,
} = {}) {
  const maximum = numericWidth(maximumWidth)
  const minimum = numericWidth(minimumWidth)
  const intrinsicWidth = Math.max(numericWidth(measuredWidth), minimum)
  const resolvedWidth = intrinsicWidth || numericWidth(fallbackWidth)
  return maximum ? Math.max(minimum, Math.min(resolvedWidth, maximum)) : resolvedWidth
}

export function canResizeTableColumn({ excluded = false, fixed = false, resizable = true } = {}) {
  return !excluded && resizable !== false && resizable !== 'false'
}

export function tableFillerWidth(viewportWidth, columnWidths = []) {
  const available = numericWidth(viewportWidth)
  const occupied = columnWidths.reduce((sum, width) => sum + numericWidth(width), 0)
  return Math.max(0, Math.floor(available - occupied))
}
