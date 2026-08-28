<script setup>
import { computed, reactive, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus/es/components/message/index.mjs'
import ConditionFilter from '../../shared/components/ConditionFilter.vue'
import StatusTag from '../../shared/components/StatusTag.vue'
import DataTableFrame from '../../shared/components/DataTableFrame.vue'
import { customerRelationSummary, formatCustomerRelations, matchCustomerRelations } from '../../domain/customerRelations.js'
import { isConfigReferenceActive, taskOverlapsReferenceStart } from '../../domain/configGeneration.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  config: { type: Object, default: null },
  customers: { type: Array, default: () => [] },
  referenceHistory: { type: Array, default: () => [] },
  focusCustomerCode: { type: String, default: '' },
  tasks: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'confirm'])

const selectionRef = ref(null)
const selectedRows = ref([])
const query = reactive({ customer:'', stores:[], groups:[] })
const appliedQuery = reactive({ customer:'', stores:[], groups:[] })
const form = reactive({ effectiveAt: '2026-09-01', forceConfirmed: false, reason: '' })
const visible = computed({ get: () => props.modelValue, set: value => emit('update:modelValue', value) })
const stores = computed(() => [...new Set(props.customers.flatMap(row => customerRelationSummary(row).stores))])
const groups = computed(() => [...new Set(props.customers.flatMap(row => customerRelationSummary(row).groups))])
function taskOverlapsSwitch(task, customerCode) {
  return taskOverlapsReferenceStart(task, { customerCode, billType:props.config?.type, effectiveAt:form.effectiveAt })
}
const allRows = computed(() => props.customers.map((customer) => {
  const relationMatch = matchCustomerRelations(customer, appliedQuery)
  const referenceAtSwitch = props.referenceHistory
    .filter(reference => reference.type === props.config?.type && reference.customerCode === customer.customerCode && isConfigReferenceActive(reference, form.effectiveAt))
    .sort((left, right) => String(right.effectStart).localeCompare(String(left.effectStart)))[0]
  const adopted = referenceAtSwitch || customer
  const sameConfig = adopted.configId === props.config?.id
  const sameVersion = sameConfig && adopted.configNo === props.config?.no && adopted.version === props.config?.version
  const blockingTasks = props.tasks.filter(task => taskOverlapsSwitch(task, customer.customerCode))
  const blocked = Boolean(customer.blocked || blockingTasks.length)
  const category = blocked ? '不可切换'
    : sameVersion ? '已引用当前版本'
    : sameConfig ? '本配置其它版本'
      : adopted.configId ? '其它配置'
        : '未配置'
  return {
    ...customer,
    configId:adopted.configId,
    configName:adopted.configName,
    configNo:adopted.configNo,
    version:adopted.version,
    code:customer.customerCode,
    name:customer.customerName,
    category,
    blocked,
    blockingTaskNos:blockingTasks.map(task => task.taskNo),
    selectable:!sameVersion && !blocked,
    risky:category === '其它配置',
    relationMatch:relationMatch.matches,
    relations:relationMatch.relations,
    stores:relationMatch.stores,
    groups:relationMatch.groups,
    memberCodes:relationMatch.memberCodes,
    storesText:relationMatch.stores.join('、') || '-',
    groupsText:relationMatch.groups.join('、') || '-',
    memberCodesText:relationMatch.memberCodes.join('、') || '-',
    matchedRelationsText:formatCustomerRelations(relationMatch.matchedRelations),
  }
}))
const rows = computed(() => allRows.value.filter(row =>
  (!appliedQuery.customer || `${row.code}${row.name}`.includes(appliedQuery.customer))
  && row.relationMatch))
const resolvedSelectedRows = computed(() => selectedRows.value.map(row => allRows.value.find(current => current.code === row.code) || row))
const riskCount = computed(() => resolvedSelectedRows.value.filter(row => row.risky).length)

function applyQuery() { Object.assign(appliedQuery, { customer:query.customer, stores:[...query.stores], groups:[...query.groups] }) }
function resetQuery() { Object.assign(query, { customer:'', stores:[], groups:[] }); applyQuery() }

watch(() => props.modelValue, async (open) => {
  if (!open) return
  form.effectiveAt = '2026-09-01'
  form.forceConfirmed = false
  form.reason = ''
  selectedRows.value = []
  resetQuery()
  await new Promise(resolve => window.setTimeout(resolve, 0))
  const defaults = allRows.value.filter(row => row.selectable && (props.focusCustomerCode ? row.code === props.focusCustomerCode : row.category === '本配置其它版本'))
  defaults.forEach(row => selectionRef.value?.toggleRowSelection(row, true))
})

function selectable(row) { return row.selectable }
function confirm() {
  if (!selectedRows.value.length) return ElMessage.warning('请至少选择一个可切换客户')
  if (!form.effectiveAt) return ElMessage.warning('请选择配置切换日期')
  if (dayjs(form.effectiveAt).isBefore('2026-08-27', 'day')) return ElMessage.warning('配置切换日期不能早于当前日期')
  if (resolvedSelectedRows.value.some(row => row.blocked)) return ElMessage.warning('所选客户存在与切换日期重叠的未完成任务，请先调整日期或处理冲突任务')
  if (resolvedSelectedRows.value.some(row => !row.selectable)) return ElMessage.warning('切换日期变化后部分客户已不可切换，请重新选择')
  if (riskCount.value && !form.forceConfirmed) return ElMessage.warning('请确认强制替换正在使用其它配置的客户')
  if (riskCount.value && !form.reason.trim()) return ElMessage.warning('强制替换必须填写变更原因')
  emit('confirm', { customers:resolvedSelectedRows.value, effectiveAt:form.effectiveAt, force:riskCount.value > 0, reason:form.reason.trim() })
  visible.value = false
}
</script>

