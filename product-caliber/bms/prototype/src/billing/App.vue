<script setup>
import { computed, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowDown, Bell, CircleCheck, Clock, Coin, Delete, DocumentChecked,
  Download, Expand, Failed, Fold, List, Menu, Operation, QuestionFilled,
  Refresh, RefreshRight, Search, Setting, Tickets, User, View,
} from '@element-plus/icons-vue'
import BillsView from './views/BillsView.vue'
import BillingConfigView from './views/BillingConfigView.vue'
import RateConfigView from './views/RateConfigView.vue'
import RemittanceView from './views/RemittanceView.vue'
import AdjustmentView from './views/AdjustmentView.vue'
import ProcessView from './views/ProcessView.vue'
import { useDemoDataset } from './data/useDemoDataset.js'

const props = defineProps({
  initialMenu: { type: String, default: 'tasks' },
  embedded: { type: Boolean, default: false },
})

const activeMenu = ref(props.initialMenu)
const detailVisible = ref(false)
const detailTab = ref('overview')
const selectedTask = ref(null)
const collapsed = ref(false)
const advancedVisible = ref(false)
const notifications = ref(4)
const lastRefreshedAt = ref('2026-08-02 10:26:18')

const taskQuery = reactive({
  keyword: '',
  executionLevel: '',
  status: '',
  calculationType: '',
  initiateIntent: '',
  actualMode: '',
  periodClose: '',
  triggerType: '',
  pullType: '',
  configType: '',
  shop: '',
  period: [],
})

const menuGroups = [
  { label: '财务日常', items: [
    { key: 'receivable', label: '应收账单', icon: DocumentChecked },
    { key: 'refund', label: '返款账单', icon: Tickets },
    { key: 'remittance', label: '回款管理', icon: Coin },
    { key: 'adjustments', label: '调账中心', icon: Operation },
  ] },
  { label: '核心配置', items: [
    { key: 'config', label: '账单配置', icon: Setting },
    { key: 'rates', label: '汇率配置', icon: Coin },
  ] },
  { label: '过程管控', items: [
    { key: 'tasks', label: '生成任务', icon: List },
    { key: 'base', label: '基础配置', icon: Setting },
    { key: 'exports', label: '导出管理', icon: Download },
    { key: 'audit', label: '内部审计', icon: View },
  ] },
  { label: '辅助测试', items: [
    { key: 'compare', label: '报表比对', icon: Search },
    { key: 'migration', label: '数据迁移', icon: Refresh },
  ] },
]
const menus = menuGroups.flatMap((group) => group.items)

const viewRegistry = {
  receivable: { component: BillsView, props: { billType: 'AR' } },
  refund: { component: BillsView, props: { billType: 'RF' } },
  remittance: { component: RemittanceView },
  adjustments: { component: AdjustmentView },
  config: { component: BillingConfigView },
  rates: { component: RateConfigView },
  base: { component: ProcessView, props: { mode: 'base' } },
  exports: { component: ProcessView, props: { mode: 'exports' } },
  audit: { component: ProcessView, props: { mode: 'audit' } },
  compare: { component: ProcessView, props: { mode: 'compare' } },
  migration: { component: ProcessView, props: { mode: 'migration' } },
}

const statusMeta = {
  PENDING: { label: '待执行', className: 'info' },
  RUNNING: { label: '执行中', className: 'running' },
  SUCCESS: { label: '执行成功', className: 'success' },
  FAILED: { label: '执行失败', className: 'danger' },
}

const executionLevelMeta = {
  FEE_POOL: '费项入池',
  BILL_CALCULATION: '账单计算',
}

const calculationMeta = {
  BILL_GENERATE: '账单生成',
  BILL_RECALCULATE: '账单重算',
}

const intentMeta = {
  FIRST_GENERATE: '首次生成',
  SUPPLEMENT_GENERATE: '补充生成',
  PERIOD_CLOSE: '期末收口',
  REPLACE_GENERATE: '替换生成',
}

const actualModeMeta = {
  PENDING: '待判定',
  FIRST: '首次生成',
  SUPPLEMENT: '补充生成',
  REPLACE: '替换生成',
}

const triggerMeta = {
  SCHEDULED: '定时',
  MANUAL: '手动',
}

const pullTypeMeta = {
  FULL: '全量',
  INCREMENTAL: '增量',
}

