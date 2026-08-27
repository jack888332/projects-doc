const makeSchemeSnapshot = (
  sourceCurrency: string,
  period: string,
  branches: Record<string, unknown>[] = [],
  sendAfterDays = 3,
  effectStart = '2026-08-01',
) => {
  const makeScheme = (values: Record<string, unknown>, schemeKey: string) => ({
    schemeKey,
    enabled: true,
    businessTypes: [],
    targetCountries: [],
    warehouses: [],
    sourceCurrency,
    feeRules: [{ feeCode: 'FALLBACK', fallback: true, settlementCurrency: sourceCurrency }],
    node: 'WEIGHT_OUTBOUND',
    period,
    sendAfterDays,
    effectPeriod: [effectStart, '2027-07-31'],
    ...values,
  })

  return {
    branchKeyCeiling: branches.length,
    defaultScheme: makeScheme({}, 'DEFAULT'),
    branches: branches.map((values, index) => makeScheme(values, `BRANCH-${String(index + 1).padStart(2, '0')}`)),
  }
}

const makeRefundSnapshot = (mode = 'RECEIVED', period = 'WEEK', currency = 'CNY', effectStart = '2026-08-01') => ({
  enabled:true,
  refundMode:mode,
  billingPeriodType:period,
  startDays:period === 'HALF_WEEK' ? ['2', '5'] : [],
  sendAfterDays:1,
  requiredFees:['FEE0024'],
  directDeductFees:['COD_SERVICE_FEE', 'OVERSIZE_FEE', 'REISSUE_FEE'],
  currencyRules:[{ fallback:true, sourceCurrency:'', settlementCurrency:currency, accountName:'客户默认账户', accountNo:'**** 6208' }],
  negativePolicy:'NEXT_REFUND_BILL',
  effectPeriod:[effectStart, '2027-07-31'],
})

export const billingConfigSeedVersion = 2026082704

const customerRelationDirectory: Record<string, Record<string, string>[]> = {
  OG0271: [
    { store:'星际货运(中转)', group:'台湾大客户组', memberCode:'M-700127' },
    { store:'台湾集运店', group:'美国电商组', memberCode:'M-700129' },
  ],
  OG0370: [{ store:'星际中转2', group:'日本同行组', memberCode:'M-672019' }],
  OG0347: [{ store:'台湾集运店', group:'台湾大客户组', memberCode:'M-204801' }],
  OG0412: [{ store:'星际货运(中转)', group:'美国电商组', memberCode:'M-204812' }],
}

const withCustomerRelations = <T extends { customerCode:string }>(row:T) => ({
  ...row,
  relations:customerRelationDirectory[row.customerCode] || [],
})

