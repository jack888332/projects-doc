<script setup>
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus/es/components/message/index.mjs'
import { ElMessageBox } from 'element-plus/es/components/message-box/index.mjs'
import {
  Delete, DocumentChecked, Download, Operation, Refresh, RefreshRight, View,
} from '@element-plus/icons-vue'
import ProcessView from './ProcessView.vue'
import ConditionFilter from '../../shared/components/ConditionFilter.vue'
import HoverActionMenu from '../../shared/components/HoverActionMenu.vue'
import MetricGrid from '../../shared/components/MetricGrid.vue'
import PageHeader from '../../shared/components/PageHeader.vue'
import StackedCell from '../../shared/components/StackedCell.vue'
import StatusTag from '../../shared/components/StatusTag.vue'
import DataTableFrame from '../../shared/components/DataTableFrame.vue'
import { useStagedQuery } from '../../shared/composables/useStagedQuery.js'
import { billingTaskFixtures, sourceScansByTaskId } from '../../data/fixtures/billingTasks.ts'
import { useDemoDataset } from '../data/useDemoDataset.js'

const props = defineProps({
  initialTaskTab: { type: String, default: 'list' },
})

const taskPageTab = ref(props.initialTaskTab)
const detailVisible = ref(false)
const detailTab = ref('overview')
const selectedTask = ref(null)
const advancedVisible = ref(false)

const initialTaskQuery = {
  keyword: '',
  taskType: '',
  status: '',
  generationMode: '',
  triggerType: '',
  configType: '',
  shop: '',
  period: [],
}
const { query: taskQuery, appliedQuery: appliedTaskQuery, applyQuery: applyTaskQuery, resetQuery: resetTaskQuery } = useStagedQuery(initialTaskQuery)

const statusMeta = {
  PENDING: { label: '待执行', className: 'info' },
  RUNNING: { label: '执行中', className: 'running' },
  SUCCESS: { label: '执行成功', className: 'success' },
  FAILED: { label: '执行失败', className: 'danger' },
}

const taskTypeMeta = {
  FEE_POOL: '费项入池',
  BILL_GENERATE: '账单生成',
  BILL_RECALCULATE: '账单重算',
}

const generationModeMeta = {
  PENDING: '待判定',
  FIRST: '首次生成',
  SUPPLEMENT: '补充生成',
  REPLACE: '替换生成',
}

const triggerMeta = {
  SCHEDULED: '定时',
  MANUAL: '手动',
}

const taskRecords = useDemoDataset('billingTasks', billingTaskFixtures)
const canFilterGenerationMode = computed(() => !taskQuery.taskType || taskQuery.taskType === 'BILL_GENERATE')
const selectedSourceScans = computed(() => sourceScansByTaskId[selectedTask.value?.id] || [])

const filteredTasks = computed(() => taskRecords.value.filter((item) => {
  const keyword = `${item.taskNo}${item.configNo}${item.customerName}${item.customerNo}${item.memberCode}${item.shop}`.toLowerCase()
  const periodMatched = !appliedTaskQuery.period?.length
    || (dayjs(item.periodStart).isAfter(dayjs(appliedTaskQuery.period[0]).subtract(1, 'day'))
      && dayjs(item.periodEnd).isBefore(dayjs(appliedTaskQuery.period[1]).add(1, 'day')))
  return (!appliedTaskQuery.keyword || keyword.includes(appliedTaskQuery.keyword.toLowerCase()))
    && (!appliedTaskQuery.taskType || item.taskType === appliedTaskQuery.taskType)
    && (!appliedTaskQuery.status || item.status === appliedTaskQuery.status)
    && (!appliedTaskQuery.generationMode || item.generationMode === appliedTaskQuery.generationMode)
    && (!appliedTaskQuery.triggerType || item.triggerType === appliedTaskQuery.triggerType)
    && (!appliedTaskQuery.configType || item.configType === appliedTaskQuery.configType)
    && (!appliedTaskQuery.shop || item.shop === appliedTaskQuery.shop)
    && periodMatched
}))