const taskRecords = useDemoDataset('billingTasks', [
  {
    id: 1,
    taskNo: 'BMS-20260802-00081',
    status: 'FAILED',
    executionLevel: 'BILL_CALCULATION',
    currentStage: 'BILL_CALCULATE',
    calculationType: 'BILL_GENERATE',
    initiateIntent: 'PERIOD_CLOSE',
    actualMode: 'SUPPLEMENT',
    periodClose: '是',
    triggerType: 'SCHEDULED',
    pullType: 'INCREMENTAL',
    configNo: 'BC-OG4155-M-US',
    configVersion: 'V12',
    configType: '分支配置',
    customerName: 'OceanGate Logistics',
    customerNo: 'OG4155',
    memberCode: 'M-700127',
    shop: '深圳集运店',
    periodStart: '2026-08-01',
    periodEnd: '2026-08-01',
    period: '2026-08-01 至 2026-08-01',
    dataCutoff: '2026-08-02 02:00:00',
    createdAt: '2026-08-02 02:00:01',
    startedAt: '2026-08-02 02:10:03',
    finishedAt: '2026-08-02 02:12:29',
    duration: '2分26秒',
    operator: 'system',
    failedStage: 'BILL_CALCULATE',
    error: '11条费项缺少业务板块，无法按“业务板块 + 运抵国”完成拆单。',
    advice: '核对来源数据完整性；修复后按原任务快照重新执行。若需改变范围或配置，请先删除任务并从业务入口新建任务。',
    sourceCount: 1864,
    pooledFeeCount: 6421,
    billCount: 0,
    netChange: 0,
    resultConclusion: '-',
    resultVersion: '-',
    originalBills: ['ARB-OG4155-20260801-f31a'],
    newBills: [],
    scopeKey: 'OG4155|AR|2026-08-01|BC-OG4155-M-US|BILL_GENERATE',
    sourceSql: 'SELECT ... FROM sale_order_fee_detail\nWHERE customer_no = :customerNo\n  AND fee_created_at <= :dataCutoff\n  AND bms_reviewed = 0;',
  },
  {
    id: 2,
    taskNo: 'BMS-20260802-00080',
    status: 'SUCCESS',
    executionLevel: 'BILL_CALCULATION',
    currentStage: 'RESULT_SAVE',
    calculationType: 'BILL_GENERATE',
    initiateIntent: 'FIRST_GENERATE',
    actualMode: 'FIRST',
    periodClose: '否',
    triggerType: 'MANUAL',
    pullType: 'FULL',
    configNo: 'BC-TK9012-D',
    configVersion: 'V8',
    configType: '默认配置',
    customerName: 'TopKing Supply',
    customerNo: 'TK9012',
    memberCode: 'M-672019',
    shop: '义乌集运店',
    periodStart: '2026-08-01',
    periodEnd: '2026-08-07',
    period: '2026-08-01 至 2026-08-07',
    dataCutoff: '2026-08-02 09:30:00',
    createdAt: '2026-08-02 09:30:02',
    startedAt: '2026-08-02 09:31:11',
    finishedAt: '2026-08-02 09:34:45',
    duration: '3分34秒',
    operator: '谭清辉',
    failedStage: '',
    error: '',
    advice: '',
    sourceCount: 2540,
    pooledFeeCount: 8220,
    billCount: 2,
    netChange: 483126.58,
    resultConclusion: '首次生成',
    resultVersion: 'RV-20260802-00317',
    originalBills: [],
    newBills: ['ARB-TK9012-20260801-41b7', 'ARB-TK9012-20260801-8c2a'],
    scopeKey: 'TK9012|AR|2026-08-01/07|BC-TK9012-D|BILL_GENERATE',
    sourceSql: 'SELECT ... FROM sale_order_fee_detail\nWHERE customer_no = :customerNo\n  AND sign_time BETWEEN :periodStart AND :dataCutoff\n  AND bms_reviewed = 0;',
  },
  {
    id: 3,
    taskNo: 'BMS-20260802-00079',
    status: 'RUNNING',
    executionLevel: 'FEE_POOL',
    currentStage: 'FEE_POOL_WRITE',
    calculationType: '',
    initiateIntent: '',
    actualMode: '',
    periodClose: '',
    triggerType: 'SCHEDULED',
    pullType: 'INCREMENTAL',
    configNo: 'BC-ADDITIONAL-INCR',
    configVersion: 'V5',
    configType: '默认配置',
    customerName: '全部客户',
    customerNo: '-',
    memberCode: '-',
    shop: '全部店铺',
    periodStart: '2026-08-02',
    periodEnd: '2026-08-02',
    period: '2026-08-02 至 2026-08-02',
    dataCutoff: '2026-08-02 10:00:00',
    createdAt: '2026-08-02 10:00:01',
    startedAt: '2026-08-02 10:03:00',
    finishedAt: '-',
    duration: '8分12秒',
    operator: 'system',
    failedStage: '',
    error: '',
    advice: '',
    sourceCount: 916,
    pooledFeeCount: 342,
    billCount: 0,
    netChange: 0,
    resultConclusion: '执行中',
    resultVersion: '-',
    originalBills: [],
    newBills: [],
    scopeKey: 'ALL|ADDITIONAL|2026-08-02 09:00/10:00|V5',
    sourceSql: 'SELECT ... FROM sale_order_additional_fee\nWHERE created_at > :lastCheckpoint\n  AND created_at <= :dataCutoff\n  AND billing_status = :billable;',
  },
  {
    id: 4,
    taskNo: 'BMS-20260802-00077',
    status: 'PENDING',
    executionLevel: 'BILL_CALCULATION',
    currentStage: 'SCOPE_LOCK',
    calculationType: 'BILL_RECALCULATE',
    initiateIntent: '',
    actualMode: '',
    periodClose: '',
    triggerType: 'MANUAL',
    pullType: '',
    configNo: 'BC-NW2048-W',
    configVersion: 'V9',
    configType: '默认配置',
    customerName: 'NorthWind Cargo',
    customerNo: 'NW2048',
    memberCode: 'M-204801',
    shop: '上海集运店',
    periodStart: '2026-07-21',
    periodEnd: '2026-07-27',
    period: '2026-07-21 至 2026-07-27',
    dataCutoff: '2026-08-02 09:48:16',
    createdAt: '2026-08-02 09:48:18',
    startedAt: '-',
    finishedAt: '-',
    duration: '0秒',
    operator: '郑雅雯',
    failedStage: '',
    error: '',
    advice: '',
    sourceCount: 0,
    pooledFeeCount: 6188,
    billCount: 1,
    netChange: 0,
    resultConclusion: '排队中',
    resultVersion: 'RV-20260728-00196',
    originalBills: ['ARB-NW2048-20260721-7f3c'],
    newBills: [],
    scopeKey: 'ARB-NW2048-20260721-7f3c|BILL_RECALCULATE',
    recalculateScope: '特调汇率、已审核调账及币种汇总',
    sourceSql: '',
  },
  {
    id: 5,
    taskNo: 'BMS-20260802-00072',
    status: 'SUCCESS',
    executionLevel: 'BILL_CALCULATION',
    currentStage: 'RESULT_SAVE',
    calculationType: 'BILL_GENERATE',
    initiateIntent: 'PERIOD_CLOSE',
    actualMode: 'SUPPLEMENT',
    periodClose: '是',
    triggerType: 'MANUAL',
    pullType: 'INCREMENTAL',
    configNo: 'BC-HL2388-WEEK',
    configVersion: 'V6',
    configType: '默认配置',
    customerName: 'Hualei Express',
    customerNo: 'HL2388',
    memberCode: 'M-238801',
    shop: '广州同行店',
    periodStart: '2026-07-27',
    periodEnd: '2026-08-02',
    period: '2026-07-27 至 2026-08-02',
    dataCutoff: '2026-08-02 08:35:00',
    createdAt: '2026-08-02 08:35:03',
    startedAt: '2026-08-02 08:35:18',
    finishedAt: '2026-08-02 08:36:09',
    duration: '51秒',
    operator: '郑雅雯',
    failedStage: '',
    error: '',
    advice: '',
    sourceCount: 642,
    pooledFeeCount: 0,
    billCount: 1,
    netChange: 0,
    resultConclusion: '无需补充',
    resultVersion: '未新增结果版本',
    originalBills: ['ARB-HL2388-20260727-3d90'],
    newBills: [],
    scopeKey: 'HL2388|AR|2026-07-27/08-02|BC-HL2388-WEEK|BILL_GENERATE',
    sourceSql: 'SELECT ... FROM peer_order_fee_detail\nWHERE customer_no = :customerNo\n  AND fee_created_at <= :dataCutoff\n  AND bms_reviewed = 0;',
  },
  {
    id: 6,
    taskNo: 'BMS-20260801-00068',
    status: 'SUCCESS',
    executionLevel: 'BILL_CALCULATION',
    currentStage: 'RESULT_SAVE',
    calculationType: 'BILL_GENERATE',
    initiateIntent: 'REPLACE_GENERATE',
    actualMode: 'REPLACE',
    periodClose: '否',
    triggerType: 'MANUAL',
    pullType: 'FULL',
    configNo: 'BC-OG4155-M-UK',
    configVersion: 'V13',
    configType: '分支配置',
    customerName: 'OceanGate Logistics',
    customerNo: 'OG4155',
    memberCode: 'M-700127',
    shop: '深圳集运店',
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
    period: '2026-07-01 至 2026-07-31',
    dataCutoff: '2026-08-01 18:19:00',
    createdAt: '2026-08-01 18:19:03',
    startedAt: '2026-08-01 18:19:28',
    finishedAt: '2026-08-01 18:25:06',
    duration: '5分38秒',
    operator: '谭清辉',
    failedStage: '',
    error: '',
    advice: '',
    sourceCount: 3188,
    pooledFeeCount: 11290,
    billCount: 3,
    netChange: -1266.4,
    resultConclusion: '替换生成成功',
    resultVersion: 'RV-20260801-00288',
    originalBills: ['ARB-OG4155-20260701-a20f', 'ARB-OG4155-20260701-d819'],
    newBills: ['ARB-OG4155-20260701-f802', 'ARB-OG4155-20260701-a664', 'ARB-OG4155-20260701-339c'],
    scopeKey: 'REPLACE-BATCH-20260801-0017',
    sourceSql: 'SELECT ... FROM sale_order_fee_detail\nWHERE customer_no = :customerNo\n  AND sign_time BETWEEN :periodStart AND :dataCutoff;',
  },
  {
    id: 7,
    taskNo: 'BMS-20260801-00064',
    status: 'FAILED',
    executionLevel: 'FEE_POOL',
    currentStage: 'SOURCE_FILTER',
    calculationType: '',
    initiateIntent: '',
    actualMode: '',
    periodClose: '',
    triggerType: 'SCHEDULED',
    pullType: 'INCREMENTAL',
    configNo: 'BC-ADDITIONAL-INCR',
    configVersion: 'V5',
    configType: '默认配置',
    customerName: '全部客户',
    customerNo: '-',
    memberCode: '-',
    shop: '全部店铺',
    periodStart: '2026-08-01',
    periodEnd: '2026-08-01',
    period: '2026-08-01 至 2026-08-01',
    dataCutoff: '2026-08-01 23:00:00',
    createdAt: '2026-08-01 23:00:01',
    startedAt: '2026-08-01 23:01:11',
    finishedAt: '2026-08-01 23:03:42',
    duration: '2分31秒',
    operator: 'system',
    failedStage: 'SOURCE_FILTER',
    error: '来源库连接超时，系统自动重试后仍未恢复。',
    advice: '该费项入池任务由系统负责恢复，财务无需重新执行或删除。',
    sourceCount: 0,
    pooledFeeCount: 0,
    billCount: 0,
    netChange: 0,
    resultConclusion: '系统恢复中',
    resultVersion: '-',
    originalBills: [],
    newBills: [],
    scopeKey: 'ALL|ADDITIONAL|2026-08-01 22:00/23:00|V5',
    sourceSql: 'SELECT ... FROM sale_order_additional_fee\nWHERE created_at > :lastCheckpoint\n  AND created_at <= :dataCutoff;',
  },
])

