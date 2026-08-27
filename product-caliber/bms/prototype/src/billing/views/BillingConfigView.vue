<script setup>
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus/es/components/message/index.mjs'
import { ElMessageBox } from 'element-plus/es/components/message-box/index.mjs'
import { CopyDocument, EditPen, Plus, Promotion, Tickets, View } from '@element-plus/icons-vue'
import ConditionFilter from '../../shared/components/ConditionFilter.vue'
import MetricGrid from '../../shared/components/MetricGrid.vue'
import HoverActionMenu from '../../shared/components/HoverActionMenu.vue'
import BillingConfigDetailDialog from '../components/BillingConfigDetailDialog.vue'
import ConfigReferenceDialog from '../components/ConfigReferenceDialog.vue'
import ConfigGenerationDialog from '../components/ConfigGenerationDialog.vue'
import ConfigSchemeOverview from '../components/ConfigSchemeOverview.vue'
import SegmentedControl from '../../shared/components/SegmentedControl.vue'
import StackedCell from '../../shared/components/StackedCell.vue'
import StatusTag from '../../shared/components/StatusTag.vue'
import DataTableFrame from '../../shared/components/DataTableFrame.vue'
import { useStagedQuery } from '../../shared/composables/useStagedQuery.js'
import { billingConfigFixtures, billingConfigSeedVersion, billingConfigVersionFixtures, billingCustomerConfigFixtures } from '../../data/fixtures/billingConfigs.ts'
import { billingTaskFixtures, billingTaskSeedVersion } from '../../data/fixtures/billingTasks.ts'
import { configReferenceStats, createConfigBatchTaskRows, isConfigReferenceActive } from '../../domain/configGeneration.js'
import { useDemoDataset } from '../data/useDemoDataset.js'

const activeType = ref('AR')
const activeView = ref('customers')
const detailVisible = ref(false)
const referenceVisible = ref(false)
const generationVisible = ref(false)
const selectionVisible = ref(false)
const detailMode = ref('edit')
const selectedConfig = ref(null)
const targetConfig = ref(null)
const selectedCustomer = ref(null)
const focusCustomerCode = ref('')
const generationCustomerCode = ref('')
const editorRef = ref(null)
const demoNow = '2026-08-27'
const initialQuery = { keyword:'', store:'', group:'', usageType:'', status:'' }
const { query, appliedQuery, applyQuery, resetQuery } = useStagedQuery(initialQuery)

const customerReferences = useDemoDataset('billingConfigReferencesV2', billingCustomerConfigFixtures, billingConfigSeedVersion)
const configs = useDemoDataset('billingConfigsUnified', billingConfigFixtures, billingConfigSeedVersion)
const configVersions = useDemoDataset('billingConfigVersionsUnified', billingConfigVersionFixtures, billingConfigSeedVersion)
const taskRecords = useDemoDataset('billingTasks', billingTaskFixtures, billingTaskSeedVersion)
const generationAudits = useDemoDataset('billingGenerationValidationAudits', [], 2026082701)
const usageTypes = [{ label:'共享配置', value:'SHARED' }, { label:'独享配置', value:'EXCLUSIVE' }, { label:'未引用配置', value:'UNUSED' }]
const periodLabels = { DAY_1:'1 自然天', DAY_7:'7 自然天', DAY_10:'10 自然天', DAY_15:'15 自然天', WEEK:'周账单', HALF_MONTH:'半月账单', MONTH:'月账单' }
const periodLabel = value => periodLabels[value] || value || '-'
const settlementCurrency = scheme => { const value = scheme?.feeRules?.find(rule => rule.fallback)?.settlementCurrency; return value === 'SOURCE_CURRENCY' ? '随原始币种' : value || '-' }
const cloneSnapshot = snapshot => snapshot ? JSON.parse(JSON.stringify(snapshot)) : null
const stores = computed(() => [...new Set(customerReferences.value.map(row => row.store).filter(Boolean))])
const groups = computed(() => [...new Set(customerReferences.value
  .filter(row => !query.store || row.store === query.store)
  .map(row => row.group)
  .filter(Boolean))])
