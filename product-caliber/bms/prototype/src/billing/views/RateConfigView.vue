<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus/es/components/message/index.mjs'
import { ElMessageBox } from 'element-plus/es/components/message-box/index.mjs'
import { Delete, EditPen, Plus, RefreshRight, UploadFilled, View } from '@element-plus/icons-vue'
import ConditionFilter from '../../shared/components/ConditionFilter.vue'
import HoverActionMenu from '../../shared/components/HoverActionMenu.vue'
import DataTableFrame from '../../shared/components/DataTableFrame.vue'
import ImportDialog from '../../shared/components/ImportDialog.vue'
import StatusTag from '../../shared/components/StatusTag.vue'
import { useStagedQuery } from '../../shared/composables/useStagedQuery.js'
import { billingBaseRateFixtures, billingRateFixtures } from '../../data/fixtures/billingRates.ts'
import { useDemoDataset } from '../data/useDemoDataset.js'

const baseRates = useDemoDataset('billingBaseRates', billingBaseRateFixtures)
const rateRows = useDemoDataset('billingRates', billingRateFixtures, 3)
const importVisible = ref(false)
const editorVisible = ref(false)
const editingId = ref(null)
const draft = ref(null)

const scopeTypes = [
  { label: '店铺级', value: 'STORE' },
  { label: '客户组级', value: 'GROUP' },
  { label: '客户级', value: 'CUSTOMER' },
]
const scopeOptions = {
  STORE: ['星际货运(中转)', '星际中转2', '台湾集运店'],
  GROUP: ['台湾大客户组', '日本同行组', '美国电商组'],
  CUSTOMER: ['OG4155 OceanGate Logistics', 'TK9012 TopKing Supply', 'NW2048 NorthWind Cargo'],
}
const currencyPairs = [
  { label: 'USD -> CNY', value: 'USD -> CNY' },
  { label: 'GBP -> CNY', value: 'GBP -> CNY' },
  { label: 'CAD -> CNY', value: 'CAD -> CNY' },
  { label: 'CNY -> USD', value: 'CNY -> USD' },
  { label: 'CNY -> GBP', value: 'CNY -> GBP' },
]
const initialQuery = { scopeType: '', scopeText: '', status: '' }
const { query, appliedQuery, applyQuery, resetQuery } = useStagedQuery(initialQuery)

const filteredRates = computed(() => rateRows.value.filter((row) =>
  (!appliedQuery.scopeType || row.scopeType === appliedQuery.scopeType)
  && (!appliedQuery.scopeText || row.scope.join('、').includes(appliedQuery.scopeText))
  && (!appliedQuery.status || row.status === appliedQuery.status)))

const formatDirection = (direction) => direction.replace('->', '→')
const formatRate = (rate) => {
  if (rate === null || rate === undefined || rate === '--') return '--'
  const value = Number(rate)
  return Number.isNaN(value) ? '--' : value.toFixed(6)
}
const scopeTypeLabel = (value) => scopeTypes.find((item) => item.value === value)?.label || '-'
const scopeText = (scope = []) => scope.join('、') || '-'
const currentScopeOptions = computed(() => draft.value ? scopeOptions[draft.value.scopeType] || [] : [])
const simpleAction = (name) => ElMessage.success(`${name}已提交`)
const finishImport = (file) => ElMessage.success(`${file.name} 已导入，汇率校验任务已创建`)

