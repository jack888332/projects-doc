<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, EditPen, Search } from '@element-plus/icons-vue'
import StatusTag from './StatusTag.vue'
import TablePagination from './TablePagination.vue'
import { useDemoDataset } from '../data/useDemoDataset.js'

const props = defineProps({
  bill: { type: Object, required: true },
  isReceivable: { type: Boolean, required: true },
})
const emit = defineEmits(['action'])
const activeTab = ref(props.isReceivable ? 'rates' : 'info')
const feeView = ref('horizontal')
const feeAmountDimension = ref('settlement')
const feeBusinessNo = ref('')
const showUnboundFees = ref(false)
const previewVisible = ref(false)
const previewAction = ref('')
const rateEditorVisible = ref(false)
const editableRates = ref([])
const generationVisible = ref(false)
const generationStep = ref(0)
const generationForm = reactive({ reason: '', dataCutoff: '2026-08-02 10:30:00', newConfig: 'CURRENT', switchAt: '2026-08-03 00:00:00' })

watch(() => [props.bill.billNo, props.isReceivable], () => {
  activeTab.value = props.isReceivable ? 'rates' : 'info'
  feeView.value = 'horizontal'
  feeAmountDimension.value = 'settlement'
  feeBusinessNo.value = ''
  showUnboundFees.value = false
})