const statsFor = config => configReferenceStats(config, customerReferences.value, demoNow)
const activeReferencesFor = config => customerReferences.value.filter(row => row.configId === config.id && isConfigReferenceActive(row, demoNow))
const versionRowsFor = (config) => {
  const snapshots = configVersions.value.filter(row => row.configId === config.id)
  if (!snapshots.some(row => row.version === config.version)) snapshots.push({ ...config, configId:config.id, snapshotId:`${config.id}@${config.version}` })
  return snapshots
    .sort((left, right) => Number(right.version.slice(1)) - Number(left.version.slice(1)))
    .map((snapshot) => {
      const byCustomer = new Map()
      activeReferencesFor(config).filter(row => row.version === snapshot.version).forEach(row => byCustomer.set(row.customerCode, row))
      return { ...snapshot, references:[...byCustomer.values()], isCurrent:snapshot.version === config.version }
    })
}
const configRowsWithStats = computed(() => configs.value.filter(row => row.type === activeType.value).map(row => ({ ...row, referenceStats:statsFor(row) })))
const currentReferences = computed(() => {
  const rows = customerReferences.value.filter(row => row.type === activeType.value)
  const grouped = new Map()
  rows.forEach((row) => {
    const values = grouped.get(row.customerCode) || []
    values.push(row)
    grouped.set(row.customerCode, values)
  })
  return [...grouped.values()].map((values) => {
    const active = values.filter(row => isConfigReferenceActive(row, demoNow)).sort((a, b) => b.effectStart.localeCompare(a.effectStart))[0]
    if (active) return active
    const base = values.sort((a, b) => String(b.effectStart).localeCompare(String(a.effectStart)))[0]
    return { ...base, id:`${base.type}-ROSTER-${base.customerCode}`, referenceNo:'-', configId:null, configName:'未配置', configNo:'-', version:'-', currency:'-', cycle:'-', sentRule:'-', mode:'-', schemeSnapshot:null, refundSnapshot:null, effectStart:'-', effectEnd:'-', status:'未配置' }
  })
})
const customerRows = computed(() => currentReferences.value.filter(row =>
  (!appliedQuery.keyword || `${row.customerCode}${row.customerName}${row.memberCode}${row.configNo}${row.configName}`.includes(appliedQuery.keyword))
  && (!appliedQuery.store || row.store === appliedQuery.store)
  && (!appliedQuery.group || row.group === appliedQuery.group)
  && (!appliedQuery.status || row.status === appliedQuery.status)))
const configRows = computed(() => configRowsWithStats.value.filter(row =>
  (!appliedQuery.keyword || `${row.no}${row.name}`.includes(appliedQuery.keyword))
  && (!appliedQuery.usageType || row.referenceStats.usageType === appliedQuery.usageType)
  && (!appliedQuery.status || row.status === appliedQuery.status)))
const rows = computed(() => activeView.value === 'customers' ? customerRows.value : configRows.value)
const summary = computed(() => activeView.value === 'customers' ? [
  { label:'客户总数', value:customerRows.value.length, tone:'green' },
  { label:'已引用配置', value:customerRows.value.filter(row => row.configId).length, tone:'blue' },
  { label:'涉及配置', value:new Set(customerRows.value.map(row => row.configId).filter(Boolean)).size, tone:'amber' },
  { label:'未配置', value:customerRows.value.filter(row => !row.configId).length, tone:'red' },
] : [
  { label:'配置总数', value:configRows.value.length, tone:'green' },
  { label:'共享配置', value:configRows.value.filter(row => row.referenceStats.usageType === 'SHARED').length, tone:'blue' },
  { label:'独享配置', value:configRows.value.filter(row => row.referenceStats.usageType === 'EXCLUSIVE').length, tone:'amber' },
  { label:'未引用配置', value:configRows.value.filter(row => row.referenceStats.usageType === 'UNUSED').length, tone:'red' },
])

watch(activeType, () => { activeView.value = 'customers'; resetQuery() })
watch(activeView, resetQuery)
watch(() => query.store, () => { if (query.group && !groups.value.includes(query.group)) query.group = '' })

const usageTone = type => type === 'SHARED' ? 'info' : type === 'EXCLUSIVE' ? 'success' : 'warning'
function referenceUsage(row) { const config = configs.value.find(item => item.id === row.configId); return config ? statsFor(config) : { usageType:'UNUSED', label:'未配置' } }
const editingReferences = computed(() => selectedConfig.value
  ? customerReferences.value.filter(row => row.configId === selectedConfig.value.id && isConfigReferenceActive(row, demoNow))
  : [])
