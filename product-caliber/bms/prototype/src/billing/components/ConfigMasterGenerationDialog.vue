<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus/es/components/message/index.mjs'
import DataTableFrame from '../../shared/components/DataTableFrame.vue'
import StackedCell from '../../shared/components/StackedCell.vue'
import StatusTag from '../../shared/components/StatusTag.vue'
import { buildMasterGenerationScopes } from '../../domain/masterGeneration.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  master: { type: Object, default: null },
  customers: { type: Array, default: () => [] },
  tasks: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'confirm'])

const tableRef = ref(null)
const selectedRows = ref([])
const form = reactive({ cutoff: '2026-08-27 16:45:00', reason: '' })
const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})
const preview = computed(() => buildMasterGenerationScopes({
  master: props.master,
  customers: props.customers,
  tasks: props.tasks,
  cutoff: form.cutoff,
}))
const blockedCount = computed(() => preview.value.rows.filter(row => row.blocked).length)
const selectedCustomerCount = computed(() => new Set(selectedRows.value.map(row => row.customerCode)).size)
const previewSignature = computed(() => preview.value.rows.map(row => `${row.id}:${row.blocked}`).join('|'))

async function selectEligibleRows() {
  selectedRows.value = []
  await nextTick()
  tableRef.value?.clearSelection()
  preview.value.rows.filter(row => !row.blocked)
    .forEach(row => tableRef.value?.toggleRowSelection(row, true))
}

watch(() => props.modelValue, async (open) => {
  if (!open) return
  form.cutoff = '2026-08-27 16:45:00'
  form.reason = ''
  await selectEligibleRows()
})
watch(previewSignature, () => {
  if (props.modelValue) selectEligibleRows()
})

function selectable(row) {
  return !row.blocked
}

function confirm() {
  if (!form.cutoff) return ElMessage.warning('请选择数据截止点')
  emit('confirm', {
    scopes: selectedRows.value,
    skippedCount: blockedCount.value,
    frozenCustomerCount: preview.value.exactCustomerCount,
    cutoff: form.cutoff,
    reason: form.reason.trim(),
  })
  visible.value = false
}
</script>

<template>
  <el-dialog
    v-model="visible"
    class="module-dialog module-dialog-large master-generation-dialog"
    align-center
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
  >
    <template #header>
      <div class="drawer-title">
        <span>批量生成账单</span>
        <small>{{ master?.name }} · {{ master?.no }} / {{ master?.version }}</small>
      </div>
    </template>

    <div class="generation-summary">
      <div><span>当前版本引用客户</span><strong>{{ preview.exactCustomerCount }}</strong></div>
      <div><span>其它版本不纳入</span><strong>{{ preview.otherVersionCount }}</strong></div>
      <div><span>已选客户 / 任务</span><strong>{{ selectedCustomerCount }} / {{ selectedRows.length }}</strong></div>
      <div><span>校验跳过范围</span><strong :class="{ warning: blockedCount }">{{ blockedCount }}</strong></div>
    </div>

    <el-alert
      title="本次只冻结当前母版编号与当前准确版本的客户引用；任务将按客户、账单类型、方案和实际账期独立创建。"
      type="info"
      :closable="false"
      show-icon
    />

    <el-form label-position="top" class="generation-form">
      <el-form-item label="数据截止点" required>
        <el-date-picker
          v-model="form.cutoff"
          type="datetime"
          value-format="YYYY-MM-DD HH:mm:ss"
          format="YYYY-MM-DD HH:mm:ss"
          :editable="false"
        />
      </el-form-item>
      <el-form-item label="发起原因">
        <el-input v-model="form.reason" maxlength="100" show-word-limit placeholder="选填，将写入批次审计" />
      </el-form-item>
    </el-form>

    <DataTableFrame
      class="generation-table"
      :total="preview.rows.length"
      :selected-count="selectedRows.length"
      selection-summary
      :pagination="false"
      :column-sort="false"
    >
      <el-table
        ref="tableRef"
        :data="preview.rows"
        border
        row-key="id"
        @selection-change="selectedRows = $event"
      >
        <el-table-column type="selection" width="44" :selectable="selectable" />
        <el-table-column label="客户" min-width="180">
          <template #default="scope"><StackedCell :primary="scope.row.customerName" :secondary="scope.row.customerCode" /></template>
        </el-table-column>
        <el-table-column prop="store" label="所属店铺" min-width="125" />
        <el-table-column prop="group" label="所属客户组" min-width="125" />
        <el-table-column label="方案名称 / 标识" min-width="140">
          <template #default="scope"><StackedCell :primary="scope.row.schemeName" :secondary="scope.row.schemeKey" /></template>
        </el-table-column>
        <el-table-column label="实际账期" width="190">
          <template #default="scope">{{ scope.row.periodStart === '-' ? '-' : `${scope.row.periodStart} 至 ${scope.row.periodEnd}` }}</template>
        </el-table-column>
        <el-table-column label="创建校验" min-width="190">
          <template #default="scope">
            <div class="validation-cell">
              <StatusTag :label="scope.row.blocked ? '跳过' : '可创建'" :tone="scope.row.blocked ? 'warning' : 'success'" />
              <small v-if="scope.row.reason">{{ scope.row.reason }}</small>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </DataTableFrame>

    <template #footer>
      <div class="config-drawer-footer">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="confirm">{{ selectedRows.length ? `创建批次与 ${selectedRows.length} 条任务` : '保存校验结果' }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.generation-summary{margin-bottom:var(--space-3);display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));border:1px solid var(--border);background:#f8fafb}.generation-summary>div{min-height:64px;padding:var(--space-3);display:flex;flex-direction:column;gap:6px;border-right:1px solid var(--border)}.generation-summary>div:last-child{border-right:0}.generation-summary span{color:#7d8797;font-size:var(--font-size-sm)}.generation-summary strong{color:#2e3b51}.generation-summary strong.warning{color:var(--warning)}.generation-form{margin-top:var(--space-3);display:grid;grid-template-columns:250px 1fr;gap:16px}.generation-form :deep(.el-form-item){margin-bottom:0}.generation-form :deep(.el-date-editor){width:100%}.generation-table{margin-top:var(--space-3)}.validation-cell{display:flex;align-items:center;gap:8px}.validation-cell small{min-width:0;color:#7d8797}.config-drawer-footer{display:flex;justify-content:flex-end;gap:8px}.master-generation-dialog :deep(.el-alert){border-radius:2px}@media(max-width:760px){.generation-summary{grid-template-columns:1fr 1fr}.generation-form{grid-template-columns:1fr}.validation-cell{align-items:flex-start;flex-direction:column}}
</style>
