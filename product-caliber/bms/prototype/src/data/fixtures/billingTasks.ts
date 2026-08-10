export type TaskStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED'
export type TaskType = 'FEE_POOL' | 'BILL_GENERATE' | 'BILL_RECALCULATE'
export type GenerationMode = '' | 'FIRST' | 'SUPPLEMENT' | 'REPLACE'

export interface BillingTaskFixture {
  id: number
  taskNo: string
  status: TaskStatus
  taskType: TaskType
  generationMode: GenerationMode
  triggerType: 'SCHEDULED' | 'MANUAL'
  configNo: string
  configVersion: string
  configType: string
  customerName: string
  customerNo: string
  memberCode: string
  shop: string
  periodStart: string
  periodEnd: string
  period: string
  dataCutoff: string
  createdAt: string
  startedAt: string
  finishedAt: string
  duration: string
  operator: string
  failedStage: string
  error: string
  advice: string
  sourceCount: number
  pooledFeeCount: number
  billCount: number
  netChange: number
  resultConclusion: string
  resultVersion: string
  originalBills: string[]
  newBills: string[]
  scopeKey: string
  sourceSql: string
  recalculateScope: string
  closeResult: string
}

const baseTask: Omit<BillingTaskFixture, 'id' | 'taskNo' | 'periodStart' | 'periodEnd' | 'period'> = {
  status: 'SUCCESS',
  taskType: 'BILL_GENERATE',
  generationMode: '',
  triggerType: 'MANUAL',
  configNo: 'BC-DEFAULT',
  configVersion: 'V1',
  configType: '默认配置',
  customerName: '全部客户',
  customerNo: '-',
  memberCode: '-',
  shop: '全部店铺',
  dataCutoff: '-',
  createdAt: '-',
  startedAt: '-',
  finishedAt: '-',
  duration: '0秒',
  operator: 'system',
  failedStage: '',
  error: '',
  advice: '',
  sourceCount: 0,
  pooledFeeCount: 0,
  billCount: 0,
  netChange: 0,
  resultConclusion: '--',
  resultVersion: '--',
  originalBills: [],
  newBills: [],
  scopeKey: '',
  sourceSql: '',
  recalculateScope: '',
  closeResult: '不涉及',
}

function task(input: Pick<BillingTaskFixture, 'id' | 'taskNo' | 'periodStart' | 'periodEnd'> & Partial<BillingTaskFixture>): BillingTaskFixture {
  return {
    ...baseTask,
    ...input,
    period: `${input.periodStart} 至 ${input.periodEnd}`,
  }
}