function rateBase(row) {
  const matched = baseRates.value.find((item) => item.direction === row.direction && item.status === '生效')
  return matched ? Number(matched.rate) : (row.base === '--' || row.base == null ? null : Number(row.base))
}
function formatAdjustValue(row) {
  if (row.method === '百分比缩放') return `${row.adjustValue}%`
  return row.adjustValue
}
function clearScope() {
  if (draft.value) draft.value.scope = []
}
function syncDirection(value) {
  if (!draft.value) return
  draft.value.direction = value
  const matched = baseRates.value.find((item) => item.direction === value && item.status === '生效')
  draft.value.base = matched ? Number(matched.rate) : '--'
}
function syncMethod(value) {
  if (!draft.value) return
  draft.value.method = value
  draft.value.adjustDirection = value === '固定汇率值' ? '直接指定' : '上浮'
}
function openNewRate() {
  editingId.value = null
  draft.value = {
    id: `R-${Date.now()}`,
    scopeType: 'CUSTOMER',
    scope: [],
    pair: 'USD / CNY',
    direction: 'USD -> CNY',
    method: '百分比缩放',
    adjustDirection: '上浮',
    adjustValue: 1.5,
    base: rateBase({ direction: 'USD -> CNY', base: '--' }),
    result: null,
    status: '启用',
  }
  editorVisible.value = true
}
function openEditRate(row) {
  editingId.value = row.id
  draft.value = { ...row, scope: [...row.scope] }
  editorVisible.value = true
}
function computeResult(row) {
  if (row.method === '固定汇率值') {
    row.result = Number(row.adjustValue)
    return
  }
  const base = rateBase(row)
  if (base == null) {
    row.result = null
    return
  }
  const value = Number(row.adjustValue)
  const sign = row.adjustDirection === '下浮' ? -1 : 1
  row.result = row.method === '百分比缩放' ? base * (1 + sign * value / 100) : base + sign * value
  row.base = base
}
function saveRate() {
  if (!draft.value?.scopeType) return ElMessage.warning('请选择适用层级')
  if (!draft.value?.scope?.length) return ElMessage.warning('请至少选择一个适用对象')
  if (!draft.value?.direction) return ElMessage.warning('请选择货币对和汇兑方向')
  if (!draft.value?.adjustValue || Number(draft.value.adjustValue) <= 0) return ElMessage.warning('调整值必须大于 0')
  computeResult(draft.value)
  const index = rateRows.value.findIndex((row) => row.id === editingId.value)
  if (index >= 0) rateRows.value.splice(index, 1, { ...draft.value })
  else rateRows.value.unshift({ ...draft.value })
  ElMessage.success('特调汇率已保存')
  editorVisible.value = false
}
function toggleStatus(row) {
  row.status = row.status === '启用' ? '停用' : '启用'
  ElMessage.success(`特调汇率已${row.status}`)
}
async function removeBaseRate(row) {
  await ElMessageBox.confirm(`确认删除 ${formatDirection(row.direction)} 的基准汇率？`, '删除基准汇率', { type: 'warning' })
  baseRates.value.splice(baseRates.value.indexOf(row), 1)
  ElMessage.success('基准汇率已删除')
}
function viewRate(row) {
  ElMessage.info(`打开 ${scopeTypeLabel(row.scopeType)} ${scopeText(row.scope)} 的特调汇率明细`)
}
</script>