const taskSummary = computed(() => {
  const rows = filteredTasks.value
  return [
    { key: '', label: '任务总数', value: rows.length, tone: 'blue' },
    { key: 'PENDING', label: '待执行任务', value: rows.filter((item) => item.status === 'PENDING').length, tone: 'slate' },
    { key: 'RUNNING', label: '执行中任务', value: rows.filter((item) => item.status === 'RUNNING').length, tone: 'violet' },
    { key: 'SUCCESS', label: '执行成功任务', value: rows.filter((item) => item.status === 'SUCCESS').length, tone: 'green' },
    { key: 'FAILED', label: '执行失败任务', value: rows.filter((item) => item.status === 'FAILED').length, tone: 'red' },
  ]
})

const snapshotJson = computed(() => JSON.stringify({
  executionSnapshot: {
    scopeKey: selectedTask.value?.scopeKey,
    dataCutoff: selectedTask.value?.dataCutoff,
    taskType: selectedTask.value?.taskType,
    generationMode: selectedTask.value?.generationMode || 'N/A',
    targetBills: selectedTask.value?.originalBills,
    recalculateScope: selectedTask.value?.recalculateScope || 'N/A',
    sourceScanMethods: selectedSourceScans.value.map((item) => `${item.dataset}: ${item.method}`),
  },
  businessSnapshotReferences: {
    billConfig: `${selectedTask.value?.configNo}@${selectedTask.value?.configVersion}`,
    sourceRule: 'DSR-OFP-AR@V5',
    feeRule: 'FR-AR-CUSTOMER@V9',
    exchangeRate: 'FX-CUSTOMER@20260802',
  },
}, null, 2))

function display(meta, value) {
  return value ? (meta[value] || value) : '--'
}

function taskStatus(row) {
  return statusMeta[row.status] || statusMeta.PENDING
}

function formatAmount(value) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function handleTaskTypeChange(value) {
  if (value !== 'BILL_GENERATE') {
    taskQuery.generationMode = ''
  }
}

function resetFilters() {
  resetTaskQuery()
}

function refreshTasks() {
  ElMessage.success('任务状态已刷新')
}

function openDetail(row, tab = 'overview') {
  selectedTask.value = row
  detailTab.value = tab
  detailVisible.value = true
}

