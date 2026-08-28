<script setup>
import { computed } from 'vue'

const props = defineProps({
  snapshot: { type: Object, default: null },
  compact: { type: Boolean, default: false },
})

const periodLabels = { DAY_1:'1 自然天', DAY_7:'7 自然天', DAY_10:'10 自然天', DAY_15:'15 自然天', WEEK:'周账单', HALF_MONTH:'半月账单', MONTH:'月账单' }
const businessLabels = { PEER:'同行订单', CONSOLIDATION:'集运订单', ECOMMERCE:'电商订单' }
const countryLabels = { TW:'中国台湾', JP:'日本', US:'美国', VN:'越南', MY:'马来西亚' }
const warehouseLabels = { SZ:'深圳集运仓', DG:'东莞集运仓', YW:'义乌集运仓' }
const nodeLabels = { WEIGHT_OUTBOUND:'出库时间', ORDER_COMPLETED:'订单完结' }
const listLabels = (values, labels) => values?.length ? values.map(value => labels[value] || value).join('、') : '不限'
const periodLabel = value => periodLabels[value] || value || '-'
const settlementCurrency = (scheme) => {
  const value = scheme?.feeRules?.find(rule => rule.fallback)?.settlementCurrency
  return value === 'SOURCE_CURRENCY' ? '随原始币种' : value || '-'
}
const primary = computed(() => props.snapshot ? `默认：${periodLabel(props.snapshot.defaultScheme.period)} / ${settlementCurrency(props.snapshot.defaultScheme)}` : '-')
const secondary = computed(() => props.snapshot?.branches?.length ? `${props.snapshot.branches.length} 个分支` : props.snapshot ? '仅默认方案' : '')
const branchCondition = branch => `订单类型：${listLabels(branch.businessTypes, businessLabels)}；目的国：${listLabels(branch.targetCountries, countryLabels)}；集运仓：${listLabels(branch.warehouses, warehouseLabels)}`
const ruleSummary = scheme => `${periodLabel(scheme.period)} / ${settlementCurrency(scheme)} · ${nodeLabels[scheme.node] || scheme.node || '-'} · 账期结束后 ${scheme.sendAfterDays ?? '-'} 天`
</script>

<template>
  <div v-if="compact" class="scheme-overview-cell">
    <strong>{{ primary }}</strong>
    <small v-if="secondary">{{ secondary }}</small>
  </div>
  <div v-else-if="snapshot" class="scheme-expand">
    <div class="scheme-expand-row"><b>默认方案</b><span>无条件兜底</span><strong>{{ ruleSummary(snapshot.defaultScheme) }}</strong></div>
    <div v-for="(branch,index) in snapshot.branches" :key="branch.schemeKey || index" class="scheme-expand-row"><b>分支方案 {{ index + 1 }}</b><span>{{ branchCondition(branch) }}</span><strong>{{ ruleSummary(branch) }}</strong></div>
    <div v-if="!snapshot.branches.length" class="scheme-empty">仅默认方案</div>
  </div>
</template>

<style scoped>
.scheme-overview-cell{min-width:0;display:flex;flex-direction:column;gap:2px;line-height:var(--line-height-base)}.scheme-overview-cell strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:var(--font-weight-regular)}.scheme-overview-cell small{color:#737f91;font-size:var(--table-secondary-font-size)}.scheme-expand{margin:0 20px 14px;border-top:1px solid #e3e7ee}.scheme-expand-row{min-height:42px;display:grid;grid-template-columns:110px minmax(260px,1fr) minmax(260px,340px);align-items:center;gap:16px;border-bottom:1px solid #edf0f4}.scheme-expand-row span,.scheme-empty{color:#697587}.scheme-expand-row strong{font-weight:500}.scheme-empty{padding:12px 0}@media(max-width:760px){.scheme-expand-row{grid-template-columns:1fr;gap:4px;padding:10px 0}}
</style>
