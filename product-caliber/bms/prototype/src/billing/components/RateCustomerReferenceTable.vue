<script setup>
import { View } from '@element-plus/icons-vue'
import StackedCell from '../../shared/components/StackedCell.vue'
import StatusTag from '../../shared/components/StatusTag.vue'
import ConfigVersionTag from '../../shared/components/ConfigVersionTag.vue'

const props = defineProps({ rows: { type:Array, default:() => [] } })
const emit = defineEmits(['view'])
</script>

<template>
  <el-table :data="props.rows" class="clean-table rate-table" border height="100%" row-key="id">
    <el-table-column label="客户（会员）" min-width="185"><template #default="scope"><StackedCell :primary="scope.row.customerName" :secondary="scope.row.customerCode" /></template></el-table-column>
    <el-table-column prop="memberCode" label="会员编码" min-width="125" show-overflow-tooltip />
    <el-table-column prop="store" label="所属店铺" min-width="145" show-overflow-tooltip />
    <el-table-column prop="group" label="所属客户组" min-width="145" show-overflow-tooltip />
    <el-table-column label="配置编号" min-width="245" show-overflow-tooltip><template #default="scope">{{ scope.row.config ? scope.row.configNo : '未配置' }}</template></el-table-column>
    <el-table-column label="配置版本" width="100"><template #default="scope"><ConfigVersionTag :version="scope.row.config ? scope.row.configVersion : ''" /></template></el-table-column>
    <el-table-column label="配置标签" width="128"><template #default="scope"><StatusTag :label="scope.row.referenceLabel" :tone="scope.row.referenceTone" /></template></el-table-column>
    <el-table-column label="生效期间" min-width="155"><template #default="scope">{{ scope.row.effectiveFrom ? `${scope.row.effectiveFrom} 至 ${scope.row.effectiveTo}` : '--' }}</template></el-table-column>
    <el-table-column label="规则摘要 / 默认汇率预览" min-width="245"><template #default="scope"><div class="rule-summary" :title="scope.row.ruleSummary"><div v-for="(line, index) in String(scope.row.ruleSummary || '--').split('；')" :key="index">{{ line }}</div></div></template></el-table-column>
    <el-table-column label="状态" width="82"><template #default="scope"><StatusTag :label="scope.row.status" :tone="scope.row.status === '未配置' ? 'warning' : ''" /></template></el-table-column>
    <TableActionColumn compact><template #default="scope"><el-button v-if="scope.row.config" class="table-detail-button" link type="primary" :icon="View" title="查看配置" aria-label="查看配置" @click="emit('view', scope.row)" /></template></TableActionColumn>
  </el-table>
</template>

<style scoped>
.relation-text{display:block;white-space:normal;line-height:1.5}.rule-summary{display:block;line-height:1.5}.rule-summary>div{min-width:0}
</style>