const money = (value) => Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const statusClass = computed(() => props.bill.status === '已结清' ? 'success' : props.bill.status === '待结清' ? 'running' : 'warning')
const arCurrencyBuckets = computed(() => {
  const rows = [{ currency: props.bill.currency, state: '待收款', due: props.bill.amount, settled: props.bill.paid, pending: props.bill.amount - props.bill.paid }]
  if (props.bill.secondCurrency) rows.push({ currency: props.bill.secondCurrency, state: '已核销', due: props.bill.secondAmount, settled: 0, pending: props.bill.secondAmount })
  return rows
})
const arRates = computed(() => [
  { settlement: props.bill.currency, target: 'TWD', direction: `${props.bill.currency} → TWD`, rate: '1.000000' },
  ...(props.bill.secondCurrency ? [{ settlement: props.bill.secondCurrency, target: 'CNY', direction: `CNY → ${props.bill.secondCurrency}`, rate: '1.000000' }] : []),
])
const arFeeSummary = computed(() => [
  { fee: '基础运费', currency: props.bill.currency, amount: props.bill.amount, written: props.bill.paid, pending: props.bill.amount - props.bill.paid },
  ...(props.bill.secondCurrency ? [{ fee: '往期账单冲正', currency: props.bill.secondCurrency, amount: props.bill.secondAmount, written: 0, pending: props.bill.secondAmount }] : []),
])
const arOrderFeeRows = useDemoDataset('billingReceivableOrderFees', [
  { businessNo: 'PF607701341575057408', lastMileNo: 'LJ00006908-1', firstMileNo: 'LJ00006908-1', freight: 126.36, deliverySurcharge: null, warehouseFee: 8.5, operationFee: null },
  { businessNo: 'PF607701341755412480', lastMileNo: 'LJ00006904-2', firstMileNo: 'LJ00006904-2', freight: 143.07, deliverySurcharge: null, warehouseFee: null, operationFee: 12 },
  { businessNo: 'PF607701342111928320', lastMileNo: 'LJ00006905', firstMileNo: 'LJ00006905', freight: 340.41, deliverySurcharge: null, warehouseFee: 16, operationFee: null },
  { businessNo: 'PF607701342355197952', lastMileNo: '1051653540', firstMileNo: '1051653540', freight: 30.75, deliverySurcharge: 18, warehouseFee: null, operationFee: null },
  { businessNo: 'PF607701342648799232', lastMileNo: '1051653562', firstMileNo: '1051653562', freight: 85.35, deliverySurcharge: null, warehouseFee: null, operationFee: 10 },
  { businessNo: 'PF607701342871097344', lastMileNo: '1051653573', firstMileNo: '1051653573', freight: 50.7, deliverySurcharge: 18, warehouseFee: 8.5, operationFee: null },
  { businessNo: 'PF607701343030480896', lastMileNo: '1051653455', firstMileNo: '1051653455', freight: 9.23, deliverySurcharge: 18, warehouseFee: null, operationFee: null },
  { businessNo: 'PF607701343168892928', lastMileNo: '1051653466', firstMileNo: '1051653466', freight: 732.81, deliverySurcharge: null, warehouseFee: 22, operationFee: 16 },
  { businessNo: 'PF607701343277944832', lastMileNo: 'LJ00006911', firstMileNo: 'LJ00006911', freight: 22.82, deliverySurcharge: 18, warehouseFee: null, operationFee: null },
  { businessNo: 'PF607701343441522688', lastMileNo: '1051653514', firstMileNo: '1051653514', freight: 135.92, deliverySurcharge: 18, warehouseFee: 12, operationFee: null },
  { businessNo: 'PF607701343588323328', lastMileNo: '1051653536', firstMileNo: '1051653536', freight: 158.93, deliverySurcharge: null, warehouseFee: null, operationFee: 10 },
  { businessNo: 'PF607701343865147392', lastMileNo: 'LJ00006903', firstMileNo: 'LJ00006903', freight: 416.13, deliverySurcharge: null, warehouseFee: 8.5, operationFee: null },
  { businessNo: 'PF607701344225857536', lastMileNo: 'LJ00006898-1', firstMileNo: 'LJ00006898-1', freight: 618.8, deliverySurcharge: null, warehouseFee: null, operationFee: 18 },
  { businessNo: 'PF607701344624316416', lastMileNo: 'LJ00006910-2', firstMileNo: 'LJ00006910-2', freight: 134.81, deliverySurcharge: null, warehouseFee: 12, operationFee: null },
])
const filteredArOrderFeeRows = computed(() => arOrderFeeRows.value.filter((row) => !feeBusinessNo.value || row.businessNo.includes(feeBusinessNo.value.trim())))
const arVerticalFeeRows = computed(() => filteredArOrderFeeRows.value.flatMap((row) => [
  ['运费', row.freight], ['派送附加费', row.deliverySurcharge], ['仓储费', row.warehouseFee], ['操作费', row.operationFee],
].filter(([, amount]) => amount !== null).map(([fee, amount], index) => ({ feeNo: `FEE-${row.businessNo.slice(-8)}-${index + 1}`, businessNo: row.businessNo, lastMileNo: row.lastMileNo, fee, currency: 'CNY', amount }))))
const baseRefundable = computed(() => props.bill.baseRefundable ?? (props.bill.currency === 'CNY' ? props.bill.amount : props.bill.amount * 4.2))
const baseReturned = computed(() => props.bill.baseReturned ?? (props.bill.currency === 'CNY' ? props.bill.paid : props.bill.paid * 4.2))
const refundDetailRows = useDemoDataset('billingRefundDetails', [
  { billNo: 'PCB-OG0347-20260526', waybill: 'YT682941503GB', order: 'SO-260526-003952', signedAt: '2026/05/25 16:42', currency: 'TWD', original: 9780, deduction: 0, refundable: 9780, returned: 2101, pending: 7679, state: '部分核销' },
  { billNo: 'PCB-OG0370-20260721', waybill: 'YT682941566TW', order: 'SO-260721-004221', signedAt: '2026/07/21 11:08', currency: 'CNY', original: 91640, deduction: 3020, refundable: 88620, returned: 0, pending: 88620, state: '待核销' },
])
const deductionDetailRows = useDemoDataset('billingDeductionDetails', [
  { billNo: 'PCB-OG0370-20260721', feeNo: 'FEE-COD-20260721-001', fee: '代收货款手续费', order: 'SO-260721-004221', currency: 'CNY', amount: 3020, state: '已计入返款账单' },
])
const writeoffRows = useDemoDataset('billingWriteoffs', [
  { billNo: 'PCB-OG0347-20260526', no: 'WO-20260530-001', type: '返款核销', currency: 'TWD', amount: 2101, time: '2026/05/30 15:26', operator: '财务管理员' },
  { billNo: 'ARB-OG0360-20260601-81FF', no: 'WO-20260718-003', type: '应收核销', currency: 'CNY', amount: 8000, time: '2026/07/18 14:12', operator: '财务管理员' },
], 2)
const adjustmentRows = useDemoDataset('billingBillAdjustmentLinks', [
  { billNo: 'ARB-OG0370-20260707-81FF', no: 'ADJ-AR-260715-001', type: '应收调账', status: '审核通过', fee: '派送附加费', objectNo: 'PF607701342355197952', currency: 'CNY', delta: 18, adjustedAt: '2026/07/15 10:24' },
  { billNo: 'PCB-OG0370-20260721', no: 'ADJ-RF-260728-004', type: '返款调账', status: '待审核', fee: '代收服务费', objectNo: 'SO-260721-004221', currency: 'CNY', delta: -320, adjustedAt: '2026/07/28 16:02' },
])
const generationCandidateFees = useDemoDataset('billingGenerationCandidateFees', [
  { id: 'GF-AR-001', billType: 'AR', selected: true, fee: '派送附加费', businessNo: 'PF607701342355197952', sourceAt: '2026-08-02 08:42', currency: 'CNY', amount: 18, reason: '期末补录' },
  { id: 'GF-AR-002', billType: 'AR', selected: true, fee: '仓储费', businessNo: 'PF607701343168892928', sourceAt: '2026-08-02 09:15', currency: 'CNY', amount: 22, reason: '延迟同步' },
  { id: 'GF-AR-003', billType: 'AR', selected: false, fee: '操作费', businessNo: 'PF607701344225857536', sourceAt: '2026-08-02 09:32', currency: 'CNY', amount: 18, reason: '待财务确认' },
  { id: 'GF-RF-001', billType: 'RF', selected: true, fee: '应返货款', businessNo: 'SO-260721-004326', sourceAt: '2026-08-02 08:56', currency: 'CNY', amount: 1260, reason: '新增签收包裹' },
  { id: 'GF-RF-002', billType: 'RF', selected: true, fee: '代收服务费', businessNo: 'SO-260721-004326', sourceAt: '2026-08-02 08:56', currency: 'CNY', amount: -42, reason: '随包裹归集' },
])
const replacementOptions = useDemoDataset('billingReplacementOptions', [
  { billType: 'AR', value: 'ARB-OG0370-Scheme-1782960772-v11', label: 'V11 · 7天账期 · 新版费项币种规则', state: '待生效', effect: '2026-08-03 至长期' },
  { billType: 'AR', value: 'ARB-OG0370-Scheme-1782960772-v12', label: 'V12 · 周账期 · 台湾线路分支', state: '已生效', effect: '2026-08-01 至长期' },
  { billType: 'RF', value: 'RFB-OG0370-Scheme-1782960772-v5', label: 'V5 · 周账期 · 回款返款', state: '待生效', effect: '2026-08-03 至长期' },
  { billType: 'RF', value: 'RFB-OG0370-Scheme-1782960772-v6', label: 'V6 · 半周账期 · 签收返款', state: '已生效', effect: '2026-08-01 至长期' },
])
const replacementPreviewRows = useDemoDataset('billingReplacementPreview', [
  { billType: 'AR', side: 'OLD', billNo: 'ARB-OG0370-20260707-81FF', group: '默认业务板块 / 台湾', config: 'V10', currency: 'CNY', amount: 3096.09, feeCount: 14, state: '待审核 · 已收口' },
  { billType: 'AR', side: 'NEW', billNo: '候选-01', group: '默认业务板块 / 台湾', config: 'V11', currency: 'CNY', amount: 2984.09, feeCount: 13, state: '候选账单' },
  { billType: 'AR', side: 'NEW', billNo: '候选-02', group: '增值业务板块 / 台湾', config: 'V11', currency: 'CNY', amount: 130, feeCount: 2, state: '候选账单' },
  { billType: 'RF', side: 'OLD', billNo: 'PCB-OG0370-20260721', group: '台湾 / 周账期', config: 'V4', currency: 'CNY', amount: 88620, feeCount: 2, state: '待审核 · 未收口' },
  { billType: 'RF', side: 'NEW', billNo: '候选-01', group: '台湾 / 周账期', config: 'V5', currency: 'CNY', amount: 87360, feeCount: 3, state: '候选账单' },
])
const refundDetails = computed(() => refundDetailRows.value.filter((row) => row.billNo === props.bill.billNo))
const deductionDetails = computed(() => deductionDetailRows.value.filter((row) => row.billNo === props.bill.billNo))
const writeoffs = computed(() => writeoffRows.value.filter((row) => row.billNo === props.bill.billNo))
const adjustments = computed(() => adjustmentRows.value.filter((row) => row.billNo === props.bill.billNo))
const billType = computed(() => props.isReceivable ? 'AR' : 'RF')
const candidateFees = computed(() => generationCandidateFees.value.filter((row) => row.billType === billType.value))
const selectedCandidateFees = computed(() => candidateFees.value.filter((row) => row.selected))
const candidateAmount = computed(() => selectedCandidateFees.value.reduce((sum, row) => sum + row.amount, 0))
const availableReplacementOptions = computed(() => replacementOptions.value.filter((row) => row.billType === billType.value))
const generationConfigOptions = computed(() => [
  { value: 'CURRENT', label: `${currentConfigVersion.value} · 沿用当前账单配置`, state: '当前账单配置', effect: '保持现有口径' },
  ...availableReplacementOptions.value,
])
const selectedReplacementOption = computed(() => generationConfigOptions.value.find((row) => row.value === generationForm.newConfig))
const mayReplaceExistingBills = computed(() => generationForm.newConfig !== 'CURRENT')
const replacementOldRows = computed(() => replacementPreviewRows.value.filter((row) => row.billType === billType.value && row.side === 'OLD').map((row) => ({
  ...row,
  billNo: props.bill.billNo,
  group: props.isReceivable ? `${props.bill.sector} / ${props.bill.country}` : `${props.bill.country} / ${props.bill.periodType}账期`,
  config: currentConfigVersion.value,
  currency: props.bill.currency,
  amount: Number(props.bill.amount || 0),
})))
const replacementNewRows = computed(() => {
  const rows = replacementPreviewRows.value.filter((row) => row.billType === billType.value && row.side === 'NEW')
  const oldAmount = Number(props.bill.amount || 0)
  return rows.map((row, index) => ({
    ...row,
    config: selectedReplacementOption.value?.label.match(/^V\d+/)?.[0] || row.config,
    currency: props.bill.currency,
    amount: props.isReceivable ? (index === 0 ? Number((oldAmount * 0.96).toFixed(2)) : Number((oldAmount * 0.04 + 18).toFixed(2))) : Number(Math.max(oldAmount - 1260, 0).toFixed(2)),
  }))
})
const replacementOldAmount = computed(() => replacementOldRows.value.reduce((sum, row) => sum + row.amount, 0))
const replacementNewAmount = computed(() => replacementNewRows.value.reduce((sum, row) => sum + row.amount, 0))
const currentConfigLabel = computed(() => props.bill.configNo || `${props.isReceivable ? 'ARB' : 'RFB'}-${props.bill.customerNo}-Scheme`)
const currentConfigVersion = computed(() => props.bill.configVersion || (props.isReceivable ? 'V10' : 'V4'))
const currentResultVersion = computed(() => props.bill.resultVersion || 'RV-20260801-0018')

