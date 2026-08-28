import { describe, expect, it } from 'vitest'
import { customerRelationSummary, matchCustomerRelations } from '../src/domain/customerRelations.js'

const customer = {
  customerCode:'OG0271',
  relations:[
    { store:'店铺一', group:'客户组一', memberCode:'M-001' },
    { store:'店铺二', group:'客户组二', memberCode:'M-002' },
  ],
}

describe('customer relation snapshots', () => {
  it('retains every current store, group and member relation', () => {
    expect(customerRelationSummary(customer)).toMatchObject({
      stores:['店铺一', '店铺二'],
      groups:['客户组一', '客户组二'],
      memberCodes:['M-001', 'M-002'],
    })
  })

  it('requires store and customer group filters to match the same relation chain', () => {
    expect(matchCustomerRelations(customer, { stores:['店铺一'], groups:['客户组一'] }).matches).toBe(true)
    expect(matchCustomerRelations(customer, { stores:['店铺一'], groups:['客户组二'] }).matches).toBe(false)
  })
})
