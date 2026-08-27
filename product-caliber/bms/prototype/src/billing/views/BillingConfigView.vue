<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus/es/components/message/index.mjs'
import { ElMessageBox } from 'element-plus/es/components/message-box/index.mjs'
import { CopyDocument, EditPen, Plus, Promotion, View } from '@element-plus/icons-vue'
import ConditionFilter from '../../shared/components/ConditionFilter.vue'
import MetricGrid from '../../shared/components/MetricGrid.vue'
import HoverActionMenu from '../../shared/components/HoverActionMenu.vue'
import ReceivableConfigEditor from '../components/ReceivableConfigEditor.vue'
import RefundConfigEditor from '../components/RefundConfigEditor.vue'
import ConfigMasterAssignmentDialog from '../components/ConfigMasterAssignmentDialog.vue'
import SegmentedControl from '../../shared/components/SegmentedControl.vue'
import StackedCell from '../../shared/components/StackedCell.vue'
import StatusTag from '../../shared/components/StatusTag.vue'
import DataTableFrame from '../../shared/components/DataTableFrame.vue'
import { useStagedQuery } from '../../shared/composables/useStagedQuery.js'
import { useDemoDataset } from '../data/useDemoDataset.js'

const activeType = ref('AR')
const activeView = ref('customers')
const detailVisible = ref(false)
const assignmentVisible = ref(false)
const selectedConfig = ref(null)
const selectedMaster = ref(null)
const editorRef = ref(null)
const initialQuery = { customerText: '', store: '', group: '', sourceType: '', status: '' }
const { query, appliedQuery, applyQuery, resetQuery } = useStagedQuery(initialQuery)

const customerConfigs = useDemoDataset('billingCustomerConfigs', [
  { id:'AR-C-001', type:'AR', customerCode:'OG0271', customerName:'渣渣辉3号', store:'星际货运(中转)', group:'台湾大客户组', sourceType:'MASTER', sourceName:'台湾电商月结母版', sourceNo:'ARB-MASTER-20260801-01', masterId:'AR-M-001', version:'V2', currency:'TWD', cycle:'月账单', sentRule:'账期结束后 3 天', branches:'2', effectStart:'2026-08-01', effectEnd:'长期', operator:'谭清辉', updatedAt:'2026-08-01 10:18', changeReason:'升级母版版本', status:'启用' },
  { id:'AR-C-002', type:'AR', customerCode:'OG0370', customerName:'JYK-深圳立杰海快', store:'星际中转2', group:'日本同行组', sourceType:'CUSTOM', sourceName:'客户自定义配置', sourceNo:'ARB-CUSTOM-OG0370', version:'V4', currency:'CNY', cycle:'7 自然天', sentRule:'账期结束后 1 天', branches:'1', effectStart:'2026-07-01', effectEnd:'长期', operator:'郑雅雯', updatedAt:'2026-07-01 11:05', changeReason:'客户独立账期', status:'启用' },
  { id:'AR-C-003', type:'AR', customerCode:'OG0347', customerName:'测试1', store:'台湾集运店', group:'台湾大客户组', sourceType:'MASTER', sourceName:'基础周结母版', sourceNo:'ARB-MASTER-20260715-02', masterId:'AR-M-002', version:'V1', currency:'CNY', cycle:'周账单', sentRule:'账期结束后 1 天', branches:'0', effectStart:'2026-07-15', effectEnd:'长期', operator:'谭清辉', updatedAt:'2026-07-15 09:20', changeReason:'首次分配', status:'启用' },
  { id:'AR-C-004', type:'AR', customerCode:'OG0412', customerName:'NorthWind Cargo', store:'星际货运(中转)', group:'美国电商组', sourceType:'NONE', sourceName:'未配置', sourceNo:'-', version:'-', currency:'-', cycle:'-', sentRule:'-', branches:'-', effectStart:'-', effectEnd:'-', operator:'-', updatedAt:'-', changeReason:'-', status:'未配置' },
  { id:'RF-C-001', type:'RF', customerCode:'OG0271', customerName:'渣渣辉3号', store:'星际货运(中转)', group:'台湾大客户组', sourceType:'MASTER', sourceName:'COD 周返母版', sourceNo:'RFB-MASTER-20260801-01', masterId:'RF-M-001', version:'V3', currency:'TWD', cycle:'周账单', sentRule:'账期结束后 1 天', mode:'回款返款', effectStart:'2026-08-01', effectEnd:'长期', operator:'谭清辉', updatedAt:'2026-08-01 10:20', changeReason:'调整返款周期', status:'启用' },
  { id:'RF-C-002', type:'RF', customerCode:'OG0370', customerName:'JYK-深圳立杰海快', store:'星际中转2', group:'日本同行组', sourceType:'CUSTOM', sourceName:'客户自定义配置', sourceNo:'RFB-CUSTOM-OG0370', version:'V4', currency:'CNY', cycle:'半周账单', sentRule:'账期结束后 1 天', mode:'签收返款', effectStart:'2026-07-01', effectEnd:'长期', operator:'郑雅雯', updatedAt:'2026-07-01 11:08', changeReason:'客户独立返款条款', status:'启用' },
  { id:'RF-C-003', type:'RF', customerCode:'OG0347', customerName:'测试1', store:'台湾集运店', group:'台湾大客户组', sourceType:'MASTER', sourceName:'COD 周返母版', sourceNo:'RFB-MASTER-20260801-01', masterId:'RF-M-001', version:'V2', currency:'TWD', cycle:'周账单', sentRule:'账期结束后 1 天', mode:'回款返款', effectStart:'2026-07-01', effectEnd:'长期', operator:'郑雅雯', updatedAt:'2026-07-01 11:10', changeReason:'待升级母版版本', status:'启用' },
  { id:'RF-C-004', type:'RF', customerCode:'OG0412', customerName:'NorthWind Cargo', store:'星际货运(中转)', group:'美国电商组', sourceType:'NONE', sourceName:'未配置', sourceNo:'-', version:'-', currency:'-', cycle:'-', sentRule:'-', mode:'-', effectStart:'-', effectEnd:'-', operator:'-', updatedAt:'-', changeReason:'-', status:'未配置' },
], 1)

