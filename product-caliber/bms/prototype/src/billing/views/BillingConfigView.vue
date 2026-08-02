<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, RefreshRight, Search } from '@element-plus/icons-vue'
import PageHeader from '../components/PageHeader.vue'
import ReceivableConfigEditor from '../components/ReceivableConfigEditor.vue'
import RefundConfigEditor from '../components/RefundConfigEditor.vue'
import { useDemoDataset } from '../data/useDemoDataset.js'

const activeType = ref('AR')
const query = reactive({ shop: '', customer: '', customerNo: '', memberCode: '', status: '' })
const detailVisible = ref(false)
const selectedConfig = ref(null)
const editorRef = ref(null)
const configs = useDemoDataset('billingConfigs', [
  { type:'AR', no:'ARB-OG0271-Scheme-1785487906-v1', version:'V1', customer:'渣渣辉3号', customerNo:'OG0271', memberCode:'700127', shop:'星际货运(中转)', email:'finance-og0271@example.com', currency:'TWD', cycle:'1天账单', sentRule:'账期结束后 3 天', branches:'-', effectStart:'2026-07-01', effectEnd:'长期', operator:'谭清辉', updatedAt:'2026-07-01 10:18', changeReason:'首次启用', status:'启用' },
  { type:'AR', no:'ARB-OG0370-Scheme-1782960772-v10', version:'V10', customer:'JYK-深圳立杰海快', customerNo:'OG0370', memberCode:'20260701-009', shop:'星际中转2', email:'billing-og0370@example.com', currency:'CNY', cycle:'7天', sentRule:'账期结束后 1 天', branches:'-', effectStart:'2026-07-01', effectEnd:'长期', operator:'郑雅雯', updatedAt:'2026-07-01 11:05', changeReason:'调整账期规则', status:'启用' },
  { type:'AR', no:'ARB-OG0347-Scheme-1782548834-v1', version:'V1', customer:'测试1', customerNo:'OG0347', memberCode:'20260228-002', shop:'星际中转2', email:'finance-og0347@example.com', currency:'TWD', cycle:'周账单', sentRule:'账期结束后 3 天', branches:'-', effectStart:'2026-06-01', effectEnd:'长期', operator:'谭清辉', updatedAt:'2026-06-01 09:20', changeReason:'首次启用', status:'启用' },
  { type:'RF', no:'RFB-OG0271-Scheme-1785487906-v3', version:'V3', customer:'渣渣辉3号', customerNo:'OG0271', memberCode:'700127', shop:'星际货运(中转)', email:'finance-og0271@example.com', currency:'TWD', cycle:'半周账单', sentRule:'账期结束后 1 天', mode:'回款返款', effectStart:'2026-07-01', effectEnd:'长期', operator:'谭清辉', updatedAt:'2026-07-01 10:20', changeReason:'调整返款周期', status:'启用' },
  { type:'RF', no:'RFB-OG0370-Scheme-1782960772-v4', version:'V4', customer:'JYK-深圳立杰海快', customerNo:'OG0370', memberCode:'20260701-009', shop:'星际中转2', email:'billing-og0370@example.com', currency:'CNY', cycle:'周账单', sentRule:'账期结束后 1 天', mode:'签收返款', effectStart:'2026-07-01', effectEnd:'长期', operator:'郑雅雯', updatedAt:'2026-07-01 11:08', changeReason:'切换签收返款', status:'启用' },
], 2)
const rows = computed(() => configs.value.filter(i => i.type === activeType.value
  && (!query.shop || i.shop.includes(query.shop)) && (!query.customer || i.customer.includes(query.customer))
  && (!query.customerNo || i.customerNo.includes(query.customerNo)) && (!query.memberCode || i.memberCode.includes(query.memberCode))
  && (!query.status || i.status === query.status)))
