<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus/es/components/message/index.mjs'
import { ElMessageBox } from 'element-plus/es/components/message-box/index.mjs'
import { EditPen, Plus } from '@element-plus/icons-vue'
import ConditionFilter from '../../shared/components/ConditionFilter.vue'
import MetricGrid from '../../shared/components/MetricGrid.vue'
import HoverActionMenu from '../../shared/components/HoverActionMenu.vue'
import ReceivableConfigEditor from '../components/ReceivableConfigEditor.vue'
import RefundConfigEditor from '../components/RefundConfigEditor.vue'
import SegmentedControl from '../../shared/components/SegmentedControl.vue'
import StackedCell from '../../shared/components/StackedCell.vue'
import StatusTag from '../../shared/components/StatusTag.vue'
import DataTableFrame from '../../shared/components/DataTableFrame.vue'
import { useStagedQuery } from '../../shared/composables/useStagedQuery.js'
import { useDemoDataset } from '../data/useDemoDataset.js'

const activeType = ref('AR')
const scopeTypes = [
  { label: '店铺级', value: 'STORE' },
  { label: '客户组级', value: 'GROUP' },
  { label: '客户级', value: 'CUSTOMER' },
]
const scopeOptions = {
  STORE: ['星际货运(中转)', '星际中转2', '台湾集运店'],
  GROUP: ['台湾大客户组', '日本同行组', '美国电商组'],
  CUSTOMER: ['OG0271 渣渣辉3号', 'OG0370 JYK-深圳立杰海快', 'OG0347 测试1'],
}
const initialQuery = { scopeType: '', scopeText: '', status: '' }
const { query, appliedQuery, applyQuery, resetQuery } = useStagedQuery(initialQuery)
const detailVisible = ref(false)
const selectedConfig = ref(null)
const editorRef = ref(null)
const configs = useDemoDataset('billingConfigs', [
  { type:'AR', no:'ARB-SCHEME-20260701-01-v1', version:'V1', scopeType:'STORE', scope:['星际货运(中转)','星际中转2'], currency:'TWD', cycle:'1天账单', sentRule:'账期结束后 3 天', branches:'-', effectStart:'2026-07-01', effectEnd:'长期', operator:'谭清辉', updatedAt:'2026-07-01 10:18', changeReason:'首次启用', status:'启用' },
  { type:'AR', no:'ARB-SCHEME-20260701-02-v1', version:'V1', scopeType:'GROUP', scope:['台湾大客户组','日本同行组'], currency:'CNY', cycle:'7天', sentRule:'账期结束后 1 天', branches:'-', effectStart:'2026-07-01', effectEnd:'长期', operator:'郑雅雯', updatedAt:'2026-07-01 11:05', changeReason:'调整账期规则', status:'启用' },
  { type:'AR', no:'ARB-SCHEME-20260701-03-v1', version:'V1', scopeType:'CUSTOMER', scope:['OG0271 渣渣辉3号'], currency:'CNY', cycle:'周账单', sentRule:'账期结束后 3 天', branches:'-', effectStart:'2026-06-01', effectEnd:'长期', operator:'谭清辉', updatedAt:'2026-06-01 09:20', changeReason:'首次启用', status:'启用' },
  { type:'RF', no:'RFB-SCHEME-20260701-01-v3', version:'V3', scopeType:'STORE', scope:['星际中转2'], currency:'TWD', cycle:'半周账单', sentRule:'账期结束后 1 天', mode:'回款返款', effectStart:'2026-07-01', effectEnd:'长期', operator:'谭清辉', updatedAt:'2026-07-01 10:20', changeReason:'调整返款周期', status:'启用' },
  { type:'RF', no:'RFB-SCHEME-20260701-02-v4', version:'V4', scopeType:'GROUP', scope:['台湾大客户组'], currency:'CNY', cycle:'周账单', sentRule:'账期结束后 1 天', mode:'签收返款', effectStart:'2026-07-01', effectEnd:'长期', operator:'郑雅雯', updatedAt:'2026-07-01 11:08', changeReason:'切换签收返款', status:'启用' },
  { type:'RF', no:'RFB-SCHEME-20260701-03-v4', version:'V4', scopeType:'CUSTOMER', scope:['OG0370 JYK-深圳立杰海快'], currency:'CNY', cycle:'周账单', sentRule:'账期结束后 1 天', mode:'回款返款', effectStart:'2026-07-01', effectEnd:'长期', operator:'郑雅雯', updatedAt:'2026-07-01 11:10', changeReason:'客户独享返款规则', status:'启用' },
], 2)
const rows = computed(() => configs.value.filter(i => i.type === activeType.value
  && (!appliedQuery.scopeType || i.scopeType === appliedQuery.scopeType)
  && (!appliedQuery.scopeText || i.scope.join('、').includes(appliedQuery.scopeText))
  && (!appliedQuery.status || i.status === appliedQuery.status)))
