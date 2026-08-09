<script setup>
import { computed, ref, watch } from 'vue'
import { Download, EditPen, Search } from '@element-plus/icons-vue'
import BillGenerationDialog from './BillGenerationDialog.vue'
import DataTableFrame from '../../shared/components/DataTableFrame.vue'
import StatusTag from '../../shared/components/StatusTag.vue'
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
const generationDialog = ref(null)

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
const refundDetails = computed(() => refundDetailRows.value.filter((row) => row.billNo === props.bill.billNo))
const deductionDetails = computed(() => deductionDetailRows.value.filter((row) => row.billNo === props.bill.billNo))
const writeoffs = computed(() => writeoffRows.value.filter((row) => row.billNo === props.bill.billNo))
const adjustments = computed(() => adjustmentRows.value.filter((row) => row.billNo === props.bill.billNo))

function openPreview(action) { previewAction.value = action; previewVisible.value = true }
function confirmPreview() { previewVisible.value = false; emit('action', previewAction.value) }
function openRateEditor() { editableRates.value = arRates.value.map((row) => ({ ...row })); rateEditorVisible.value = true }
function saveRates() { rateEditorVisible.value = false; emit('action', '保存账单特调汇率') }
function openGeneration() { generationDialog.value?.open() }
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
       <div class="bill-detail-table-block"><h4>费项结算币种折算</h4><div class="table-reference-toolbar"><TableFieldSortButton /></div>
<DataTableFrame :total="arRates.length" :page-size="20" :toolbar="false"><el-table :data="arRates" border><el-table-column prop="settlement" label="费项结算币种" /><el-table-column prop="target" label="财务本位币种" /><el-table-column prop="direction" label="汇兑方向" /><el-table-column prop="rate" label="锁定汇率" align="right" /></el-table></DataTableFrame></div>
        <div class="bill-detail-table-block"><h4>费项原始币种折算</h4><div class="table-reference-toolbar"><TableFieldSortButton /></div>
<DataTableFrame :total="arRates.length" :page-size="20" :toolbar="false"><el-table :data="arRates" border><el-table-column prop="settlement" label="费项结算币种" /><el-table-column prop="target" label="费项原始币种" /><el-table-column prop="direction" label="汇兑方向" /><el-table-column prop="rate" label="锁定汇率" align="right" /></el-table></DataTableFrame></div>
        <el-button :icon="EditPen" :disabled="!['待审核'].includes(bill.status)" @click="openRateEditor">编辑特调汇率</el-button>
      </el-tab-pane>
      <el-tab-pane label="费用汇总" name="summary"><div class="table-reference-toolbar"><TableFieldSortButton /></div>
<DataTableFrame :total="arFeeSummary.length" :page-size="20" :toolbar="false"><el-table :data="arFeeSummary" border><el-table-column prop="fee" label="费项" /><el-table-column prop="currency" label="结算币种" /><el-table-column label="应收金额" align="right"><template #default="scope">{{ money(scope.row.amount) }}</template></el-table-column><el-table-column label="已核销金额" align="right"><template #default="scope">{{ money(scope.row.written) }}</template></el-table-column><el-table-column label="待核销金额" align="right"><template #default="scope">{{ money(scope.row.pending) }}</template></el-table-column></el-table></DataTableFrame></el-tab-pane>
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
          <div class="table-reference-toolbar"><TableFieldSortButton /></div>
          <DataTableFrame
            :total="feeView === 'horizontal' ? filteredArOrderFeeRows.length : arVerticalFeeRows.length"
            :toolbar="false"
          >
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
          </DataTableFrame>
        </div>
      </el-tab-pane>
     <el-tab-pane label="调账记录" name="adjustments"><div class="table-reference-toolbar"><TableFieldSortButton /></div>