export const billingCustomerConfigFixtures = [
  { id:'AR-R-001', referenceNo:'AR-REF-OG0271-0002', memberCode:'M-700127', type:'AR', customerCode:'OG0271', customerName:'渣渣辉3号', store:'星际货运(中转)', group:'台湾大客户组', configId:'AR-CFG-001', configName:'台湾电商月结', configNo:'ARB-20260801-01', version:'V2', currency:'TWD', cycle:'月账单', sentRule:'账期结束后 3 天', schemeSnapshot:makeSchemeSnapshot('TWD','MONTH',[{ businessTypes:['ECOMMERCE'], targetCountries:['TW'], warehouses:['SZ'] },{ businessTypes:['CONSOLIDATION'], targetCountries:['TW'], warehouses:['DG'], period:'HALF_MONTH' }]), effectStart:'2026-08-01', effectEnd:'长期', operator:'谭清辉', updatedAt:'2026-08-01 10:18', changeReason:'升级到配置 V2', status:'启用' },
  { id:'AR-R-002', referenceNo:'AR-REF-OG0370-0004', memberCode:'M-672019', type:'AR', customerCode:'OG0370', customerName:'JYK-深圳立杰海快', store:'星际中转2', group:'日本同行组', configId:'AR-CFG-003', configName:'日本同行 7 天结算', configNo:'ARB-OG0370-01', version:'V4', currency:'CNY', cycle:'7 自然天', sentRule:'账期结束后 1 天', schemeSnapshot:makeSchemeSnapshot('CNY','DAY_7',[{ businessTypes:['PEER'], targetCountries:['JP'], warehouses:['SZ'] }],1,'2026-07-01'), effectStart:'2026-07-01', effectEnd:'长期', operator:'郑雅雯', updatedAt:'2026-07-01 11:05', changeReason:'客户独立账期', status:'启用' },
  { id:'AR-R-003', referenceNo:'AR-REF-OG0347-0002', memberCode:'M-204801', type:'AR', customerCode:'OG0347', customerName:'测试1', store:'台湾集运店', group:'台湾大客户组', configId:'AR-CFG-001', configName:'台湾电商月结', configNo:'ARB-20260801-01', version:'V2', currency:'TWD', cycle:'月账单', sentRule:'账期结束后 3 天', schemeSnapshot:makeSchemeSnapshot('TWD','MONTH',[{ businessTypes:['ECOMMERCE'], targetCountries:['TW'], warehouses:['SZ'] },{ businessTypes:['CONSOLIDATION'], targetCountries:['TW'], warehouses:['DG'], period:'HALF_MONTH' }]), effectStart:'2026-08-01', effectEnd:'长期', operator:'谭清辉', updatedAt:'2026-08-01 10:20', changeReason:'引用统一配置', status:'启用' },
  { id:'AR-R-004', referenceNo:'-', memberCode:'M-204812', type:'AR', customerCode:'OG0412', customerName:'NorthWind Cargo', store:'星际货运(中转)', group:'美国电商组', configId:null, configName:'未配置', configNo:'-', version:'-', currency:'-', cycle:'-', sentRule:'-', schemeSnapshot:null, effectStart:'-', effectEnd:'-', operator:'-', updatedAt:'-', changeReason:'-', status:'未配置' },
  { id:'RF-R-001', referenceNo:'RF-REF-OG0271-0003', memberCode:'M-700127', type:'RF', customerCode:'OG0271', customerName:'渣渣辉3号', store:'星际货运(中转)', group:'台湾大客户组', configId:'RF-CFG-001', configName:'COD 周返', configNo:'RFB-20260801-01', version:'V3', currency:'TWD', cycle:'周账单', sentRule:'账期结束后 1 天', mode:'回款返款', refundSnapshot:makeRefundSnapshot('RECEIVED','WEEK','TWD'), effectStart:'2026-08-01', effectEnd:'长期', operator:'谭清辉', updatedAt:'2026-08-01 10:20', changeReason:'升级到配置 V3', status:'启用' },
  { id:'RF-R-002', referenceNo:'RF-REF-OG0370-0004', memberCode:'M-672019', type:'RF', customerCode:'OG0370', customerName:'JYK-深圳立杰海快', store:'星际中转2', group:'日本同行组', configId:'RF-CFG-003', configName:'日本同行签收返款', configNo:'RFB-OG0370-01', version:'V4', currency:'CNY', cycle:'半周账单', sentRule:'账期结束后 1 天', mode:'签收返款', refundSnapshot:makeRefundSnapshot('SIGNED','HALF_WEEK','CNY','2026-07-01'), effectStart:'2026-07-01', effectEnd:'长期', operator:'郑雅雯', updatedAt:'2026-07-01 11:08', changeReason:'客户独立返款条款', status:'启用' },
  { id:'RF-R-003', referenceNo:'RF-REF-OG0347-0002', memberCode:'M-204801', type:'RF', customerCode:'OG0347', customerName:'测试1', store:'台湾集运店', group:'台湾大客户组', configId:'RF-CFG-001', configName:'COD 周返', configNo:'RFB-20260801-01', version:'V2', currency:'TWD', cycle:'周账单', sentRule:'账期结束后 1 天', mode:'回款返款', refundSnapshot:makeRefundSnapshot('RECEIVED','WEEK','TWD','2026-07-01'), effectStart:'2026-07-01', effectEnd:'长期', operator:'郑雅雯', updatedAt:'2026-07-01 11:10', changeReason:'保留准确版本 V2', status:'启用' },
  { id:'RF-R-004', referenceNo:'-', memberCode:'M-204812', type:'RF', customerCode:'OG0412', customerName:'NorthWind Cargo', store:'星际货运(中转)', group:'美国电商组', configId:null, configName:'未配置', configNo:'-', version:'-', currency:'-', cycle:'-', sentRule:'-', mode:'-', effectStart:'-', effectEnd:'-', operator:'-', updatedAt:'-', changeReason:'-', status:'未配置' },
].map(withCustomerRelations)

