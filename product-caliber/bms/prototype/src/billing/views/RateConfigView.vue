<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus/es/components/message/index.mjs'
import { ElMessageBox } from 'element-plus/es/components/message-box/index.mjs'
import { CopyDocument, Delete, EditPen, Plus, Promotion, RefreshRight, UploadFilled, View } from '@element-plus/icons-vue'
import ConditionFilter from '../../shared/components/ConditionFilter.vue'
import HoverActionMenu from '../../shared/components/HoverActionMenu.vue'
import DataTableFrame from '../../shared/components/DataTableFrame.vue'
import ImportDialog from '../../shared/components/ImportDialog.vue'
import StatusTag from '../../shared/components/StatusTag.vue'
import StackedCell from '../../shared/components/StackedCell.vue'
import ConfigMasterAssignmentDialog from '../components/ConfigMasterAssignmentDialog.vue'
import { useStagedQuery } from '../../shared/composables/useStagedQuery.js'
import { billingBaseRateFixtures, billingRateFixtures, billingRateMasterFixtures } from '../../data/fixtures/billingRates.ts'
import { useDemoDataset } from '../data/useDemoDataset.js'

const baseRates = useDemoDataset('billingBaseRates', billingBaseRateFixtures)
const rateRows = useDemoDataset('billingRates', billingRateFixtures, 4)
const rateMasters = useDemoDataset('billingRateMasters', billingRateMasterFixtures, 1)
const activeView = ref('customers')
const importVisible = ref(false)
const editorVisible = ref(false)
const assignmentVisible = ref(false)
const editingId = ref(null)
const editorKind = ref('CUSTOM')
const selectedMaster = ref(null)
const draft = ref(null)
const initialQuery = { customerText:'', store:'', group:'', sourceType:'', status:'' }
const { query, appliedQuery, applyQuery, resetQuery } = useStagedQuery(initialQuery)
const sourceTypes = [{ label:'客户自定义配置', value:'CUSTOM' }, { label:'共享配置母版', value:'MASTER' }, { label:'未配置', value:'NONE' }]
const currencyPairs = [
  { label:'USD -> CNY', value:'USD -> CNY' }, { label:'GBP -> CNY', value:'GBP -> CNY' },
  { label:'CAD -> CNY', value:'CAD -> CNY' }, { label:'CNY -> USD', value:'CNY -> USD' },
]
const stores = computed(() => [...new Set(rateRows.value.map(row => row.store))])
const groups = computed(() => [...new Set(rateRows.value.map(row => row.group))])
const customers = computed(() => rateRows.value.map(row => ({ code:row.customerCode, name:row.customerName, store:row.store, group:row.group })))
const filteredRates = computed(() => rateRows.value.filter(row =>
  (!appliedQuery.customerText || `${row.customerCode}${row.customerName}`.includes(appliedQuery.customerText))
  && (!appliedQuery.store || row.store === appliedQuery.store)
  && (!appliedQuery.group || row.group === appliedQuery.group)
  && (!appliedQuery.sourceType || row.sourceType === appliedQuery.sourceType)
  && (!appliedQuery.status || row.status === appliedQuery.status)))
const filteredMasters = computed(() => rateMasters.value.filter(row =>
  (!appliedQuery.customerText || `${row.no}${row.name}`.includes(appliedQuery.customerText))
  && (!appliedQuery.status || row.status === appliedQuery.status)))