const currentMenu = computed(() => menus.find((item) => item.key === activeMenu.value))
const currentGroup = computed(() => menuGroups.find((group) => group.items.some((item) => item.key === activeMenu.value)))
const currentView = computed(() => viewRegistry[activeMenu.value])
const isFeePoolFilter = computed(() => taskQuery.executionLevel === 'FEE_POOL')

const filteredTasks = computed(() => taskRecords.value.filter((item) => {
  const keyword = `${item.taskNo}${item.configNo}${item.customerName}${item.customerNo}${item.memberCode}${item.shop}`.toLowerCase()
  const periodMatched = !taskQuery.period?.length
    || (dayjs(item.periodStart).isAfter(dayjs(taskQuery.period[0]).subtract(1, 'day'))
      && dayjs(item.periodEnd).isBefore(dayjs(taskQuery.period[1]).add(1, 'day')))
  return (!taskQuery.keyword || keyword.includes(taskQuery.keyword.toLowerCase()))
    && (!taskQuery.executionLevel || item.executionLevel === taskQuery.executionLevel)
    && (!taskQuery.status || item.status === taskQuery.status)
    && (!taskQuery.calculationType || item.calculationType === taskQuery.calculationType)
    && (!taskQuery.initiateIntent || item.initiateIntent === taskQuery.initiateIntent)
    && (!taskQuery.actualMode || item.actualMode === taskQuery.actualMode)
    && (!taskQuery.periodClose || item.periodClose === taskQuery.periodClose)
    && (!taskQuery.triggerType || item.triggerType === taskQuery.triggerType)
    && (!taskQuery.pullType || item.pullType === taskQuery.pullType)
    && (!taskQuery.configType || item.configType === taskQuery.configType)
    && (!taskQuery.shop || item.shop === taskQuery.shop)
    && periodMatched
}))