const configured = computed(() => rows.value.length)
function resetQuery(){ Object.assign(query,{shop:'',customer:'',customerNo:'',memberCode:'',status:''}) }
function openDetail(row){ selectedConfig.value={...row}; detailVisible.value=true }
function newConfig(){ openDetail({type:activeType.value,no:'新配置',version:'V1',customer:'',customerNo:'',memberCode:'',shop:'',email:'',currency:'CNY',cycle:activeType.value==='AR'?'月账单':'周账单',sentRule:'账期结束后 1 天',branches:'-',mode:'回款返款',effectStart:'2026-08-03',effectEnd:'长期',operator:'财务管理员',updatedAt:'2026-08-02 10:30',changeReason:'新建配置',status:'启用'}) }
async function save(){
  if (!selectedConfig.value?.email) return ElMessage.warning('客户邮箱不能为空，账单审核后将按该邮箱发送通知')
  if (!editorRef.value?.validate()) return
  if (selectedConfig.value?.type === 'AR') {
    try {
      await ElMessageBox.confirm('确定提交整份结算设置？<br>（任何设置有变动都会以邮件通知客户）','提示',{dangerouslyUseHTMLString:true,type:'warning',confirmButtonText:'确定',cancelButtonText:'取消'})
    } catch { return }
  }
  const next = { ...selectedConfig.value }
  if (next.no === '新配置') next.no = `${next.type === 'AR' ? 'ARB' : 'RFB'}-${next.customerNo || 'NEW'}-Scheme-${Date.now()}-v1`
  const currentIndex = configs.value.findIndex((item) => item.no === selectedConfig.value.no)
  if (currentIndex >= 0) configs.value.splice(currentIndex, 1, next)
  else configs.value.unshift(next)
  ElMessage.success(next.type === 'AR' ? `配置已保存，编号：${next.no}` : '返款账单配置已保存')
  detailVisible.value=false
}
function generate(row){ ElMessage.success(`已为 ${row.customer} 创建账单生成任务`) }
</script>