const editingImpactText = computed(() => editingReferences.value
  .map(row => `${row.customerName}（${row.customerCode}，${row.configNo} / ${row.version}）`)
  .join('、'))
function openDetail(config, mode = 'edit') { if (mode === 'edit' && config.status === '停用' && config.no !== '新配置') return ElMessage.warning('停用配置不能发布后续版本'); detailMode.value = mode; selectedConfig.value = { ...config, schemeSnapshot:cloneSnapshot(config.schemeSnapshot), refundSnapshot:cloneSnapshot(config.refundSnapshot), isNew:config.no === '新配置' }; detailVisible.value = true }
function newConfig() {
  openDetail({ id:`${activeType.value}-CFG-${Date.now()}`, type:activeType.value, no:'新配置', name:'', version:'V1', currency:'CNY', cycle:activeType.value === 'AR' ? '月账单' : '周账单', sentRule:'账期结束后 1 天', mode:'回款返款', effectStart:'2026-09-01', effectEnd:'长期', operator:'财务管理员', updatedAt:'2026-08-27 10:30', changeReason:'首次发布', status:'启用', forkCustomerCode:'' })
}
function configFromReference(reference) {
  const current = configs.value.find(item => item.id === reference.configId)
  if (!current) return null
  const archived = configVersions.value.find(item => item.configId === reference.configId && item.version === reference.version)
  return {
    ...current,
    ...archived,
    name:reference.configName,
    version:reference.version,
    currency:reference.currency,
    cycle:reference.cycle,
    sentRule:reference.sentRule,
    mode:reference.mode,
    schemeSnapshot:cloneSnapshot(archived?.schemeSnapshot || reference.schemeSnapshot),
    refundSnapshot:cloneSnapshot(archived?.refundSnapshot || reference.refundSnapshot),
    effectStart:archived?.effectStart || reference.effectStart,
    effectEnd:archived?.effectEnd || reference.effectEnd,
    changeReason:`客户引用记录 ${reference.referenceNo}`,
  }
}
function viewConfig(reference) { const snapshot = configFromReference(reference); if (snapshot) openDetail(snapshot, 'view') }
function forkForCustomer(reference) {
  const snapshot = configFromReference(reference)
  if (!snapshot) return
  openDetail({ ...snapshot, id:`${snapshot.type}-CFG-${Date.now()}`, no:'新配置', name:`${snapshot.name}-${reference.customerName}`, version:'V1', status:'启用', changeReason:`为 ${reference.customerCode} 另存独立配置`, forkCustomerCode:reference.customerCode, isNew:true })
}
function manageReferences(config, customerCode = '') { if (config.status === '停用') return ElMessage.warning('停用配置不能建立新的客户引用'); targetConfig.value = config; focusCustomerCode.value = customerCode; referenceVisible.value = true }
function chooseForCustomer(reference) { selectedCustomer.value = reference; selectionVisible.value = true }
function selectConfig(config) { if (config.status === '停用') return ElMessage.warning('请选择启用配置'); selectionVisible.value = false; manageReferences(config, selectedCustomer.value?.customerCode || '') }