async function rerunTask(row) {
  if (row.taskType === 'FEE_POOL' || row.status !== 'FAILED') return
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
  const canDelete = row.taskType !== 'FEE_POOL' && ['PENDING', 'FAILED'].includes(row.status)
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
  <div class="billing-task-page">
        <PageHeader v-if="taskPageTab === 'list'">
          <template #export>
            <el-button :icon="Download">导出任务</el-button>
          </template>
        </PageHeader>

        <el-tabs v-model="taskPageTab" class="task-page-tabs">
          <el-tab-pane label="任务列表" name="list">
        <section class="panel work-panel task-list-panel">
          <div class="filter-toolbar task-filter-toolbar">
            <div class="condition-filter-bar">
              <ConditionFilter v-model="taskQuery.keyword" label="关键词" type="text" search-placeholder="任务编号 / 配置 / 客户 / 会员编码" />
              <ConditionFilter v-model="taskQuery.taskType" label="任务类型" :options="Object.entries(taskTypeMeta).map(([value, label]) => ({ value, label }))" @change="handleTaskTypeChange" />
              <ConditionFilter v-model="taskQuery.status" label="任务状态" :options="Object.entries(statusMeta).map(([value, meta]) => ({ value, label: meta.label }))" />
              <template v-if="advancedVisible">
                <ConditionFilter v-model="taskQuery.generationMode" label="账单生成方式" :options="Object.entries(generationModeMeta).map(([value, label]) => ({ value, label }))" :disabled="!canFilterGenerationMode" />
                <ConditionFilter v-model="taskQuery.triggerType" label="触发方式" :options="Object.entries(triggerMeta).map(([value, label]) => ({ value, label }))" />
                <ConditionFilter v-model="taskQuery.configType" label="配置类型" :options="['默认配置','分支配置']" />
                <ConditionFilter v-model="taskQuery.shop" label="店铺" :options="['深圳集运店','义乌集运店','广州同行店','上海集运店']" />
                <ConditionFilter v-model="taskQuery.period" label="账期" type="date-range" />
              </template>
              <div class="condition-filter-actions task-filter-actions">
                <el-button type="primary" @click="applyTaskQuery">查询</el-button>
                <el-button @click="resetFilters">重置</el-button>
                <el-button class="advanced-filter-toggle" :icon="Operation" @click="advancedVisible = !advancedVisible">{{ advancedVisible ? '隐藏高级筛选项' : '显示高级筛选项' }}</el-button>
              </div>
            </div>
          </div>

          <MetricGrid :items="taskSummary" :columns="5" />

          <DataTableFrame :total="filteredTasks.length" :selected-count="0" :page-size="10">
            <template #actions><el-button type="primary" :icon="Refresh" @click="refreshTasks">刷新状态</el-button></template>
            <el-table :data="filteredTasks" class="clean-table" row-key="taskNo">
            <el-table-column prop="taskNo" label="任务编号" width="185" fixed />
            <el-table-column label="任务状态" width="98">
              <template #default="scope"><StatusTag :label="taskStatus(scope.row).label" :tone="taskStatus(scope.row).className" /></template>
            </el-table-column>
            <el-table-column prop="createdAt" label="任务创建时间" width="160" />
            <el-table-column prop="duration" label="执行耗时" width="90" />
            <el-table-column label="任务类型" width="100"><template #default="scope">{{ display(taskTypeMeta, scope.row.taskType) }}</template></el-table-column>
            <el-table-column label="账单生成方式" width="116"><template #default="scope">{{ display(generationModeMeta, scope.row.generationMode) }}</template></el-table-column>
            <el-table-column label="触发方式" width="112"><template #default="scope">{{ display(triggerMeta, scope.row.triggerType) }}</template></el-table-column>
            <el-table-column label="账单配置" min-width="185">
              <template #default="scope"><StackedCell :primary="scope.row.configNo" :secondary="`${scope.row.configType} · ${scope.row.configVersion}`" /></template>
            </el-table-column>
            <el-table-column label="客户" min-width="190">
              <template #default="scope"><StackedCell :primary="scope.row.customerName" :secondary="`${scope.row.customerNo} / ${scope.row.memberCode}`" /></template>
            </el-table-column>
            <el-table-column prop="shop" label="店铺" width="120" />
            <el-table-column prop="period" label="账期" width="188" />
            <el-table-column prop="dataCutoff" label="数据截止点" width="160" />
            <el-table-column label="操作" width="112" fixed="right">
              <template #default="scope">
                <div class="row-action-cell">
                  <el-button class="table-detail-button" link type="primary" :icon="View" title="详情" aria-label="详情" @click="openDetail(scope.row)" />
                  <HoverActionMenu v-if="scope.row.taskType !== 'FEE_POOL'">
                    <el-dropdown-item v-if="scope.row.status === 'SUCCESS'" :icon="DocumentChecked" @click="viewResult(scope.row)">关联结果</el-dropdown-item>
                    <el-dropdown-item v-if="scope.row.status === 'FAILED'" :icon="RefreshRight" @click="rerunTask(scope.row)">重新执行</el-dropdown-item>
                    <el-dropdown-item v-if="['PENDING', 'FAILED'].includes(scope.row.status)" class="danger-action" :icon="Delete" @click="deleteTask(scope.row)">删除</el-dropdown-item>
                  </HoverActionMenu>
                </div>
              </template>
            </el-table-column>
            </el-table>
          </DataTableFrame>
        </section>
          </el-tab-pane>
          <el-tab-pane label="基础配置" name="base">
            <ProcessView mode="base" embedded />
          </el-tab-pane>
        </el-tabs>

    <el-drawer v-model="detailVisible" size="760px" class="detail-drawer">
      <template #header>
        <div class="drawer-title"><span>任务详情</span><small>{{ selectedTask?.taskNo }}</small></div>
      </template>

      <template v-if="selectedTask">
        <div class="task-hero">
          <div class="task-identity">
            <span :class="['status-dot', taskStatus(selectedTask).className]" />
            <strong>{{ taskStatus(selectedTask).label }}</strong>
            <small>{{ display(taskTypeMeta, selectedTask.taskType) }} · {{ display(triggerMeta, selectedTask.triggerType) }}</small>
          </div>
          <div class="drawer-actions">
            <el-button v-if="selectedTask.status === 'FAILED' && selectedTask.taskType !== 'FEE_POOL'" type="primary" :icon="RefreshRight" @click="rerunTask(selectedTask)">重新执行</el-button>
            <el-button v-if="['PENDING', 'FAILED'].includes(selectedTask.status) && selectedTask.taskType !== 'FEE_POOL'" :icon="Delete" @click="deleteTask(selectedTask)">删除</el-button>
          </div>
        </div>

        <el-tabs v-model="detailTab" class="drawer-tabs">
          <el-tab-pane label="任务概览" name="overview">
            <dl class="detail-grid">
              <div><dt>任务编号</dt><dd>{{ selectedTask.taskNo }}</dd></div>
              <div><dt>任务创建时间</dt><dd>{{ selectedTask.createdAt }}</dd></div>
              <div><dt>任务类型</dt><dd>{{ display(taskTypeMeta, selectedTask.taskType) }}</dd></div>
              <div><dt>触发方式</dt><dd>{{ display(triggerMeta, selectedTask.triggerType) }}</dd></div>
              <div><dt>账单生成方式</dt><dd>{{ display(generationModeMeta, selectedTask.generationMode) }}</dd></div>
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
            <h4 class="section-title first-title">来源扫描记录</h4>
            <DataTableFrame v-if="selectedSourceScans.length" :total="selectedSourceScans.length" :page-size="10">
<el-table :data="selectedSourceScans" border class="source-scan-table">
              <el-table-column prop="dataset" label="来源数据集" min-width="130" fixed="left" />
              <el-table-column prop="method" label="扫描方式" width="86">
                <template #default="scope"><el-tag :type="scope.row.method === '全量' ? 'warning' : 'success'" effect="plain">{{ scope.row.method }}</el-tag></template>
              </el-table-column>
              <el-table-column prop="range" label="扫描范围" min-width="270" />
              <el-table-column prop="previousWatermark" label="上次成功水位" min-width="230" />
              <el-table-column prop="cutoff" label="本次数据截止点" min-width="170" />
              <el-table-column label="拉取 / 命中" width="110">
                <template #default="scope">{{ scope.row.pulled.toLocaleString() }} / {{ scope.row.matched.toLocaleString() }}</template>
              </el-table-column>
              <el-table-column prop="result" label="扫描结果" width="86" />
              <el-table-column prop="failure" label="失败原因" min-width="150" />
            </el-table>
            </DataTableFrame>
            <div v-else class="na-box">不适用：账单重算不读取来源数据，也不产生来源扫描记录。</div>
            <h4 class="section-title">任务执行快照</h4>
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
                <div><span>原账单清单</span><strong>{{ selectedTask.originalBills.join('、') || '--' }}</strong></div>
                <div><span>新账单清单</span><strong>{{ selectedTask.newBills.join('、') || '未生成新账单' }}</strong></div>
                <div><span>替换影响</span><strong>{{ selectedTask.generationMode === 'REPLACE' ? '原账单作废；费项归属迁移至新账单' : '--' }}</strong></div>
                <div><span>重算范围</span><strong>{{ selectedTask.recalculateScope || '当前任务账期及目标账单内费项' }}</strong></div>
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
