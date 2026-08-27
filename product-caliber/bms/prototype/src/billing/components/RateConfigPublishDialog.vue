<script setup>
import DataTableFrame from '../../shared/components/DataTableFrame.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  config: { type: Object, default: null },
  nextVersion: { type: String, default: '' },
  references: { type: Array, default: () => [] },
  upgradeCodes: { type: Array, default: () => [] },
  switchDate: { type: String, default: '' },
  reason: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'update:switchDate', 'update:reason', 'toggleUpgrade', 'confirm'])
</script>

<template>
  <el-dialog
    :model-value="props.modelValue"
    class="module-dialog module-dialog-large"
    width="980px"
    align-center
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header><div class="drawer-title"><span>发布新版本</span><small>{{ props.config?.no }} / {{ props.nextVersion }}</small></div></template>
    <div class="config-summary">
      <div><span>配置</span><strong>{{ props.config?.name }}</strong></div>
      <div><span>当前版本</span><strong>{{ props.config?.currentVersion }}</strong></div>
      <div><span>当前引用客户</span><strong>{{ props.references.length }}</strong></div>
      <div><span>本次升级客户</span><strong>{{ props.upgradeCodes.length }}</strong></div>
    </div>
    <el-alert v-if="props.references.length > 1" title="共享配置仅升级勾选客户，其他客户保留原准确版本。" type="warning" :closable="false" show-icon />
    <el-alert v-else title="仅升级勾选客户，历史账单保留原准确版本。" type="info" :closable="false" show-icon />
    <el-form label-position="top" class="publish-form"><el-form-item label="切换日期" required><el-date-picker :model-value="props.switchDate" type="date" value-format="YYYY-MM-DD" @update:model-value="emit('update:switchDate', $event)" /></el-form-item></el-form>
    <DataTableFrame class="dialog-table" :total="props.references.length" :pagination="false" :column-sort="false">
      <el-table :data="props.references" border row-key="id">
        <el-table-column label="升级" width="60"><template #default="scope"><el-checkbox :model-value="props.upgradeCodes.includes(scope.row.customerCode)" :aria-label="`升级 ${scope.row.customerName}`" @change="emit('toggleUpgrade', scope.row.customerCode, $event)" /></template></el-table-column>
        <el-table-column prop="customerCode" label="客户编码" width="100" />
        <el-table-column prop="customerName" label="客户名称" min-width="170" />
        <el-table-column prop="memberCode" label="会员编码" min-width="120" show-overflow-tooltip />
        <el-table-column prop="store" label="所属店铺" min-width="140" show-overflow-tooltip />
        <el-table-column prop="group" label="所属客户组" min-width="140" show-overflow-tooltip />
        <el-table-column prop="configVersion" label="当前准确版本" width="110" />
        <el-table-column label="发布后" width="105"><template #default="scope">{{ props.upgradeCodes.includes(scope.row.customerCode) ? props.nextVersion : scope.row.configVersion }}</template></el-table-column>
      </el-table>
    </DataTableFrame>
    <el-form label-position="top" class="dialog-form"><el-form-item label="变更原因" :required="props.references.length > 1"><el-input :model-value="props.reason" placeholder="共享配置发布新版本时必填" @update:model-value="emit('update:reason', $event)" /></el-form-item></el-form>
    <template #footer><div class="dialog-footer"><el-button @click="emit('update:modelValue', false)">取消</el-button><el-button type="primary" @click="emit('confirm')">发布并确认切换</el-button></div></template>
  </el-dialog>
</template>

<style scoped>
.dialog-footer{display:flex;justify-content:flex-end;gap:8px}.config-summary{margin-bottom:12px;display:grid;grid-template-columns:repeat(4,minmax(130px,1fr));border:1px solid var(--border);background:#f8fafb}.config-summary>div{min-height:64px;padding:12px;display:flex;flex-direction:column;gap:6px;border-right:1px solid var(--border)}.config-summary>div:last-child{border-right:0}.dialog-table,.dialog-form,.publish-form{margin-top:12px}.relation-text{white-space:normal;line-height:1.5}.dialog-form :deep(.el-form-item),.publish-form :deep(.el-form-item){margin-bottom:0}.publish-form{width:220px}.publish-form :deep(.el-date-editor){width:100%}
@media(max-width:760px){.config-summary{grid-template-columns:1fr 1fr}}
</style>