const enabledCount = computed(() => rows.value.filter(i => i.status === '启用').length)
const scopeCount = computed(() => new Set(rows.value.flatMap(row => row.scope)).size)
const configSummary = computed(() => [
  { label: '配置总数', value: rows.value.length, tone: 'green' },
  { label: '生效中', value: enabledCount.value, tone: 'blue' },
  { label: '适用对象数', value: scopeCount.value, tone: 'amber' },
])
const scopeTypeLabel = (value) => scopeTypes.find(item => item.value === value)?.label || '-'
const scopeText = (scope = []) => scope.join('、') || '-'
const currentScopeOptions = computed(() => selectedConfig.value ? scopeOptions[selectedConfig.value.scopeType] || [] : [])
function clearScope(){ selectedConfig.value.scope = [] }
function openDetail(row){ selectedConfig.value={...row}; detailVisible.value=true }
function newConfig(){ openDetail({type:activeType.value,no:'新配置',version:'V1',scopeType:'CUSTOMER',scope:[],currency:'CNY',cycle:activeType.value==='AR'?'月账单':'周账单',sentRule:'账期结束后 1 天',branches:'-',mode:'回款返款',effectStart:'2026-08-03',effectEnd:'长期',operator:'财务管理员',updatedAt:'2026-08-02 10:30',changeReason:'新建配置',status:'启用'}) }
async function save(){
  if (!selectedConfig.value?.scopeType) return ElMessage.warning('请选择配置适用层级')
  if (!selectedConfig.value?.scope?.length) return ElMessage.warning('请至少选择一个适用对象')
  if (!editorRef.value?.validate()) return
  if (selectedConfig.value?.type === 'AR') {
    try {
      await ElMessageBox.confirm('确定提交整份结算设置？<br>（任何设置有变动都会以邮件通知客户）','提示',{dangerouslyUseHTMLString:true,type:'warning',confirmButtonText:'确定',cancelButtonText:'取消'})
    } catch { return }
  }
  const next = { ...selectedConfig.value }
  if (next.no === '新配置') next.no = `${next.type === 'AR' ? 'ARB' : 'RFB'}-SCHEME-${Date.now()}-v1`
  const currentIndex = configs.value.findIndex((item) => item.no === selectedConfig.value.no)
  if (currentIndex >= 0) configs.value.splice(currentIndex, 1, next)
  else configs.value.unshift(next)
  ElMessage.success(next.type === 'AR' ? `配置已保存，编号：${next.no}` : '返款账单配置已保存')
  detailVisible.value=false
}
function generate(row){ ElMessage.success(`已为配置适用范围内的客户创建${row.type === 'AR' ? '应收' : '返款'}账单生成任务`) }
</script>