<DataTableFrame v-if="adjustments.length" :total="adjustments.length" :page-size="20" :toolbar="false"><el-table :data="adjustments" border><el-table-column prop="no" label="调账单号" width="180" /><el-table-column prop="status" label="审核状态" /><el-table-column prop="fee" label="费项" /><el-table-column prop="objectNo" label="挂靠对象编号" width="220" /><el-table-column prop="currency" label="币种" /><el-table-column label="金额变幅" align="right"><template #default="scope">{{ money(scope.row.delta) }}</template></el-table-column><el-table-column prop="adjustedAt" label="调账时间" width="155" /></el-table></DataTableFrame><el-empty v-else description="暂无调账记录" /></el-tab-pane>
      <el-tab-pane label="核销记录" name="writeoffs"><div class="table-reference-toolbar"><TableFieldSortButton /></div>
<DataTableFrame v-if="writeoffs.length" :total="writeoffs.length" :page-size="20" :toolbar="false"><el-table :data="writeoffs" border><el-table-column prop="no" label="核销编号" /><el-table-column prop="type" label="核销类型" /><el-table-column prop="currency" label="币种" /><el-table-column label="核销金额"><template #default="scope">{{ money(scope.row.amount) }}</template></el-table-column><el-table-column prop="time" label="核销时间" /><el-table-column prop="operator" label="操作人" /></el-table></DataTableFrame><el-empty v-else description="暂无核销记录" /></el-tab-pane>
    </el-tabs>

    <el-tabs v-else v-model="activeTab" class="bill-detail-tabs">
      <el-tab-pane label="账单信息" name="info"><dl class="bill-info-grid"><div><dt>账单编号</dt><dd>{{ bill.billNo }}</dd></div><div><dt>账单状态</dt><dd>{{ bill.status }}</dd></div><div><dt>账期收口状态</dt><dd>{{ bill.closeStatus }}</dd></div><div><dt>客户</dt><dd>{{ bill.customer }}</dd></div><div><dt>返款模式</dt><dd>{{ bill.refundMode }}</dd></div><div><dt>模式说明</dt><dd>{{ bill.refundMode }}：{{ bill.refundMode === '回款返款' ? '先回收，后返还' : '先返还，后回收' }}</dd></div><div><dt>账期类型</dt><dd>{{ bill.periodType }}</dd></div><div><dt>账期起始日</dt><dd>{{ bill.periodStart }}</dd></div><div><dt>账期结束日</dt><dd>{{ bill.periodEnd }}</dd></div></dl></el-tab-pane>
      <el-tab-pane label="账单汇率" name="rates"><div class="table-reference-toolbar"><TableFieldSortButton /></div>
<DataTableFrame :total="1" :page-size="20" :toolbar="false"><el-table :data="[{ source: bill.currency, target: 'CNY', direction: `${bill.currency} → CNY`, rate: '4.200000', state: '已锁定' }]" border><el-table-column prop="source" label="货款结算币种" /><el-table-column prop="target" label="财务本位币种" /><el-table-column prop="direction" label="汇兑方向" /><el-table-column prop="rate" label="锁定汇率" /><el-table-column prop="state" label="状态" /></el-table></DataTableFrame></el-tab-pane>
      <el-tab-pane label="返款明细" name="refunds"><div class="table-reference-toolbar"><TableFieldSortButton /></div>
<DataTableFrame :total="refundDetails.length" :page-size="20" :toolbar="false"><el-table :data="refundDetails" border><el-table-column prop="waybill" label="尾程运单号" width="150" /><el-table-column prop="order" label="所属内部订单" width="155" /><el-table-column prop="signedAt" label="签收时间" width="150" /><el-table-column label="原始货款"><template #default="scope">{{ money(scope.row.original) }} {{ scope.row.currency }}</template></el-table-column><el-table-column label="应返货款"><template #default="scope">{{ money(scope.row.refundable) }} {{ scope.row.currency }}</template></el-table-column><el-table-column label="已返货款"><template #default="scope">{{ money(scope.row.returned) }} {{ scope.row.currency }}</template></el-table-column><el-table-column label="待返货款"><template #default="scope">{{ money(scope.row.pending) }} {{ scope.row.currency }}</template></el-table-column><el-table-column prop="state" label="核销状态" /></el-table></DataTableFrame></el-tab-pane>
      <el-tab-pane label="扣减费项明细" name="deductions"><div class="table-reference-toolbar"><TableFieldSortButton /></div>