export const billingTaskFixtures: BillingTaskFixture[] = [
  task({
    id: 1, taskNo: 'BMS-20260802-00081', status: 'FAILED', generationMode: 'SUPPLEMENT', triggerType: 'SCHEDULED',
    configNo: 'BC-OG4155-M-US', configVersion: 'V12', configType: '分支配置', customerName: 'OceanGate Logistics',
    customerNo: 'OG4155', memberCode: 'M-700127', shop: '深圳集运店', periodStart: '2026-08-01', periodEnd: '2026-08-01',
    dataCutoff: '2026-08-02 02:00:00', createdAt: '2026-08-02 02:00:01', startedAt: '2026-08-02 02:10:03',
    finishedAt: '2026-08-02 02:12:29', duration: '2分26秒', failedStage: 'BILL_CALCULATE', sourceCount: 1864,
    pooledFeeCount: 6421, originalBills: ['ARB-OG4155-20260801-f31a'], scopeKey: 'OG4155|AR|2026-08-01|BC-OG4155-M-US',
    error: '11条费项缺少业务板块，无法完成拆单。', advice: '核对来源数据完整性，修复后按原任务快照重新执行。',
    sourceSql: 'SELECT ... FROM sale_order_fee_detail WHERE customer_no = :customerNo AND bms_reviewed = 0;',
  }),
  task({
    id: 2, taskNo: 'BMS-20260802-00080', generationMode: 'FIRST', configNo: 'BC-TK9012-D', configVersion: 'V8',
    customerName: 'TopKing Supply', customerNo: 'TK9012', memberCode: 'M-672019', shop: '义乌集运店',
    periodStart: '2026-08-01', periodEnd: '2026-08-07', dataCutoff: '2026-08-02 09:30:00', createdAt: '2026-08-02 09:30:02',
    startedAt: '2026-08-02 09:31:11', finishedAt: '2026-08-02 09:34:45', duration: '3分34秒', operator: '谭清辉',
    sourceCount: 2540, pooledFeeCount: 8220, billCount: 2, netChange: 483126.58, resultConclusion: '首次生成',
    resultVersion: 'RV-20260802-00317', newBills: ['ARB-TK9012-20260801-41b7', 'ARB-TK9012-20260801-8c2a'],
    scopeKey: 'TK9012|AR|2026-08-01/07|BC-TK9012-D', sourceSql: 'SELECT ... FROM sale_order_fee_detail WHERE customer_no = :customerNo;',
  }),
  task({
    id: 3, taskNo: 'BMS-20260802-00079', status: 'RUNNING', taskType: 'FEE_POOL', triggerType: 'SCHEDULED',
    configNo: 'BC-ADDITIONAL-INCR', configVersion: 'V5', periodStart: '2026-08-02', periodEnd: '2026-08-02',
    dataCutoff: '2026-08-02 10:00:00', createdAt: '2026-08-02 10:00:01', startedAt: '2026-08-02 10:00:06',
    duration: '8分12秒', sourceCount: 12640, pooledFeeCount: 11806, resultConclusion: '执行中', resultVersion: '--',
    sourceSql: 'SELECT ... FROM sale_order_fee_detail WHERE fee_created_at <= :dataCutoff;',
  }),
  task({
    id: 4, taskNo: 'BMS-20260802-00077', status: 'PENDING', taskType: 'BILL_RECALCULATE', configNo: 'BC-NW2048-W',
    configVersion: 'V9', customerName: 'NorthWind Cargo', customerNo: 'NW2048', memberCode: 'M-204801', shop: '上海集运店',
    periodStart: '2026-07-21', periodEnd: '2026-07-27', createdAt: '2026-08-02 09:48:18', originalBills: ['ARB-NW2048-20260721-9c01'],
    recalculateScope: '原账单全部费项', resultConclusion: '待执行', resultVersion: '--',
  }),
  task({
    id: 5, taskNo: 'BMS-20260802-00072', generationMode: 'SUPPLEMENT', configNo: 'BC-HL2388-WEEK', configVersion: 'V6',
    customerName: 'Hualei Express', customerNo: 'HL2388', memberCode: 'M-238801', shop: '广州同行店', periodStart: '2026-07-27',
    periodEnd: '2026-08-02', dataCutoff: '2026-08-02 08:35:00', createdAt: '2026-08-02 08:35:03', duration: '51秒',
    sourceCount: 784, pooledFeeCount: 2680, billCount: 1, netChange: 32680.2, resultConclusion: '补充生成',
    resultVersion: 'RV-20260802-00296', originalBills: ['ARB-HL2388-20260727-a922'], newBills: ['ARB-HL2388-20260727-a922-S1'],
  }),
  task({
    id: 6, taskNo: 'BMS-20260801-00068', generationMode: 'REPLACE', configNo: 'BC-OG4155-M-UK', configVersion: 'V13',
    configType: '分支配置', customerName: 'OceanGate Logistics', customerNo: 'OG4155', memberCode: 'M-700127', shop: '深圳集运店',
    periodStart: '2026-07-01', periodEnd: '2026-07-31', dataCutoff: '2026-08-01 18:19:00', createdAt: '2026-08-01 18:19:03',
    duration: '5分38秒', sourceCount: 3188, pooledFeeCount: 2931, billCount: 2, netChange: -1280.5, resultConclusion: '替换生成',
    resultVersion: 'RV-20260801-00981', originalBills: ['ARB-OG4155-20260701-old'], newBills: ['ARB-OG4155-20260701-new-a', 'ARB-OG4155-20260701-new-b'],
  }),
  task({
    id: 7, taskNo: 'BMS-20260801-00064', status: 'FAILED', taskType: 'FEE_POOL', triggerType: 'SCHEDULED',
    configNo: 'BC-ADDITIONAL-INCR', configVersion: 'V5', periodStart: '2026-08-01', periodEnd: '2026-08-01',
    dataCutoff: '2026-08-01 23:00:00', createdAt: '2026-08-01 23:00:01', duration: '2分31秒', failedStage: 'SOURCE_SCAN',
    error: '来源库连接超时。', advice: '等待连接恢复后由调度服务重新拉取。', resultConclusion: '扫描失败', resultVersion: '--',
    sourceSql: 'SELECT ... FROM sale_order_fee_detail WHERE fee_created_at <= :dataCutoff;',
  }),
]

export interface SourceScanFixture {
  dataset: string
  method: '全量' | '增量'
  range: string
  previousWatermark: string
  cutoff: string
  pulled: number
  matched: number
  result: '成功' | '失败'
  failure: string
}

const scan = (overrides: Partial<SourceScanFixture> = {}): SourceScanFixture => ({
  dataset: '订单费用明细', method: '增量', range: '(上次成功水位, 本次数据截止点]', previousWatermark: '2026-08-01 00:00:00',
  cutoff: '2026-08-02 00:00:00', pulled: 0, matched: 0, result: '成功', failure: '--', ...overrides,
})

export const sourceScansByTaskId: Record<number, SourceScanFixture[]> = {
  1: [scan({ pulled: 1864, matched: 1849, cutoff: '2026-08-02 02:00:00' })],
  2: [scan({ method: '全量', range: '[2026-08-01, 2026-08-02 09:30:00]', pulled: 2540, matched: 2540, cutoff: '2026-08-02 09:30:00' })],
  3: [scan({ dataset: '订单附加费', pulled: 12640, matched: 11806, cutoff: '2026-08-02 10:00:00' })],
  5: [scan({ dataset: '同行订单费用明细', pulled: 784, matched: 768, cutoff: '2026-08-02 08:35:00' })],
  6: [scan({ method: '全量', range: '[2026-07-01, 2026-08-01 18:19:00]', previousWatermark: '配置版本变化，原水位失效', pulled: 3188, matched: 2931, cutoff: '2026-08-01 18:19:00' })],
  7: [scan({ dataset: '订单附加费', pulled: 0, matched: 0, cutoff: '2026-08-01 23:00:00', result: '失败', failure: '来源库连接超时' })],
}