const masters = useDemoDataset('billingConfigMasters', [
  { id:'AR-M-001', type:'AR', no:'ARB-MASTER-20260801-01', name:'台湾电商月结母版', version:'V2', rangeMode:'STORE', rangeValues:['星际货运(中转)','台湾集运店'], rangeText:'店铺：星际货运(中转)、台湾集运店', currency:'TWD', cycle:'月账单', sentRule:'账期结束后 3 天', branches:'2', effectStart:'2026-08-01', effectEnd:'长期', operator:'谭清辉', updatedAt:'2026-08-01 10:18', changeReason:'增加台湾电商分支', status:'启用' },
  { id:'AR-M-002', type:'AR', no:'ARB-MASTER-20260715-02', name:'基础周结母版', version:'V1', rangeMode:'GROUP', rangeValues:['台湾大客户组','日本同行组'], rangeText:'客户组：台湾大客户组、日本同行组', currency:'CNY', cycle:'周账单', sentRule:'账期结束后 1 天', branches:'0', effectStart:'2026-07-15', effectEnd:'长期', operator:'郑雅雯', updatedAt:'2026-07-15 11:05', changeReason:'首次发布', status:'启用' },
  { id:'RF-M-001', type:'RF', no:'RFB-MASTER-20260801-01', name:'COD 周返母版', version:'V3', rangeMode:'STORE', rangeValues:['星际货运(中转)','台湾集运店'], rangeText:'店铺：星际货运(中转)、台湾集运店', currency:'TWD', cycle:'周账单', sentRule:'账期结束后 1 天', mode:'回款返款', effectStart:'2026-08-01', effectEnd:'长期', operator:'谭清辉', updatedAt:'2026-08-01 10:20', changeReason:'调整返款周期', status:'启用' },
  { id:'RF-M-002', type:'RF', no:'RFB-MASTER-20260715-02', name:'签收半周返款母版', version:'V1', rangeMode:'GROUP', rangeValues:['日本同行组'], rangeText:'客户组：日本同行组', currency:'CNY', cycle:'半周账单', sentRule:'账期结束后 1 天', mode:'签收返款', effectStart:'2026-07-15', effectEnd:'长期', operator:'郑雅雯', updatedAt:'2026-07-15 11:08', changeReason:'首次发布', status:'启用' },
], 1)

