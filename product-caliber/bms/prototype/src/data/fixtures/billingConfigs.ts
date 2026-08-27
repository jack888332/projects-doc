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
    defaultScheme: makeScheme({}, 'DEFAULT'),
    branches: branches.map((values, index) => makeScheme(values, `BRANCH-${String(index + 1).padStart(2, '0')}`)),
  }
}

export const billingConfigSeedVersion = 20260827

export const billingCustomerConfigFixtures = [
  { id:'AR-C-001', referenceNo:'AR-REF-OG0271-0002', memberCode:'M-700127', type:'AR', customerCode:'OG0271', customerName:'渣渣辉3号', store:'星际货运(中转)', group:'台湾大客户组', sourceType:'MASTER', sourceName:'台湾电商月结母版', sourceNo:'ARB-MASTER-20260801-01', masterId:'AR-M-001', version:'V2', currency:'TWD', cycle:'月账单', sentRule:'账期结束后 3 天', schemeSnapshot:makeSchemeSnapshot('TWD','MONTH',[{ businessTypes:['ECOMMERCE'], targetCountries:['TW'], warehouses:['SZ'] },{ businessTypes:['CONSOLIDATION'], targetCountries:['TW'], warehouses:['DG'], period:'HALF_MONTH' }]), effectStart:'2026-08-01', effectEnd:'长期', operator:'谭清辉', updatedAt:'2026-08-01 10:18', changeReason:'升级母版版本', status:'启用' },
  { id:'AR-C-002', referenceNo:'AR-REF-OG0370-0004', memberCode:'M-672019', type:'AR', customerCode:'OG0370', customerName:'JYK-深圳立杰海快', store:'星际中转2', group:'日本同行组', sourceType:'CUSTOM', sourceName:'客户自定义配置', sourceNo:'ARB-CUSTOM-OG0370', version:'V4', currency:'CNY', cycle:'7 自然天', sentRule:'账期结束后 1 天', schemeSnapshot:makeSchemeSnapshot('CNY','DAY_7',[{ businessTypes:['PEER'], targetCountries:['JP'], warehouses:['SZ'] }],1,'2026-07-01'), effectStart:'2026-07-01', effectEnd:'长期', operator:'郑雅雯', updatedAt:'2026-07-01 11:05', changeReason:'客户独立账期', status:'启用' },
  { id:'AR-C-003', referenceNo:'AR-REF-OG0347-0002', memberCode:'M-204801', type:'AR', customerCode:'OG0347', customerName:'测试1', store:'台湾集运店', group:'台湾大客户组', sourceType:'MASTER', sourceName:'台湾电商月结母版', sourceNo:'ARB-MASTER-20260801-01', masterId:'AR-M-001', version:'V2', currency:'TWD', cycle:'月账单', sentRule:'账期结束后 3 天', schemeSnapshot:makeSchemeSnapshot('TWD','MONTH',[{ businessTypes:['ECOMMERCE'], targetCountries:['TW'], warehouses:['SZ'] },{ businessTypes:['CONSOLIDATION'], targetCountries:['TW'], warehouses:['DG'], period:'HALF_MONTH' }]), effectStart:'2026-08-01', effectEnd:'长期', operator:'谭清辉', updatedAt:'2026-08-01 10:20', changeReason:'分配共享母版', status:'启用' },
  { id:'AR-C-004', referenceNo:'-', memberCode:'M-204812', type:'AR', customerCode:'OG0412', customerName:'NorthWind Cargo', store:'星际货运(中转)', group:'美国电商组', sourceType:'NONE', sourceName:'未配置', sourceNo:'-', version:'-', currency:'-', cycle:'-', sentRule:'-', schemeSnapshot:null, effectStart:'-', effectEnd:'-', operator:'-', updatedAt:'-', changeReason:'-', status:'未配置' },
  { id:'RF-C-001', referenceNo:'RF-REF-OG0271-0003', memberCode:'M-700127', type:'RF', customerCode:'OG0271', customerName:'渣渣辉3号', store:'星际货运(中转)', group:'台湾大客户组', sourceType:'MASTER', sourceName:'COD 周返母版', sourceNo:'RFB-MASTER-20260801-01', masterId:'RF-M-001', version:'V3', currency:'TWD', cycle:'周账单', sentRule:'账期结束后 1 天', mode:'回款返款', effectStart:'2026-08-01', effectEnd:'长期', operator:'谭清辉', updatedAt:'2026-08-01 10:20', changeReason:'调整返款周期', status:'启用' },
  { id:'RF-C-002', referenceNo:'RF-REF-OG0370-0004', memberCode:'M-672019', type:'RF', customerCode:'OG0370', customerName:'JYK-深圳立杰海快', store:'星际中转2', group:'日本同行组', sourceType:'CUSTOM', sourceName:'客户自定义配置', sourceNo:'RFB-CUSTOM-OG0370', version:'V4', currency:'CNY', cycle:'半周账单', sentRule:'账期结束后 1 天', mode:'签收返款', effectStart:'2026-07-01', effectEnd:'长期', operator:'郑雅雯', updatedAt:'2026-07-01 11:08', changeReason:'客户独立返款条款', status:'启用' },
  { id:'RF-C-003', referenceNo:'RF-REF-OG0347-0002', memberCode:'M-204801', type:'RF', customerCode:'OG0347', customerName:'测试1', store:'台湾集运店', group:'台湾大客户组', sourceType:'MASTER', sourceName:'COD 周返母版', sourceNo:'RFB-MASTER-20260801-01', masterId:'RF-M-001', version:'V2', currency:'TWD', cycle:'周账单', sentRule:'账期结束后 1 天', mode:'回款返款', effectStart:'2026-07-01', effectEnd:'长期', operator:'郑雅雯', updatedAt:'2026-07-01 11:10', changeReason:'待升级母版版本', status:'启用' },
  { id:'RF-C-004', referenceNo:'-', memberCode:'M-204812', type:'RF', customerCode:'OG0412', customerName:'NorthWind Cargo', store:'星际货运(中转)', group:'美国电商组', sourceType:'NONE', sourceName:'未配置', sourceNo:'-', version:'-', currency:'-', cycle:'-', sentRule:'-', mode:'-', effectStart:'-', effectEnd:'-', operator:'-', updatedAt:'-', changeReason:'-', status:'未配置' },
]

