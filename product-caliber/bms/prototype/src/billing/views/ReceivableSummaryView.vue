<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { ArrowDown, CircleClose, Download, Search, View } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import MetricGrid from '../components/MetricGrid.vue'
import PageHeader from '../components/PageHeader.vue'
import StackedCell from '../components/StackedCell.vue'
import StatusTag from '../components/StatusTag.vue'
import TablePagination from '../components/TablePagination.vue'
import { useDemoDataset } from '../data/useDemoDataset.js'

const detailVisible = ref(false)
const selectedSummary = ref(null)
const customerPanelVisible = ref(false)
const customerReferenceRef = ref(null)
const periodPickerRef = ref(null)
const customerSearch = ref('')
const query = reactive({
  shop: '',
  customerNo: '',
  currency: '',
  overdue: '',
  period: [],
})

const records = useDemoDataset('receivableSummaryRecords', [
  { id: 'SZ-OG4155-CNY', shop: '深圳集运店', shopCode: 'SZ-CONSOL', customer: 'OceanGate Logistics', customerNo: 'OG4155', memberCode: 'M-700127', currency: 'CNY', receivable: 228640.82, received: 171800.00, outstanding: 56840.82, overdue: 21240.50, pendingReview: 12420.00, billCount: 8, outstandingBills: 3, oldestDue: '2026-07-18', lastBillAt: '2026-08-01' },
  { id: 'SZ-FL3088-CNY', shop: '深圳集运店', shopCode: 'SZ-CONSOL', customer: 'FastLine UK', customerNo: 'FL3088', memberCode: 'M-308801', currency: 'CNY', receivable: 100000.00, received: 70000.00, outstanding: 30000.00, overdue: 10000.00, pendingReview: 6000.00, billCount: 4, outstandingBills: 1, oldestDue: '2026-07-20', lastBillAt: '2026-07-31' },
  { id: 'YW-TK9012-CNY', shop: '义乌集运店', shopCode: 'YW-CONSOL', customer: 'TopKing Supply', customerNo: 'TK9012', memberCode: 'M-701006', currency: 'CNY', receivable: 126420.36, received: 95000.00, outstanding: 31420.36, overdue: 0, pendingReview: 8660.00, billCount: 5, outstandingBills: 2, oldestDue: '2026-08-12', lastBillAt: '2026-08-02' },
  { id: 'YW-EB6026-CNY', shop: '义乌集运店', shopCode: 'YW-CONSOL', customer: 'EastBridge Commerce', customerNo: 'EB6026', memberCode: 'M-602601', currency: 'CNY', receivable: 60000.00, received: 40000.00, outstanding: 20000.00, overdue: 0, pendingReview: 4000.00, billCount: 3, outstandingBills: 1, oldestDue: '2026-08-18', lastBillAt: '2026-08-01' },
  { id: 'GZ-HL2388-CNY', shop: '广州同行店', shopCode: 'GZ-PEER', customer: 'Hualei Express', customerNo: 'HL2388', memberCode: 'M-238801', currency: 'CNY', receivable: 145320.18, received: 119500.00, outstanding: 25820.18, overdue: 6820.18, pendingReview: 0, billCount: 6, outstandingBills: 2, oldestDue: '2026-07-28', lastBillAt: '2026-07-31' },
  { id: 'SH-SR6018-CNY', shop: '上海集运店', shopCode: 'SH-CONSOL', customer: 'Sunrise Parcel', customerNo: 'SR6018', memberCode: 'M-480221', currency: 'CNY', receivable: 93680.44, received: 93680.44, outstanding: 0, overdue: 0, pendingReview: 8400.00, billCount: 5, outstandingBills: 0, oldestDue: '-', lastBillAt: '2026-07-30' },
  { id: 'SH-NW2048-USD', shop: '上海集运店', shopCode: 'SH-CONSOL', customer: 'NorthWind Cargo', customerNo: 'NW2048', memberCode: 'M-703880', currency: 'USD', receivable: 24680.75, received: 12200.00, outstanding: 12480.75, overdue: 3980.25, pendingReview: 2100.00, billCount: 7, outstandingBills: 3, oldestDue: '2026-07-25', lastBillAt: '2026-08-01' },
  { id: 'SZ-OG4155-USD', shop: '深圳集运店', shopCode: 'SZ-CONSOL', customer: 'OceanGate Logistics', customerNo: 'OG4155', memberCode: 'M-700127', currency: 'USD', receivable: 19640.00, received: 15400.00, outstanding: 4240.00, overdue: 0, pendingReview: 0, billCount: 3, outstandingBills: 1, oldestDue: '2026-08-15', lastBillAt: '2026-07-29' },
], 1)