const sourceTypes = [{ label:'自定义配置', value:'CUSTOM' }, { label:'共享配置母版', value:'MASTER' }, { label:'未配置', value:'NONE' }]
const stores = computed(() => [...new Set(customerConfigs.value.map(row => row.store))])
const groups = computed(() => [...new Set(customerConfigs.value.map(row => row.group))])
const customerRows = computed(() => customerConfigs.value.filter(row => row.type === activeType.value
  && (!appliedQuery.customerText || `${row.customerCode}${row.customerName}`.includes(appliedQuery.customerText))
  && (!appliedQuery.store || row.store === appliedQuery.store)
  && (!appliedQuery.group || row.group === appliedQuery.group)
  && (!appliedQuery.sourceType || row.sourceType === appliedQuery.sourceType)
  && (!appliedQuery.status || row.status === appliedQuery.status)))
const masterRows = computed(() => masters.value.filter(row => row.type === activeType.value
  && (!appliedQuery.customerText || `${row.no}${row.name}`.includes(appliedQuery.customerText))
  && (!appliedQuery.status || row.status === appliedQuery.status)))
const rows = computed(() => activeView.value === 'customers' ? customerRows.value : masterRows.value)
const referenceCount = master => customerConfigs.value.filter(row => row.type === master.type && row.masterId === master.id).length
const summary = computed(() => activeView.value === 'customers' ? [
  { label:'客户总数', value:customerRows.value.length, tone:'green' },
  { label:'引用母版', value:customerRows.value.filter(row => row.sourceType === 'MASTER').length, tone:'blue' },
  { label:'自定义配置', value:customerRows.value.filter(row => row.sourceType === 'CUSTOM').length, tone:'amber' },
  { label:'未配置', value:customerRows.value.filter(row => row.sourceType === 'NONE').length, tone:'red' },
] : [
  { label:'母版总数', value:masterRows.value.length, tone:'green' },
  { label:'生效中', value:masterRows.value.filter(row => row.status === '启用').length, tone:'blue' },
  { label:'当前引用客户', value:masterRows.value.reduce((sum, master) => sum + referenceCount(master), 0), tone:'amber' },
])

