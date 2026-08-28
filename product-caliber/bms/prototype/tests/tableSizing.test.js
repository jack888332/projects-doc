import { describe, expect, it } from 'vitest'
import { canResizeTableColumn, fittedContentWidth, independentColumnWidth, independentTableProps, tableFillerWidth } from '../src/shared/components/tableSizing.js'

describe('independent table sizing', () => {
  it('keeps fit disabled even when a page attempts to enable it', () => {
    expect(independentTableProps({ fit: true, border: false, stripe: true })).toEqual({
      fit: false,
      border: false,
      stripe: true,
      allowDragLastColumn: true,
    })
  })

  it('preserves explicit widths and sizes unspecified columns from intrinsic content', () => {
    expect(independentColumnWidth({
      declaredWidth: 85,
      headerWidth: 74,
      contentWidth: 220,
    })).toBe(85)

    expect(independentColumnWidth({
      declaredMinWidth: 150,
      headerWidth: 132,
      contentWidth: 220,
    })).toBe(220)

    expect(independentColumnWidth({ headerWidth: 86 })).toBe(86)
    expect(independentColumnWidth({ contentWidth: 174, headerWidth: 86 })).toBe(174)
    expect(independentColumnWidth({})).toBe(120)
  })

  it('caps content-fitted widths while respecting the intrinsic minimum', () => {
    expect(fittedContentWidth({ measuredWidth: 174, minimumWidth: 86 })).toBe(174)
    expect(fittedContentWidth({ measuredWidth: 72, minimumWidth: 125 })).toBe(125)
    expect(fittedContentWidth({ measuredWidth: 420, minimumWidth: 125, maximumWidth: 260 })).toBe(260)
    expect(fittedContentWidth({ measuredWidth: 420, minimumWidth: 280, maximumWidth: 260 })).toBe(280)
  })

  it('only allows ordinary non-fixed columns to be resized', () => {
    expect(canResizeTableColumn()).toBe(true)
    expect(canResizeTableColumn({ fixed: 'right' })).toBe(true)
    expect(canResizeTableColumn({ excluded: true })).toBe(false)
    expect(canResizeTableColumn({ resizable: false })).toBe(false)
  })

  it('fills unused viewport space without stretching business columns', () => {
    expect(tableFillerWidth(1012, [48, 120, 120, 145, 130, 130, 165, 85, 52])).toBe(17)
    expect(tableFillerWidth(900, [48, 120, 120, 145, 130, 130, 165, 85, 52])).toBe(0)
  })
})
