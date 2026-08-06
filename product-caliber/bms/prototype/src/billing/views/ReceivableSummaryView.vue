<script setup>
import { computed, reactive, ref } from 'vue'
import { Download, Search, View } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import MetricGrid from '../components/MetricGrid.vue'
import ModuleToolbar from '../components/ModuleToolbar.vue'
import PageHeader from '../components/PageHeader.vue'
import SegmentedControl from '../components/SegmentedControl.vue'
import StackedCell from '../components/StackedCell.vue'
import StatusTag from '../components/StatusTag.vue'
import TablePagination from '../components/TablePagination.vue'

const activeTab = ref('supplyChain')
const detailVisible = ref(false)
const selectedSummary = ref(null)
const query = reactive({
  keyword: '',
  supplyChain: '',
  currency: 'CNY',
  overdue: '',
  period: [],
})

const records = [
  { supplyChain: '天马供应链', supplyChainCode: 'TM', customer: 'OceanGate Logistics', customerNo: 'OG4155', memberCode: 'M-700127', currency: 'CNY', receivable: 328640.82, received: 241800.00, outstanding: 86840.82, overdue: 31240.50, pendingReview: 18420.00, billCount: 12, outstandingBills: 4, oldestDue: '2026-07-18', lastBillAt: '2026-08-01' },
  { supplyChain: '天马供应链', supplyChainCode: 'TM', customer: 'TopKing Supply', customerNo: 'TK9012', memberCode: 'M-701006', currency: 'CNY', receivable: 186420.36, received: 135000.00, outstanding: 51420.36, overdue: 0, pendingReview: 12660.00, billCount: 8, outstandingBills: 3, oldestDue: '2026-08-12', lastBillAt: '2026-08-02' },
  { supplyChain: '天马供应链', supplyChainCode: 'TM', customer: 'NorthWind Cargo', customerNo: 'NW2048', memberCode: 'M-703880', currency: 'USD', receivable: 24680.75, received: 12200.00, outstanding: 12480.75, overdue: 3980.25, pendingReview: 2100.00, billCount: 7, outstandingBills: 3, oldestDue: '2026-07-25', lastBillAt: '2026-08-01' },
  { supplyChain: '华南供应链', supplyChainCode: 'HN', customer: 'Hualei Express', customerNo: 'HL2388', memberCode: 'M-238801', currency: 'CNY', receivable: 145320.18, received: 119500.00, outstanding: 25820.18, overdue: 6820.18, pendingReview: 0, billCount: 6, outstandingBills: 2, oldestDue: '2026-07-28', lastBillAt: '2026-07-31' },
  { supplyChain: '华东供应链', supplyChainCode: 'HD', customer: 'Sunrise Parcel', customerNo: 'SR6018', memberCode: 'M-480221', currency: 'CNY', receivable: 93680.44, received: 93680.44, outstanding: 0, overdue: 0, pendingReview: 8400.00, billCount: 5, outstandingBills: 0, oldestDue: '-', lastBillAt: '2026-07-30' },
  { supplyChain: '天马供应链', supplyChainCode: 'TM', customer: 'OceanGate Logistics', customerNo: 'OG4155', memberCode: 'M-700127', currency: 'USD', receivable: 19640.00, received: 15400.00, outstanding: 4240.00, overdue: 0, pendingReview: 0, billCount: 3, outstandingBills: 1, oldestDue: '2026-08-15', lastBillAt: '2026-07-29' },
]

