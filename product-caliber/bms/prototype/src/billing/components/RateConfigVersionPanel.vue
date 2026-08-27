<script setup>
import { Promotion, View } from '@element-plus/icons-vue'

const props = defineProps({ versions: { type:Array, default:() => [] } })
const emit = defineEmits(['view', 'assign'])
</script>

<template>
  <div class="version-panel">
    <div class="version-row version-head"><span>准确版本</span><span>发布时间</span><span>规则数</span><span>规则摘要 / 当前默认汇率预览</span><span>当前引用客户</span><span>操作</span></div>
    <div v-for="version in props.versions" :key="version.version" class="version-row">
      <strong>{{ version.version }}</strong>
      <span>{{ version.publishedAt || '-' }}</span>
      <span>{{ version.ruleCount }}</span>
      <span class="rule-summary" :title="version.ruleSummary">{{ version.ruleSummary }}</span>
      <span>{{ version.referenceCount }}</span>
      <div class="version-actions"><el-button link type="primary" :icon="View" title="查看准确版本" aria-label="查看准确版本" @click="emit('view', version)" /><el-button link type="primary" :icon="Promotion" title="分配此准确版本" aria-label="分配此准确版本" @click="emit('assign', version)" /></div>
    </div>
  </div>
</template>

<style scoped>
.version-panel{margin:0 12px 8px;border:1px solid var(--border);background:#fff}.version-row{min-height:44px;display:grid;grid-template-columns:90px 150px 70px minmax(260px,1fr) 105px 90px;align-items:center;gap:12px;padding:6px 12px;border-bottom:1px solid var(--border);font-size:13px}.version-row:last-child{border-bottom:0}.version-head{background:#f7f8fa;font-weight:600}.rule-summary{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.version-actions{display:flex;align-items:center;gap:4px}@media(max-width:900px){.version-panel{overflow-x:auto}.version-row{min-width:820px}}
</style>