watch(activeView, resetQuery)
const formatDirection = direction => direction?.replace('->', '→') || '-'
const formatRate = (rate) => { if (rate === null || rate === undefined || rate === '--') return '--'; const value = Number(rate); return Number.isNaN(value) ? '--' : value.toFixed(6) }
const formatAdjustValue = row => row.method === '百分比缩放' ? `${row.adjustValue}%` : row.adjustValue
const sourceLabel = value => sourceTypes.find(item => item.value === value)?.label || value
const referenceCount = master => rateRows.value.filter(row => row.masterId === master.id).length
const finishImport = file => ElMessage.success(`${file.name} 已导入，汇率校验任务已创建`)
const simpleAction = name => ElMessage.success(`${name}已提交`)
function rateBase(row) { const matched = baseRates.value.find(item => item.direction === row.direction && item.status === '生效'); return matched ? Number(matched.rate) : (row.base === '--' || row.base == null ? null : Number(row.base)) }
function computeResult(row) { if (row.method === '固定汇率值') return row.result = Number(row.adjustValue); const base = rateBase(row); if (base == null) return row.result = null; const sign = row.adjustDirection === '下浮' ? -1 : 1; row.result = row.method === '百分比缩放' ? base * (1 + sign * Number(row.adjustValue) / 100) : base + sign * Number(row.adjustValue); row.base = base }
function syncDirection(value) { draft.value.direction = value; draft.value.base = rateBase({ direction:value, base:'--' }) ?? '--'; computeResult(draft.value) }
function syncMethod(value) { draft.value.adjustDirection = value === '固定汇率值' ? '直接指定' : '上浮'; computeResult(draft.value) }
function rangeOptions(type) { return type === 'STORE' ? stores.value : type === 'GROUP' ? groups.value : customers.value.map(item => `${item.code} ${item.name}`) }
function syncRangeText() { const label = draft.value.rangeMode === 'STORE' ? '店铺' : draft.value.rangeMode === 'GROUP' ? '客户组' : '指定客户'; draft.value.rangeText = `${label}：${draft.value.rangeValues.join('、') || '待选择'}` }
function clearRange() { draft.value.rangeValues = []; syncRangeText() }
function openNew() {
  editorKind.value = activeView.value === 'masters' ? 'MASTER' : 'CUSTOM'; editingId.value = null
  draft.value = editorKind.value === 'MASTER'
    ? { id:`RM-${Date.now()}`, no:'新母版', name:'', version:'V1', rangeMode:'STORE', rangeValues:[], rangeText:'店铺：待选择', rules:1, direction:'USD -> CNY', method:'百分比缩放', adjustDirection:'上浮', adjustValue:1.5, base:rateBase({ direction:'USD -> CNY', base:'--' }), result:null, status:'启用', updatedAt:'2026-08-27 10:30' }
    : { id:`R-${Date.now()}`, customerCode:'', customerName:'', store:'', group:'', sourceType:'CUSTOM', sourceName:'客户自定义特调', sourceNo:'新配置', version:'V1', direction:'USD -> CNY', method:'百分比缩放', adjustDirection:'上浮', adjustValue:1.5, base:rateBase({ direction:'USD -> CNY', base:'--' }), result:null, status:'启用' }
  computeResult(draft.value); editorVisible.value = true
}
function openEdit(row, kind = activeView.value === 'masters' ? 'MASTER' : 'CUSTOM') { editorKind.value = kind; editingId.value = row.id; draft.value = { ...row, rangeValues:[...(row.rangeValues || [])] }; editorVisible.value = true }
function copyToCustom(row) { openEdit({ ...row, id:`R-${Date.now()}`, sourceType:'CUSTOM', sourceName:'客户自定义特调', sourceNo:'新配置', masterId:null, version:'V1' }, 'CUSTOM'); editingId.value = null }
function saveRate() {
  if (editorKind.value === 'MASTER') { if (!draft.value.name?.trim()) return ElMessage.warning('请输入母版名称'); if (!draft.value.rangeValues.length) return ElMessage.warning('请设置可分配客户范围'); syncRangeText() }
  else if (!draft.value.customerCode) return ElMessage.warning('请选择一个明确客户')
  if (!draft.value.direction) return ElMessage.warning('请选择货币对和汇兑方向')
  if (!draft.value.adjustValue || Number(draft.value.adjustValue) <= 0) return ElMessage.warning('调整值必须大于 0')
  computeResult(draft.value)
  if (editorKind.value === 'MASTER') {
    if (draft.value.no === '新母版') draft.value.no = `RATE-MASTER-${Date.now()}`
    const index = rateMasters.value.findIndex(row => row.id === editingId.value)
    if (index >= 0) rateMasters.value.splice(index, 1, { ...draft.value, version:`V${Number(draft.value.version.slice(1) || 0) + 1}` })
    else rateMasters.value.unshift({ ...draft.value })
    ElMessage.success('特调汇率母版版本已发布，客户引用保持不变')
  } else {
    const chosen = rateRows.value.find(row => row.customerCode === draft.value.customerCode)
    const customer = customers.value.find(item => item.code === draft.value.customerCode)
    if (draft.value.sourceNo === '新配置') draft.value.sourceNo = `RATE-CUSTOM-${draft.value.customerCode}`
    const saved = { ...draft.value, customerName:draft.value.customerName || customer?.name || '', store:draft.value.store || customer?.store || '', group:draft.value.group || customer?.group || '', sourceType:'CUSTOM', sourceName:'客户自定义特调', masterId:null, status:'启用' }
    if (chosen) rateRows.value.splice(rateRows.value.indexOf(chosen), 1, saved); else rateRows.value.unshift(saved)
    ElMessage.success('客户自定义特调配置已保存')
  }
  editorVisible.value = false
}
function openAssignment(master) { selectedMaster.value = master; assignmentVisible.value = true }
function inMasterRange(row, master) {
  if (!master) return false
  if (master.rangeMode === 'STORE') return master.rangeValues.includes(row.store)
  if (master.rangeMode === 'GROUP') return master.rangeValues.includes(row.group)
  return master.rangeValues.some(value => value.startsWith(`${row.customerCode} `) || value === row.customerCode)
}
function assignmentCandidates(master) { return rateRows.value.filter(row => inMasterRange(row, master)).map(row => ({ id:row.id, code:row.customerCode, name:row.customerName, store:row.store, group:row.group, sourceType:row.sourceType, sourceName:row.sourceName, masterId:row.masterId, version:row.version, blocked:false })) }
function assignCustomers(payload) {
  payload.customers.forEach((candidate) => { const row = rateRows.value.find(item => item.id === candidate.id); Object.assign(row, { sourceType:'MASTER', sourceName:selectedMaster.value.name, sourceNo:selectedMaster.value.no, masterId:selectedMaster.value.id, version:selectedMaster.value.version, direction:selectedMaster.value.direction, method:selectedMaster.value.method, adjustDirection:selectedMaster.value.adjustDirection, adjustValue:selectedMaster.value.adjustValue, base:selectedMaster.value.base, result:selectedMaster.value.result, status:'启用' }) })
  ElMessage.success(`已为 ${payload.customers.length} 个客户建立特调母版引用${payload.force ? '，强制覆盖已留痕' : ''}`)
}
async function removeBaseRate(row) { await ElMessageBox.confirm(`确认删除 ${formatDirection(row.direction)} 的基准汇率？`, '删除基准汇率', { type:'warning' }); baseRates.value.splice(baseRates.value.indexOf(row), 1); ElMessage.success('基准汇率已删除') }
function viewSource(row) { if (row.sourceType !== 'MASTER') return openEdit(row); const master = rateMasters.value.find(item => item.id === row.masterId); if (master) { activeView.value = 'masters'; openEdit(master, 'MASTER') } }
</script>