const money = (value, currency = query.currency) => `${Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
const matches = (row) => {
  const keyword = query.keyword.trim().toLowerCase()
  const text = `${row.supplyChain}${row.supplyChainCode}${row.customer}${row.customerNo}${row.memberCode}`.toLowerCase()
  const [periodStart, periodEnd] = query.period || []
  const lastBillDate = new Date(`${row.lastBillAt}T00:00:00`)
  return (!keyword || text.includes(keyword))
    && (!query.supplyChain || row.supplyChain === query.supplyChain)
    && (!query.currency || row.currency === query.currency)
    && (!query.overdue || (query.overdue === '逾期' ? row.overdue > 0 : row.outstanding > 0 && row.overdue === 0))
    && (!periodStart || lastBillDate >= periodStart)
    && (!periodEnd || lastBillDate <= periodEnd)
}

const filteredRecords = computed(() => records.filter(matches))
const aggregate = (items, key, value) => {
  const groups = new Map()
  items.forEach((row) => {
    const groupKey = row[key]
    const current = groups.get(groupKey) || { ...row, customerCount: 0, receivable: 0, received: 0, outstanding: 0, overdue: 0, pendingReview: 0, billCount: 0, outstandingBills: 0 }
    current.receivable += row.receivable
    current.received += row.received
    current.outstanding += row.outstanding
    current.overdue += row.overdue
    current.pendingReview += row.pendingReview
    current.billCount += row.billCount
    current.outstandingBills += row.outstandingBills
    current.customerCount += 1
    if (current.oldestDue === '-' || (row.oldestDue !== '-' && row.oldestDue < current.oldestDue)) current.oldestDue = row.oldestDue
    groups.set(groupKey, current)
  })
  return [...groups.values()].map((row) => ({ ...row, groupValue: value(row) }))
}
const supplyChainRows = computed(() => aggregate(filteredRecords.value, 'supplyChain', (row) => row.supplyChain))
const customerRows = computed(() => aggregate(filteredRecords.value, 'customerNo', (row) => row.customer))
const currentRows = computed(() => activeTab.value === 'supplyChain' ? supplyChainRows.value : customerRows.value)
const totals = computed(() => filteredRecords.value.reduce((sum, row) => ({
  receivable: sum.receivable + row.receivable,
  received: sum.received + row.received,
  outstanding: sum.outstanding + row.outstanding,
  overdue: sum.overdue + row.overdue,
}), { receivable: 0, received: 0, outstanding: 0, overdue: 0 }))
const kpis = computed(() => [
  { label: '应收金额', value: money(totals.value.receivable), tone: 'blue', extra: '有效应收账单' },
  { label: '已收金额', value: money(totals.value.received), tone: 'green', extra: '有效核销金额' },
  { label: '应收未收', value: money(totals.value.outstanding), tone: 'amber', extra: '按账单结果汇总' },
  { label: '逾期未收', value: money(totals.value.overdue), tone: 'red', extra: '已超过信用期' },
])
const supplyChains = [...new Set(records.map((row) => row.supplyChain))]

function drillSupplyChain(row) {
  query.supplyChain = row.supplyChain
  activeTab.value = 'customer'
}
function openDetail(row) {
  selectedSummary.value = row
  detailVisible.value = true
}
function resetQuery() {
  Object.assign(query, { keyword: '', supplyChain: '', currency: 'CNY', overdue: '', period: [] })
}
</script>

<template>
  <div class="module-page receivable-summary-page">
    <PageHeader title="营收总览" description="按供应链和客户查看应收、已收、未收及逾期金额">
      <template #actions><el-button :icon="Download" @click="ElMessage.success('总表导出任务已创建')">导出总表</el-button></template>
    </PageHeader>

    <section class="module-panel query-panel receivable-summary-query">
      <el-form label-position="top" class="reference-query-grid five">
        <el-form-item label="供应链"><el-select v-model="query.supplyChain" placeholder="全部供应链" clearable><el-option v-for="item in supplyChains" :key="item" :label="item" :value="item" /></el-select></el-form-item>
        <el-form-item label="客户"><el-input v-model="query.keyword" :prefix-icon="Search" placeholder="名称 / 编号 / 会员编码" clearable /></el-form-item>
        <el-form-item label="结算币种"><el-select v-model="query.currency"><el-option v-for="item in ['CNY','USD']" :key="item" :label="item" :value="item" /></el-select></el-form-item>
        <el-form-item label="未收状态"><el-select v-model="query.overdue" placeholder="全部未收状态" clearable><el-option label="逾期" value="逾期" /><el-option label="未逾期" value="未逾期" /></el-select></el-form-item>
        <el-form-item label="账期范围"><el-date-picker v-model="query.period" type="daterange" start-placeholder="开始日期" end-placeholder="结束日期" /></el-form-item>
      </el-form>
      <div class="query-actions"><el-button @click="resetQuery">重置</el-button><el-button type="primary" :icon="Search">查询</el-button></div>
    </section>

    <MetricGrid :items="kpis" />
    <SegmentedControl v-model="activeTab" :options="[{ label: '供应链汇总', value: 'supplyChain' }, { label: '客户汇总', value: 'customer' }]" aria-label="总表维度" />

    <section class="module-panel">
      <ModuleToolbar :result-text="`${currentRows.length} 条汇总记录`">
        <template #actions><span class="summary-currency-note">金额币种：{{ query.currency }}</span></template>
      </ModuleToolbar>
      <el-table :data="currentRows" class="clean-table" row-key="groupValue" border>
        <template v-if="activeTab === 'supplyChain'">
          <el-table-column label="供应链" min-width="190" fixed><template #default="scope"><StackedCell :primary="scope.row.supplyChain" :secondary="scope.row.supplyChainCode" /></template></el-table-column>
          <el-table-column prop="customerCount" label="客户数" width="90" />
        </template>
        <template v-else>
          <el-table-column label="客户" min-width="210" fixed><template #default="scope"><StackedCell :primary="scope.row.customer" :secondary="`${scope.row.customerNo} / ${scope.row.memberCode}`" /></template></el-table-column>
          <el-table-column prop="supplyChain" label="供应链" width="150" />
        </template>
        <el-table-column prop="currency" label="结算币种" width="92" />
        <el-table-column label="应收金额" min-width="138" align="right"><template #default="scope">{{ money(scope.row.receivable, scope.row.currency) }}</template></el-table-column>
        <el-table-column label="已收金额" min-width="138" align="right"><template #default="scope">{{ money(scope.row.received, scope.row.currency) }}</template></el-table-column>
        <el-table-column label="应收未收" min-width="138" align="right"><template #default="scope"><strong class="outstanding-amount">{{ money(scope.row.outstanding, scope.row.currency) }}</strong></template></el-table-column>
        <el-table-column label="逾期未收" min-width="138" align="right"><template #default="scope"><span :class="{ 'overdue-amount': scope.row.overdue > 0 }">{{ money(scope.row.overdue, scope.row.currency) }}</span></template></el-table-column>
        <el-table-column label="待审核金额" min-width="138" align="right"><template #default="scope">{{ money(scope.row.pendingReview, scope.row.currency) }}</template></el-table-column>
        <el-table-column prop="billCount" label="账单数" width="86" />
        <el-table-column prop="outstandingBills" label="未结账单" width="96" />
        <el-table-column prop="oldestDue" label="最早到期日" width="115" />
        <el-table-column label="状态" width="86"><template #default="scope"><StatusTag :label="scope.row.overdue > 0 ? '有逾期' : scope.row.outstanding > 0 ? '待回款' : '已收清'" /></template></el-table-column>
        <el-table-column label="操作" width="98" fixed="right"><template #default="scope"><el-button v-if="activeTab === 'supplyChain'" link type="primary" @click="drillSupplyChain(scope.row)">看客户</el-button><el-button v-else class="table-detail-button" link type="primary" :icon="View" title="查看账单" aria-label="查看账单" @click="openDetail(scope.row)" /></template></el-table-column>
      </el-table>
      <TablePagination :total="currentRows.length" :page-size="10" layout="prev, pager, next" :summary="`展示 1-${currentRows.length} 条`" />
    </section>

    <el-drawer v-model="detailVisible" title="客户应收账单" class="module-drawer" destroy-on-close>
      <div v-if="selectedSummary" class="drawer-summary"><div><StatusTag :label="selectedSummary.overdue > 0 ? '有逾期' : '待回款'" /><span>{{ selectedSummary.customer }}</span></div><strong>{{ money(selectedSummary.outstanding, selectedSummary.currency) }}</strong></div>
      <dl v-if="selectedSummary" class="inline-detail-grid">
        <div><dt>客户编号</dt><dd>{{ selectedSummary.customerNo }}</dd></div><div><dt>会员编码</dt><dd>{{ selectedSummary.memberCode }}</dd></div><div><dt>供应链</dt><dd>{{ selectedSummary.supplyChain }}</dd></div><div><dt>结算币种</dt><dd>{{ selectedSummary.currency }}</dd></div>
        <div><dt>应收金额</dt><dd>{{ money(selectedSummary.receivable, selectedSummary.currency) }}</dd></div><div><dt>已收金额</dt><dd>{{ money(selectedSummary.received, selectedSummary.currency) }}</dd></div><div><dt>未结账单</dt><dd>{{ selectedSummary.outstandingBills }}</dd></div><div><dt>最早到期日</dt><dd>{{ selectedSummary.oldestDue }}</dd></div>
      </dl>
      <el-table v-if="selectedSummary" :data="[
        { no: 'ARB-20260721-OG4155-a3f1', period: '2026/07/21 - 2026/07/27', due: selectedSummary.oldestDue, amount: selectedSummary.outstanding * 0.62, status: selectedSummary.overdue > 0 ? '已逾期' : '待回款' },
        { no: 'ARB-20260728-OG4155-f892', period: '2026/07/28 - 2026/08/03', due: '2026-08-18', amount: selectedSummary.outstanding * 0.38, status: '待回款' },
      ]" border class="clean-table summary-bill-table">
        <el-table-column prop="no" label="应收账单编号" min-width="210" /><el-table-column prop="period" label="账期" min-width="180" /><el-table-column prop="due" label="到期日" width="115" /><el-table-column label="未收金额" min-width="140" align="right"><template #default="scope">{{ money(scope.row.amount, selectedSummary.currency) }}</template></el-table-column><el-table-column label="状态" width="90"><template #default="scope"><StatusTag :label="scope.row.status" /></template></el-table-column>
      </el-table>
    </el-drawer>
  </div>
</template>

<style scoped>
.receivable-summary-page { display: flex; flex-direction: column; gap: 12px; }
.receivable-summary-page :deep(.module-heading), .receivable-summary-page :deep(.module-kpis), .receivable-summary-page :deep(.module-segmented) { margin-bottom: 0; }
.receivable-summary-query { overflow: visible; }
.summary-currency-note { color: #6f7a8c; font-size: var(--font-size-sm); }
.outstanding-amount { color: #9a611a; font-variant-numeric: tabular-nums; }
.overdue-amount { color: #b6424d; font-weight: var(--font-weight-semibold); }
.summary-bill-table { margin-top: var(--space-4); }
</style>