<DataTableFrame v-if="deductionDetails.length" :total="deductionDetails.length" :page-size="20" :toolbar="false"><el-table :data="deductionDetails" border><el-table-column prop="feeNo" label="费用编号" width="190" /><el-table-column prop="fee" label="扣减费项" /><el-table-column prop="order" label="业务订单号" /><el-table-column prop="currency" label="币种" /><el-table-column label="扣减金额"><template #default="scope">{{ money(scope.row.amount) }}</template></el-table-column><el-table-column prop="state" label="处理状态" /></el-table></DataTableFrame><el-empty v-else description="当前账单无扣减费项" /></el-tab-pane>
      <el-tab-pane label="关联调账" name="adjustments"><div class="table-reference-toolbar"><TableFieldSortButton /></div>
<DataTableFrame v-if="adjustments.length" :total="adjustments.length" :page-size="20" :toolbar="false"><el-table :data="adjustments" border><el-table-column prop="no" label="调账单号" width="180" /><el-table-column prop="status" label="审核状态" /><el-table-column prop="fee" label="费项" /><el-table-column prop="objectNo" label="挂靠对象编号" width="220" /><el-table-column prop="currency" label="币种" /><el-table-column label="金额变幅" align="right"><template #default="scope">{{ money(scope.row.delta) }}</template></el-table-column><el-table-column prop="adjustedAt" label="调账时间" width="155" /></el-table></DataTableFrame><el-empty v-else description="暂无关联调账" /></el-tab-pane>
      <el-tab-pane label="核销记录" name="writeoffs"><div class="table-reference-toolbar"><TableFieldSortButton /></div>
<DataTableFrame :total="writeoffs.length" :page-size="20" :toolbar="false"><el-table :data="writeoffs" border><el-table-column prop="no" label="核销编号" /><el-table-column prop="type" label="核销类型" /><el-table-column prop="currency" label="币种" /><el-table-column label="核销金额"><template #default="scope">{{ money(scope.row.amount) }}</template></el-table-column><el-table-column prop="time" label="核销时间" /><el-table-column prop="operator" label="操作人" /></el-table></DataTableFrame></el-tab-pane>
    </el-tabs>

    <BillGenerationDialog ref="generationDialog" :bill="bill" :is-receivable="isReceivable" @submit="emit('action', '创建账单生成任务')" />

    <el-dialog v-model="previewVisible" :title="`${previewAction}预览`" width="720px" align-center append-to-body>
      <dl class="bill-info-grid"><div><dt>账单编号</dt><dd>{{ bill.billNo }}</dd></div><div><dt>客户</dt><dd>{{ bill.customer }}</dd></div><div><dt>当前账单状态</dt><dd>{{ bill.status }}</dd></div><div><dt>当前收口状态</dt><dd>{{ bill.closeStatus }}</dd></div><div><dt>影响范围</dt><dd>当前账单及其账期内已归属费项</dd></div><div><dt>处理结果</dt><dd>创建账单重算任务</dd></div></dl>
      <template #footer><el-button @click="previewVisible=false">取消</el-button><el-button type="primary" @click="confirmPreview">确认执行</el-button></template>
    </el-dialog>

    <el-dialog v-model="rateEditorVisible" title="编辑账单特调汇率" width="760px" align-center append-to-body>
      <el-alert title="仅修改当前待审核账单的锁定汇率，不回写汇率配置。" type="info" :closable="false" />
      <div class="table-reference-toolbar"><TableFieldSortButton /></div>
<DataTableFrame :total="editableRates.length" :page-size="20" :toolbar="false"><el-table :data="editableRates" border style="margin-top:var(--space-4)"><el-table-column prop="settlement" label="费项结算币种" /><el-table-column prop="target" label="财务本位币种" /><el-table-column prop="direction" label="汇兑方向" /><el-table-column label="锁定汇率"><template #default="scope"><el-input-number v-model="scope.row.rate" :precision="6" :step="0.000001" :min="0.000001" controls-position="right" /></template></el-table-column></el-table></DataTableFrame>
      <template #footer><el-button @click="rateEditorVisible=false">取消</el-button><el-button type="primary" @click="saveRates">保存特调汇率</el-button></template>
    </el-dialog>
  </div>
</template>
