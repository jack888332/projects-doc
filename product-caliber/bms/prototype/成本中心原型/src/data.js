export const suppliers = [
  { code: 'SUP-DF-001', name: '东风速运有限公司', modules: ['派送成本', '清关成本'], cycle: '半月', currency: 'TWD', currentPeriod: '2026/07/01 - 2026/07/15', bills: 26, pending: 2, pendingAmount: '218,636.000 TWD', total: '5,886,220.000 TWD', status: '启用', snapshot: '2026/07/02 10:18' },
  { code: 'SUP-FG-003', name: '福广国际报关有限公司', modules: ['清关成本'], cycle: '周', currency: 'TWD', currentPeriod: '2026/07/06 - 2026/07/12', bills: 18, pending: 1, pendingAmount: '938,733.000 TWD', total: '7,420,560.000 TWD', status: '启用', snapshot: '2026/07/09 15:42' },
  { code: 'SUP-LB-006', name: '力宝国际物流', modules: ['空运成本'], cycle: '周', currency: 'USD', currentPeriod: '2026/07/06 - 2026/07/12', bills: 13, pending: 1, pendingAmount: '31,284.500 USD', total: '410,728.900 USD', status: '启用', snapshot: '2026/06/30 09:21' },
  { code: 'SUP-LD-008', name: '联多国际货运', modules: ['海运成本'], cycle: '月', currency: 'USD', currentPeriod: '2026/07/01 - 2026/07/31', bills: 9, pending: 1, pendingAmount: '18,920.000 USD', total: '238,112.000 USD', status: '启用', snapshot: '2026/07/01 17:06' },
  { code: 'SUP-BYG-010', name: '深圳搬运工物流', modules: ['海运成本'], cycle: '月', currency: 'CNY', currentPeriod: '2026/07/01 - 2026/07/31', bills: 11, pending: 0, pendingAmount: '0.000 CNY', total: '864,300.000 CNY', status: '启用', snapshot: '2026/06/28 14:30' },
  { code: 'SUP-ZC-012', name: '桃园仓配车队', modules: ['租车成本'], cycle: '不固定', currency: 'TWD', currentPeriod: '2026/06/01 - 2026/06/30', bills: 7, pending: 1, pendingAmount: '132,625.000 TWD', total: '792,880.000 TWD', status: '启用', snapshot: '暂无' },
  { code: 'SUP-SS-015', name: '顺盛物流股份有限公司', modules: ['派送成本'], cycle: '半月', currency: 'TWD', currentPeriod: '2026/07/01 - 2026/07/15', bills: 14, pending: 0, pendingAmount: '0.000 TWD', total: '2,106,740.000 TWD', status: '停用', snapshot: '2026/05/18 11:05' },
]

export const bills = [
  { id: 'APB-DF-20260701-7D32A1', supplier: '东风速运有限公司', module: '派送成本', period: '2026/07/01 - 2026/07/15', amount: 218636, currency: 'TWD', rows: 2814, direct: 2134, indirect: 680, settled: '待结清', importStatus: '导入成功', importedAt: '2026/07/16 10:32', file: '台湾端派送（东风.xlsx' },
  { id: 'APB-FG-20260706-0EC9B8', supplier: '福广国际报关有限公司', module: '清关成本', period: '2026/07/06 - 2026/07/12', amount: 938733, currency: 'TWD', rows: 7856, direct: 7542, indirect: 314, settled: '待结清', importStatus: '导入成功', importedAt: '2026/07/14 15:08', file: '海快清关（福广.xlsx' },
  { id: 'APB-LB-20260706-5F90C2', supplier: '力宝国际物流', module: '空运成本', period: '2026/07/06 - 2026/07/12', amount: 31284.5, currency: 'USD', rows: 426, direct: 410, indirect: 16, settled: '待结清', importStatus: '导入成功', importedAt: '2026/07/13 09:45', file: '空运头程（力宝.xls' },
  { id: 'APB-LD-20260701-51E764', supplier: '联多国际货运', module: '海运成本', period: '2026/07/01 - 2026/07/31', amount: 18920, currency: 'USD', rows: 118, direct: 102, indirect: 16, settled: '待结清', importStatus: '导入成功', importedAt: '2026/07/12 17:22', file: '海快船公司（联多.xlsx' },
  { id: 'APB-ZC-20260601-9A4C10', supplier: '桃园仓配车队', module: '租车成本', period: '2026/06/01 - 2026/06/30', amount: 132625, currency: 'TWD', rows: 15, direct: 0, indirect: 15, settled: '待结清', importStatus: '导入成功', importedAt: '2026/07/03 11:16', file: '海快租车（仓库送船公司.xlsx' },
  { id: 'APB-BYG-20260601-A28D7F', supplier: '深圳搬运工物流', module: '海运成本', period: '2026/06/01 - 2026/06/30', amount: 86400, currency: 'CNY', rows: 72, direct: 64, indirect: 8, settled: '已结清', importStatus: '导入成功', importedAt: '2026/07/02 14:26', file: '海快（深圳搬运工.xlsx' },
]