export const billingConfigMasterFixtures = [
  { id:'AR-M-001', type:'AR', no:'ARB-MASTER-20260801-01', name:'台湾电商月结母版', version:'V2', rangeMode:'STORE', rangeValues:['星际货运(中转)','台湾集运店'], rangeText:'店铺：星际货运(中转)、台湾集运店', currency:'TWD', cycle:'月账单', sentRule:'账期结束后 3 天', schemeSnapshot:makeSchemeSnapshot('TWD','MONTH',[{ businessTypes:['ECOMMERCE'], targetCountries:['TW'], warehouses:['SZ'] },{ businessTypes:['CONSOLIDATION'], targetCountries:['TW'], warehouses:['DG'], period:'HALF_MONTH' }]), effectStart:'2026-08-01', effectEnd:'长期', operator:'谭清辉', updatedAt:'2026-08-01 10:18', changeReason:'增加台湾电商分支', status:'启用' },
  { id:'AR-M-002', type:'AR', no:'ARB-MASTER-20260715-02', name:'基础周结母版', version:'V1', rangeMode:'GROUP', rangeValues:['台湾大客户组','日本同行组'], rangeText:'客户组：台湾大客户组、日本同行组', currency:'CNY', cycle:'周账单', sentRule:'账期结束后 1 天', schemeSnapshot:makeSchemeSnapshot('CNY','WEEK',[],1,'2026-07-15'), effectStart:'2026-07-15', effectEnd:'长期', operator:'郑雅雯', updatedAt:'2026-07-15 11:05', changeReason:'首次发布', status:'启用' },
  { id:'RF-M-001', type:'RF', no:'RFB-MASTER-20260801-01', name:'COD 周返母版', version:'V3', rangeMode:'STORE', rangeValues:['星际货运(中转)','台湾集运店'], rangeText:'店铺：星际货运(中转)、台湾集运店', currency:'TWD', cycle:'周账单', sentRule:'账期结束后 1 天', mode:'回款返款', effectStart:'2026-08-01', effectEnd:'长期', operator:'谭清辉', updatedAt:'2026-08-01 10:20', changeReason:'调整返款周期', status:'启用' },
  { id:'RF-M-002', type:'RF', no:'RFB-MASTER-20260715-02', name:'签收半周返款母版', version:'V1', rangeMode:'GROUP', rangeValues:['日本同行组'], rangeText:'客户组：日本同行组', currency:'CNY', cycle:'半周账单', sentRule:'账期结束后 1 天', mode:'签收返款', effectStart:'2026-07-15', effectEnd:'长期', operator:'郑雅雯', updatedAt:'2026-07-15 11:08', changeReason:'首次发布', status:'启用' },
]