const taskSummary = computed(() => {
  const rows = filteredTasks.value
  return [
    { key: '', label: '任务总数', value: rows.length, icon: Tickets, tone: 'blue' },
    { key: 'PENDING', label: '待执行任务', value: rows.filter((item) => item.status === 'PENDING').length, icon: Clock, tone: 'slate' },
    { key: 'RUNNING', label: '执行中任务', value: rows.filter((item) => item.status === 'RUNNING').length, icon: Refresh, tone: 'violet' },
    { key: 'SUCCESS', label: '执行成功任务', value: rows.filter((item) => item.status === 'SUCCESS').length, icon: CircleCheck, tone: 'green' },
    { key: 'FAILED', label: '执行失败任务', value: rows.filter((item) => item.status === 'FAILED').length, icon: Failed, tone: 'red' },
  ]
})

const snapshotJson = computed(() => JSON.stringify({
  executionSnapshot: {
    scopeKey: selectedTask.value?.scopeKey,
    dataCutoff: selectedTask.value?.dataCutoff,
    executionLevel: selectedTask.value?.executionLevel,
    calculationType: selectedTask.value?.calculationType || 'N/A',
    targetBills: selectedTask.value?.originalBills,
    recalculateScope: selectedTask.value?.recalculateScope || 'N/A',
  },
  businessSnapshotReferences: {
    billConfig: `${selectedTask.value?.configNo}@${selectedTask.value?.configVersion}`,
    sourceRule: 'DSR-OFP-AR@V5',
    feeRule: 'FR-AR-CUSTOMER@V9',
    exchangeRate: 'FX-CUSTOMER@20260802',
  },
}, null, 2))

