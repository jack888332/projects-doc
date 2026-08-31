<script setup>
import { View } from '@element-plus/icons-vue'

const props = defineProps({ versions: { type:Array, default:() => [] } })
const emit = defineEmits(['view'])
</script>

<template>
  <div class="version-panel">
    <div class="version-row version-head"><span>配置版本编号</span><span>发布时间</span><span>版本状态</span><span>规则数</span><span>规则摘要 / 当前默认汇率预览</span><span>操作</span></div>
    <div v-for="version in props.versions" :key="version.version" class="version-row">
      <strong>{{ version.configVersionNo || version.version }}</strong>
      <span>{{ version.publishedAt || '--' }}</span>
      <span>{{ version.versionStatus || '历史' }}</span>
      <span>{{ version.ruleCount }}</span>
      <span class="rule-summary" :title="version.ruleSummary">{{ version.ruleSummary }}</span>
      <div class="version-actions"><el-button link type="primary" :icon="View" title="查看版本快照" aria-label="查看版本快照" @click="emit('view', version)" /></div>
    </div>
  </div>
</template>

<style scoped>
.version-panel{margin:0 12px 8px;border:1px solid var(--border);background:#fff}.version-row{min-height:44px;display:grid;grid-template-columns:210px 150px 90px 70px minmax(260px,1fr) 70px;align-items:center;gap:12px;padding:6px 12px;border-bottom:1px solid var(--border);font-size:13px}.version-row:last-child{border-bottom:0}.version-head{background:#f7f8fa;font-weight:600}.rule-summary{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.version-actions{display:flex;align-items:center;gap:4px}@media(max-width:900px){.version-panel{overflow-x:auto}.version-row{min-width:900px}}
</style>