const money = (value, currency = query.currency) => `${Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
const shops = computed(() => [...new Set(records.value.map((row) => row.shop))])
const customers = computed(() => [...new Map(records.value.map((row) => [row.customerNo, {
  value: row.customerNo,
  customer: row.customer,
  customerNo: row.customerNo,
  memberCode: row.memberCode,
}])).values()])
const selectedCustomer = computed(() => customers.value.find((item) => item.value === query.customerNo))
const selectedShopLabel = computed(() => query.shop || '请选择')
const selectedCustomerLabel = computed(() => selectedCustomer.value?.customer || query.customerNo || '请选择')
const dateFormatter = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
const periodLabel = computed(() => query.period?.length === 2
  ? `${dateFormatter.format(query.period[0])} - ${dateFormatter.format(query.period[1])}`
  : '请选择')
const filterMeasureContext = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
const measureFilterText = (text, weight) => {
  if (!filterMeasureContext || !document.body) return String(text).length * 7
  const bodyStyle = getComputedStyle(document.body)
  filterMeasureContext.font = `${weight} ${bodyStyle.fontSize} ${bodyStyle.fontFamily}`
  return filterMeasureContext.measureText(String(text)).width
}
const filterContentWidth = (label, value, selected = false) => {
  const textWidth = measureFilterText(label, 400) + measureFilterText(value, selected ? 600 : 400)
  return { '--filter-content-width': `${Math.ceil(textWidth + 60)}px` }
}
const filteredCustomers = computed(() => {
  const keyword = customerSearch.value.trim().toLowerCase()
  if (!keyword) return customers.value
  return customers.value.filter((item) => `${item.customer}${item.customerNo}${item.memberCode}`.toLowerCase().includes(keyword))
})

const filteredRecords = computed(() => records.value.filter((row) => {
  const [periodStart, periodEnd] = query.period || []
  const lastBillDate = new Date(`${row.lastBillAt}T00:00:00`)
  const customerKeyword = query.customerNo.trim().toLowerCase()
  const matchesCustomer = !customerKeyword
    || (selectedCustomer.value
      ? row.customerNo === query.customerNo
      : `${row.customer}${row.customerNo}${row.memberCode}`.toLowerCase().includes(customerKeyword))
  return (!query.shop || row.shop === query.shop)
    && matchesCustomer
    && (!query.currency || row.currency === query.currency)
    && (!query.overdue || (query.overdue === '逾期' ? row.overdue > 0 : row.outstanding > 0 && row.overdue === 0))
    && (!periodStart || lastBillDate >= periodStart)
    && (!periodEnd || lastBillDate <= periodEnd)
}))

const sumBy = (items, key) => items.reduce((total, row) => total + Number(row[key] || 0), 0)
const summaryStatus = (row) => row.overdue > 0 ? '有逾期' : row.outstanding > 0 ? '待回款' : '已收清'

const totals = computed(() => ({
  receivable: sumBy(filteredRecords.value, 'receivable'),
  received: sumBy(filteredRecords.value, 'received'),
  outstanding: sumBy(filteredRecords.value, 'outstanding'),
  overdue: sumBy(filteredRecords.value, 'overdue'),
}))
const kpis = computed(() => {
  if (!query.currency) return [
    { label: '应收金额', value: '--', tone: 'blue' },
    { label: '已收金额', value: '--', tone: 'green' },
    { label: '应收未收', value: '--', tone: 'amber' },
    { label: '逾期未收', value: '--', tone: 'red' },
  ]
  return [
    { label: '应收金额', value: money(totals.value.receivable), tone: 'blue' },
    { label: '已收金额', value: money(totals.value.received), tone: 'green' },
    { label: '应收未收', value: money(totals.value.outstanding), tone: 'amber' },
    { label: '逾期未收', value: money(totals.value.overdue), tone: 'red' },
  ]
})

function openDetail(row) {
  selectedSummary.value = row
  detailVisible.value = true
}
function selectCustomer(value) {
  query.customerNo = value
  customerPanelVisible.value = false
  customerSearch.value = ''
}
async function applyCustomerSearch(event) {
  if (event?.isComposing) return
  const value = customerSearch.value.trim()
  if (!value) return
  query.customerNo = value
  customerPanelVisible.value = false
  customerSearch.value = ''
  event?.target?.blur()
  await nextTick()
  customerReferenceRef.value?.blur()
  window.getSelection()?.removeAllRanges()
}
function clearCustomer() {
  query.customerNo = ''
  customerSearch.value = ''
}
function clearPeriod() {
  query.period = []
  periodPickerRef.value?.handleClose()
}
function openPeriodPicker() {
  periodPickerRef.value?.handleOpen()
}
function closePeriodPicker() {
  periodPickerRef.value?.handleClose()
}
function resetFilters() {
  Object.assign(query, { shop: '', customerNo: '', currency: '', overdue: '', period: [] })
  customerSearch.value = ''
  closePeriodPicker()
}
</script>

<template>
  <div class="module-page receivable-summary-page">
    <PageHeader eyebrow="" title="营收总览">
      <template #actions>
        <el-button :icon="Download" @click="ElMessage.success('导出任务已创建')">导出</el-button>
      </template>
    </PageHeader>

    <div class="summary-dimension-heading"><strong>店铺</strong></div>
    <div class="summary-scope-row">
      <div class="filter-token shop-filter-token adaptive-filter-width" :class="{ active: query.shop }" :style="filterContentWidth('店铺', selectedShopLabel, Boolean(query.shop))">
        <span class="filter-token-label">店铺</span>
        <el-select v-model="query.shop" class="summary-shop-select" placeholder="请选择" clearable aria-label="店铺范围">
          <el-option v-for="item in shops" :key="item" :label="item" :value="item" />
        </el-select>
      </div>
    </div>
    <MetricGrid :items="kpis" />

    <div class="summary-dimension-heading customer-dimension-heading"><strong>客户</strong></div>

    <section class="module-panel query-panel receivable-summary-query">
      <div class="inline-filter-bar">
        <div class="filter-token customer-filter-token adaptive-filter-width" :class="{ active: query.customerNo }" :style="filterContentWidth('客户', selectedCustomerLabel, Boolean(query.customerNo))">
          <span class="filter-token-label">客户</span>
          <el-popover v-model:visible="customerPanelVisible" placement="bottom-start" :width="360" trigger="click">
            <template #reference>
              <div ref="customerReferenceRef" class="customer-filter-reference" role="button" tabindex="0" aria-label="客户筛选" @keydown.enter.space.prevent="customerPanelVisible = !customerPanelVisible">
                <span class="customer-filter-value">{{ selectedCustomerLabel }}</span>
                <el-icon v-if="query.customerNo" class="filter-token-clear" role="button" tabindex="0" aria-label="清除客户" title="清除客户" @click.stop="clearCustomer" @keydown.enter.space.stop.prevent="clearCustomer"><CircleClose /></el-icon>
                <el-icon v-else class="filter-token-arrow"><ArrowDown /></el-icon>
              </div>
            </template>
            <div class="customer-filter-panel">
              <el-input v-model="customerSearch" :prefix-icon="Search" placeholder="搜索名称 / 客户编号 / 会员编码" clearable @keyup.enter.stop="applyCustomerSearch" />
              <div class="customer-filter-options">
                <button v-for="item in filteredCustomers" :key="item.value" type="button" :class="{ active: query.customerNo === item.value }" @click="selectCustomer(item.value)">
                  <strong>{{ item.customer }}</strong>
                  <small>{{ item.customerNo }} / {{ item.memberCode }}</small>
                </button>
                <div v-if="!filteredCustomers.length" class="customer-filter-empty">未找到匹配客户</div>
              </div>
            </div>
          </el-popover>
        </div>
        <div class="filter-token currency-filter-token adaptive-filter-width" :class="{ active: query.currency }" :style="filterContentWidth('结算币种', query.currency || '请选择', Boolean(query.currency))">
          <span class="filter-token-label">结算币种</span>
          <el-select v-model="query.currency" placeholder="请选择" clearable aria-label="结算币种">
            <el-option v-for="item in ['CNY','USD']" :key="item" :label="item" :value="item" />
          </el-select>
        </div>
        <div class="filter-token status-filter-token adaptive-filter-width" :class="{ active: query.overdue }" :style="filterContentWidth('未收状态', query.overdue || '请选择', Boolean(query.overdue))">
          <span class="filter-token-label">未收状态</span>
          <el-select v-model="query.overdue" placeholder="请选择" clearable aria-label="未收状态">
            <el-option label="逾期" value="逾期" />
            <el-option label="未逾期" value="未逾期" />
          </el-select>
        </div>
        <div class="filter-token period-filter-token adaptive-filter-width" :class="{ active: query.period?.length }" :style="filterContentWidth('账期范围', periodLabel, Boolean(query.period?.length))">
          <span class="filter-token-label">账期范围</span>
          <div class="period-filter-reference" role="button" tabindex="0" aria-label="账期范围" @click="openPeriodPicker" @keydown.enter.space.prevent="openPeriodPicker">
            <span class="period-filter-value">{{ periodLabel }}</span>
            <el-icon v-if="query.period?.length" class="filter-token-clear" role="button" tabindex="0" aria-label="清除账期范围" title="清除账期范围" @click.stop="clearPeriod" @keydown.enter.space.stop.prevent="clearPeriod"><CircleClose /></el-icon>
            <el-icon v-else class="filter-token-arrow"><ArrowDown /></el-icon>
          </div>
          <el-date-picker ref="periodPickerRef" v-model="query.period" class="period-picker-anchor" type="daterange" :editable="false" tabindex="-1" aria-hidden="true" @change="closePeriodPicker" />
        </div>
        <div class="filter-actions">
          <el-button type="primary" @click="ElMessage.success(`查询完成，共 ${filteredRecords.length} 条`)">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </div>
      </div>
    </section>

    <section class="module-panel summary-table-panel">
      <el-table
        :data="filteredRecords"
        class="clean-table receivable-summary-table"
        row-key="id"
        border
      >
        <el-table-column label="客户" min-width="220" fixed><template #default="scope"><StackedCell :primary="scope.row.customer" :secondary="`${scope.row.customerNo} / ${scope.row.memberCode}`" /></template></el-table-column>
        <el-table-column prop="shop" label="店铺" min-width="130" />
        <el-table-column prop="currency" label="结算币种" width="92" />
        <el-table-column label="应收金额" min-width="132"><template #default="scope">{{ money(scope.row.receivable, scope.row.currency) }}</template></el-table-column>
        <el-table-column label="已收金额" min-width="132"><template #default="scope">{{ money(scope.row.received, scope.row.currency) }}</template></el-table-column>
        <el-table-column label="应收未收" min-width="132"><template #default="scope"><span class="outstanding-amount">{{ money(scope.row.outstanding, scope.row.currency) }}</span></template></el-table-column>
        <el-table-column label="逾期未收" min-width="132"><template #default="scope"><span :class="{ 'overdue-amount': scope.row.overdue > 0 }">{{ money(scope.row.overdue, scope.row.currency) }}</span></template></el-table-column>
        <el-table-column label="待审核金额" min-width="132"><template #default="scope">{{ money(scope.row.pendingReview, scope.row.currency) }}</template></el-table-column>
        <el-table-column prop="billCount" label="账单数" width="78" />
        <el-table-column prop="outstandingBills" label="未结账单" width="88" />
        <el-table-column prop="oldestDue" label="最早到期日" width="112" />
        <el-table-column label="状态" width="82"><template #default="scope"><StatusTag :label="summaryStatus(scope.row)" /></template></el-table-column>
        <el-table-column label="操作" width="72" fixed="right">
          <template #default="scope">
            <el-button class="table-detail-button" link type="primary" :icon="View" title="查看账单" aria-label="查看账单" @click="openDetail(scope.row)" />
          </template>
        </el-table-column>
      </el-table>
      <TablePagination :total="filteredRecords.length" :page-size="10" layout="prev, pager, next" :summary="`展示 1-${filteredRecords.length} 条`" />
    </section>

    <el-drawer v-model="detailVisible" title="客户应收账单" class="module-drawer" destroy-on-close>
      <div v-if="selectedSummary" class="drawer-summary"><div><StatusTag :label="summaryStatus(selectedSummary)" /><span>{{ selectedSummary.customer }}</span></div><strong>{{ money(selectedSummary.outstanding, selectedSummary.currency) }}</strong></div>
      <dl v-if="selectedSummary" class="inline-detail-grid">
        <div><dt>客户编号</dt><dd>{{ selectedSummary.customerNo }}</dd></div><div><dt>会员编码</dt><dd>{{ selectedSummary.memberCode }}</dd></div><div><dt>店铺</dt><dd>{{ selectedSummary.shop }}</dd></div><div><dt>结算币种</dt><dd>{{ selectedSummary.currency }}</dd></div>
        <div><dt>应收金额</dt><dd>{{ money(selectedSummary.receivable, selectedSummary.currency) }}</dd></div><div><dt>已收金额</dt><dd>{{ money(selectedSummary.received, selectedSummary.currency) }}</dd></div><div><dt>未结账单</dt><dd>{{ selectedSummary.outstandingBills }}</dd></div><div><dt>最早到期日</dt><dd>{{ selectedSummary.oldestDue }}</dd></div>
      </dl>
      <el-table v-if="selectedSummary" :data="[
        { no: `ARB-${selectedSummary.customerNo}-202607-a3f1`, period: '2026/07/21 - 2026/07/27', due: selectedSummary.oldestDue, amount: selectedSummary.outstanding * 0.62, status: selectedSummary.overdue > 0 ? '已逾期' : '待回款' },
        { no: `ARB-${selectedSummary.customerNo}-202608-f892`, period: '2026/07/28 - 2026/08/03', due: '2026-08-18', amount: selectedSummary.outstanding * 0.38, status: '待回款' },
      ]" border class="clean-table summary-bill-table">
        <el-table-column prop="no" label="应收账单编号" min-width="210" /><el-table-column prop="period" label="账期" min-width="180" /><el-table-column prop="due" label="到期日" width="115" /><el-table-column label="未收金额" min-width="140"><template #default="scope">{{ money(scope.row.amount, selectedSummary.currency) }}</template></el-table-column><el-table-column label="状态" width="90"><template #default="scope"><StatusTag :label="scope.row.status" /></template></el-table-column>
      </el-table>
    </el-drawer>
  </div>
</template>

<style scoped>
.receivable-summary-page { --summary-vertical-gap: var(--space-3); --filter-control-height: 30px; --filter-control-radius: var(--action-button-radius); --filter-control-padding-inline: var(--space-3); --filter-min-width: 168px; --filter-action-width: 130px; display: flex; flex-direction: column; gap: var(--summary-vertical-gap); }
.receivable-summary-page :deep(.module-heading), .receivable-summary-page :deep(.module-kpis) { margin-bottom: 0; }
.summary-scope-row { margin: 0; padding: 0; display: flex; gap: var(--space-3); }
.adaptive-filter-width { width: max(var(--filter-min-width), var(--filter-content-width)); min-width: var(--filter-min-width); max-width: 100%; }
.summary-shop-select { min-width: 0; flex: 1; }
.summary-dimension-heading { min-height: 38px; display: flex; align-items: center; border-bottom: 1px solid var(--border); }
.customer-dimension-heading { margin-top: var(--space-2); }
.summary-dimension-heading strong { position: relative; height: 38px; padding-left: var(--space-3); display: inline-flex; align-items: center; color: var(--primary); font-size: var(--section-title-font-size); font-weight: var(--font-weight-semibold); }
.summary-dimension-heading strong::before { content: ""; position: absolute; left: 0; width: 5px; height: 16px; background: var(--primary); }
.receivable-summary-query { margin: 0; padding: 0 !important; overflow: visible; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.inline-filter-bar { display: flex; flex-wrap: wrap; gap: var(--space-3); }
.filter-actions { width: var(--filter-action-width); flex: 0 0 var(--filter-action-width); display: flex; gap: var(--space-2); }
.filter-actions :deep(.el-button) { width: calc((var(--filter-action-width) - var(--space-2)) / 2); height: var(--filter-control-height) !important; min-height: var(--filter-control-height); margin: 0; padding: 0 var(--filter-control-padding-inline); border-radius: var(--filter-control-radius); }
.filter-token { min-width: 0; height: var(--filter-control-height); min-height: var(--filter-control-height); padding: 0 var(--filter-control-padding-inline); display: flex; align-items: center; gap: var(--space-3); border: 1px solid #cfd4de; border-radius: var(--filter-control-radius); background: #fff; transition: border-color .16s ease, background-color .16s ease, box-shadow .16s ease; }
.filter-token.adaptive-filter-width { min-width: var(--filter-min-width); }
.filter-token:hover { border-color: var(--primary-border); }
.filter-token:focus-within { border-color: var(--primary); box-shadow: 0 0 0 2px var(--primary-focus-ring); }
.filter-token.active { border-color: var(--primary); background: var(--primary-soft); }
.filter-token-label { flex: 0 0 auto; color: #232b3b; white-space: nowrap; }
.customer-filter-reference, .period-filter-reference { min-width: 0; min-height: calc(var(--filter-control-height) - 2px); display: flex; flex: 1; align-items: center; gap: var(--space-2); cursor: pointer; outline: none; }
.customer-filter-reference:focus-visible, .period-filter-reference:focus-visible { box-shadow: 0 0 0 2px var(--primary-focus-ring) inset; }
.customer-filter-value, .period-filter-value { min-width: 0; flex: 1; overflow: hidden; color: #7b8494; text-overflow: ellipsis; white-space: nowrap; }
.filter-token.active .customer-filter-value, .filter-token.active .period-filter-value { color: var(--primary-strong); font-weight: var(--font-weight-semibold); }
.filter-token-arrow, .filter-token-clear { flex: 0 0 auto; color: #8a93a2; }
.filter-token-clear:hover { color: var(--primary); }
.customer-filter-panel { display: grid; gap: var(--space-3); }
.customer-filter-options { max-height: 250px; overflow-y: auto; border-top: 1px solid var(--border); }
.customer-filter-options button { width: 100%; min-height: 42px; padding: var(--space-2) var(--space-3); display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); border: 0; border-bottom: 1px solid #edf0f4; color: #30394b; background: #fff; text-align: left; cursor: pointer; }
.customer-filter-options button:hover, .customer-filter-options button.active { color: var(--primary); background: var(--primary-soft); }
.customer-filter-options button strong { overflow: hidden; font-size: var(--content-font-size); font-weight: var(--font-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
.customer-filter-options button small { flex: 0 0 auto; color: #7b8494; font-size: var(--font-size-sm); }
.customer-filter-empty { padding: var(--space-5); color: #7b8494; text-align: center; }
.filter-token > :deep(.el-input), .filter-token > :deep(.el-select), .filter-token > :deep(.el-date-editor) { min-width: 0; flex: 1; }
.filter-token :deep(.el-input__wrapper), .filter-token :deep(.el-select__wrapper), .filter-token :deep(.el-range-editor.el-input__wrapper) { height: calc(var(--filter-control-height) - 2px); min-height: calc(var(--filter-control-height) - 2px); padding: 0; background: transparent; box-shadow: none !important; }
.filter-token :deep(.el-input__inner), .filter-token :deep(.el-select__selected-item), .filter-token :deep(.el-range-input) { color: var(--primary-strong); font-weight: var(--font-weight-semibold); }
.filter-token:not(.active) :deep(.el-input__inner), .filter-token:not(.active) :deep(.el-select__placeholder), .filter-token:not(.active) :deep(.el-range-input) { color: #7b8494; font-weight: 400; }
.period-filter-token { position: relative; }
.period-filter-token :deep(.period-picker-anchor) { position: absolute !important; inset: 0; width: 100% !important; height: 100%; opacity: 0 !important; pointer-events: none; }
.summary-table-panel { overflow: hidden; }
.outstanding-amount { color: #9a611a; font-variant-numeric: tabular-nums; }
.overdue-amount { color: #b6424d; font-weight: var(--font-weight-semibold); }
.summary-bill-table { margin-top: var(--space-4); }
@media (max-width: 760px) {
  .adaptive-filter-width { width: 100%; max-width: 100%; }
}
</style>
