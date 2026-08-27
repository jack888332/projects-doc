import { describe, expect, it } from 'vitest'
import { buildMasterGenerationScopes, createMasterBatchTaskRows } from '../src/domain/masterGeneration.js'

const master = {
  id: 'AR-M-001', type: 'AR', no: 'ARB-MASTER-001', version: 'V2',
  effectStart: '2026-08-01', effectEnd: '长期',
  schemeSnapshot: {
    defaultScheme: { schemeKey:'DEFAULT', period:'MONTH', effectPeriod:['2026-08-01', '2027-07-31'] },
    branches: [{ schemeKey:'BRANCH-01', enabled:true, period:'HALF_MONTH', effectPeriod:['2026-08-01', '2027-07-31'] }],
  },
}

const customer = (overrides = {}) => ({
  id: 'AR-C-001', sourceType: 'MASTER', masterId: 'AR-M-001', sourceNo: 'ARB-MASTER-001', version: 'V2',
  customerCode: 'OG0271', customerName: '客户一', memberCode: 'M-001', store: '店铺一', group: '客户组一',
  referenceNo: 'AR-REF-001', effectStart: '2026-08-01', effectEnd: '长期', ...overrides,
})

describe('shared master generation', () => {
  it('expands only exact-version references into customer and scheme scopes', () => {
    const result = buildMasterGenerationScopes({
      master,
      customers: [customer(), customer({ id:'AR-C-002', customerCode:'OG0347', version:'V1' })],
      tasks: [],
      cutoff: '2026-08-27 16:45:00',
    })

    expect(result.exactCustomerCount).toBe(1)
    expect(result.otherVersionCount).toBe(1)
    expect(result.rows.map(row => row.schemeKey)).toEqual(['DEFAULT', 'BRANCH-01'])
    expect(result.rows.find(row => row.schemeKey === 'BRANCH-01')).toMatchObject({
      customerCode: 'OG0271', periodStart: '2026-08-01', periodEnd: '2026-08-15', blocked: false,
    })
  })

  it('does not generate a period before the customer reference becomes effective', () => {
    const result = buildMasterGenerationScopes({
      master,
      customers: [customer({ effectStart:'2026-09-01' })],
      tasks: [],
      cutoff: '2026-08-27 16:45:00',
    })

    expect(result.rows.every(row => row.blocked)).toBe(true)
  })

  it('uses a version-independent business lock and ignores deleted failures', () => {
    const baseTask = {
      taskNo: 'BMS-OLD', status: 'FAILED', customerNo: 'OG0271', schemeKey: 'BRANCH-01',
      periodStart: '2026-08-01', periodEnd: '2026-08-15',
      lockKey: 'OG0271|AR|BRANCH-01|2026-08-01/2026-08-15|BILL_GENERATE',
    }
    const blocked = buildMasterGenerationScopes({ master, customers:[customer()], tasks:[baseTask], cutoff:'2026-08-27 16:45:00' })
    const released = buildMasterGenerationScopes({ master, customers:[customer()], tasks:[{ ...baseTask, deletedAt:'2026-08-27 17:05:00' }], cutoff:'2026-08-27 16:45:00' })

    expect(blocked.rows.find(row => row.schemeKey === 'BRANCH-01').reason).toContain('BMS-OLD')
    expect(released.rows.find(row => row.schemeKey === 'BRANCH-01').blocked).toBe(false)
  })

  it('creates one non-executing batch reference and flat customer tasks', () => {
    const preview = buildMasterGenerationScopes({ master, customers:[customer()], tasks:[], cutoff:'2026-08-27 16:45:00' })
    const scopes = preview.rows.filter(row => !row.blocked)
    const result = createMasterBatchTaskRows({
      master, scopes, skippedCount:1, frozenCustomerCount:1, cutoff:'2026-08-27 16:45:00', existingTasks:[],
    })

    expect(result.batchNo).toMatch(/^BMSB-20260827-/)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({
      batchNo: result.batchNo, customerNo:'OG0271', schemeKey:'BRANCH-01', configVersion:'V2', status:'PENDING',
    })
    expect(result.rows[0]).not.toHaveProperty('parentTaskNo')
  })
})
