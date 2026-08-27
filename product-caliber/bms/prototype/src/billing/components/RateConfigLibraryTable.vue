<script setup>
import { EditPen, Promotion } from '@element-plus/icons-vue'
import HoverActionMenu from '../../shared/components/HoverActionMenu.vue'
import StackedCell from '../../shared/components/StackedCell.vue'
import StatusTag from '../../shared/components/StatusTag.vue'
import RateConfigVersionPanel from './RateConfigVersionPanel.vue'

const props = defineProps({ rows: { type:Array, default:() => [] } })
const emit = defineEmits(['edit', 'assign', 'viewVersion'])
</script>

<template>
  <el-table :data="props.rows" class="clean-table rate-table" border height="100%" row-key="id">
    <el-table-column type="expand" width="44"><template #default="scope"><RateConfigVersionPanel :versions="scope.row.displayVersions" @view="emit('viewVersion', scope.row, $event)" @assign="emit('assign', scope.row, $event.version)" /></template></el-table-column>
    <el-table-column label="配置" min-width="225"><template #default="scope"><StackedCell :primary="scope.row.name" :secondary="scope.row.no" /></template></el-table-column>
    <el-table-column prop="currentVersion" label="当前版本" width="88" />
    <el-table-column label="引用标签" width="135"><template #default="scope"><StatusTag :label="scope.row.referenceLabel" :tone="scope.row.referenceTone" /></template></el-table-column>
    <el-table-column prop="versionReferenceText" label="版本引用分布" min-width="145" />
    <el-table-column prop="ruleCount" label="当前规则数" width="90" />
    <el-table-column label="当前规则摘要 / 默认汇率预览" min-width="265"><template #default="scope"><span class="rule-summary" :title="scope.row.ruleSummary">{{ scope.row.ruleSummary }}</span></template></el-table-column>
    <el-table-column label="状态" width="82"><template #default="scope"><StatusTag :label="scope.row.status" /></template></el-table-column>
    <TableActionColumn><template #default="scope"><div class="row-action-cell"><el-button class="table-detail-button" link type="primary" :icon="EditPen" title="发布新版本" aria-label="发布新版本" @click="emit('edit', scope.row)" /><HoverActionMenu><el-dropdown-item :icon="Promotion" @click="emit('assign', scope.row, scope.row.currentVersion)">分配当前版本</el-dropdown-item></HoverActionMenu></div></template></TableActionColumn>
  </el-table>
</template>

<style scoped>
.rule-summary{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
</style>