export const billingConfigFixtures = [
  { id:'AR-CFG-001', type:'AR', no:'ARB-20260801-01', name:'台湾电商月结', version:'V2', currency:'TWD', cycle:'月账单', sentRule:'账期结束后 3 天', schemeSnapshot:makeSchemeSnapshot('TWD','MONTH',[{ businessTypes:['ECOMMERCE'], targetCountries:['TW'], warehouses:['SZ'] },{ businessTypes:['CONSOLIDATION'], targetCountries:['TW'], warehouses:['DG'], period:'HALF_MONTH' }]), effectStart:'2026-08-01', effectEnd:'长期', operator:'谭清辉', updatedAt:'2026-08-01 10:18', changeReason:'增加台湾电商分支', status:'启用' },
  { id:'AR-CFG-002', type:'AR', no:'ARB-20260715-02', name:'基础周结', version:'V1', currency:'CNY', cycle:'周账单', sentRule:'账期结束后 1 天', schemeSnapshot:makeSchemeSnapshot('CNY','WEEK',[],1,'2026-07-15'), effectStart:'2026-07-15', effectEnd:'长期', operator:'郑雅雯', updatedAt:'2026-07-15 11:05', changeReason:'首次发布', status:'启用' },
  { id:'AR-CFG-003', type:'AR', no:'ARB-OG0370-01', name:'日本同行 7 天结算', version:'V4', currency:'CNY', cycle:'7 自然天', sentRule:'账期结束后 1 天', schemeSnapshot:makeSchemeSnapshot('CNY','DAY_7',[{ businessTypes:['PEER'], targetCountries:['JP'], warehouses:['SZ'] }],1,'2026-07-01'), effectStart:'2026-07-01', effectEnd:'长期', operator:'郑雅雯', updatedAt:'2026-07-01 11:05', changeReason:'调整同行账期', status:'启用' },
  { id:'RF-CFG-001', type:'RF', no:'RFB-20260801-01', name:'COD 周返', version:'V3', currency:'TWD', cycle:'周账单', sentRule:'账期结束后 1 天', mode:'回款返款', refundSnapshot:makeRefundSnapshot('RECEIVED','WEEK','TWD'), effectStart:'2026-08-01', effectEnd:'长期', operator:'谭清辉', updatedAt:'2026-08-01 10:20', changeReason:'调整返款周期', status:'启用' },
  { id:'RF-CFG-002', type:'RF', no:'RFB-20260715-02', name:'签收半周返款', version:'V1', currency:'CNY', cycle:'半周账单', sentRule:'账期结束后 1 天', mode:'签收返款', refundSnapshot:makeRefundSnapshot('SIGNED','HALF_WEEK','CNY','2026-07-15'), effectStart:'2026-07-15', effectEnd:'长期', operator:'郑雅雯', updatedAt:'2026-07-15 11:08', changeReason:'首次发布', status:'启用' },
  { id:'RF-CFG-003', type:'RF', no:'RFB-OG0370-01', name:'日本同行签收返款', version:'V4', currency:'CNY', cycle:'半周账单', sentRule:'账期结束后 1 天', mode:'签收返款', refundSnapshot:makeRefundSnapshot('SIGNED','HALF_WEEK','CNY','2026-07-01'), effectStart:'2026-07-01', effectEnd:'长期', operator:'郑雅雯', updatedAt:'2026-07-01 11:08', changeReason:'调整返款条款', status:'启用' },
]

const versionSnapshot = (config:Record<string, unknown>, version:string, overrides:Record<string, unknown> = {}) => ({
  ...config,
  configId:config.id,
  snapshotId:`${config.id}@${version}`,
  version,
  ...overrides,
})

export const billingConfigVersionFixtures = [
  ...billingConfigFixtures.map(config => versionSnapshot(config, config.version)),
  versionSnapshot(billingConfigFixtures[0], 'V1', { updatedAt:'2026-07-01 10:10', changeReason:'首次发布', schemeSnapshot:makeSchemeSnapshot('TWD','MONTH',[]) }),
  versionSnapshot(billingConfigFixtures[2], 'V3', { updatedAt:'2026-06-15 14:20', changeReason:'调整日本同行费项规则' }),
  versionSnapshot(billingConfigFixtures[3], 'V2', { updatedAt:'2026-07-01 11:10', changeReason:'调整返款发出日', refundSnapshot:makeRefundSnapshot('RECEIVED','WEEK','TWD','2026-07-01') }),
  versionSnapshot(billingConfigFixtures[3], 'V1', { updatedAt:'2026-06-01 09:30', changeReason:'首次发布', refundSnapshot:makeRefundSnapshot('RECEIVED','WEEK','TWD','2026-06-01') }),
  versionSnapshot(billingConfigFixtures[5], 'V3', { updatedAt:'2026-06-15 16:05', changeReason:'调整半周起始日' }),
]