async function save() {
  const next = selectedConfig.value
  if (!next.name?.trim()) return ElMessage.warning('请输入配置名称')
  if (!editorRef.value?.validate()) return
  if (next.type === 'AR') {
    const snapshot = editorRef.value?.getSchemeSnapshot?.()
    if (snapshot) Object.assign(next, { schemeSnapshot:snapshot, cycle:periodLabel(snapshot.defaultScheme.period), currency:settlementCurrency(snapshot.defaultScheme), sentRule:`账期结束后 ${snapshot.defaultScheme.sendAfterDays} 天` })
  } else {
    const snapshot = editorRef.value?.getRefundSnapshot?.()
    if (snapshot) {
      const fallbackCurrency = snapshot.currencyRules.find(rule => rule.fallback)?.settlementCurrency || '-'
      Object.assign(next, {
        refundSnapshot:snapshot,
        mode:snapshot.refundMode === 'SIGNED' ? '签收返款' : '回款返款',
        cycle:snapshot.billingPeriodType === 'HALF_WEEK' ? '半周账单' : '周账单',
        currency:fallbackCurrency,
        sentRule:`账期结束后 ${snapshot.sendAfterDays} 天`,
        effectStart:snapshot.effectPeriod[0],
        effectEnd:snapshot.effectPeriod[1] || '长期',
        status:snapshot.enabled ? '启用' : '停用',
      })
    }
  }
  const existing = configs.value.find(item => item.id === next.id)
  const beforeStats = existing ? statsFor(existing) : { total:0, label:'未引用配置' }
  const message = existing
    ? `当前配置由 ${beforeStats.total} 个客户引用。发布新版本后，系统将展示这些客户，由你选择升级对象；未选择客户继续引用原准确版本。`
    : '首次发布将形成未引用配置；可在发布后选择客户建立准确版本引用。'
  try { await ElMessageBox.confirm(message, '确认发布配置版本', { type:beforeStats.total > 1 ? 'warning' : 'info' }) } catch { return }
  if (next.no === '新配置') next.no = `${next.type === 'AR' ? 'ARB' : 'RFB'}-${Date.now()}`
  const { forkCustomerCode = '', isNew: _isNew, ...persistable } = next
  const saved = { ...persistable, version:existing ? `V${Number(existing.version.slice(1) || 0) + 1}` : 'V1', updatedAt:'2026-08-27 10:45', operator:'财务管理员' }
  if (existing) configs.value.splice(configs.value.indexOf(existing), 1, saved)
  else configs.value.unshift(saved)
  configVersions.value.unshift({ ...saved, configId:saved.id, snapshotId:`${saved.id}@${saved.version}` })
  detailVisible.value = false
  ElMessage.success(`${saved.no} / ${saved.version} 已发布，既有客户引用未自动变更`)
  targetConfig.value = saved
  focusCustomerCode.value = forkCustomerCode
  if (beforeStats.total || forkCustomerCode) referenceVisible.value = true
}

function assignReferences(payload) {
  payload.customers.forEach((candidate, index) => {
    const customerHistory = customerReferences.value.filter(row => row.type === candidate.type && row.customerCode === candidate.customerCode)
    const exactStart = customerHistory.find(row => row.configId && row.effectStart === payload.effectiveAt)
    const activeAtSwitch = customerHistory
      .filter(row => isConfigReferenceActive(row, payload.effectiveAt))
      .sort((a, b) => b.effectStart.localeCompare(a.effectStart))[0]
    const nextFuture = customerHistory
      .filter(row => row.configId && dayjs(row.effectStart).isAfter(payload.effectiveAt, 'day'))
      .sort((a, b) => a.effectStart.localeCompare(b.effectStart))[0]
    const nextEnd = nextFuture ? dayjs(nextFuture.effectStart).subtract(1, 'day').format('YYYY-MM-DD') : null

    if (!exactStart && activeAtSwitch && dayjs(activeAtSwitch.effectStart).isBefore(payload.effectiveAt, 'day')) {
      activeAtSwitch.effectEnd = dayjs(payload.effectiveAt).subtract(1, 'day').format('YYYY-MM-DD')
      activeAtSwitch.updatedAt = '2026-08-27 10:45'
      activeAtSwitch.changeReason = payload.reason || '切换配置，结束原准确版本引用'
    }

    if (exactStart) Object.assign(exactStart, {
      status:'已替换',
      updatedAt:'2026-08-27 10:45',
      changeReason:payload.reason || '同日起始的计划引用已被新引用替换',
    })

    const referenceValues = {
      referenceNo:`${candidate.type}-REF-${candidate.customerCode}-${Date.now()}-${index + 1}`,
      configId:targetConfig.value.id,
      configName:targetConfig.value.name,
      configNo:targetConfig.value.no,
      version:targetConfig.value.version,
      currency:targetConfig.value.currency,
      cycle:targetConfig.value.cycle,
      sentRule:targetConfig.value.sentRule,
      schemeSnapshot:cloneSnapshot(targetConfig.value.schemeSnapshot),
      refundSnapshot:cloneSnapshot(targetConfig.value.refundSnapshot),
      mode:targetConfig.value.mode,
      effectStart:payload.effectiveAt,
      effectEnd:nextEnd || '长期',
      status:'启用',
      operator:'财务管理员',
      updatedAt:'2026-08-27 10:45',
      changeReason:payload.reason || '建立配置准确版本引用',
    }
    customerReferences.value.push({
      ...candidate,
      id:`${candidate.type}-R-${candidate.customerCode}-${Date.now()}-${index + 1}`,
      ...referenceValues,
    })
  })
  focusCustomerCode.value = ''
  ElMessage.success(`已为 ${payload.customers.length} 个客户建立准确版本引用，原引用按生效日留存${payload.force ? '，强制替换已留痕' : ''}`)
}
function openGeneration(config, customerCode = '') { targetConfig.value = config; generationCustomerCode.value = customerCode; generationVisible.value = true }
function confirmGeneration(payload) {
  if (!payload.scopes.length) {
    const auditNo = `BMSV-${Date.now()}`
    generationAudits.value.unshift({ auditNo, configNo:targetConfig.value.no, configVersion:targetConfig.value.version, candidateCustomerCount:payload.candidateCustomerCount, blockedCount:payload.blockedCount, unselectedCount:payload.unselectedCount, cutoff:payload.cutoff, reason:payload.reason, createdAt:'2026-08-27 16:45:00', operator:'财务管理员' })
    return ElMessage.warning(`未创建批次或任务；校验审计 ${auditNo} 已保存`)
  }
  const { batchNo, rows:createdTasks } = createConfigBatchTaskRows({ config:targetConfig.value, scopes:payload.scopes, skippedCount:payload.skippedCount, frozenCustomerCount:payload.frozenCustomerCount, cutoff:payload.cutoff, existingTasks:taskRecords.value })
  taskRecords.value.unshift(...createdTasks)
  ElMessage.success(`批次 ${batchNo} 已创建，生成 ${createdTasks.length} 条客户任务`)
}
function generate(reference) { const snapshot = configFromReference(reference); if (snapshot) openGeneration(snapshot, reference.customerCode) }
</script>