function openPreview(action) { previewAction.value = action; previewVisible.value = true }
function confirmPreview() { previewVisible.value = false; emit('action', previewAction.value) }
function openRateEditor() { editableRates.value = arRates.value.map((row) => ({ ...row })); rateEditorVisible.value = true }
function saveRates() { rateEditorVisible.value = false; emit('action', '保存账单特调汇率') }
function openGeneration() {
  generationStep.value = 0
  generationForm.reason = ''
  generationForm.dataCutoff = '2026-08-02 10:30:00'
  generationForm.switchAt = '2026-08-03 00:00:00'
  generationForm.newConfig = 'CURRENT'
  generationVisible.value = true
}
function nextGenerationStep() {
  if (generationStep.value === 0 && !generationForm.reason.trim()) return ElMessage.warning('请填写本次生成原因')
  if (generationStep.value === 0 && !generationForm.newConfig) return ElMessage.warning('请选择本次采用的账单配置')
  if (!mayReplaceExistingBills.value && generationStep.value === 1 && !selectedCandidateFees.value.length) return ElMessage.warning('至少选择一条待归集费项')
  generationStep.value += 1
}
function submitGenerationTask() {
  generationVisible.value = false
  emit('action', '创建账单生成任务')
}
</script>

<template>
  <div class="bill-detail-reference">
    <section class="bill-detail-overview">
      <div class="bill-detail-identity">
        <div class="bill-detail-title-line">
          <strong>{{ bill.billNo }}</strong>
          <StatusTag :label="bill.status" :tone="statusClass" />
          <StatusTag v-if="bill.processingState" :label="bill.processingState" tone="running" />
        </div>
        <div class="bill-detail-meta">
          <span class="period-chip">{{ bill.periodType }} <i></i> {{ bill.periodStart }} ~ {{ bill.periodEnd }}</span>
          <span>{{ bill.customer }}</span><i></i><span>{{ bill.memberCode || bill.customerNo }}</span><i></i><span>{{ bill.shop }}</span><template v-if="isReceivable"><i></i><span>{{ bill.sector }}</span></template><i></i><span>{{ bill.country }}</span>
          <i></i><span>账期收口：{{ bill.closeStatus }}</span>
        </div>
        <small v-if="!isReceivable" class="refund-mode-note">{{ bill.refundMode }}：{{ bill.refundMode === '回款返款' ? '先回收，后返还' : '先返还，后回收' }}</small>
      </div>
      <div class="bill-detail-actions">
        <template v-if="isReceivable">
          <el-button v-if="bill.status === '待审核' && bill.closeStatus === '已收口' && !bill.processingState" @click="emit('action', '审核通过')">审核通过</el-button>
          <el-button v-if="bill.status === '待审核' && !bill.processingState" @click="openGeneration">账单生成</el-button>
          <el-button v-if="!['已结清','已作废'].includes(bill.status) && !bill.processingState" @click="openPreview('账单重算')">账单重算</el-button>
          <el-button type="primary" plain :icon="Download" @click="emit('action', '导出账单')">导出账单</el-button>
        </template>
        <template v-else>
          <el-button v-if="bill.status === '待审核' && bill.closeStatus === '已收口' && !bill.processingState" @click="emit('action', '审核通过')">审核通过</el-button>
          <el-button v-if="bill.status === '待结清' && !bill.processingState" @click="emit('action', '退回待审核')">退回待审核</el-button>
          <el-button v-if="bill.status === '待审核' && !bill.processingState" @click="openGeneration">账单生成</el-button>
          <el-button v-if="!['已结清','已作废'].includes(bill.status) && !bill.processingState" @click="openPreview('账单重算')">账单重算</el-button>
          <el-button v-if="bill.status === '待结清' && !bill.processingState" @click="emit('action', '登记返还')">登记返还</el-button>
          <el-button @click="emit('action', '打开调账中心')">调账中心</el-button>
          <el-button type="primary" plain :icon="Download" @click="emit('action', '导出明细')">导出明细</el-button>
        </template>
      </div>
    </section>

    <section v-if="isReceivable" class="bill-money-section">
      <h3>费项结算币种金额</h3>
      <div class="currency-bucket-grid">
        <article v-for="bucket in arCurrencyBuckets" :key="bucket.currency" class="currency-bucket">
          <div class="currency-bucket-head"><strong>{{ bucket.currency }}</strong><StatusTag :label="bucket.state" :tone="bucket.state === '已核销' ? 'success' : 'neutral'" /></div>
          <dl><div><dt>应收金额</dt><dd>{{ money(bucket.due) }}</dd></div><div><dt>实收金额</dt><dd>{{ money(bucket.settled) }}</dd></div><div><dt>待收金额</dt><dd>{{ money(bucket.pending) }}</dd></div></dl>
          <el-button type="primary" plain :disabled="Boolean(bill.processingState)" @click="emit('action', `${bucket.currency}费用核销`)">费用核销</el-button>
        </article>
      </div>
    </section>

    <section v-else class="refund-money-grid">
      <article class="refund-money-panel">
        <div class="money-panel-heading"><h3>财务本位币金额</h3><small>按系统配置财务本位币（CNY）折算聚合</small></div>
        <div class="currency-bucket-head"><strong>CNY</strong></div>
        <dl class="money-metrics"><div><dt>应返金额</dt><dd>{{ money(baseRefundable) }}</dd></div><div><dt>已返金额</dt><dd>{{ money(baseReturned) }}</dd></div><div><dt>待返金额</dt><dd>{{ money(baseRefundable - baseReturned) }}</dd></div></dl>
      </article>
      <article class="refund-money-panel">
        <div class="money-panel-heading"><h3>货款结算币种金额</h3><small>按账单下所有返款币种维度汇总展示</small></div>
        <div class="currency-bucket-head"><strong>{{ bill.currency }}</strong><StatusTag label="待核销" tone="warning" /></div>
        <dl class="money-metrics five"><div><dt>原始货款金额</dt><dd>{{ money(bill.original) }}</dd></div><div><dt>扣除费项金额</dt><dd>{{ money(bill.deduction) }}</dd></div><div><dt>应返货款金额</dt><dd>{{ money(bill.amount) }}</dd></div><div><dt>已返货款金额</dt><dd>{{ money(bill.paid) }}</dd></div><div><dt>待返货款金额</dt><dd>{{ money(bill.amount - bill.paid) }}</dd></div></dl>
        <el-button type="primary" :disabled="Boolean(bill.processingState)" @click="emit('action', `${bill.currency}货款核销`)">核销</el-button>
      </article>
    </section>

    <el-tabs v-if="isReceivable" v-model="activeTab" class="bill-detail-tabs">
      <el-tab-pane label="账单汇率" name="rates">
        <div class="bill-detail-table-block"><h4>费项结算币种折算</h4><el-table :data="arRates" border><el-table-column prop="settlement" label="费项结算币种" /><el-table-column prop="target" label="财务本位币种" /><el-table-column prop="direction" label="汇兑方向" /><el-table-column prop="rate" label="锁定汇率" align="right" /></el-table></div>
        <div class="bill-detail-table-block"><h4>费项原始币种折算</h4><el-table :data="arRates" border><el-table-column prop="settlement" label="费项结算币种" /><el-table-column prop="target" label="费项原始币种" /><el-table-column prop="direction" label="汇兑方向" /><el-table-column prop="rate" label="锁定汇率" align="right" /></el-table></div>
        <el-button :icon="EditPen" :disabled="!['待审核'].includes(bill.status)" @click="openRateEditor">编辑特调汇率</el-button>
      </el-tab-pane>
      <el-tab-pane label="费用汇总" name="summary"><el-table :data="arFeeSummary" border><el-table-column prop="fee" label="费项" /><el-table-column prop="currency" label="结算币种" /><el-table-column label="应收金额" align="right"><template #default="scope">{{ money(scope.row.amount) }}</template></el-table-column><el-table-column label="已核销金额" align="right"><template #default="scope">{{ money(scope.row.written) }}</template></el-table-column><el-table-column label="待核销金额" align="right"><template #default="scope">{{ money(scope.row.pending) }}</template></el-table-column></el-table></el-tab-pane>
      <el-tab-pane label="费用明细" name="details">
        <div class="fee-detail-workbench">
          <div class="fee-detail-viewbar">
            <div class="fee-view-switch"><button :class="{ active: feeView === 'horizontal' }" @click="feeView = 'horizontal'">费项横表视图</button><button :class="{ active: feeView === 'vertical' }" @click="feeView = 'vertical'">费项纵表视图</button></div>
            <span class="fee-dimension-label">金额币种</span>
            <el-select v-model="feeAmountDimension" class="fee-amount-dimension"><el-option label="费项结算币种金额" value="settlement" /><el-option label="费项原始币种金额" value="original" /><el-option label="财务本位币金额" value="base" /></el-select>
            <el-button :class="{ active: showUnboundFees }" @click="showUnboundFees = !showUnboundFees">非业务订单下挂费项（0）</el-button>
            <el-button class="supplement-fee-button" type="primary" @click="emit('action', '补录费项')">补录费项</el-button>
          </div>
          <div class="fee-detail-query"><span>业务单号</span><el-input v-model="feeBusinessNo" placeholder="输入业务单号" clearable /><el-button type="primary" :icon="Search">查询</el-button></div>
          <el-table v-if="feeView === 'horizontal'" :data="filteredArOrderFeeRows" border class="fee-horizontal-table">
            <el-table-column prop="businessNo" label="业务单号" width="245" fixed />
            <el-table-column prop="lastMileNo" label="尾程运单号" width="215" />
            <el-table-column prop="firstMileNo" label="首程运单号" width="215" />
            <el-table-column label="运费" min-width="170" align="right"><template #default="scope">{{ scope.row.freight === null ? '-' : `${money(scope.row.freight)} CNY` }}</template></el-table-column>
            <el-table-column label="派送附加费" min-width="170" align="right"><template #default="scope">{{ scope.row.deliverySurcharge === null ? '-' : `${money(scope.row.deliverySurcharge)} CNY` }}</template></el-table-column>
            <el-table-column label="仓储费" min-width="150" align="right"><template #default="scope">{{ scope.row.warehouseFee === null ? '-' : `${money(scope.row.warehouseFee)} CNY` }}</template></el-table-column>
            <el-table-column label="操作费" min-width="150" align="right"><template #default="scope">{{ scope.row.operationFee === null ? '-' : `${money(scope.row.operationFee)} CNY` }}</template></el-table-column>
          </el-table>
          <el-table v-else :data="arVerticalFeeRows" border class="fee-vertical-table">
            <el-table-column prop="feeNo" label="费用编号" width="190" /><el-table-column prop="businessNo" label="业务单号" width="220" /><el-table-column prop="lastMileNo" label="尾程运单号" width="180" /><el-table-column prop="fee" label="费项" /><el-table-column prop="currency" label="币种" width="90" /><el-table-column label="结算金额" align="right"><template #default="scope">{{ money(scope.row.amount) }} {{ scope.row.currency }}</template></el-table-column>
          </el-table>
          <TablePagination
            class="fee-detail-pagination"
            :total="feeView === 'horizontal' ? filteredArOrderFeeRows.length : arVerticalFeeRows.length"
          />
        </div>
      </el-tab-pane>
      <el-tab-pane label="调账记录" name="adjustments"><el-table v-if="adjustments.length" :data="adjustments" border><el-table-column prop="no" label="调账单号" width="180" /><el-table-column prop="status" label="审核状态" /><el-table-column prop="fee" label="费项" /><el-table-column prop="objectNo" label="挂靠对象编号" width="220" /><el-table-column prop="currency" label="币种" /><el-table-column label="金额变幅" align="right"><template #default="scope">{{ money(scope.row.delta) }}</template></el-table-column><el-table-column prop="adjustedAt" label="调账时间" width="155" /></el-table><el-empty v-else description="暂无调账记录" /></el-tab-pane>
      <el-tab-pane label="核销记录" name="writeoffs"><el-table v-if="writeoffs.length" :data="writeoffs" border><el-table-column prop="no" label="核销编号" /><el-table-column prop="type" label="核销类型" /><el-table-column prop="currency" label="币种" /><el-table-column label="核销金额"><template #default="scope">{{ money(scope.row.amount) }}</template></el-table-column><el-table-column prop="time" label="核销时间" /><el-table-column prop="operator" label="操作人" /></el-table><el-empty v-else description="暂无核销记录" /></el-tab-pane>
    </el-tabs>

    <el-tabs v-else v-model="activeTab" class="bill-detail-tabs">
      <el-tab-pane label="账单信息" name="info"><dl class="bill-info-grid"><div><dt>账单编号</dt><dd>{{ bill.billNo }}</dd></div><div><dt>账单状态</dt><dd>{{ bill.status }}</dd></div><div><dt>账期收口状态</dt><dd>{{ bill.closeStatus }}</dd></div><div><dt>客户</dt><dd>{{ bill.customer }}</dd></div><div><dt>返款模式</dt><dd>{{ bill.refundMode }}</dd></div><div><dt>模式说明</dt><dd>{{ bill.refundMode }}：{{ bill.refundMode === '回款返款' ? '先回收，后返还' : '先返还，后回收' }}</dd></div><div><dt>账期类型</dt><dd>{{ bill.periodType }}</dd></div><div><dt>账期起始日</dt><dd>{{ bill.periodStart }}</dd></div><div><dt>账期结束日</dt><dd>{{ bill.periodEnd }}</dd></div></dl></el-tab-pane>
      <el-tab-pane label="账单汇率" name="rates"><el-table :data="[{ source: bill.currency, target: 'CNY', direction: `${bill.currency} → CNY`, rate: '4.200000', state: '已锁定' }]" border><el-table-column prop="source" label="货款结算币种" /><el-table-column prop="target" label="财务本位币种" /><el-table-column prop="direction" label="汇兑方向" /><el-table-column prop="rate" label="锁定汇率" /><el-table-column prop="state" label="状态" /></el-table></el-tab-pane>
      <el-tab-pane label="返款明细" name="refunds"><el-table :data="refundDetails" border><el-table-column prop="waybill" label="尾程运单号" width="150" /><el-table-column prop="order" label="所属内部订单" width="155" /><el-table-column prop="signedAt" label="签收时间" width="150" /><el-table-column label="原始货款"><template #default="scope">{{ money(scope.row.original) }} {{ scope.row.currency }}</template></el-table-column><el-table-column label="应返货款"><template #default="scope">{{ money(scope.row.refundable) }} {{ scope.row.currency }}</template></el-table-column><el-table-column label="已返货款"><template #default="scope">{{ money(scope.row.returned) }} {{ scope.row.currency }}</template></el-table-column><el-table-column label="待返货款"><template #default="scope">{{ money(scope.row.pending) }} {{ scope.row.currency }}</template></el-table-column><el-table-column prop="state" label="核销状态" /></el-table></el-tab-pane>
      <el-tab-pane label="扣减费项明细" name="deductions"><el-table v-if="deductionDetails.length" :data="deductionDetails" border><el-table-column prop="feeNo" label="费用编号" width="190" /><el-table-column prop="fee" label="扣减费项" /><el-table-column prop="order" label="业务订单号" /><el-table-column prop="currency" label="币种" /><el-table-column label="扣减金额"><template #default="scope">{{ money(scope.row.amount) }}</template></el-table-column><el-table-column prop="state" label="处理状态" /></el-table><el-empty v-else description="当前账单无扣减费项" /></el-tab-pane>
      <el-tab-pane label="关联调账" name="adjustments"><el-table v-if="adjustments.length" :data="adjustments" border><el-table-column prop="no" label="调账单号" width="180" /><el-table-column prop="status" label="审核状态" /><el-table-column prop="fee" label="费项" /><el-table-column prop="objectNo" label="挂靠对象编号" width="220" /><el-table-column prop="currency" label="币种" /><el-table-column label="金额变幅" align="right"><template #default="scope">{{ money(scope.row.delta) }}</template></el-table-column><el-table-column prop="adjustedAt" label="调账时间" width="155" /></el-table><el-empty v-else description="暂无关联调账" /></el-tab-pane>
      <el-tab-pane label="核销记录" name="writeoffs"><el-table :data="writeoffs" border><el-table-column prop="no" label="核销编号" /><el-table-column prop="type" label="核销类型" /><el-table-column prop="currency" label="币种" /><el-table-column label="核销金额"><template #default="scope">{{ money(scope.row.amount) }}</template></el-table-column><el-table-column prop="time" label="核销时间" /><el-table-column prop="operator" label="操作人" /></el-table></el-tab-pane>
    </el-tabs>

    <el-dialog v-model="generationVisible" title="账单生成" width="1040px" align-center append-to-body :close-on-click-modal="false" class="generation-dialog">
      <el-steps :active="generationStep" finish-status="success" align-center class="generation-steps">
        <el-step title="设置生成条件" />
        <el-step title="核对判定依据" />
        <el-step title="创建任务" />
      </el-steps>

      <section v-if="generationStep === 0" class="generation-step-panel">
        <div class="generation-mode-banner">
          <div><strong>系统执行时判定生成方式</strong><span>财务只需确认配置和数据范围；系统取得执行权后再判定首次生成、补充生成或替换生成。</span></div>
          <StatusTag label="实际方式待判定" tone="running" />
        </div>
        <dl class="generation-context-grid">
          <div><dt>目标账单</dt><dd>{{ bill.billNo }}</dd></div><div><dt>客户 / 账单类型</dt><dd>{{ bill.customer }} / {{ isReceivable ? '应收账单' : '返款账单' }}</dd></div>
          <div><dt>实际账期</dt><dd>{{ bill.periodStart }} 至 {{ bill.periodEnd }}</dd></div><div><dt>当前收口状态</dt><dd>{{ bill.closeStatus }}</dd></div>
          <div><dt>原配置</dt><dd>{{ currentConfigLabel }} · {{ currentConfigVersion }}</dd></div><div><dt>当前结果版本</dt><dd>{{ currentResultVersion }}</dd></div>
        </dl>
        <div v-if="mayReplaceExistingBills" class="generation-checks">
          <div><span class="check-mark">✓</span><strong>账单状态为待审核</strong><small>符合替换条件</small></div>
          <div><span class="check-mark">✓</span><strong>账单尚未发出</strong><small>发出时间为空</small></div>
          <div><span class="check-mark">✓</span><strong>不存在资金事实</strong><small>无核销、回款或返款</small></div>
          <div><span class="check-mark">✓</span><strong>范围未被其它任务占用</strong><small>允许创建替换批次</small></div>
        </div>
        <el-form label-position="top" class="generation-form-grid">
          <el-form-item label="本次采用的账单配置"><el-select v-model="generationForm.newConfig"><el-option v-for="item in generationConfigOptions" :key="item.value" :label="item.label" :value="item.value"><span>{{ item.label }}</span><small class="option-meta">{{ item.state }} · {{ item.effect }}</small></el-option></el-select></el-form-item>
          <el-form-item v-if="mayReplaceExistingBills" label="配置切换时点 T"><el-date-picker v-model="generationForm.switchAt" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" /></el-form-item>
          <el-form-item label="数据截止点"><el-date-picker v-model="generationForm.dataCutoff" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" /></el-form-item>
          <el-form-item label="生成原因" :class="{ 'span-2': !mayReplaceExistingBills }"><el-input v-model="generationForm.reason" type="textarea" :rows="2" placeholder="说明本次生成账单的原因" /></el-form-item>
        </el-form>
      </section>

      <section v-else-if="generationStep === 1 && !mayReplaceExistingBills" class="generation-step-panel">
        <el-alert title="系统执行时将根据是否已有可沿用的待审核账单，判定为首次生成或补充生成。" type="info" :closable="false" />
        <div class="generation-summary-row"><div><span>待选择费项</span><strong>{{ candidateFees.length }}</strong></div><div><span>已选择</span><strong>{{ selectedCandidateFees.length }}</strong></div><div><span>预计金额变化</span><strong>{{ money(candidateAmount) }} {{ bill.currency }}</strong></div><div><span>结果处理</span><strong>新增结果版本</strong></div></div>
        <el-table :data="candidateFees" border class="generation-table">
          <el-table-column label="纳入" width="64" align="center"><template #default="scope"><el-checkbox v-model="scope.row.selected" /></template></el-table-column>
          <el-table-column prop="fee" label="费项" width="150" /><el-table-column prop="businessNo" label="业务单号" min-width="220" /><el-table-column prop="sourceAt" label="进入费项池时间" width="160" /><el-table-column prop="reason" label="待补充原因" width="130" /><el-table-column prop="currency" label="币种" width="80" /><el-table-column label="金额" align="right" width="130"><template #default="scope">{{ money(scope.row.amount) }}</template></el-table-column>
        </el-table>
      </section>

      <section v-else-if="generationStep === 1" class="generation-step-panel">
        <el-alert title="新版配置可能改变账单范围或分组。系统执行时若不能沿用原账单，将判定为替换生成；候选账单在任务成功前不可见。" type="warning" :closable="false" />
        <div class="replacement-config-line"><span>原配置：<strong>{{ currentConfigVersion }}</strong></span><span>新版配置：<strong>{{ selectedReplacementOption?.label }}</strong></span><span>切换时点：<strong>{{ generationForm.switchAt }}</strong></span></div>
        <div class="replacement-columns">
          <div><h4>待替换账单集合</h4><el-table :data="replacementOldRows" border><el-table-column prop="billNo" label="原账单" min-width="210" /><el-table-column prop="group" label="分组范围" min-width="170" /><el-table-column prop="config" label="配置" width="80" /><el-table-column prop="feeCount" label="费项" width="70" /><el-table-column label="金额" width="130" align="right"><template #default="scope">{{ money(scope.row.amount) }} {{ scope.row.currency }}</template></el-table-column></el-table></div>
          <div><h4>候选新账单集合</h4><el-table :data="replacementNewRows" border><el-table-column prop="billNo" label="候选账单" min-width="120" /><el-table-column prop="group" label="新版拆单结果" min-width="170" /><el-table-column prop="config" label="配置" width="80" /><el-table-column prop="feeCount" label="费项" width="70" /><el-table-column label="金额" width="130" align="right"><template #default="scope">{{ money(scope.row.amount) }} {{ scope.row.currency }}</template></el-table-column></el-table></div>
        </div>
        <div class="generation-summary-row replacement-summary"><div><span>原账单数量</span><strong>{{ replacementOldRows.length }}</strong></div><div><span>候选账单数量</span><strong>{{ replacementNewRows.length }}</strong></div><div><span>原账单金额</span><strong>{{ money(replacementOldAmount) }}</strong></div><div><span>候选金额</span><strong>{{ money(replacementNewAmount) }}</strong></div><div><span>金额变化</span><strong>{{ money(replacementNewAmount - replacementOldAmount) }}</strong></div></div>
      </section>

      <section v-else class="generation-step-panel generation-confirm-panel">
        <div class="confirm-icon">✓</div><h3>任务信息已准备完成</h3>
        <p>提交后创建账单生成任务。账单生成方式将在任务取得执行权、检查现有账单和配置影响后确定。</p>
        <dl class="generation-context-grid confirm-grid"><div><dt>任务类型</dt><dd>账单生成</dd></div><div><dt>账单生成方式</dt><dd>待判定</dd></div><div><dt>数据截止点</dt><dd>{{ generationForm.dataCutoff }}</dd></div><div><dt>操作原因</dt><dd>{{ generationForm.reason }}</dd></div></dl>
        <el-alert v-if="mayReplaceExistingBills" title="若系统判定为替换生成，原账单将在候选账单集合整体成功后才作废并切换。" type="warning" :closable="false" />
      </section>

      <template #footer><el-button @click="generationVisible=false">取消</el-button><el-button v-if="generationStep > 0" @click="generationStep--">上一步</el-button><el-button v-if="generationStep < 2" type="primary" @click="nextGenerationStep">下一步</el-button><el-button v-else type="primary" @click="submitGenerationTask">创建任务</el-button></template>
    </el-dialog>

    <el-dialog v-model="previewVisible" :title="`${previewAction}预览`" width="720px" align-center append-to-body>
      <dl class="bill-info-grid"><div><dt>账单编号</dt><dd>{{ bill.billNo }}</dd></div><div><dt>客户</dt><dd>{{ bill.customer }}</dd></div><div><dt>当前账单状态</dt><dd>{{ bill.status }}</dd></div><div><dt>当前收口状态</dt><dd>{{ bill.closeStatus }}</dd></div><div><dt>影响范围</dt><dd>当前账单及其账期内已归属费项</dd></div><div><dt>处理结果</dt><dd>创建账单重算任务</dd></div></dl>
      <template #footer><el-button @click="previewVisible=false">取消</el-button><el-button type="primary" @click="confirmPreview">确认执行</el-button></template>
    </el-dialog>

    <el-dialog v-model="rateEditorVisible" title="编辑账单特调汇率" width="760px" align-center append-to-body>
      <el-alert title="仅修改当前待审核账单的锁定汇率，不回写汇率配置。" type="info" :closable="false" />
      <el-table :data="editableRates" border style="margin-top:var(--space-4)"><el-table-column prop="settlement" label="费项结算币种" /><el-table-column prop="target" label="财务本位币种" /><el-table-column prop="direction" label="汇兑方向" /><el-table-column label="锁定汇率"><template #default="scope"><el-input-number v-model="scope.row.rate" :precision="6" :step="0.000001" :min="0.000001" controls-position="right" /></template></el-table-column></el-table>
      <template #footer><el-button @click="rateEditorVisible=false">取消</el-button><el-button type="primary" @click="saveRates">保存特调汇率</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.generation-steps{margin:0 var(--space-6) var(--space-6)}.generation-step-panel{min-height:430px}.generation-mode-banner{display:flex;align-items:center;justify-content:space-between;padding:var(--space-4) var(--space-4);border-left:3px solid var(--primary);background:var(--primary-soft)}.generation-mode-banner div{display:flex;flex-direction:column;gap:5px}.generation-mode-banner strong{font-size: var(--font-size-lg);color:#17233d}.generation-mode-banner span{color:#637089}.generation-context-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin:var(--space-4) 0;border-top:1px solid #e1e6ef;border-left:1px solid #e1e6ef}.generation-context-grid div{min-height:72px;padding:var(--space-3) var(--space-3);border-right:1px solid #e1e6ef;border-bottom:1px solid #e1e6ef}.generation-context-grid dt{margin-bottom:var(--space-2);color:#7a8699;font-size: var(--font-size-sm)}.generation-context-grid dd{margin:0;color:#273247;font-weight: var(--font-weight-semibold);overflow-wrap:anywhere}.generation-checks{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:var(--space-4) 0}.generation-checks div{display:grid;grid-template-columns:24px 1fr;gap:2px 8px;padding:var(--space-3);border:1px solid #dfe6ee;background:#fbfcfd}.generation-checks .check-mark{grid-row:1/3;display:grid;place-items:center;width:22px;height:22px;background:#e8f7ef;color:#11875d;font-weight: var(--font-weight-bold)}.generation-checks strong{font-size: var(--font-size-body)}.generation-checks small{color:#7b8797}.generation-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px}.generation-form-grid :deep(.el-form-item.span-2){grid-column:span 2}.generation-form-grid :deep(.el-date-editor){width:100%}.option-meta{float:right;margin-left:var(--space-4);color:#8a95a6}.generation-summary-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin:var(--space-4) 0;border:1px solid #dfe5ee}.generation-summary-row div{padding:var(--space-3) var(--space-4);border-right:1px solid #dfe5ee}.generation-summary-row div:last-child{border-right:0}.generation-summary-row span{display:block;margin-bottom:var(--space-2);color:#7c8798;font-size: var(--font-size-sm)}.generation-summary-row strong{color:#17233d;font-size: var(--font-size-lg)}.generation-table{margin-top:var(--space-3)}.replacement-config-line{display:flex;gap:28px;margin:var(--space-4) 0;padding:var(--space-3) var(--space-4);background:#f6f8fb;color:#657187}.replacement-config-line strong{color:#273247}.replacement-columns{display:grid;grid-template-columns:1fr;gap:14px}.replacement-columns h4{margin:0 0 var(--space-2)}.replacement-summary{grid-template-columns:repeat(5,minmax(0,1fr))}.generation-confirm-panel{text-align:center;padding-top:var(--space-6)}.confirm-icon{display:grid;place-items:center;width:52px;height:52px;margin:0 auto var(--space-3);background:#e8f7ef;color:#14845e;font-size: var(--font-size-4xl);font-weight: var(--font-weight-bold)}.generation-confirm-panel h3{margin:0 0 var(--space-2);font-size: var(--font-size-2xl)}.generation-confirm-panel>p{margin:0 auto var(--space-5);color:#69758a}.confirm-grid{text-align:left}.generation-confirm-panel :deep(.el-alert){text-align:left}@media(max-width:900px){.generation-context-grid,.generation-checks{grid-template-columns:1fr 1fr}.generation-form-grid{grid-template-columns:1fr}.generation-form-grid :deep(.el-form-item.span-2){grid-column:auto}.replacement-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
