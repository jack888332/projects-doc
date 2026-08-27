<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus/es/components/message/index.mjs'
import StatusTag from '../../shared/components/StatusTag.vue'
import DataTableFrame from '../../shared/components/DataTableFrame.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  master: { type: Object, default: null },
  customers: { type: Array, default: () => [] },
  sourceLabel: { type: String, default: '配置母版' },
})
const emit = defineEmits(['update:modelValue', 'confirm'])

const selectionRef = ref(null)
const selectedRows = ref([])
const form = reactive({ effectiveAt: '2026-09-01', forceConfirmed: false, reason: '' })
const visible = computed({ get: () => props.modelValue, set: value => emit('update:modelValue', value) })
const rows = computed(() => props.customers.map((customer) => {
  const source = customer.sourceType || 'NONE'
  const sameMaster = source === 'MASTER' && customer.masterId === props.master?.id
  const sameVersion = sameMaster && customer.version === props.master?.version
  const category = sameVersion ? '已引用当前版本'
    : sameMaster ? '当前母版旧版本'
      : source === 'MASTER' ? '其它母版'
        : source === 'CUSTOM' ? '自定义配置'
          : '未配置'
  return { ...customer, category, selectable: !sameVersion && !customer.blocked, risky: ['其它母版', '自定义配置'].includes(category) }
}))
const riskCount = computed(() => selectedRows.value.filter(row => row.risky).length)

watch(() => props.modelValue, async (open) => {
  if (!open) return
  form.effectiveAt = '2026-09-01'
  form.forceConfirmed = false
  form.reason = ''
  selectedRows.value = []
  await new Promise(resolve => window.setTimeout(resolve, 0))
  rows.value.filter(row => row.selectable && ['未配置', '当前母版旧版本'].includes(row.category))
    .forEach(row => selectionRef.value?.toggleRowSelection(row, true))
})

function selectable(row) { return row.selectable }
function confirm() {
  if (!selectedRows.value.length) return ElMessage.warning('请至少选择一个可切换客户')
  if (!form.effectiveAt) return ElMessage.warning('请选择配置切换日期')
  if (riskCount.value && !form.forceConfirmed) return ElMessage.warning('请确认强制替换已使用其它配置的客户')
  if (riskCount.value && !form.reason.trim()) return ElMessage.warning('强制替换必须填写变更原因')
  emit('confirm', { customers: selectedRows.value, effectiveAt: form.effectiveAt, force: riskCount.value > 0, reason: form.reason.trim() })
  visible.value = false
}
</script>

<template>
  <el-dialog v-model="visible" class="module-dialog module-dialog-large assignment-dialog" align-center append-to-body destroy-on-close :close-on-click-modal="false">
    <template #header>
      <div class="drawer-title"><span>分配客户</span><small>{{ sourceLabel }} · {{ master?.name }} / {{ master?.version }}</small></div>
    </template>
    <div class="assignment-summary">
      <div><span>可分配客户范围</span><strong>{{ master?.rangeText || '-' }}</strong></div>
      <div><span>候选客户</span><strong>{{ rows.length }}</strong></div>
      <div><span>已选客户</span><strong>{{ selectedRows.length }}</strong></div>
      <div><span>强制替换</span><strong :class="{ danger: riskCount }">{{ riskCount }}</strong></div>
    </div>
    <el-alert title="店铺和客户组仅用于展开候选客户；提交后会逐客户固化引用，后续改组不会自动改变引用。" type="info" :closable="false" show-icon />
    <DataTableFrame class="assignment-table" :total="rows.length" :selected-count="selectedRows.length" :pagination="false" :column-sort="false">
      <el-table ref="selectionRef" :data="rows" border row-key="id" @selection-change="selectedRows = $event">
        <el-table-column type="selection" width="44" :selectable="selectable" />
        <el-table-column prop="code" label="客户编码" width="100" />
        <el-table-column prop="name" label="客户名称" min-width="170" />
        <el-table-column prop="store" label="店铺" min-width="130" />
        <el-table-column prop="group" label="客户组" min-width="130" />
        <el-table-column label="当前配置" min-width="190"><template #default="scope">{{ scope.row.sourceName || '未配置' }}<small v-if="scope.row.version"> · {{ scope.row.version }}</small></template></el-table-column>
        <el-table-column label="识别结果" width="125"><template #default="scope"><StatusTag :label="scope.row.category" :tone="scope.row.blocked ? 'danger' : scope.row.risky ? 'warning' : scope.row.category === '已引用当前版本' ? 'neutral' : 'success'" /></template></el-table-column>
      </el-table>
    </DataTableFrame>
    <el-form label-position="top" class="assignment-form">
      <el-form-item label="配置切换日期" required><el-date-picker v-model="form.effectiveAt" type="date" value-format="YYYY-MM-DD" /></el-form-item>
      <el-form-item label="变更原因" :required="riskCount > 0"><el-input v-model="form.reason" placeholder="强制替换时必填" /></el-form-item>
      <el-form-item class="force-confirm"><el-checkbox v-model="form.forceConfirmed" :disabled="riskCount === 0">确认强制替换 {{ riskCount }} 个正在使用自定义配置或其它母版的客户</el-checkbox></el-form-item>
    </el-form>
    <template #footer><div class="config-drawer-footer"><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="confirm">确认分配</el-button></div></template>
  </el-dialog>
</template>

<style scoped>
.assignment-summary{margin-bottom:var(--space-3);display:grid;grid-template-columns:repeat(4,minmax(130px,1fr));border:1px solid var(--border);background:#f8fafb}.assignment-summary>div{min-height:64px;padding:var(--space-3);display:flex;flex-direction:column;gap:6px;border-right:1px solid var(--border)}.assignment-summary>div:last-child{border-right:0}.assignment-summary span{color:#7d8797;font-size:var(--font-size-sm)}.assignment-summary strong{color:#2e3b51}.assignment-summary strong.danger{color:var(--danger)}.assignment-table{margin-top:var(--space-3)}.assignment-table small{color:#7d8797}.assignment-form{margin-top:var(--space-3);display:grid;grid-template-columns:220px 1fr;gap:0 16px}.assignment-form :deep(.el-form-item){margin-bottom:0}.assignment-form :deep(.el-date-editor){width:100%}.force-confirm{grid-column:1/-1;margin-top:var(--space-2)!important}.config-drawer-footer{display:flex;justify-content:flex-end;gap:8px}.assignment-dialog :deep(.el-alert){border-radius:2px}@media(max-width:760px){.assignment-summary{grid-template-columns:1fr 1fr}.assignment-form{grid-template-columns:1fr}.force-confirm{grid-column:auto}}
</style>