export const costRows = [
  { id: 'COST-260716-00128', bill: 'APB-DF-20260701-7D32A1', module: '派送成本', supplier: '东风速运有限公司', rawItem: '派件費', item: '派送费', keyType: '尾程运单号', key: '40524779466', amount: 88, currency: 'TWD', type: '直接成本', target: '尾程包裹 AG099649-1', status: '已归属' },
  { id: 'COST-260716-00129', bill: 'APB-DF-20260701-7D32A1', module: '派送成本', supplier: '东风速运有限公司', rawItem: '拖車及疊貨費', item: '派送附加费', keyType: '尾程运单号', key: 'EAST00004637', amount: 18.4, currency: 'TWD', type: '直接成本', target: '尾程包裹 LWD032402', status: '已归属' },
  { id: 'COST-260714-00316', bill: 'APB-FG-20260706-0EC9B8', module: '清关成本', supplier: '福广国际报关有限公司', rawItem: '稅費金額', item: '进口税金', keyType: '分提单号', key: 'DZD90351936', amount: 399, currency: 'TWD', type: '直接成本', target: '业务订单 SO260619036', status: '已归属' },
  { id: 'COST-260714-00317', bill: 'APB-FG-20260706-0EC9B8', module: '清关成本', supplier: '福广国际报关有限公司', rawItem: '倉租', item: '仓租费', keyType: '清关条码', key: '0A41M686', amount: 30, currency: 'TWD', type: '直接成本', target: '业务订单 SO260623686', status: '已归属' },
  { id: 'COST-260712-00201', bill: 'APB-LD-20260701-51E764', module: '海运成本', supplier: '联多国际货运', rawItem: 'DOC FEE', item: '文件费', keyType: '提单号', key: 'OOLU4108271', amount: 320, currency: 'USD', type: '间接成本', target: '海运文件费分摊池 07月', status: '待分摊' },
  { id: 'COST-260703-00015', bill: 'APB-ZC-20260601-9A4C10', module: '租车成本', supplier: '桃园仓配车队', rawItem: '車趟費', item: '租车费', keyType: '柜号', key: 'HPCU4883085', amount: 10500, currency: 'TWD', type: '间接成本', target: '桃园仓租车分摊池 06月', status: '已分摊' },
  { id: 'COST-260703-00016', bill: 'APB-ZC-20260601-9A4C10', module: '租车成本', supplier: '桃园仓配车队', rawItem: '超時費', item: '车辆超时费', keyType: '柜号', key: 'XYLU8150662', amount: 2000, currency: 'TWD', type: '间接成本', target: '尚未选择分摊池', status: '待处理' },
]

export const allocationPools = [
  { id: 'POOL-SEA-DOC-202607', name: '海运文件费分摊池 07月', module: '海运成本', item: '文件费', supplier: '联多国际货运', period: '2026/07/01 - 2026/07/31', amount: '1,280.000 USD', factor: '计费重量', orders: 84, status: '待试算', progress: 42 },
  { id: 'POOL-TRUCK-202606', name: '桃园仓租车分摊池 06月', module: '租车成本', item: '租车费', supplier: '桃园仓配车队', period: '2026/06/01 - 2026/06/30', amount: '130,625.000 TWD', factor: '业务订单件数', orders: 3126, status: '已生效', progress: 100 },
  { id: 'POOL-CUS-WH-202607', name: '清关仓租分摊池 第28周', module: '清关成本', item: '仓租费', supplier: '福广国际报关有限公司', period: '2026/07/06 - 2026/07/12', amount: '26,840.000 TWD', factor: '清关重量', orders: 581, status: '待确认', progress: 86 },
  { id: 'POOL-AIR-SEC-202607', name: '空运安检费分摊池 第28周', module: '空运成本', item: '安检费', supplier: '力宝国际物流', period: '2026/07/06 - 2026/07/12', amount: '2,560.000 USD', factor: '计费重量', orders: 426, status: '分摊失败', progress: 18 },
]

export const moduleTone = {
  派送成本: 'delivery',
  清关成本: 'customs',
  海运成本: 'sea',
  空运成本: 'air',
  租车成本: 'truck',
}

export const formatAmount = (amount, currency) => `${Number(amount).toLocaleString('zh-CN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${currency}`
