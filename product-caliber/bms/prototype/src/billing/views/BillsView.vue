<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus/es/components/message/index.mjs'
import { Download, RefreshRight, View } from '@element-plus/icons-vue'
import BillDetailPanel from '../components/BillDetailPanel.vue'
import ConditionFilter from '../../shared/components/ConditionFilter.vue'
import HoverActionMenu from '../../shared/components/HoverActionMenu.vue'
import MetricGrid from '../../shared/components/MetricGrid.vue'
import SegmentedControl from '../../shared/components/SegmentedControl.vue'
import StatusTag from '../../shared/components/StatusTag.vue'
import DataTableFrame from '../../shared/components/DataTableFrame.vue'
import { useStagedQuery } from '../../shared/composables/useStagedQuery.js'
import { createBillListSchema } from '../schemas/billListSchema.ts'
import { billingBillFixtures } from '../../data/fixtures/billingBills.ts'
import { useDemoDataset } from '../data/useDemoDataset.js'

const props = defineProps({ billType: { type: String, required: true } })
const isReceivable = computed(() => props.billType === 'AR')
const title = computed(() => isReceivable.value ? '应收账单' : '返款账单')
const pageSchema = computed(() => createBillListSchema(isReceivable.value))
const initialQuery = { billNo: '', customer: '', shop: '', country: '', periodType: '', period: [] }
const { query, appliedQuery, applyQuery, resetQuery: resetStagedQuery } = useStagedQuery(initialQuery)
const activeStatus = ref('待审核')
const selectedRows = ref([])
const detailVisible = ref(false)
const selectedBill = ref(null)
const exportVisible = ref(false)
const exportPurpose = ref('CUSTOMER')
const exportFormat = ref('SPLIT')
const exportFormatOptions = [
  { label: '拆分式', value: 'SPLIT' },
  { label: '合并式', value: 'MERGED' },
]
const expectedSheetCount = computed(() => exportPurpose.value === 'INTERNAL' && exportFormat.value === 'MERGED' ? 1 : selectedRows.value.length)

const bills = useDemoDataset('billingBills', billingBillFixtures, 4)

const statuses = computed(() => isReceivable.value
  ? ['待审核', '待结清', '逾期未结清', '已结清', '已作废', '全部']
  : ['待审核', '待结清', '已结清', '已作废', '全部'])
const typeBills = computed(() => bills.value.filter((item) => item.type === props.billType))
const filteredBills = computed(() => typeBills.value.filter((item) => {
  const statusMatch = activeStatus.value === '全部'
    || (activeStatus.value === '逾期未结清' ? item.status === '待结清' && item.overdueDays > 0 : item.status === activeStatus.value)
  return statusMatch && (!appliedQuery.billNo || item.billNo.includes(appliedQuery.billNo))
    && (!appliedQuery.customer || `${item.customer}${item.customerNo}`.includes(appliedQuery.customer))
    && (!appliedQuery.shop || item.shop.includes(appliedQuery.shop)) && (!appliedQuery.country || item.country === appliedQuery.country)
    && (!appliedQuery.periodType || item.periodType === appliedQuery.periodType)
}))
const countStatus = (status) => status === '逾期未结清'
  ? typeBills.value.filter((item) => item.status === '待结清' && item.overdueDays > 0).length
  : typeBills.value.filter((item) => item.status === status).length
const summary = computed(() => isReceivable.value ? [
  { label: '账单总数', value: typeBills.value.length, tone: 'blue' },
  { label: '待审核账单', value: countStatus('待审核'), tone: 'amber' },
  { label: '待结清', value: countStatus('待结清'), tone: 'violet' },
  { label: '逾期未结清', value: countStatus('逾期未结清'), tone: 'red' },
] : [
  { label: '账单总数', value: typeBills.value.length, tone: 'blue' },
  { label: '待审核账单', value: countStatus('待审核'), tone: 'amber' },
  { label: '待结清', value: countStatus('待结清'), tone: 'violet' },
  { label: '已结清', value: countStatus('已结清'), tone: 'green' },
])

