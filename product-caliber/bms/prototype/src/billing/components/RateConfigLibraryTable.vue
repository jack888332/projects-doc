<script setup>
import { CircleClose, EditPen, Promotion } from '@element-plus/icons-vue'
import HoverActionMenu from '../../shared/components/HoverActionMenu.vue'
import StackedCell from '../../shared/components/StackedCell.vue'
import StatusTag from '../../shared/components/StatusTag.vue'
import RateConfigVersionPanel from './RateConfigVersionPanel.vue'

const props = defineProps({ rows: { type:Array, default:() => [] } })
const emit = defineEmits(['edit', 'assign', 'viewVersion', 'cancelPending'])
</script>

<template>
  <el-table :data="props.rows" class="clean-table rate-table" border height="100%" row-key="id">
    <el-table-column type="expand" width="44"><template #default="scope"><RateConfigVersionPanel :versions="scope.row.displayVersions" @view="emit('viewVersion', scope.row, $event)" /></template></el-table-column>
    <el-table-column label="配置" min-width="245"><template #default="scope"><StackedCell :primary="scope.row.name || `${scope.row.no}-${scope.row.currentVersion}`" :secondary="scope.row.name ? `${scope.row.no}-${scope.row.currentVersion}` : ''" /></template></el-table-column>
    <el-table-column label="待生效版本" min-width="150"><template #default="scope">{{ scope.row.pendingVersion ? `${scope.row.no}-${scope.row.pendingVersion} · ${scope.row.pendingEffectiveAt}` : '--' }}</template></el-table-column>
    <el-table-column label="配置标签" width="135"><template #default="scope"><StatusTag :label="scope.row.referenceLabel" :tone="scope.row.referenceTone" /></template></el-table-column>
    <el-table-column prop="referenceCount" label="有效引用客户" width="115" />
    <el-table-column prop="ruleCount" label="当前规则数" width="90" />
    <el-table-column label="当前规则摘要 / 默认汇率预览" min-width="265"><template #default="scope"><span class="rule-summary" :title="scope.row.ruleSummary">{{ scope.row.ruleSummary }}</span></template></el-table-column>
    <el-table-column label="状态" width="82"><template #default="scope"><StatusTag :label="scope.row.status" /></template></el-table-column>
    <TableActionColumn><template #default="scope"><div class="row-action-cell"><el-button class="table-detail-button" link type="primary" :icon="EditPen" title="编辑并发布新版本" aria-label="编辑并发布新版本" :disabled="Boolean(scope.row.pendingVersion)" @click="emit('edit', scope.row)" /><HoverActionMenu><el-dropdown-item v-if="scope.row.pendingVersion" class="danger-action" :icon="CircleClose" @click="emit('cancelPending', scope.row)">取消待生效版本</el-dropdown-item><el-dropdown-item :icon="Promotion" @click="emit('assign', scope.row, scope.row.currentVersion)">分配配置</el-dropdown-item></HoverActionMenu></div></template></TableActionColumn>
  </el-table>
</template>

<style scoped>
.rule-summary{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
</style>