<template>
  <div class="module-page live-reference-page">
    <SegmentedControl v-model="activeType" :options="[{ label: '应收账单配置', value: 'AR' }, { label: '返款账单配置', value: 'RF' }]" aria-label="账单配置类型" />
    <section class="condition-query-panel">
      <div class="condition-filter-bar">
        <ConditionFilter v-model="query.scopeType" label="适用层级" :options="scopeTypes" />
        <ConditionFilter v-model="query.scopeText" label="适用对象" type="text" />
        <ConditionFilter v-model="query.status" label="状态" :options="['启用','停用']" />
        <div class="condition-filter-actions"><el-button type="primary" @click="applyQuery">查询</el-button><el-button @click="resetQuery">重置</el-button></div>
      </div>
    </section>
    <MetricGrid class="reference-kpis" :items="configSummary" :columns="3" />
    <section class="module-panel">
      <DataTableFrame :total="rows.length" :selected-count="0">
        <template #actions><el-button type="primary" :icon="Plus" @click="newConfig">新建账单配置</el-button></template>
        <el-table :data="rows" border row-key="no" class="clean-table">
        <el-table-column type="expand"><template #default="scope"><dl class="inline-detail-grid"><div><dt>配置类型</dt><dd>{{ activeType==='AR'?'应收账单配置':'返款账单配置' }}</dd></div><div><dt>适用层级</dt><dd>{{ scopeTypeLabel(scope.row.scopeType) }}</dd></div><div><dt>适用对象</dt><dd>{{ scopeText(scope.row.scope) }}</dd></div><div><dt>账期规则</dt><dd>{{ scope.row.cycle }}</dd></div><div><dt>账单发出时间</dt><dd>{{ scope.row.sentRule }}</dd></div></dl></template></el-table-column>
        <el-table-column prop="no" label="配置编号" width="230" /><el-table-column prop="version" label="版本" width="72" /><el-table-column label="适用层级" width="120"><template #default="scope">{{ scopeTypeLabel(scope.row.scopeType) }}</template></el-table-column><el-table-column label="适用对象" min-width="260" :show-overflow-tooltip="true"><template #default="scope">{{ scopeText(scope.row.scope) }}</template></el-table-column><el-table-column prop="currency" label="默认结算币种" width="125" /><el-table-column prop="cycle" label="账期类型" width="110" /><el-table-column prop="sentRule" label="账单发出时间" width="170" /><el-table-column v-if="activeType==='AR'" prop="branches" label="分支数" width="80" /><el-table-column v-else prop="mode" label="返款模式" width="110" /><el-table-column label="生效周期" width="185"><template #default="scope">{{ scope.row.effectStart }} 至 {{ scope.row.effectEnd }}</template></el-table-column><el-table-column label="最近操作" width="170"><template #default="scope"><StackedCell :primary="scope.row.operator" :secondary="scope.row.updatedAt" /></template></el-table-column><el-table-column label="状态" width="80"><template #default="scope"><StatusTag :label="scope.row.status" /></template></el-table-column><TableActionColumn compact><template #default="scope"><HoverActionMenu><el-dropdown-item :icon="EditPen" @click="openDetail(scope.row)">编辑</el-dropdown-item><el-dropdown-item @click="generate(scope.row)">生成账单</el-dropdown-item></HoverActionMenu></template></TableActionColumn>
        </el-table>
      </DataTableFrame>
    </section>
    <el-dialog v-model="detailVisible" class="module-dialog module-dialog-wide" align-center append-to-body destroy-on-close :close-on-click-modal="false">
      <template #header><div class="drawer-title"><span>{{ selectedConfig?.no==='新配置'?'新建账单配置':'编辑账单配置' }}</span><small>{{ selectedConfig?.type==='AR'?'应收账单配置':'返款账单配置' }}</small></div></template>
      <template v-if="selectedConfig">
        <div class="scope-info-bar"><div><span>适用层级：</span><strong>{{ scopeTypeLabel(selectedConfig.scopeType) }}</strong></div><div><span>适用对象：</span><strong>{{ scopeText(selectedConfig.scope) }}</strong></div><div><span>当前版本：</span><strong>{{ selectedConfig.version }}</strong></div></div>
        <section class="config-version-panel"><el-form label-position="top" class="config-version-grid"><el-form-item label="适用层级"><el-select v-model="selectedConfig.scopeType" @change="clearScope"><el-option v-for="item in scopeTypes" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item><el-form-item label="适用对象"><el-select v-model="selectedConfig.scope" multiple filterable collapse-tags placeholder="请选择适用对象"><el-option v-for="item in currentScopeOptions" :key="item" :label="item" :value="item" /></el-select></el-form-item><el-form-item label="生效开始日"><el-date-picker v-model="selectedConfig.effectStart" value-format="YYYY-MM-DD" type="date" /></el-form-item><el-form-item label="生效结束日"><el-input v-model="selectedConfig.effectEnd" placeholder="长期或日期" /></el-form-item><el-form-item label="变更原因"><el-input v-model="selectedConfig.changeReason" /></el-form-item></el-form><div class="config-version-meta">最近操作：{{ selectedConfig.operator }} · {{ selectedConfig.updatedAt }}</div></section>
        <ReceivableConfigEditor v-if="selectedConfig.type==='AR'" :key="selectedConfig.no" ref="editorRef" :config="selectedConfig" />
        <RefundConfigEditor v-else :key="selectedConfig.no" ref="editorRef" :config="selectedConfig" />
      </template>
      <template #footer><div class="config-drawer-footer"><el-button @click="detailVisible=false">取消</el-button><el-button type="primary" @click="save">保存配置</el-button></div></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.scope-info-bar{min-height:48px;margin-bottom:var(--space-3);padding:0 var(--space-4);display:flex;align-items:center;gap:48px;border:1px solid #dfe4ec;background:#f7f9fb;color:#687386}.scope-info-bar div{display:flex;gap:4px}.scope-info-bar strong{color:#29364c}.config-version-panel{margin-bottom:var(--space-3);padding:var(--space-3) var(--space-4);border:1px solid #dfe4ec;background:#fff}.config-version-grid{display:grid;grid-template-columns:1fr 2fr 1fr 1fr;gap:12px}.config-version-grid :deep(.el-form-item){margin-bottom:0}.config-version-meta{margin-top:var(--space-2);color:#7b8798;font-size: var(--font-size-sm)}.config-drawer-footer{display:flex;justify-content:flex-end;gap:8px;padding-right:var(--space-2)}
@media(max-width:760px){.scope-info-bar{align-items:flex-start;flex-direction:column;gap:6px;padding:var(--space-2) var(--space-3)}}
</style>