function display(meta, value) {
  return value ? (meta[value] || value) : '不适用'
}

function taskStatus(row) {
  return statusMeta[row.status] || statusMeta.PENDING
}

function formatAmount(value) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function setSummaryFilter(key) {
  taskQuery.status = key
}

function handleExecutionLevelChange(value) {
  if (value === 'FEE_POOL') {
    taskQuery.calculationType = ''
    taskQuery.initiateIntent = ''
    taskQuery.actualMode = ''
    taskQuery.periodClose = ''
  }
}

function resetFilters() {
  Object.assign(taskQuery, {
    keyword: '', executionLevel: '', status: '', calculationType: '',
    initiateIntent: '', actualMode: '', periodClose: '', triggerType: '', pullType: '',
    configType: '', shop: '', period: [],
  })
}

function refreshTasks() {
  lastRefreshedAt.value = dayjs().format('YYYY-MM-DD HH:mm:ss')
  ElMessage.success('任务状态已刷新')
}

function openDetail(row, tab = 'overview') {
  selectedTask.value = row
  detailTab.value = tab
  detailVisible.value = true
}

async function rerunTask(row) {
  if (row.executionLevel !== 'BILL_CALCULATION' || row.status !== 'FAILED') return
  await ElMessageBox.confirm(
    '任务将沿用原执行快照、处理范围和数据截止点继续处理。确认重新执行？',
    '重新执行任务',
    { confirmButtonText: '确认重新执行', cancelButtonText: '取消', type: 'warning' },
  )
  row.status = 'PENDING'
  row.finishedAt = '-'
  row.duration = '0秒'
  row.resultConclusion = '等待从失败检查点恢复'
  ElMessage.success('任务已回到待执行队列，任务编号和执行快照保持不变')
}