<template>
  <div class="module-page rate-config-page">
    <div class="rate-config-grid">
      <section class="rate-panel base-rate-panel"><header class="rate-panel-head"><div><h2>基准汇率表</h2><p>客户特调配置未覆盖时的统一兜底来源</p></div></header>
        <DataTableFrame class="rate-table-frame" :total="baseRates.length" :page-size="20" :column-sort="false"><template #actions><el-button :icon="RefreshRight" disabled>抓取</el-button><el-button :icon="UploadFilled" @click="importVisible = true">导入</el-button></template><el-table :data="baseRates" class="clean-table rate-table" border height="100%"><el-table-column label="货币对" min-width="130"><template #default="scope"><strong>{{ formatDirection(scope.row.direction) }}</strong></template></el-table-column><el-table-column label="汇率" width="112"><template #default="scope"><strong class="rate-value">{{ formatRate(scope.row.rate) }}</strong></template></el-table-column><TableActionColumn compact><template #default="scope"><HoverActionMenu><el-dropdown-item :icon="EditPen" @click="simpleAction('汇率编辑')">编辑</el-dropdown-item><el-dropdown-item class="danger-action" :icon="Delete" @click="removeBaseRate(scope.row)">删除</el-dropdown-item></HoverActionMenu></template></TableActionColumn></el-table></DataTableFrame>
      </section>
      <section class="rate-panel rate-panel-wide"><header class="rate-panel-head rate-panel-head-stack"><div><h2>客户特调汇率</h2><p>客户使用自定义配置，或引用一个共享母版准确版本</p></div><el-tabs v-model="activeView" class="rate-source-tabs"><el-tab-pane label="客户配置" name="customers" /><el-tab-pane label="共享配置母版" name="masters" /></el-tabs><div class="rate-panel-filters"><ConditionFilter v-model="query.customerText" :label="activeView === 'customers' ? '客户' : '母版'" type="text" /><template v-if="activeView === 'customers'"><ConditionFilter v-model="query.store" label="店铺" :options="stores" /><ConditionFilter v-model="query.group" label="客户组" :options="groups" /><ConditionFilter v-model="query.sourceType" label="配置来源" :options="sourceTypes" /></template><ConditionFilter v-model="query.status" label="状态" :options="activeView === 'customers' ? ['启用','未配置'] : ['启用','停用']" /><div class="condition-filter-actions linked-query-actions"><el-button type="primary" @click="applyQuery">查询</el-button><el-button @click="resetQuery">重置</el-button></div></div></header>
        <DataTableFrame class="rate-table-frame" :total="activeView === 'customers' ? filteredRates.length : filteredMasters.length" :page-size="20" :column-sort="false"><template #actions><el-button type="primary" :icon="Plus" @click="openNew">{{ activeView === 'customers' ? '新建自定义配置' : '新建特调母版' }}</el-button></template>
          <el-table v-if="activeView === 'customers'" :data="filteredRates" class="clean-table rate-table" border height="100%" row-key="id"><el-table-column label="客户" min-width="190"><template #default="scope"><StackedCell :primary="scope.row.customerName" :secondary="scope.row.customerCode" /></template></el-table-column><el-table-column label="配置来源" width="132"><template #default="scope"><StatusTag :label="sourceLabel(scope.row.sourceType)" :tone="scope.row.sourceType === 'MASTER' ? 'info' : scope.row.sourceType === 'CUSTOM' ? 'success' : 'warning'" /></template></el-table-column><el-table-column label="采用配置" min-width="210"><template #default="scope"><StackedCell :primary="scope.row.sourceName" :secondary="scope.row.sourceNo === '-' ? '-' : `${scope.row.sourceNo} / ${scope.row.version}`" /></template></el-table-column><el-table-column label="货币对" width="130"><template #default="scope"><strong>{{ formatDirection(scope.row.direction) }}</strong></template></el-table-column><el-table-column prop="method" label="调整方式" width="115" /><el-table-column label="调整值" width="90"><template #default="scope">{{ formatAdjustValue(scope.row) }}</template></el-table-column><el-table-column label="默认汇率" width="120"><template #default="scope"><strong class="rate-value">{{ formatRate(scope.row.result) }}</strong></template></el-table-column><el-table-column label="状态" width="88"><template #default="scope"><StatusTag :label="scope.row.status" :tone="scope.row.status === '未配置' ? 'warning' : ''" /></template></el-table-column><TableActionColumn><template #default="scope"><div class="row-action-cell"><el-button v-if="scope.row.sourceType !== 'NONE'" class="table-detail-button" link type="primary" :icon="View" title="详情" @click="viewSource(scope.row)" /><HoverActionMenu><el-dropdown-item v-if="scope.row.sourceType === 'CUSTOM'" :icon="EditPen" @click="openEdit(scope.row)">编辑自定义配置</el-dropdown-item><el-dropdown-item v-if="scope.row.sourceType === 'MASTER'" :icon="CopyDocument" @click="copyToCustom(scope.row)">复制为自定义配置</el-dropdown-item></HoverActionMenu></div></template></TableActionColumn></el-table>
          <el-table v-else :data="filteredMasters" class="clean-table rate-table" border height="100%" row-key="id"><el-table-column label="母版" min-width="210"><template #default="scope"><StackedCell :primary="scope.row.name" :secondary="scope.row.no" /></template></el-table-column><el-table-column prop="version" label="当前版本" width="85" /><el-table-column prop="rangeText" label="可分配客户范围" min-width="235" :show-overflow-tooltip="true" /><el-table-column label="引用客户" width="95"><template #default="scope"><strong>{{ referenceCount(scope.row) }}</strong></template></el-table-column><el-table-column prop="rules" label="规则数" width="75" /><el-table-column label="示例货币对" width="125"><template #default="scope">{{ formatDirection(scope.row.direction) }}</template></el-table-column><el-table-column label="状态" width="85"><template #default="scope"><StatusTag :label="scope.row.status" /></template></el-table-column><TableActionColumn><template #default="scope"><HoverActionMenu><el-dropdown-item :icon="EditPen" @click="openEdit(scope.row, 'MASTER')">发布新版本</el-dropdown-item><el-dropdown-item :icon="Promotion" @click="openAssignment(scope.row)">分配客户</el-dropdown-item></HoverActionMenu></template></TableActionColumn></el-table>
        </DataTableFrame>
      </section>
    </div>
    <ImportDialog v-model="importVisible" title="导入基准汇率" template-name="基准汇率导入模板.xlsx" @submit="finishImport" />
    <el-dialog v-model="editorVisible" class="module-dialog" align-center append-to-body destroy-on-close :close-on-click-modal="false"><template #header><div class="drawer-title"><span>{{ editorKind === 'MASTER' ? (editingId ? '发布母版新版本' : '新建特调汇率母版') : (editingId ? '编辑客户自定义特调' : '新建客户自定义特调') }}</span><small>特调汇率</small></div></template><el-form v-if="draft" label-position="top" class="rate-editor-grid">
      <template v-if="editorKind === 'MASTER'"><el-form-item label="母版名称" required><el-input v-model="draft.name" /></el-form-item><el-form-item label="可分配范围维度" required><el-select v-model="draft.rangeMode" @change="clearRange"><el-option label="店铺" value="STORE" /><el-option label="客户组" value="GROUP" /><el-option label="指定客户" value="CUSTOMER" /></el-select></el-form-item><el-form-item class="span-2" label="可分配客户范围" required><el-select v-model="draft.rangeValues" multiple filterable collapse-tags @change="syncRangeText"><el-option v-for="item in rangeOptions(draft.rangeMode)" :key="item" :label="item" :value="item" /></el-select></el-form-item></template>
      <el-form-item v-else label="客户" required><el-select v-model="draft.customerCode" filterable :disabled="Boolean(editingId)"><el-option v-for="item in customers" :key="item.code" :label="`${item.code} ${item.name}`" :value="item.code" /></el-select></el-form-item>
      <el-form-item label="货币对 / 汇兑方向" required><el-select v-model="draft.direction" @change="syncDirection"><el-option v-for="item in currencyPairs" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item><el-form-item label="调整方式"><el-select v-model="draft.method" @change="syncMethod"><el-option label="百分比缩放" value="百分比缩放" /><el-option label="固定汇率差" value="固定汇率差" /><el-option label="固定汇率值" value="固定汇率值" /></el-select></el-form-item><el-form-item label="调整方向"><el-select v-model="draft.adjustDirection" :disabled="draft.method === '固定汇率值'" @change="computeResult(draft)"><el-option label="上浮" value="上浮" /><el-option label="下浮" value="下浮" /><el-option v-if="draft.method === '固定汇率值'" label="直接指定" value="直接指定" /></el-select></el-form-item><el-form-item label="调整值"><el-input v-model="draft.adjustValue" @input="computeResult(draft)" /></el-form-item><el-form-item label="基准汇率"><el-input :model-value="formatRate(rateBase(draft))" disabled /></el-form-item><el-form-item label="特调后默认汇率"><el-input :model-value="formatRate(draft.result)" disabled /></el-form-item></el-form><el-alert v-if="editorKind === 'MASTER'" title="发布新版本不会自动升级现有客户；发布后请通过分配客户向导选择需要升级的客户。" type="info" :closable="false" /><template #footer><div class="config-drawer-footer"><el-button @click="editorVisible = false">取消</el-button><el-button type="primary" @click="saveRate">{{ editorKind === 'MASTER' ? '发布版本' : '保存配置' }}</el-button></div></template></el-dialog>
    <ConfigMasterAssignmentDialog v-model="assignmentVisible" :master="selectedMaster" :customers="assignmentCandidates(selectedMaster)" source-label="特调汇率母版" @confirm="assignCustomers" />
  </div>
</template>

<style scoped>
.rate-panel-head-stack{flex-wrap:wrap}.rate-source-tabs{width:100%;order:2}.rate-source-tabs :deep(.el-tabs__header){margin:0}.rate-panel-filters{min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:8px;order:3}.rate-editor-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px}.rate-editor-grid .span-2{grid-column:1/-1}.rate-editor-grid :deep(.el-form-item){margin-bottom:0}.rate-editor-grid :deep(.el-select){width:100%}.config-drawer-footer{display:flex;justify-content:flex-end;gap:8px;padding-right:var(--space-2)}@media(max-width:760px){.rate-panel-filters{width:100%}.rate-editor-grid{grid-template-columns:1fr}.rate-editor-grid .span-2{grid-column:auto}}
</style>