watch(activeType, () => { activeView.value = 'customers'; resetQuery() })
watch(activeView, resetQuery)
const sourceLabel = value => sourceTypes.find(item => item.value === value)?.label || value
const rangeOptions = type => type === 'STORE' ? stores.value : type === 'GROUP' ? groups.value : customerConfigs.value.filter(row => row.type === activeType.value).map(row => `${row.customerCode} ${row.customerName}`)
function refreshRangeText(config) { const label = config.rangeMode === 'STORE' ? '店铺' : config.rangeMode === 'GROUP' ? '客户组' : '指定客户'; config.rangeValues = []; config.rangeText = `${label}：待选择` }
function syncRangeText(config) { const label = config.rangeMode === 'STORE' ? '店铺' : config.rangeMode === 'GROUP' ? '客户组' : '指定客户'; config.rangeText = `${label}：${config.rangeValues.join('、') || '待选择'}` }
function openDetail(row) { selectedConfig.value = { ...row, rangeValues:[...(row.rangeValues || [])], editorKind:activeView.value === 'masters' ? 'MASTER' : 'CUSTOM' }; detailVisible.value = true }
function newConfig() {
  const masterMode = activeView.value === 'masters'
  openDetail(masterMode
    ? { id:`${activeType.value}-M-${Date.now()}`, type:activeType.value, no:'新母版', name:'', version:'V1', rangeMode:'STORE', rangeValues:[], rangeText:'店铺：待选择', currency:'CNY', cycle:activeType.value === 'AR' ? '月账单' : '周账单', sentRule:'账期结束后 1 天', branches:'0', mode:'回款返款', effectStart:'2026-09-01', effectEnd:'长期', operator:'财务管理员', updatedAt:'2026-08-27 10:30', changeReason:'首次发布', status:'启用' }
    : { id:`${activeType.value}-C-${Date.now()}`, type:activeType.value, customerCode:'', customerName:'', store:'', group:'', sourceType:'CUSTOM', sourceName:'客户自定义配置', sourceNo:'新配置', version:'V1', currency:'CNY', cycle:activeType.value === 'AR' ? '月账单' : '周账单', sentRule:'账期结束后 1 天', branches:'0', mode:'回款返款', effectStart:'2026-09-01', effectEnd:'长期', operator:'财务管理员', updatedAt:'2026-08-27 10:30', changeReason:'新建自定义配置', status:'启用' })
}
function copyToCustom(row) { openDetail({ ...row, id:`${row.type}-C-${Date.now()}`, sourceType:'CUSTOM', sourceName:'客户自定义配置', sourceNo:'新配置', version:'V1', masterId:null, changeReason:'基于当前母版复制为自定义配置' }) }
function viewMaster(row) { const master = masters.value.find(item => item.id === row.masterId); if (master) { activeView.value = 'masters'; openDetail(master) } }
async function save() {
  const next = selectedConfig.value
  if (next.editorKind === 'MASTER') {
    if (!next.name.trim()) return ElMessage.warning('请输入母版名称')
    if (!next.rangeValues.length) return ElMessage.warning('请设置可分配客户范围')
    syncRangeText(next)
  } else if (!next.customerCode) return ElMessage.warning('请选择一个明确客户')
  if (!editorRef.value?.validate()) return
  try { await ElMessageBox.confirm(next.editorKind === 'MASTER' ? '保存将发布一个新的母版内容版本，现有客户不会自动升级。' : '保存将创建客户自定义配置新版本，并只影响该客户。', '确认保存', { type:'warning' }) } catch { return }
  if (next.editorKind === 'MASTER') {
    if (next.no === '新母版') next.no = `${next.type === 'AR' ? 'ARB' : 'RFB'}-MASTER-${Date.now()}`
    const index = masters.value.findIndex(item => item.id === next.id)
    if (index >= 0) masters.value.splice(index, 1, { ...next, version:`V${Number(next.version.slice(1) || 0) + 1}` })
    else masters.value.unshift({ ...next })
    ElMessage.success('母版版本已发布，现有客户引用保持不变')
  } else {
    const chosen = customerConfigs.value.find(item => item.type === next.type && item.customerCode === next.customerCode)
    if (next.sourceNo === '新配置') next.sourceNo = `${next.type === 'AR' ? 'ARB' : 'RFB'}-CUSTOM-${next.customerCode}`
    const saved = { ...next, customerName:next.customerName || chosen?.customerName || '', store:next.store || chosen?.store || '', group:next.group || chosen?.group || '', sourceType:'CUSTOM', sourceName:'客户自定义配置', masterId:null }
    if (chosen) customerConfigs.value.splice(customerConfigs.value.indexOf(chosen), 1, saved)
    else customerConfigs.value.unshift(saved)
    ElMessage.success('客户自定义配置已保存')
  }
  detailVisible.value = false
}
function openAssignment(master) { selectedMaster.value = master; assignmentVisible.value = true }
function inMasterRange(row, master) {
  if (!master) return false
  if (master.rangeMode === 'STORE') return master.rangeValues.includes(row.store)
  if (master.rangeMode === 'GROUP') return master.rangeValues.includes(row.group)
  return master.rangeValues.some(value => value.startsWith(`${row.customerCode} `) || value === row.customerCode)
}
function assignmentCandidates(master) { return customerConfigs.value.filter(row => row.type === master?.type && inMasterRange(row, master)).map(row => ({ id:row.id, code:row.customerCode, name:row.customerName, store:row.store, group:row.group, sourceType:row.sourceType, sourceName:row.sourceName, masterId:row.masterId, version:row.version, blocked:false })) }
function assignCustomers(payload) {
  payload.customers.forEach((candidate) => {
    const row = customerConfigs.value.find(item => item.id === candidate.id)
    Object.assign(row, { sourceType:'MASTER', sourceName:selectedMaster.value.name, sourceNo:selectedMaster.value.no, masterId:selectedMaster.value.id, version:selectedMaster.value.version, currency:selectedMaster.value.currency, cycle:selectedMaster.value.cycle, sentRule:selectedMaster.value.sentRule, branches:selectedMaster.value.branches, mode:selectedMaster.value.mode, effectStart:payload.effectiveAt, effectEnd:'长期', status:'启用', operator:'财务管理员', updatedAt:'2026-08-27 10:45', changeReason:payload.reason || '分配共享配置母版' })
  })
  ElMessage.success(`已为 ${payload.customers.length} 个客户建立母版引用${payload.force ? '，强制覆盖已留痕' : ''}`)
}
function generate(row) { ElMessage.success(`已为 ${row.customerCode} 创建${row.type === 'AR' ? '应收' : '返款'}账单生成任务`) }
</script>

