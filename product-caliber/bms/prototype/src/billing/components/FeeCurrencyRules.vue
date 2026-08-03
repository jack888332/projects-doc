<script setup>
import { Delete, Plus } from '@element-plus/icons-vue'

const props = defineProps({
  scheme: { type: Object, required: true },
  currencies: { type: Array, required: true },
  feeItems: { type: Array, required: true },
  templates: { type: Array, required: true },
})

const addRule = () => props.scheme.feeRules.push({ feeCode: '', mode: 'SOURCE', currency: '' })
function changeMode(rule) { if (rule.mode !== 'FIXED') rule.currency = '' }
function applyTemplate(value) {
  if (!value) return
  props.scheme.feeRules = [
    { feeCode: 'FREIGHT', mode: 'SOURCE', currency: '' },
    { feeCode: 'COD_SERVICE_FEE', mode: 'FIXED', currency: value.startsWith('TW') ? 'TWD' : 'JPY' },
  ]
}
</script>

<template>
  <div class="setting-row matrix-row">
    <div class="setting-meta"><b>费项指定结算币种</b><small>未配置的费项采用默认结算币种</small></div>
    <div class="matrix-wrap">
      <el-table :data="scheme.feeRules" border empty-text="未配置，默认使用费项默认结算币种">
        <el-table-column label="费项" min-width="170"><template #default="{row}"><el-select v-model="row.feeCode" filterable placeholder="请选择费项"><el-option v-for="item in feeItems" :key="item.value" :label="item.label" :value="item.value" /></el-select></template></el-table-column>
        <el-table-column label="结算币种" min-width="140"><template #default="{row}"><el-select v-model="row.mode" @change="changeMode(row)"><el-option label="按数据源币种" value="SOURCE" /><el-option label="固定币种" value="FIXED" /></el-select></template></el-table-column>
        <el-table-column label="固定币种" width="130"><template #default="{row}"><el-select v-model="row.currency" :disabled="row.mode !== 'FIXED'" clearable><el-option v-for="item in currencies" :key="item" :label="item" :value="item" /></el-select></template></el-table-column>
        <el-table-column label="操作" width="70"><template #default="{$index}"><el-button link type="danger" :icon="Delete" @click="scheme.feeRules.splice($index, 1)" /></template></el-table-column>
      </el-table>
      <div class="matrix-actions"><el-select v-model="scheme.template" clearable placeholder="引用费项币种模版" @change="applyTemplate"><el-option v-for="item in templates" :key="item.value" :label="item.label" :value="item.value" /></el-select><el-button :icon="Plus" @click="addRule">新增费项币种</el-button></div>
    </div>
  </div>
</template>

<style scoped>
.matrix-row{grid-template-columns:280px minmax(0,1fr);align-items:start;padding:15px 0}.setting-meta{display:flex;flex-direction:column;gap:5px}.setting-meta b{font-size:13px;font-weight:600}.setting-meta small{font-size:12px;color:#8992a1;line-height:1.5}.matrix-wrap{min-width:0}.matrix-actions{display:flex;gap:10px;margin-top:10px}.matrix-actions .el-select{width:260px}
@media(max-width:760px){.matrix-row{grid-template-columns:1fr}.matrix-actions{flex-direction:column}.matrix-actions .el-select{width:100%}}
</style>
