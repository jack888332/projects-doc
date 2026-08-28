<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus/es/components/message/index.mjs'
import DataTableFrame from '../../shared/components/DataTableFrame.vue'
import StackedCell from '../../shared/components/StackedCell.vue'
import StatusTag from '../../shared/components/StatusTag.vue'
import { buildConfigGenerationScopes } from '../../domain/configGeneration.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  config: { type: Object, default: null },
  references: { type: Array, default: () => [] },
  tasks: { type: Array, default: () => [] },
  focusCustomerCode: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'confirm'])

const tableRef = ref(null)
const selectedRows = ref([])
const form = reactive({ cutoff: '2026-08-27 16:45:00', reason: '' })
const referenceAt = '2026-08-27 16:45:00'
const visible = computed({ get: () => props.modelValue, set: value => emit('update:modelValue', value) })
const preview = computed(() => buildConfigGenerationScopes({ config:props.config, references:props.references, tasks:props.tasks, cutoff:form.cutoff, referenceAt, customerCode:props.focusCustomerCode }))
const blockedCount = computed(() => preview.value.rows.filter(row => row.blocked).length)
const selectedCustomerCount = computed(() => new Set(selectedRows.value.map(row => row.customerCode)).size)
const schemeCount = computed(() => new Set(preview.value.rows.map(row => row.schemeKey)).size)
const unselectedCount = computed(() => preview.value.rows.filter(row => !row.blocked).length - selectedRows.value.length)
const skippedCount = computed(() => blockedCount.value + unselectedCount.value)
const previewSignature = computed(() => preview.value.rows.map(row => `${row.id}:${row.blocked}`).join('|'))

async function selectEligibleRows() {
  selectedRows.value = []
  await nextTick()
  tableRef.value?.clearSelection()
  preview.value.rows.filter(row => !row.blocked).forEach(row => tableRef.value?.toggleRowSelection(row, true))
}

watch(() => props.modelValue, async (open) => {
  if (!open) return
  form.cutoff = '2026-08-27 16:45:00'
  form.reason = ''
  await selectEligibleRows()
})
watch(previewSignature, () => { if (props.modelValue) selectEligibleRows() })

function confirm() {
  if (!form.cutoff) return ElMessage.warning('请选择数据截止点')
  emit('confirm', { scopes:selectedRows.value, skippedCount:blockedCount.value, frozenCustomerCount:selectedCustomerCount.value, candidateCustomerCount:preview.value.referenceCustomerCount, blockedCount:blockedCount.value, unselectedCount:unselectedCount.value, cutoff:form.cutoff, reason:form.reason.trim() })
  visible.value = false
}
</script>

<template>
  <el-dialog v-model="visible" class="module-dialog module-dialog-large config-generation-dialog" align-center append-to-body destroy-on-close :close-on-click-modal="false">
    <template #header><div class="drawer-title"><span>批量生成账单</span><small>{{ config?.name ? `${config.name} · ` : '' }}{{ config?.no }}-{{ config?.version }}</small></div></template>
    <div class="generation-summary">
      <div><span>当前配置引用客户</span><strong>{{ preview.referenceCustomerCount }}</strong></div>
      <div><span>涉及方案</span><strong>{{ schemeCount }}</strong></div>
      <div><span>已选客户 / 任务</span><strong>{{ selectedCustomerCount }} / {{ selectedRows.length }}</strong></div>
      <div><span>未创建范围</span><strong :class="{ warning:skippedCount }">{{ skippedCount }}</strong></div>
    </div>
    <el-alert title="本次按配置当前生效版本展开引用客户，并在任务创建时冻结配置编号和准确版本；任务按客户、账单类型、方案编号和实际账期独立创建。" type="info" :closable="false" show-icon />
    <el-form label-position="top" class="generation-form">
      <el-form-item label="数据截止点" required><el-date-picker v-model="form.cutoff" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" format="YYYY-MM-DD HH:mm:ss" :editable="false" /></el-form-item>
      <el-form-item label="发起原因"><el-input v-model="form.reason" maxlength="100" show-word-limit placeholder="选填，将写入批次审计" /></el-form-item>
    </el-form>
    <DataTableFrame class="generation-table" :total="preview.rows.length" :selected-count="selectedRows.length" selection-summary :page-size="10" :column-sort="false">
      <el-table ref="tableRef" :data="preview.rows" border row-key="id" @selection-change="selectedRows = $event">
        <el-table-column type="selection" width="44" :selectable="row => !row.blocked" />
        <el-table-column label="客户" min-width="180"><template #default="scope"><StackedCell :primary="scope.row.customerName" :secondary="scope.row.customerCode" /></template></el-table-column>
        <el-table-column prop="memberCode" label="会员编码快照" min-width="145" show-overflow-tooltip />
        <el-table-column prop="store" label="所属店铺快照" min-width="155" show-overflow-tooltip />
        <el-table-column prop="group" label="所属客户组快照" min-width="155" show-overflow-tooltip />
        <el-table-column label="方案名称 / 编号" min-width="220"><template #default="scope"><StackedCell :primary="scope.row.schemeName" :secondary="scope.row.schemeKey" /></template></el-table-column>
        <el-table-column label="实际账期" width="190"><template #default="scope">{{ scope.row.periodStart === '-' ? '--' : `${scope.row.periodStart} 至 ${scope.row.periodEnd}` }}</template></el-table-column>
        <el-table-column label="创建校验" min-width="190"><template #default="scope"><div class="validation-cell"><StatusTag :label="scope.row.blocked ? '跳过' : '可创建'" :tone="scope.row.blocked ? 'warning' : 'success'" /><small v-if="scope.row.reason">{{ scope.row.reason }}</small></div></template></el-table-column>
      </el-table>
    </DataTableFrame>
    <template #footer><div class="config-drawer-footer"><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="confirm">{{ selectedRows.length ? `创建批次与 ${selectedRows.length} 条任务` : '保存校验结果' }}</el-button></div></template>
  </el-dialog>
</template>

<style scoped>
.generation-summary{margin-bottom:var(--space-3);display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));border:1px solid var(--border);background:#f8fafb}.generation-summary>div{min-height:64px;padding:var(--space-3);display:flex;flex-direction:column;gap:6px;border-right:1px solid var(--border)}.generation-summary>div:last-child{border-right:0}.generation-summary span{color:#7d8797;font-size:var(--font-size-sm)}.generation-summary strong{color:#2e3b51}.generation-summary strong.warning{color:var(--warning)}.generation-form{margin-top:var(--space-3);display:grid;grid-template-columns:250px 1fr;gap:16px}.generation-form :deep(.el-form-item){margin-bottom:0}.generation-form :deep(.el-date-editor){width:100%}.generation-table{margin-top:var(--space-3)}.validation-cell{display:flex;align-items:center;gap:8px}.validation-cell small{min-width:0;color:#7d8797}.config-drawer-footer{display:flex;justify-content:flex-end;gap:8px}.config-generation-dialog :deep(.el-alert){border-radius:2px}@media(max-width:760px){.generation-summary{grid-template-columns:1fr 1fr}.generation-form{grid-template-columns:1fr}.validation-cell{align-items:flex-start;flex-direction:column}}
</style>