<template>
  <div class="module-page live-reference-page">
    <SegmentedControl v-model="activeType" :options="[{ label:'应收账单配置', value:'AR' }, { label:'返款账单配置', value:'RF' }]" aria-label="账单配置类型" />
    <el-tabs v-model="activeView" class="module-tabs"><el-tab-pane label="客户引用" name="customers" /><el-tab-pane label="配置库" name="configs" /></el-tabs>
    <section class="condition-query-panel"><div class="condition-filter-bar">
      <ConditionFilter v-model="query.keyword" :label="activeView === 'customers' ? '客户' : '配置'" type="text" />
      <template v-if="activeView === 'customers'"><ConditionFilter v-model="query.store" label="所属店铺" :options="stores" /><ConditionFilter v-model="query.group" label="所属客户组" :options="groups" /></template>
      <ConditionFilter v-else v-model="query.usageType" label="引用标签" :options="usageTypes" />
      <ConditionFilter v-model="query.status" label="状态" :options="activeView === 'customers' ? ['启用','未配置'] : ['启用','停用']" />
      <div class="condition-filter-actions linked-query-actions"><el-button type="primary" @click="applyQuery">查询</el-button><el-button @click="resetQuery">重置</el-button></div>
    </div></section>
    <MetricGrid class="reference-kpis" :items="summary" :columns="summary.length" />
    <section class="module-panel">
      <DataTableFrame :total="rows.length" :selected-count="0">
        <template #actions><el-button type="primary" :icon="Plus" @click="newConfig">新建配置</el-button></template>
        <el-table v-if="activeView === 'customers'" :data="rows" border row-key="id" class="clean-table">
          <el-table-column type="expand"><template #default="scope"><dl class="inline-detail-grid"><div><dt>客户引用记录</dt><dd>{{ scope.row.referenceNo }}</dd></div><div><dt>准确版本</dt><dd>{{ scope.row.configNo }} / {{ scope.row.version }}</dd></div><div><dt>账期规则</dt><dd>{{ scope.row.cycle }}</dd></div><div><dt>生效周期</dt><dd>{{ scope.row.effectStart }} 至 {{ scope.row.effectEnd }}</dd></div></dl><ConfigSchemeOverview v-if="activeType === 'AR'" :snapshot="scope.row.schemeSnapshot" /></template></el-table-column>
          <el-table-column label="客户（会员）" min-width="190"><template #default="scope"><StackedCell :primary="scope.row.customerName" :secondary="scope.row.customerCode" /></template></el-table-column>
          <el-table-column prop="memberCode" label="会员编码" min-width="125" show-overflow-tooltip />
          <el-table-column prop="store" label="所属店铺" min-width="150" show-overflow-tooltip />
          <el-table-column prop="group" label="所属客户组" min-width="150" show-overflow-tooltip />
          <el-table-column label="引用状态" width="100"><template #default="scope"><StatusTag :label="scope.row.configId ? '已引用' : '未配置'" :tone="scope.row.configId ? 'success' : 'warning'" /></template></el-table-column>
          <el-table-column label="采用配置" min-width="220"><template #default="scope"><StackedCell :primary="scope.row.configName" :secondary="scope.row.configNo === '-' ? '-' : `${scope.row.configNo} / ${scope.row.version}`" /></template></el-table-column>
          <el-table-column label="引用标签" width="125"><template #default="scope"><StatusTag :label="referenceUsage(scope.row).label" :tone="usageTone(referenceUsage(scope.row).usageType)" /></template></el-table-column>
          <el-table-column v-if="activeType === 'AR'" label="方案概览" width="240"><template #default="scope"><ConfigSchemeOverview :snapshot="scope.row.schemeSnapshot" compact /></template></el-table-column>
          <template v-else><el-table-column prop="currency" label="默认结算币种" width="125" /><el-table-column prop="cycle" label="账期类型" width="110" /></template>
          <el-table-column label="生效周期" width="180"><template #default="scope">{{ scope.row.effectStart }} 至 {{ scope.row.effectEnd }}</template></el-table-column><el-table-column label="状态" width="85"><template #default="scope"><StatusTag :label="scope.row.status" :tone="scope.row.status === '未配置' ? 'warning' : ''" /></template></el-table-column>
          <TableActionColumn><template #default="scope"><HoverActionMenu><el-dropdown-item v-if="scope.row.configId" :icon="View" @click="viewConfig(scope.row)">查看配置</el-dropdown-item><el-dropdown-item v-if="scope.row.configId" :icon="CopyDocument" @click="forkForCustomer(scope.row)">另存为新配置</el-dropdown-item><el-dropdown-item :icon="Promotion" @click="chooseForCustomer(scope.row)">{{ scope.row.configId ? '更换配置' : '选择配置' }}</el-dropdown-item><el-dropdown-item v-if="scope.row.configId" :icon="Tickets" @click="generate(scope.row)">生成账单</el-dropdown-item></HoverActionMenu></template></TableActionColumn>
        </el-table>
        <el-table v-else :data="rows" border row-key="id" class="clean-table">
          <el-table-column type="expand"><template #default="scope"><div class="config-expand-content"><div class="version-reference-breakdown"><strong>准确版本记录</strong><div v-for="item in versionRowsFor(scope.row)" :key="item.snapshotId" class="version-reference-row"><b>{{ item.version }}</b><span>{{ item.references.length }} 个客户</span><small>{{ item.references.map(reference => reference.customerName).join('、') || '无当前有效引用' }}{{ item.isCurrent ? ' · 当前版本' : '' }}</small><div class="version-actions"><el-button link type="primary" @click="openDetail(item, 'view')">查看</el-button><el-button link type="primary" :disabled="scope.row.status === '停用'" @click="manageReferences(item)">管理引用</el-button><el-button link type="primary" @click="openGeneration(item)">批量生成</el-button></div></div></div><ConfigSchemeOverview v-if="activeType === 'AR'" :snapshot="scope.row.schemeSnapshot" /></div></template></el-table-column>
          <el-table-column label="配置" min-width="210"><template #default="scope"><StackedCell :primary="scope.row.name" :secondary="scope.row.no" /></template></el-table-column><el-table-column prop="version" label="当前版本" width="90" />
          <el-table-column label="引用标签" width="145"><template #default="scope"><StatusTag :label="scope.row.referenceStats.label" :tone="usageTone(scope.row.referenceStats.usageType)" /></template></el-table-column>
          <el-table-column label="全部有效引用" width="110"><template #default="scope"><strong>{{ scope.row.referenceStats.total }}</strong></template></el-table-column><el-table-column label="当前版本引用" width="110"><template #default="scope"><strong>{{ scope.row.referenceStats.exact }}</strong></template></el-table-column>
          <el-table-column v-if="activeType === 'AR'" label="方案概览" width="240"><template #default="scope"><ConfigSchemeOverview :snapshot="scope.row.schemeSnapshot" compact /></template></el-table-column><template v-else><el-table-column prop="currency" label="默认结算币种" width="125" /><el-table-column prop="cycle" label="账期类型" width="110" /></template>
          <el-table-column label="最近发布" width="165"><template #default="scope"><StackedCell :primary="scope.row.operator" :secondary="scope.row.updatedAt" /></template></el-table-column><el-table-column label="状态" width="85"><template #default="scope"><StatusTag :label="scope.row.status" /></template></el-table-column>
          <TableActionColumn><template #default="scope"><HoverActionMenu><el-dropdown-item :icon="EditPen" :disabled="scope.row.status === '停用'" @click="openDetail(scope.row)">发布新版本</el-dropdown-item><el-dropdown-item :icon="Promotion" :disabled="scope.row.status === '停用'" @click="manageReferences(scope.row)">管理客户引用</el-dropdown-item><el-dropdown-item :icon="Tickets" @click="openGeneration(scope.row)">批量生成账单</el-dropdown-item></HoverActionMenu></template></TableActionColumn>
        </el-table>
      </DataTableFrame>
    </section>

    <BillingConfigDetailDialog
      v-model="detailVisible"
      ref="editorRef"
      :config="selectedConfig"
      :detail-mode="detailMode"
      :active-type="activeType"
      :reference-stats="selectedConfig ? statsFor(selectedConfig) : undefined"
      :editing-references="editingReferences"
      :editing-impact-text="editingImpactText"
      @save="save"
    />

    <el-dialog v-model="selectionVisible" class="module-dialog module-dialog-standard" align-center append-to-body destroy-on-close>
      <template #header><div class="drawer-title"><span>选择配置</span><small>{{ selectedCustomer?.customerCode }} {{ selectedCustomer?.customerName }}</small></div></template>
      <DataTableFrame :total="configRowsWithStats.length" :selected-count="0" :pagination="false" :column-sort="false"><el-table :data="configRowsWithStats" border row-key="id"><el-table-column label="配置" min-width="210"><template #default="scope"><StackedCell :primary="scope.row.name" :secondary="`${scope.row.no} / ${scope.row.version}`" /></template></el-table-column><el-table-column label="引用标签" width="145"><template #default="scope"><StatusTag :label="scope.row.referenceStats.label" :tone="usageTone(scope.row.referenceStats.usageType)" /></template></el-table-column><el-table-column label="操作" width="80"><template #default="scope"><el-button link type="primary" :disabled="scope.row.status === '停用'" @click="selectConfig(scope.row)">选择</el-button></template></el-table-column></el-table></DataTableFrame>
    </el-dialog>

    <ConfigReferenceDialog v-model="referenceVisible" :config="targetConfig" :customers="currentReferences" :reference-history="customerReferences" :tasks="taskRecords" :focus-customer-code="focusCustomerCode" @confirm="assignReferences" />
    <ConfigGenerationDialog v-model="generationVisible" :config="targetConfig" :references="customerReferences" :tasks="taskRecords" :focus-customer-code="generationCustomerCode" @confirm="confirmGeneration" />
  </div>
</template>

<style scoped>
.config-expand-content{display:grid;gap:var(--space-3);padding:var(--space-2) var(--space-4)}.version-reference-breakdown{display:grid;grid-template-columns:150px minmax(0,1fr);gap:6px 12px}.version-reference-breakdown>strong{grid-column:1/-1;color:#334158}.version-reference-row{grid-column:1/-1;min-height:34px;display:grid;grid-template-columns:64px 92px minmax(0,1fr) 150px;align-items:center;border-bottom:1px solid #edf0f4}.version-reference-row b{color:#334158}.version-reference-row span,.version-reference-row small{color:#6e798b}.version-actions{display:flex;justify-content:flex-end;gap:4px}@media(max-width:760px){.version-reference-row{grid-template-columns:48px 70px minmax(0,1fr)}.version-actions{grid-column:1/-1;justify-content:flex-start}}
</style>