<template>
  <div class="module-page live-reference-page">
    <SegmentedControl v-model="activeType" :options="[{ label:'应收账单配置', value:'AR' }, { label:'返款账单配置', value:'RF' }]" aria-label="账单配置类型" />
    <el-tabs v-model="activeView" class="module-tabs"><el-tab-pane label="客户配置" name="customers" /><el-tab-pane label="共享配置母版" name="masters" /></el-tabs>
    <section class="condition-query-panel"><div class="condition-filter-bar">
      <ConditionFilter v-model="query.customerText" :label="activeView === 'customers' ? '客户' : '母版'" type="text" />
      <template v-if="activeView === 'customers'"><ConditionFilter v-model="query.store" label="店铺" :options="stores" /><ConditionFilter v-model="query.group" label="客户组" :options="groups" /><ConditionFilter v-model="query.sourceType" label="配置来源" :options="sourceTypes" /></template>
      <ConditionFilter v-model="query.status" label="状态" :options="activeView === 'customers' ? ['启用','未配置'] : ['启用','停用']" />
      <div class="condition-filter-actions linked-query-actions"><el-button type="primary" @click="applyQuery">查询</el-button><el-button @click="resetQuery">重置</el-button></div>
    </div></section>
    <MetricGrid class="reference-kpis" :items="summary" :columns="summary.length" />
    <section class="module-panel">
      <DataTableFrame :total="rows.length" :selected-count="0">
        <template #actions><el-button type="primary" :icon="Plus" @click="newConfig">{{ activeView === 'customers' ? '新建自定义配置' : '新建配置母版' }}</el-button></template>
        <el-table v-if="activeView === 'customers'" :data="rows" border row-key="id" class="clean-table">
          <el-table-column type="expand"><template #default="scope"><dl class="inline-detail-grid"><div><dt>配置来源</dt><dd>{{ sourceLabel(scope.row.sourceType) }}</dd></div><div><dt>准确版本</dt><dd>{{ scope.row.sourceNo }} / {{ scope.row.version }}</dd></div><div><dt>账期规则</dt><dd>{{ scope.row.cycle }}</dd></div><div><dt>生效周期</dt><dd>{{ scope.row.effectStart }} 至 {{ scope.row.effectEnd }}</dd></div></dl></template></el-table-column>
          <el-table-column label="客户" min-width="190"><template #default="scope"><StackedCell :primary="scope.row.customerName" :secondary="scope.row.customerCode" /></template></el-table-column>
          <el-table-column prop="store" label="店铺" min-width="140" /><el-table-column prop="group" label="客户组" min-width="130" />
          <el-table-column label="配置来源" width="125"><template #default="scope"><StatusTag :label="sourceLabel(scope.row.sourceType)" :tone="scope.row.sourceType === 'MASTER' ? 'info' : scope.row.sourceType === 'CUSTOM' ? 'success' : 'warning'" /></template></el-table-column>
          <el-table-column label="采用配置" min-width="230"><template #default="scope"><StackedCell :primary="scope.row.sourceName" :secondary="scope.row.sourceNo === '-' ? '-' : `${scope.row.sourceNo} / ${scope.row.version}`" /></template></el-table-column>
          <el-table-column prop="currency" label="默认结算币种" width="125" /><el-table-column prop="cycle" label="账期类型" width="110" /><el-table-column label="生效周期" width="180"><template #default="scope">{{ scope.row.effectStart }} 至 {{ scope.row.effectEnd }}</template></el-table-column><el-table-column label="状态" width="85"><template #default="scope"><StatusTag :label="scope.row.status" :tone="scope.row.status === '未配置' ? 'warning' : ''" /></template></el-table-column>
          <TableActionColumn><template #default="scope"><HoverActionMenu><el-dropdown-item v-if="scope.row.sourceType === 'CUSTOM'" :icon="EditPen" @click="openDetail(scope.row)">编辑自定义配置</el-dropdown-item><el-dropdown-item v-if="scope.row.sourceType === 'MASTER'" :icon="View" @click="viewMaster(scope.row)">查看母版</el-dropdown-item><el-dropdown-item v-if="scope.row.sourceType === 'MASTER'" :icon="CopyDocument" @click="copyToCustom(scope.row)">复制为自定义配置</el-dropdown-item><el-dropdown-item v-if="scope.row.sourceType !== 'NONE'" :icon="Promotion" @click="generate(scope.row)">生成账单</el-dropdown-item></HoverActionMenu></template></TableActionColumn>
        </el-table>
        <el-table v-else :data="rows" border row-key="id" class="clean-table">
          <el-table-column label="母版" min-width="210"><template #default="scope"><StackedCell :primary="scope.row.name" :secondary="scope.row.no" /></template></el-table-column><el-table-column prop="version" label="当前版本" width="90" /><el-table-column prop="rangeText" label="可分配客户范围" min-width="260" :show-overflow-tooltip="true" /><el-table-column label="引用客户" width="100"><template #default="scope"><strong>{{ referenceCount(scope.row) }}</strong></template></el-table-column><el-table-column prop="currency" label="默认结算币种" width="125" /><el-table-column prop="cycle" label="账期类型" width="110" /><el-table-column label="最近发布" width="165"><template #default="scope"><StackedCell :primary="scope.row.operator" :secondary="scope.row.updatedAt" /></template></el-table-column><el-table-column label="状态" width="85"><template #default="scope"><StatusTag :label="scope.row.status" /></template></el-table-column>
          <TableActionColumn><template #default="scope"><HoverActionMenu><el-dropdown-item :icon="EditPen" @click="openDetail(scope.row)">发布新版本</el-dropdown-item><el-dropdown-item :icon="Promotion" @click="openAssignment(scope.row)">分配客户</el-dropdown-item></HoverActionMenu></template></TableActionColumn>
        </el-table>
      </DataTableFrame>
    </section>
    <el-dialog v-model="detailVisible" class="module-dialog module-dialog-wide" align-center append-to-body destroy-on-close :close-on-click-modal="false">
      <template #header><div class="drawer-title"><span>{{ selectedConfig?.editorKind === 'MASTER' ? (selectedConfig?.no === '新母版' ? '新建配置母版' : '发布母版新版本') : (selectedConfig?.sourceNo === '新配置' ? '新建客户自定义配置' : '编辑客户自定义配置') }}</span><small>{{ activeType === 'AR' ? '应收账单配置' : '返款账单配置' }}</small></div></template>
      <template v-if="selectedConfig">
        <div class="scope-info-bar"><div><span>配置来源：</span><strong>{{ selectedConfig.editorKind === 'MASTER' ? '共享配置母版' : '客户自定义配置' }}</strong></div><div><span>{{ selectedConfig.editorKind === 'MASTER' ? '母版' : '客户' }}：</span><strong>{{ selectedConfig.editorKind === 'MASTER' ? (selectedConfig.name || '待填写') : `${selectedConfig.customerCode || '待选择'} ${selectedConfig.customerName || ''}` }}</strong></div><div><span>当前版本：</span><strong>{{ selectedConfig.version }}</strong></div></div>
        <section class="config-version-panel"><el-form label-position="top" class="config-version-grid">
          <template v-if="selectedConfig.editorKind === 'MASTER'"><el-form-item label="母版名称"><el-input v-model="selectedConfig.name" /></el-form-item><el-form-item label="可分配范围维度"><el-select v-model="selectedConfig.rangeMode" @change="refreshRangeText(selectedConfig)"><el-option label="店铺" value="STORE" /><el-option label="客户组" value="GROUP" /><el-option label="指定客户" value="CUSTOMER" /></el-select></el-form-item><el-form-item class="span-2" label="可分配客户范围"><el-select v-model="selectedConfig.rangeValues" multiple filterable collapse-tags @change="syncRangeText(selectedConfig)"><el-option v-for="item in rangeOptions(selectedConfig.rangeMode)" :key="item" :label="item" :value="item" /></el-select></el-form-item></template>
          <template v-else><el-form-item label="客户"><el-select v-model="selectedConfig.customerCode" filterable :disabled="selectedConfig.sourceNo !== '新配置'"><el-option v-for="item in customerConfigs.filter(row => row.type === activeType)" :key="item.customerCode" :label="`${item.customerCode} ${item.customerName}`" :value="item.customerCode" /></el-select></el-form-item></template>
          <el-form-item label="生效开始日"><el-date-picker v-model="selectedConfig.effectStart" value-format="YYYY-MM-DD" type="date" /></el-form-item><el-form-item label="生效结束日"><el-input v-model="selectedConfig.effectEnd" /></el-form-item><el-form-item class="span-2" label="变更原因"><el-input v-model="selectedConfig.changeReason" /></el-form-item>
        </el-form><div class="config-version-meta">母版新版本不会自动升级客户；客户切换将通过分配向导逐一确认。</div></section>
        <ReceivableConfigEditor v-if="selectedConfig.type === 'AR'" :key="selectedConfig.id" ref="editorRef" :config="{ ...selectedConfig, no:selectedConfig.editorKind === 'MASTER' ? selectedConfig.no : selectedConfig.sourceNo }" />
        <RefundConfigEditor v-else :key="selectedConfig.id" ref="editorRef" :config="{ ...selectedConfig, no:selectedConfig.editorKind === 'MASTER' ? selectedConfig.no : selectedConfig.sourceNo }" />
      </template>
      <template #footer><div class="config-drawer-footer"><el-button @click="detailVisible = false">取消</el-button><el-button type="primary" @click="save">{{ selectedConfig?.editorKind === 'MASTER' ? '发布版本' : '保存配置' }}</el-button></div></template>
    </el-dialog>
    <ConfigMasterAssignmentDialog v-model="assignmentVisible" :master="selectedMaster" :customers="assignmentCandidates(selectedMaster)" source-label="账单配置母版" @confirm="assignCustomers" />
  </div>
</template>

<style scoped>
.scope-info-bar{min-height:48px;margin-bottom:var(--space-3);padding:0 var(--space-4);display:flex;align-items:center;gap:48px;border:1px solid #dfe4ec;background:#f7f9fb;color:#687386}.scope-info-bar div{display:flex;gap:4px}.scope-info-bar strong{color:#29364c}.config-version-panel{margin-bottom:var(--space-3);padding:var(--space-3) var(--space-4);border:1px solid #dfe4ec;background:#fff}.config-version-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.config-version-grid .span-2{grid-column:span 2}.config-version-grid :deep(.el-form-item){margin-bottom:0}.config-version-grid :deep(.el-select),.config-version-grid :deep(.el-date-editor){width:100%}.config-version-meta{margin-top:var(--space-2);color:#7b8798;font-size:var(--font-size-sm)}.config-drawer-footer{display:flex;justify-content:flex-end;gap:8px;padding-right:var(--space-2)}@media(max-width:760px){.scope-info-bar{align-items:flex-start;flex-direction:column;gap:6px;padding:var(--space-2) var(--space-3)}.config-version-grid{grid-template-columns:1fr}.config-version-grid .span-2{grid-column:auto}}
</style>