function money(value) { return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function resetQuery() { resetStagedQuery(); activeStatus.value = '待审核' }
function openDetail(row) { selectedBill.value = row; detailVisible.value = true }
function action(name) { ElMessage.success(`${name}已提交`) }
function openExport() {
  exportPurpose.value = isReceivable.value ? 'CUSTOMER' : 'CUSTOMER'
  exportFormat.value = 'SPLIT'
  exportVisible.value = true
}
function confirmExport() {
  exportVisible.value = false
  const formatText = exportPurpose.value === 'INTERNAL' ? `，采用${exportFormat.value === 'SPLIT' ? '拆分式' : '合并式'}` : ''
  ElMessage.success(`已创建 ${selectedRows.value.length} 个账单的下载任务${formatText}`)
}
async function handleBillAction(name) {
  const bill = selectedBill.value
  if (!bill) return
  if (name === '创建账单生成任务') {
    bill.processingState = '账单生成待处理'; bill.activeTask = 'BMS-20260802-00082'
  } else if (name === '审核通过') {
    if (bill.closeStatus !== '已收口') return ElMessage.warning('账期未收口，不能审核通过')
    bill.status = '待结清'; bill.issued = true; bill.notice = '已通知'; bill.sentAt = bill.sentAt === '-' ? '2026/08/02' : bill.sentAt
  } else if (name === '退回待审核') {
    bill.status = '待审核'
  }
  ElMessage.success(`${name}已提交`)
}
</script>

<template>
  <div class="module-page live-reference-page">
    <section class="condition-query-panel">
      <div class="condition-filter-bar">
        <ConditionFilter
          v-for="filter in pageSchema.filters"
          :key="filter.key"
          v-model="query[filter.key]"
          :label="filter.label"
          :type="filter.type"
          :options="filter.options"
        />
        <div class="condition-filter-actions"><el-button type="primary" @click="applyQuery">查询</el-button><el-button @click="resetQuery">重置</el-button></div>
      </div>
    </section>

    <MetricGrid class="reference-kpis" :items="summary" />

    <div class="status-tabs-row"><button v-for="status in statuses" :key="status" :class="{ active: activeStatus === status }" @click="activeStatus = status">{{ status }}</button></div>

    <section class="module-panel">
      <DataTableFrame :total="filteredBills.length" :selected-count="selectedRows.length" selection-summary>
      <template #actions><el-button :icon="Download" :disabled="!selectedRows.length" @click="openExport">下载</el-button></template>
      <el-table :data="filteredBills" class="clean-table" row-key="billNo" border @selection-change="selectedRows = $event">
        <el-table-column type="selection" width="44" fixed />
        <el-table-column prop="billNo" label="账单编号" width="205" fixed />
        <el-table-column label="账单状态" width="100"><template #default="scope"><StatusTag :label="scope.row.status" /></template></el-table-column>
        <el-table-column prop="closeStatus" label="账期收口" width="90"><template #default="scope"><StatusTag :label="scope.row.closeStatus" /></template></el-table-column>
        <el-table-column prop="processingState" label="处理状态" width="125"><template #default="scope">{{ scope.row.processingState || '-' }}</template></el-table-column>
        <el-table-column v-if="!isReceivable" prop="refundMode" label="返款模式" width="100" />
        <el-table-column :label="isReceivable ? '费项结算币种金额' : '货款结算币种金额'" width="250"><template #default="scope"><div class="amount-lines"><span>{{ isReceivable ? '应收' : '原始货款' }} <b>{{ money(isReceivable ? scope.row.amount : scope.row.original) }} {{ scope.row.currency }}</b></span><span>{{ isReceivable ? '已核销' : '扣除费项' }} {{ money(isReceivable ? scope.row.paid : scope.row.deduction) }} {{ scope.row.currency }}</span><span>{{ isReceivable ? '未核销' : '待返货款' }} <b>{{ money(scope.row.amount - scope.row.paid) }} {{ scope.row.currency }}</b></span></div></template></el-table-column>
        <el-table-column prop="periodType" label="账期类型" width="90" /><el-table-column prop="periodStart" label="账期起始日" width="112" /><el-table-column prop="periodEnd" label="账期结束日" width="112" />
        <el-table-column v-if="isReceivable" prop="sector" label="业务板块" width="125" /><el-table-column prop="country" :label="isReceivable ? '运抵国' : '目的国'" width="100" /><el-table-column prop="customer" label="客户名称" width="160" show-overflow-tooltip /><el-table-column prop="shop" label="店铺" width="155" show-overflow-tooltip /><el-table-column prop="sentAt" label="账单发出日" width="112" />
        <el-table-column v-if="isReceivable" prop="dueAt" label="信用期结束日" width="120" /><el-table-column v-if="isReceivable" prop="overdueDays" label="逾期天数" width="90" /><el-table-column prop="notice" label="通知状态" width="95" />
        <el-table-column label="操作" width="112" fixed="right"><template #default="scope"><div class="row-action-cell"><el-button class="table-detail-button" link type="primary" :icon="View" title="详情" aria-label="详情" @click="openDetail(scope.row)" /><HoverActionMenu v-if="!['已结清','已作废'].includes(scope.row.status) && !scope.row.processingState"><el-dropdown-item :icon="RefreshRight" @click="openDetail(scope.row); handleBillAction('账单重算')">账单重算</el-dropdown-item></HoverActionMenu></div></template></el-table-column>
      </el-table>
      </DataTableFrame>
    </section>

    <el-drawer v-model="detailVisible" size="86%" class="detail-drawer module-drawer" :close-on-click-modal="false">
      <template #header><div class="drawer-title"><span>账单详情</span><small>{{ title }} · {{ selectedBill?.billNo }}</small></div></template>
      <BillDetailPanel v-if="selectedBill" :bill="selectedBill" :is-receivable="isReceivable" @action="handleBillAction" />
    </el-drawer>

    <el-dialog v-model="exportVisible" title="下载账单" width="680px" align-center>
      <el-form label-width="110px">
        <el-form-item label="账单类型"><strong>{{ title }}</strong></el-form-item>
        <el-form-item label="账单数量"><strong>{{ selectedRows.length }} 个</strong></el-form-item>
        <el-form-item label="导出用途"><el-radio-group v-model="exportPurpose" :disabled="!isReceivable"><el-radio value="CUSTOMER">导出给客户</el-radio><el-radio v-if="isReceivable" value="INTERNAL">导出给内部</el-radio></el-radio-group></el-form-item>
        <el-form-item v-if="isReceivable && exportPurpose === 'INTERNAL'" label="内部导出格式">
          <SegmentedControl v-model="exportFormat" :options="exportFormatOptions" aria-label="内部导出格式" />
        </el-form-item>
        <el-form-item v-if="isReceivable && exportPurpose === 'INTERNAL'" label="预计 Sheet"><strong>{{ expectedSheetCount }} 个</strong></el-form-item>
        <el-alert v-if="isReceivable && exportPurpose === 'INTERNAL' && exportFormat === 'SPLIT'" title="每张账单生成一个 Sheet；账单基本信息写入表头首个单元格的批注。" type="info" :closable="false" />
        <el-alert v-else-if="isReceivable && exportPurpose === 'INTERNAL'" title="全部账单明细进入同一个 Sheet；账单区块使用交替底色，区块首行首格附账单基本信息批注。" type="info" :closable="false" />
        <el-alert v-else title="客户导出按客户拆分文件，并使用当前生效的客户导出配置。" type="info" :closable="false" />
        <el-text v-if="isReceivable && exportPurpose === 'INTERNAL'" type="info" size="small">费项列固定优先展示运费、派送费，其余费项按费项索引顺序排列。</el-text>
      </el-form>
      <template #footer><el-button @click="exportVisible=false">取消</el-button><el-button type="primary" @click="confirmExport">下载</el-button></template>
    </el-dialog>
  </div>
</template>