async function deleteTask(row) {
  const canDelete = row.executionLevel === 'BILL_CALCULATION' && ['PENDING', 'FAILED'].includes(row.status)
  if (!canDelete) return
  await ElMessageBox.confirm(
    `删除后任务将移出列表并释放占用范围。任务编号 ${row.taskNo} 的删除审计仍会保留。`,
    '删除任务',
    { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning' },
  )
  taskRecords.value = taskRecords.value.filter((item) => item.id !== row.id)
  if (selectedTask.value?.id === row.id) detailVisible.value = false
  ElMessage.success('任务已删除，处理范围已释放')
}

function viewResult(row) {
  const bills = row.newBills.length ? row.newBills : row.originalBills
  if (!bills.length) {
    ElMessage.info(row.resultConclusion === '无需补充' ? '本次无需补充，未创建新结果版本' : '当前任务尚无关联账单结果')
    return
  }
  ElMessage.success(`打开关联结果：${bills.join('、')}`)
}

</script>

<template>
  <div class="app-shell" :class="{ 'is-collapsed': collapsed, 'is-embedded': embedded }">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark"><Coin /></div>
        <div v-if="!collapsed" class="brand-copy"><strong>BMS</strong><span>账单管理系统</span></div>
      </div>

      <nav class="main-nav" aria-label="账单系统菜单">
        <template v-for="group in menuGroups" :key="group.label">
          <div v-if="!collapsed" class="nav-section-label">{{ group.label }}</div>
          <button
            v-for="item in group.items"
            :key="item.key"
            class="nav-item"
            :class="{ active: activeMenu === item.key }"
            :title="collapsed ? item.label : ''"
            :aria-label="item.label"
            @click="activeMenu = item.key"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            <span v-if="!collapsed">{{ item.label }}</span>
            <i v-if="item.key === 'tasks' && !collapsed" class="nav-count">{{ taskRecords.filter((task) => ['PENDING', 'RUNNING', 'FAILED'].includes(task.status)).length }}</i>
          </button>
        </template>
      </nav>

      <div class="sidebar-spacer" />
      <div v-if="!collapsed" class="side-meta">
        <span class="meta-dot" />
        <div><strong>任务服务正常</strong><small>最近检查 10:26</small></div>
      </div>
      <button class="collapse-button" :title="collapsed ? '展开菜单' : '收起菜单'" @click="collapsed = !collapsed">
        <el-icon><Expand v-if="collapsed" /><Fold v-else /></el-icon><span v-if="!collapsed">收起菜单</span>
      </button>
    </aside>

    <section class="workspace">
      <header class="topbar">
        <div class="topbar-left"><el-icon class="mobile-menu"><Menu /></el-icon><span>账单系统</span><i>/</i><strong>{{ currentGroup?.label }}</strong><i>/</i><span>{{ currentMenu?.label }}</span></div>
        <div class="topbar-actions">
          <button class="icon-action" title="全局搜索"><el-icon><Search /></el-icon></button>
          <button class="icon-action notification" title="通知" @click="notifications = 0">
            <el-icon><Bell /></el-icon><b v-if="notifications">{{ notifications }}</b>
          </button>
          <button class="icon-action" title="帮助"><el-icon><QuestionFilled /></el-icon></button>
          <span class="topbar-divider" />
          <button class="profile-action">
            <span class="avatar"><User /></span>
            <span class="profile-copy"><strong>谭清辉</strong><small>财务管理员</small></span>
            <el-icon><ArrowDown /></el-icon>
          </button>
        </div>
      </header>

      <main class="page-main">
        <template v-if="activeMenu === 'tasks'">
        <div class="page-heading">
          <div><div class="eyebrow">BMS TASKS</div><h1>BMS任务</h1></div>
          <div class="heading-actions">
            <el-button :icon="Download">导出任务</el-button>
            <el-button type="primary" :icon="Refresh" @click="refreshTasks">刷新状态</el-button>
          </div>
        </div>

        <section class="panel work-panel">
          <div class="filter-toolbar task-filter-toolbar">
            <div class="filter-group primary-filters">
              <el-input v-model="taskQuery.keyword" :prefix-icon="Search" placeholder="任务编号 / 配置 / 客户 / 会员编码" clearable class="keyword-input wide" />
              <el-select v-model="taskQuery.executionLevel" placeholder="全部执行级别" clearable @change="handleExecutionLevelChange">
                <el-option v-for="(label, key) in executionLevelMeta" :key="key" :label="label" :value="key" />
              </el-select>
              <el-select v-model="taskQuery.status" placeholder="全部任务状态" clearable>
                <el-option v-for="(meta, key) in statusMeta" :key="key" :label="meta.label" :value="key" />
              </el-select>
              <el-select v-model="taskQuery.calculationType" placeholder="全部计算类型" clearable :disabled="isFeePoolFilter">
                <el-option v-for="(label, key) in calculationMeta" :key="key" :label="label" :value="key" />
              </el-select>
            </div>
            <div class="filter-actions">
              <el-button :icon="Operation" @click="advancedVisible = !advancedVisible">高级筛选</el-button>
              <el-button @click="resetFilters">重置</el-button>
            </div>
          </div>

          <div v-show="advancedVisible" class="advanced-filters">
            <el-select v-model="taskQuery.initiateIntent" placeholder="全部发起意图" clearable :disabled="isFeePoolFilter">
              <el-option v-for="(label, key) in intentMeta" :key="key" :label="label" :value="key" />
            </el-select>
            <el-select v-model="taskQuery.actualMode" placeholder="全部实际生成方式" clearable :disabled="isFeePoolFilter">
              <el-option v-for="(label, key) in actualModeMeta" :key="key" :label="label" :value="key" />
            </el-select>
            <el-select v-model="taskQuery.periodClose" placeholder="是否期末收口" clearable :disabled="isFeePoolFilter">
              <el-option label="是" value="是" /><el-option label="否" value="否" />
            </el-select>
            <el-select v-model="taskQuery.triggerType" placeholder="全部触发方式" clearable>
              <el-option v-for="(label, key) in triggerMeta" :key="key" :label="label" :value="key" />
            </el-select>
            <el-select v-model="taskQuery.pullType" placeholder="全部拉取类型" clearable>
              <el-option v-for="(label, key) in pullTypeMeta" :key="key" :label="label" :value="key" />
            </el-select>
            <el-select v-model="taskQuery.configType" placeholder="全部配置类型" clearable>
              <el-option label="默认配置" value="默认配置" /><el-option label="分支配置" value="分支配置" />
            </el-select>
            <el-select v-model="taskQuery.shop" placeholder="全部店铺" clearable>
              <el-option v-for="shop in ['深圳集运店', '义乌集运店', '广州同行店', '上海集运店', '全部店铺']" :key="shop" :label="shop" :value="shop" />
            </el-select>
            <el-date-picker v-model="taskQuery.period" type="daterange" range-separator="至" start-placeholder="账期开始日期" end-placeholder="账期结束日期" />
          </div>

          <div class="summary-grid prd-summary">
            <button
              v-for="item in taskSummary"
              :key="item.label"
              :class="['summary-card', item.tone, { active: taskQuery.status === item.key }]"
              @click="setSummaryFilter(item.key)"
            >
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
              <el-icon><component :is="item.icon" /></el-icon>
            </button>
          </div>

          <div class="result-summary">
            筛选结果 <strong>{{ filteredTasks.length }}</strong> 条
            <span class="refresh-copy">最后刷新 {{ lastRefreshedAt }}</span>
          </div>

          <el-table :data="filteredTasks" class="clean-table" row-key="taskNo">
            <el-table-column prop="taskNo" label="任务编号" width="185" fixed />
            <el-table-column label="任务状态" width="98">
              <template #default="scope"><span :class="['status-tag', taskStatus(scope.row).className]">{{ taskStatus(scope.row).label }}</span></template>
            </el-table-column>
            <el-table-column prop="createdAt" label="任务创建时间" width="160" />
            <el-table-column prop="duration" label="执行耗时" width="90" />
            <el-table-column label="执行级别" width="96"><template #default="scope">{{ display(executionLevelMeta, scope.row.executionLevel) }}</template></el-table-column>
            <el-table-column label="计算类型" width="92"><template #default="scope">{{ display(calculationMeta, scope.row.calculationType) }}</template></el-table-column>
            <el-table-column label="发起意图" width="94"><template #default="scope">{{ display(intentMeta, scope.row.initiateIntent) }}</template></el-table-column>
            <el-table-column label="实际生成方式" width="110"><template #default="scope">{{ display(actualModeMeta, scope.row.actualMode) }}</template></el-table-column>
            <el-table-column prop="periodClose" label="期末收口" width="86"><template #default="scope">{{ scope.row.periodClose || '不适用' }}</template></el-table-column>
            <el-table-column label="触发方式" width="112"><template #default="scope">{{ display(triggerMeta, scope.row.triggerType) }}</template></el-table-column>
            <el-table-column label="数据拉取类型" width="104"><template #default="scope">{{ display(pullTypeMeta, scope.row.pullType) }}</template></el-table-column>
            <el-table-column label="账单配置" min-width="185">
              <template #default="scope"><div class="main-cell"><strong>{{ scope.row.configNo }}</strong><small>{{ scope.row.configType }} · {{ scope.row.configVersion }}</small></div></template>
            </el-table-column>
            <el-table-column label="客户" min-width="190">
              <template #default="scope"><div class="main-cell"><strong>{{ scope.row.customerName }}</strong><small>{{ scope.row.customerNo }} / {{ scope.row.memberCode }}</small></div></template>
            </el-table-column>
            <el-table-column prop="shop" label="店铺" width="120" />
            <el-table-column prop="period" label="账期" width="188" />
            <el-table-column prop="dataCutoff" label="数据截止点" width="160" />
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="scope">
                <el-button link type="primary" :icon="View" @click="openDetail(scope.row)">详情</el-button>
                <el-button v-if="scope.row.status === 'SUCCESS' && scope.row.executionLevel === 'BILL_CALCULATION'" link type="primary" :icon="DocumentChecked" @click="viewResult(scope.row)">关联结果</el-button>
                <el-button v-if="scope.row.status === 'FAILED' && scope.row.executionLevel === 'BILL_CALCULATION'" link type="warning" :icon="RefreshRight" @click="rerunTask(scope.row)">重新执行</el-button>
                <el-button v-if="['PENDING', 'FAILED'].includes(scope.row.status) && scope.row.executionLevel === 'BILL_CALCULATION'" link type="danger" :icon="Delete" @click="deleteTask(scope.row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="table-pagination"><span>展示 1-{{ filteredTasks.length }} 条</span><el-pagination layout="prev, pager, next" :total="filteredTasks.length" :page-size="10" /></div>
        </section>
        </template>
        <component v-else-if="currentView" :is="currentView.component" v-bind="currentView.props || {}" />
      </main>
    </section>

    <el-drawer v-model="detailVisible" size="760px" class="detail-drawer">
      <template #header>
        <div class="drawer-title"><span>任务详情</span><small>{{ selectedTask?.taskNo }}</small></div>
      </template>

      <template v-if="selectedTask">
        <div class="task-hero">
          <div class="task-identity">
            <span :class="['status-dot', taskStatus(selectedTask).className]" />
            <strong>{{ taskStatus(selectedTask).label }}</strong>
            <small>{{ display(executionLevelMeta, selectedTask.executionLevel) }} · {{ display(triggerMeta, selectedTask.triggerType) }}</small>
          </div>
          <div class="drawer-actions">
            <el-button v-if="selectedTask.status === 'FAILED' && selectedTask.executionLevel === 'BILL_CALCULATION'" type="primary" :icon="RefreshRight" @click="rerunTask(selectedTask)">重新执行</el-button>
            <el-button v-if="['PENDING', 'FAILED'].includes(selectedTask.status) && selectedTask.executionLevel === 'BILL_CALCULATION'" :icon="Delete" @click="deleteTask(selectedTask)">删除</el-button>
          </div>
        </div>

        <el-tabs v-model="detailTab" class="drawer-tabs">
          <el-tab-pane label="任务概览" name="overview">
            <dl class="detail-grid">
              <div><dt>任务编号</dt><dd>{{ selectedTask.taskNo }}</dd></div>
              <div><dt>任务创建时间</dt><dd>{{ selectedTask.createdAt }}</dd></div>
              <div><dt>执行级别</dt><dd>{{ display(executionLevelMeta, selectedTask.executionLevel) }}</dd></div>
              <div><dt>计算类型</dt><dd>{{ display(calculationMeta, selectedTask.calculationType) }}</dd></div>
              <div><dt>触发方式</dt><dd>{{ display(triggerMeta, selectedTask.triggerType) }}</dd></div>
              <div><dt>发起意图</dt><dd>{{ display(intentMeta, selectedTask.initiateIntent) }}</dd></div>
              <div><dt>实际生成方式</dt><dd>{{ display(actualModeMeta, selectedTask.actualMode) }}</dd></div>
              <div><dt>是否期末收口</dt><dd>{{ selectedTask.periodClose || '不适用' }}</dd></div>
              <div><dt>数据拉取类型</dt><dd>{{ display(pullTypeMeta, selectedTask.pullType) }}</dd></div>
              <div><dt>执行开始时间</dt><dd>{{ selectedTask.startedAt }}</dd></div>
              <div><dt>执行耗时</dt><dd>{{ selectedTask.duration }}</dd></div>
            </dl>
            <h4 class="section-title">业务范围</h4>
            <dl class="detail-grid">
              <div><dt>账单配置</dt><dd>{{ selectedTask.configNo }} · {{ selectedTask.configVersion }}</dd></div>
              <div><dt>配置类型</dt><dd>{{ selectedTask.configType }}</dd></div>
              <div><dt>客户</dt><dd>{{ selectedTask.customerName }} / {{ selectedTask.customerNo }}</dd></div>
              <div><dt>会员编码 / 店铺</dt><dd>{{ selectedTask.memberCode }} / {{ selectedTask.shop }}</dd></div>
              <div><dt>账期</dt><dd>{{ selectedTask.period }}</dd></div>
              <div><dt>数据截止点</dt><dd>{{ selectedTask.dataCutoff }}</dd></div>
            </dl>
          </el-tab-pane>

          <el-tab-pane label="执行快照" name="snapshot">
            <h4 class="section-title first-title">任务执行快照</h4>
            <pre class="json-box">{{ snapshotJson }}</pre>
            <h4 class="section-title">来源查询语句（SQL）</h4>
            <pre v-if="selectedTask.sourceSql" class="json-box sql-box">{{ selectedTask.sourceSql }}</pre>
            <div v-else class="na-box">不适用：账单重算跳过来源数据筛选和费项入池。</div>
          </el-tab-pane>

          <el-tab-pane label="结果与错误" name="result">
            <div class="result-matrix">
              <div><span>来源数据</span><strong>{{ selectedTask.sourceCount.toLocaleString() }}</strong></div>
              <div><span>入池费项</span><strong>{{ selectedTask.pooledFeeCount.toLocaleString() }}</strong></div>
              <div><span>关联账单</span><strong>{{ selectedTask.billCount }}</strong></div>
              <div><span>结果结论</span><strong class="text-result">{{ selectedTask.resultConclusion }}</strong></div>
              <div><span>结果版本</span><strong class="text-result">{{ selectedTask.resultVersion }}</strong></div>
              <div><span>金额净变动（CNY）</span><strong :class="['amount-result', { negative: selectedTask.netChange < 0 }]">{{ formatAmount(selectedTask.netChange) }}</strong></div>
            </div>

            <template v-if="selectedTask.originalBills.length || selectedTask.newBills.length">
              <h4 class="section-title">账单结果关系</h4>
              <div class="bill-relations">
                <div><span>原账单清单</span><strong>{{ selectedTask.originalBills.join('、') || '不适用' }}</strong></div>
                <div><span>新账单清单</span><strong>{{ selectedTask.newBills.join('、') || '未生成新账单' }}</strong></div>
              </div>
            </template>

            <h4 class="section-title">错误与处理建议</h4>
            <div :class="['error-box', selectedTask.error ? 'has-error' : '']">
              <strong>{{ selectedTask.error ? '任务执行失败' : '当前任务没有错误信息' }}</strong>
              <span v-if="selectedTask.error">{{ selectedTask.error }}</span>
              <span v-if="selectedTask.advice">处理建议：{{ selectedTask.advice }}</span>
            </div>
          </el-tab-pane>
        </el-tabs>
      </template>
    </el-drawer>
  </div>
</template>