<template>
  <div class="module-page rate-config-page">
    <div class="rate-config-grid">
      <section class="rate-panel base-rate-panel">
        <header class="rate-panel-head">
          <div>
            <h2>基准汇率表</h2>
            <p>维护外币到财务本位币的默认汇率</p>
          </div>
        </header>

        <DataTableFrame class="rate-table-frame" :total="baseRates.length" :page-size="20" :column-sort="false">
          <template #actions><el-button :icon="RefreshRight" disabled>抓取</el-button><el-button :icon="UploadFilled" @click="importVisible = true">导入</el-button></template>
          <el-table :data="baseRates" class="clean-table rate-table" border height="100%">
            <el-table-column label="货币对" min-width="130">
              <template #default="scope"><strong>{{ formatDirection(scope.row.direction) }}</strong></template>
            </el-table-column>
            <el-table-column label="汇率" width="112">
              <template #default="scope"><strong class="rate-value">{{ formatRate(scope.row.rate) }}</strong></template>
            </el-table-column>
            <TableActionColumn compact>
              <template #default="scope">
                <HoverActionMenu>
                  <el-dropdown-item :icon="EditPen" @click="simpleAction('汇率编辑')">编辑</el-dropdown-item>
                  <el-dropdown-item class="danger-action" :icon="Delete" @click="removeBaseRate(scope.row)">删除</el-dropdown-item>
                </HoverActionMenu>
              </template>
            </TableActionColumn>
          </el-table>
        </DataTableFrame>
      </section>

      <section class="rate-panel rate-panel-wide">
        <header class="rate-panel-head rate-panel-head-stack">
          <div>
            <h2>特调汇率</h2>
            <p>按店铺、客户组或客户覆盖默认汇率</p>
          </div>
          <div class="rate-panel-filters">
            <ConditionFilter v-model="query.scopeType" label="适用层级" :options="scopeTypes" />
            <ConditionFilter v-model="query.scopeText" label="适用对象" type="text" />
            <ConditionFilter v-model="query.status" label="状态" :options="['启用','停用']" />
            <div class="condition-filter-actions linked-query-actions">
              <el-button type="primary" @click="applyQuery">查询</el-button>
              <el-button @click="resetQuery">重置</el-button>
            </div>
          </div>
        </header>

        <DataTableFrame class="rate-table-frame" :total="filteredRates.length" :page-size="20" :column-sort="false">
          <template #actions><el-button type="primary" :icon="Plus" @click="openNewRate">添加</el-button></template>
          <el-table :data="filteredRates" class="clean-table rate-table" border height="100%" row-key="id">
            <el-table-column label="适用层级" width="110">
              <template #default="scope"><strong>{{ scopeTypeLabel(scope.row.scopeType) }}</strong></template>
            </el-table-column>
            <el-table-column label="适用对象" min-width="240" :show-overflow-tooltip="true">
              <template #default="scope">{{ scopeText(scope.row.scope) }}</template>
            </el-table-column>
            <el-table-column label="货币对" width="145">
              <template #default="scope"><strong>{{ formatDirection(scope.row.direction) }}</strong></template>
            </el-table-column>
            <el-table-column prop="method" label="调整方式" width="120" />
            <el-table-column label="调整值" width="100">
              <template #default="scope">{{ formatAdjustValue(scope.row) }}</template>
            </el-table-column>
            <el-table-column label="特调后默认汇率" width="160">
              <template #default="scope"><strong class="rate-value">{{ formatRate(scope.row.result) }}</strong></template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="scope"><StatusTag :label="scope.row.status" /></template>
            </el-table-column>
            <TableActionColumn compact>
              <template #default="scope">
                <div class="row-action-cell">
                  <el-button class="table-detail-button" link type="primary" :icon="View" title="详情" aria-label="详情" @click="viewRate(scope.row)" />
                  <HoverActionMenu>
                    <el-dropdown-item :icon="EditPen" @click="openEditRate(scope.row)">编辑</el-dropdown-item>
                    <el-dropdown-item @click="toggleStatus(scope.row)">{{ scope.row.status === '启用' ? '停用' : '启用' }}</el-dropdown-item>
                  </HoverActionMenu>
                </div>
              </template>
            </TableActionColumn>
          </el-table>
        </DataTableFrame>
      </section>
    </div>
    <ImportDialog v-model="importVisible" title="导入基准汇率" template-name="基准汇率导入模板.xlsx" @submit="finishImport" />
    <el-dialog v-model="editorVisible" class="module-dialog" align-center append-to-body destroy-on-close :close-on-click-modal="false">
      <template #header><div class="drawer-title"><span>{{ editingId ? '编辑特调汇率' : '添加特调汇率' }}</span><small>特调汇率</small></div></template>
      <el-form v-if="draft" label-position="top" class="rate-editor-grid">
        <el-form-item label="适用层级" required><el-select v-model="draft.scopeType" @change="clearScope"><el-option v-for="item in scopeTypes" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item>
        <el-form-item label="适用对象" required><el-select v-model="draft.scope" multiple filterable collapse-tags placeholder="请选择适用对象"><el-option v-for="item in currentScopeOptions" :key="item" :label="item" :value="item" /></el-select></el-form-item>
        <el-form-item label="货币对 / 汇兑方向" required><el-select v-model="draft.direction" @change="syncDirection"><el-option v-for="item in currencyPairs" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item>
        <el-form-item label="调整方式"><el-select v-model="draft.method" @change="syncMethod"><el-option label="百分比缩放" value="百分比缩放" /><el-option label="固定汇率差" value="固定汇率差" /><el-option label="固定汇率值" value="固定汇率值" /></el-select></el-form-item>
        <el-form-item label="调整方向"><el-select v-model="draft.adjustDirection" :disabled="draft.method === '固定汇率值'"><el-option label="上浮" value="上浮" /><el-option label="下浮" value="下浮" /><el-option v-if="draft.method === '固定汇率值'" label="直接指定" value="直接指定" /></el-select></el-form-item>
        <el-form-item label="调整值"><el-input v-model="draft.adjustValue" /></el-form-item>
        <el-form-item label="基准汇率"><el-input :model-value="formatRate(rateBase(draft))" disabled /></el-form-item>
        <el-form-item label="特调后默认汇率"><el-input :model-value="formatRate(draft.result)" disabled /></el-form-item>
      </el-form>
      <template #footer><div class="config-drawer-footer"><el-button @click="editorVisible = false">取消</el-button><el-button type="primary" @click="saveRate">保存</el-button></div></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.rate-panel-head-stack { flex-wrap: wrap; }
.rate-panel-filters { min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.rate-editor-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
.rate-editor-grid :deep(.el-form-item) { margin-bottom: 0; }
.config-drawer-footer { display: flex; justify-content: flex-end; gap: 8px; padding-right: var(--space-2); }
@media (max-width: 760px) {
  .rate-panel-filters { width: 100%; }
  .rate-editor-grid { grid-template-columns: 1fr; }
}
</style>