<template>
  <el-dialog v-model="visible" class="module-dialog module-dialog-large reference-dialog" align-center append-to-body destroy-on-close :close-on-click-modal="false">
    <template #header><div class="drawer-title"><span>管理客户引用</span><small>{{ config?.name }} · {{ config?.no }} / {{ config?.version }}</small></div></template>
    <div class="reference-summary">
      <div><span>候选客户</span><strong>{{ allRows.length }}</strong></div>
      <div><span>当前版本引用</span><strong>{{ allRows.filter(row => row.category === '已引用当前版本').length }}</strong></div>
      <div><span>已选客户</span><strong>{{ selectedRows.length }}</strong></div>
      <div><span>强制替换</span><strong :class="{ danger:riskCount }">{{ riskCount }}</strong></div>
    </div>
    <el-alert title="所属店铺和所属客户组只用于本次筛选；确认后逐客户建立准确版本引用，客户归属变化不会自动增删引用。" type="info" :closable="false" show-icon />
    <div class="reference-filters">
      <ConditionFilter v-model="query.customer" label="客户" type="text" />
      <el-select v-model="query.stores" multiple collapse-tags collapse-tags-tooltip clearable placeholder="所属店铺" aria-label="所属店铺"><el-option v-for="item in stores" :key="item" :label="item" :value="item" /></el-select>
      <el-select v-model="query.groups" multiple collapse-tags collapse-tags-tooltip clearable placeholder="所属客户组" aria-label="所属客户组"><el-option v-for="item in groups" :key="item" :label="item" :value="item" /></el-select>
      <el-button type="primary" @click="applyQuery">查询</el-button><el-button @click="resetQuery">重置</el-button>
    </div>
    <DataTableFrame class="reference-table" :total="rows.length" :selected-count="selectedRows.length" :pagination="false" :column-sort="false">
      <el-table ref="selectionRef" :data="rows" border row-key="id" @selection-change="selectedRows = $event">
        <el-table-column type="selection" width="44" :selectable="selectable" reserve-selection />
        <el-table-column prop="code" label="客户编码" width="100" />
        <el-table-column prop="name" label="客户名称" min-width="170" />
        <el-table-column prop="storesText" label="所属店铺" min-width="150" show-overflow-tooltip />
        <el-table-column prop="groupsText" label="所属客户组" min-width="150" show-overflow-tooltip />
        <el-table-column prop="memberCodesText" label="关联会员" min-width="135" show-overflow-tooltip />
        <el-table-column prop="matchedRelationsText" label="本次命中归属" min-width="230" show-overflow-tooltip />
        <el-table-column label="当前配置" min-width="190"><template #default="scope">{{ scope.row.configName || '未配置' }}<small v-if="scope.row.version && scope.row.version !== '-'"> · {{ scope.row.version }}</small></template></el-table-column>
        <el-table-column label="识别结果" min-width="190"><template #default="scope"><div class="result-cell"><StatusTag :label="scope.row.category" :tone="scope.row.blocked ? 'danger' : scope.row.risky ? 'warning' : scope.row.category === '已引用当前版本' ? 'neutral' : 'success'" /><small v-if="scope.row.blockingTaskNos.length">冲突任务：{{ scope.row.blockingTaskNos.join('、') }}</small></div></template></el-table-column>
      </el-table>
    </DataTableFrame>
    <el-form label-position="top" class="reference-form">
      <el-form-item label="配置切换日期" required><el-date-picker v-model="form.effectiveAt" type="date" value-format="YYYY-MM-DD" :disabled-date="date => dayjs(date).isBefore('2026-08-27', 'day')" /></el-form-item>
      <el-form-item label="变更原因" :required="riskCount > 0"><el-input v-model="form.reason" placeholder="强制替换时必填" /></el-form-item>
      <el-form-item class="force-confirm"><el-checkbox v-model="form.forceConfirmed" :disabled="riskCount === 0">确认强制替换 {{ riskCount }} 个正在使用其它配置的客户</el-checkbox></el-form-item>
    </el-form>
    <template #footer><div class="config-drawer-footer"><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="confirm">确认引用</el-button></div></template>
  </el-dialog>
</template>

<style scoped>
.reference-summary{margin-bottom:var(--space-3);display:grid;grid-template-columns:repeat(4,minmax(130px,1fr));border:1px solid var(--border);background:#f8fafb}.reference-summary>div{min-height:64px;padding:var(--space-3);display:flex;flex-direction:column;gap:6px;border-right:1px solid var(--border)}.reference-summary>div:last-child{border-right:0}.reference-summary span{color:#7d8797;font-size:var(--font-size-sm)}.reference-summary strong{color:#2e3b51}.reference-summary strong.danger{color:var(--danger)}.reference-filters{margin-top:var(--space-3);display:flex;flex-wrap:wrap;gap:8px}.reference-filters :deep(.el-select){width:190px}.reference-table{margin-top:var(--space-3)}.reference-table small{color:#7d8797}.result-cell{display:flex;align-items:center;gap:8px}.result-cell small{color:var(--danger)}.reference-form{margin-top:var(--space-3);display:grid;grid-template-columns:220px 1fr;gap:0 16px}.reference-form :deep(.el-form-item){margin-bottom:0}.reference-form :deep(.el-date-editor){width:100%}.force-confirm{grid-column:1/-1;margin-top:var(--space-2)!important}.config-drawer-footer{display:flex;justify-content:flex-end;gap:8px}.reference-dialog :deep(.el-alert){border-radius:2px}@media(max-width:760px){.reference-summary{grid-template-columns:1fr 1fr}.reference-form{grid-template-columns:1fr}.force-confirm{grid-column:auto}.result-cell{align-items:flex-start;flex-direction:column}}
</style>