<template>
  <div class="module-page live-reference-page">
    <PageHeader eyebrow="" :title="activeType === 'AR' ? '应收账单配置' : '返款账单配置'" />
    <div class="module-segmented"><button :class="{active:activeType==='AR'}" @click="activeType='AR'">应收账单配置</button><button :class="{active:activeType==='RF'}" @click="activeType='RF'">返款账单配置</button></div>
    <div class="module-kpis three reference-kpis"><div class="module-kpi blue"><span>已配置客户</span><strong>{{ configured }}</strong><small>当前筛选范围</small></div><div class="module-kpi amber"><span>未配置客户</span><strong>{{ 2195-configured }}</strong><small>客户总数 - 已配置客户</small></div><div class="module-kpi green"><span>配置总数</span><strong>{{ configured }}</strong><small>默认方案数量</small></div></div>
    <section class="module-panel query-panel">
      <el-form label-position="top" class="reference-query-grid five">
        <el-form-item label="店铺"><el-input v-model="query.shop" placeholder="模糊搜索" clearable /></el-form-item><el-form-item label="客户名称"><el-input v-model="query.customer" placeholder="输入客户名称" clearable /></el-form-item><el-form-item label="客户编码"><el-input v-model="query.customerNo" placeholder="输入客户编码" clearable /></el-form-item><el-form-item label="会员编码"><el-input v-model="query.memberCode" placeholder="输入会员编码" clearable /></el-form-item><el-form-item label="状态"><el-select v-model="query.status" placeholder="全部" clearable><el-option label="启用" value="启用" /><el-option label="停用" value="停用" /></el-select></el-form-item>
      </el-form>
      <div class="query-actions"><el-button :icon="RefreshRight" @click="resetQuery">重置</el-button><el-button type="primary" :icon="Search">查询</el-button><el-button type="primary" :icon="Plus" @click="newConfig">新建账单配置</el-button></div>
    </section>
    <section class="module-panel">
      <el-table :data="rows" border row-key="no" class="clean-table">
        <el-table-column type="expand"><template #default="scope"><dl class="inline-detail-grid"><div><dt>配置类型</dt><dd>{{ activeType==='AR'?'应收账单配置':'返款账单配置' }}</dd></div><div><dt>客户</dt><dd>{{ scope.row.customer }} / {{ scope.row.customerNo }}</dd></div><div><dt>账期规则</dt><dd>{{ scope.row.cycle }}</dd></div><div><dt>账单发出时间</dt><dd>{{ scope.row.sentRule }}</dd></div></dl></template></el-table-column>
        <el-table-column prop="no" label="配置编号" width="245" /><el-table-column prop="version" label="版本" width="72" /><el-table-column prop="customer" label="客户名称" width="180" /><el-table-column prop="customerNo" label="客户编码" width="105" /><el-table-column prop="memberCode" label="会员编码" width="130" /><el-table-column prop="shop" label="店铺" width="170" /><el-table-column prop="email" label="客户邮箱" width="220" /><el-table-column prop="currency" label="默认结算币种" width="125" /><el-table-column prop="cycle" label="账期类型" width="110" /><el-table-column prop="sentRule" label="账单发出时间" width="170" /><el-table-column v-if="activeType==='AR'" prop="branches" label="分支数" width="80" /><el-table-column v-else prop="mode" label="返款模式" width="110" /><el-table-column label="生效周期" width="185"><template #default="scope">{{ scope.row.effectStart }} 至 {{ scope.row.effectEnd }}</template></el-table-column><el-table-column label="最近操作" width="170"><template #default="scope"><div class="main-cell"><strong>{{ scope.row.operator }}</strong><small>{{ scope.row.updatedAt }}</small></div></template></el-table-column><el-table-column label="状态" width="80"><template #default="scope"><span :class="['status-tag',scope.row.status==='启用'?'success':'neutral']">{{ scope.row.status }}</span></template></el-table-column><el-table-column label="操作" width="180" fixed="right"><template #default="scope"><el-button link type="primary" @click="openDetail(scope.row)">编辑</el-button><el-button link type="primary" @click="generate(scope.row)">生成账单</el-button></template></el-table-column>
      </el-table>
      <div class="table-pagination"><span>共 {{ rows.length }} 条</span><el-pagination layout="sizes, prev, pager, next, jumper" :total="rows.length" :page-size="20" /></div>
    </section>
    <el-drawer v-model="detailVisible" size="86%" class="billing-config-drawer" :close-on-click-modal="false">
      <template #header><div class="drawer-title"><span>{{ selectedConfig?.no==='新配置'?'新建账单配置':'编辑账单配置' }}</span><small>{{ selectedConfig?.type==='AR'?'应收账单配置':'返款账单配置' }}</small></div></template>
      <template v-if="selectedConfig">
        <div class="customer-info-bar"><div><span>客户编号：</span><strong>{{ selectedConfig.customerNo || '-' }}</strong></div><div><span>客户名称：</span><strong>{{ selectedConfig.customer || '-' }}</strong></div><div><span>当前版本：</span><strong>{{ selectedConfig.version }}</strong></div></div>
        <section class="config-version-panel"><el-form label-position="top" class="config-version-grid"><el-form-item label="客户邮箱"><el-input v-model="selectedConfig.email" placeholder="用于账单审核通过后的客户通知" /></el-form-item><el-form-item label="生效开始日"><el-date-picker v-model="selectedConfig.effectStart" value-format="YYYY-MM-DD" type="date" /></el-form-item><el-form-item label="生效结束日"><el-input v-model="selectedConfig.effectEnd" placeholder="长期或日期" /></el-form-item><el-form-item label="变更原因"><el-input v-model="selectedConfig.changeReason" /></el-form-item></el-form><div class="config-version-meta">最近操作：{{ selectedConfig.operator }} · {{ selectedConfig.updatedAt }}</div></section>
        <ReceivableConfigEditor v-if="selectedConfig.type==='AR'" :key="selectedConfig.no" ref="editorRef" :config="selectedConfig" />
        <RefundConfigEditor v-else :key="selectedConfig.no" ref="editorRef" :config="selectedConfig" />
      </template>
      <template #footer><div class="config-drawer-footer"><el-button @click="detailVisible=false">取消</el-button><el-button type="primary" @click="save">保存配置</el-button></div></template>
    </el-drawer>
  </div>
</template>

<style scoped>
.customer-info-bar{min-height:48px;margin-bottom:14px;padding:0 18px;display:flex;align-items:center;gap:48px;border:1px solid #dfe4ec;background:#f7f9fb;color:#687386}.customer-info-bar div{display:flex;gap:4px}.customer-info-bar strong{color:#29364c}.config-version-panel{margin-bottom:14px;padding:14px 18px;border:1px solid #dfe4ec;background:#fff}.config-version-grid{display:grid;grid-template-columns:2fr 1fr 1fr 2fr;gap:12px}.config-version-grid :deep(.el-form-item){margin-bottom:0}.config-version-meta{margin-top:10px;color:#7b8798;font-size:12px}.config-drawer-footer{display:flex;justify-content:flex-end;gap:8px;padding-right:8px}
@media(max-width:760px){.customer-info-bar{align-items:flex-start;flex-direction:column;gap:6px;padding:10px 12px}}
</style>
