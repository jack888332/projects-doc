<script setup>
import { computed, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete, Plus, QuestionFilled } from '@element-plus/icons-vue'

const props = defineProps({ config: { type: Object, required: true } })
const weekdays = [{ label: '周一', value: '1' }, { label: '周二', value: '2' }, { label: '周三', value: '3' }, { label: '周四', value: '4' }, { label: '周五', value: '5' }, { label: '周六', value: '6' }, { label: '周日', value: '7' }]
const sourceCurrencies = [{ label: '美元', value: 'USD' }, { label: '日元', value: 'JPY' }, { label: '台币', value: 'TWD' }]
const settlementCurrencies = [{ label: '人民币', value: 'CNY' }, ...sourceCurrencies]
const deductFees = [{ label: '代收货款手续费', value: 'COD_SERVICE_FEE' }, { label: '超材费', value: 'OVERSIZE_FEE' }, { label: '重出费', value: 'REISSUE_FEE' }, { label: '其他应收费项', value: 'OTHER_RECEIVABLE_FEE' }]
const createRule = (fallback = true) => ({ fallback, sourceCurrency: '', settlementCurrency: 'SOURCE_CURRENCY', accountName: '', accountNo: '' })
const form = reactive({
  enabled: props.config.status !== '停用', refundMode: 'RECEIVED', billingPeriodType: props.config.cycle?.includes('半周') ? 'HALF_WEEK' : 'WEEK',
  startDays: props.config.cycle?.includes('半周') ? ['2', '5'] : [], sendAfterDays: Number.parseInt(props.config.sentRule) || 2,
  requiredFees: ['FEE0024'], directDeductFees: ['COD_SERVICE_FEE', 'OVERSIZE_FEE', 'REISSUE_FEE'],
  currencyRules: [createRule()], negativePolicy: 'NEXT_REFUND_BILL', effectPeriod: ['2026-08-01', '2027-07-31'],
})
const previewNo = computed(() => props.config.no && props.config.no !== '新配置' ? props.config.no : '保存后自动生成')
const fallbackLabel = computed(() => form.currencyRules.length === 1 ? '不限' : '其他')
watch(() => form.billingPeriodType, value => { if (value !== 'HALF_WEEK') form.startDays = [] })

function addRule() { form.currencyRules.splice(form.currencyRules.length - 1, 0, createRule(false)) }
function removeRule(index) { if (!form.currencyRules[index].fallback) form.currencyRules.splice(index, 1) }
function halfWeekValid() {
  const values = form.startDays.map(Number).sort((a, b) => a - b)
  if (values.length !== 2) return false
  const interval = values[1] - values[0]
  return interval >= 3 && 7 - interval >= 3
}
function validate() {
  if (!form.refundMode) return warn('请选择返款模式')
  if (!['WEEK', 'HALF_WEEK'].includes(form.billingPeriodType)) return warn('返款账单配置仅支持周、半周账期')
  if (form.billingPeriodType === 'HALF_WEEK' && form.startDays.length !== 2) return warn('半周账期必须选择两个账期起始日')
  if (form.billingPeriodType === 'HALF_WEEK' && !halfWeekValid()) return warn('半周账期选择的两个起始日间隔必须大于两天')
  if (form.sendAfterDays < 0) return warn('账单发出时间不能小于 0')
  if (!form.effectPeriod?.[0]) return warn('请选择条款生效开始日期')
  const used = new Set()
  for (let i = 0; i < form.currencyRules.length; i += 1) {
    const row = form.currencyRules[i]
    if (!row.fallback && !row.sourceCurrency) return warn(`币种账户矩阵第${i + 1}行请选择货款原始币种`)
    if (!row.fallback && used.has(row.sourceCurrency)) return warn(`币种账户矩阵第${i + 1}行原始币种重复`)
    if (row.settlementCurrency !== 'SOURCE_CURRENCY' && !row.settlementCurrency) return warn(`币种账户矩阵第${i + 1}行请选择货款结算币种`)
    if (!row.fallback) used.add(row.sourceCurrency)
  }
  return true
}
function warn(message) { ElMessage.warning(message); return false }
defineExpose({ validate })
</script>

<template>
  <div class="config-editor refund-editor">
    <section class="rule-card">
      <header class="rule-head"><strong>COD包裹货款代收条款</strong><el-switch v-model="form.enabled" /></header>
      <div class="config-no-bar"><span>配置编号</span><b>{{ previewNo }}</b><small>{{ config.no === '新配置' ? '首次保存将生成返款配置 v1' : '当前版本保存后自动递增' }}</small></div>
      <div class="setting-row"><div class="setting-meta"><b>返款模式 <i>*</i></b></div><el-select v-model="form.refundMode"><el-option label="回款返款" value="RECEIVED" /><el-option label="签收返款" value="SIGNED" /></el-select></div>
      <div class="setting-row"><div class="setting-meta"><b>账期类型 <i>*</i></b></div><el-select v-model="form.billingPeriodType"><el-option label="周" value="WEEK" /><el-option label="半周" value="HALF_WEEK" /></el-select></div>
      <div class="setting-row"><div class="setting-meta"><b>账期起始日 <i v-if="form.billingPeriodType==='HALF_WEEK'">*</i></b><small>半周账期需选择每周两个起始日，两个独立账期均不得少于 3 天</small></div><el-select v-model="form.startDays" multiple :multiple-limit="2" :disabled="form.billingPeriodType!=='HALF_WEEK'" :placeholder="form.billingPeriodType==='HALF_WEEK'?'请选择两个起始日':'仅半周账期需要配置'"><el-option v-for="item in weekdays" :key="item.value" :label="item.label" :value="item.value" /></el-select></div>
      <div class="setting-row"><div class="setting-meta"><b>账单发出时间是账期结束后第...天 <i>*</i></b><small>预计在该天完成账单复核，旨在错峰复核账单</small></div><el-input-number v-model="form.sendAfterDays" :min="0" controls-position="right" /></div>
      <div class="setting-row"><div class="setting-meta"><b>返款账单必要归集金额</b><small>这些费项不在应收账单中出现</small></div><el-select v-model="form.requiredFees" multiple disabled><el-option label="代收货款" value="FEE0024" /></el-select></div>
      <div class="setting-row"><div class="setting-meta"><b class="deduct-title">在<el-tooltip placement="left"><template #content><div class="refund-tip"><strong>准返款说明</strong><p>实收回款 = 到付金额 × 回款汇率</p><p>准返款 = 到付金额 × 返款汇率</p><p>准返款币种跟随实收回款；两者与到付金额非同币种时才会产生两类汇率。</p></div></template><span>准返款 <el-icon><QuestionFilled /></el-icon></span></el-tooltip>中直接扣减的应收费项</b><small>这些费用只在返款账单中核销，但仍会在应收账单呈现</small></div><el-select v-model="form.directDeductFees" multiple filterable clearable collapse-tags placeholder="请输入费项名称搜索"><el-option v-for="item in deductFees" :key="item.value" :label="item.label" :value="item.value" /></el-select></div>
      <div class="setting-row matrix-row"><div class="setting-meta"><b>货款结算币种 <i>*</i></b><small>一份账单支持多个货款结算币种</small></div><div class="matrix-wrap"><el-table :data="form.currencyRules" border><el-table-column label="货款原始币种" min-width="150"><template #default="{row}"><strong v-if="row.fallback" class="fallback">{{ fallbackLabel }}</strong><el-select v-else v-model="row.sourceCurrency" placeholder="请选择"><el-option v-for="item in sourceCurrencies" :key="item.value" :label="item.label" :value="item.value" /></el-select></template></el-table-column><el-table-column label="货款结算币种" min-width="150"><template #default="{row}"><el-select v-model="row.settlementCurrency"><el-option label="随原始币种" value="SOURCE_CURRENCY" /><el-option v-for="item in settlementCurrencies" :key="item.value" :label="item.label" :value="item.value" /></el-select></template></el-table-column><el-table-column label="客户收款账户" min-width="240"><template #default="{row}"><div class="account-fields"><el-input v-model="row.accountName" placeholder="账户名称" /><el-input v-model="row.accountNo" placeholder="收款账号" /></div></template></el-table-column><el-table-column label="操作" width="90"><template #default="{row,$index}"><el-button v-if="row.fallback" link type="primary" :icon="Plus" @click="addRule">添加一行</el-button><el-button v-else link type="danger" :icon="Delete" @click="removeRule($index)">删除</el-button></template></el-table-column></el-table></div></div>
      <div class="setting-row"><div class="setting-meta"><b>当已返货款金额为负数时的应对措施</b><small>即应返货款不足以扣减应收费项时的处理方式</small></div><el-select v-model="form.negativePolicy"><el-option label="负数金额计入下期返款账单" value="NEXT_REFUND_BILL" /><el-option label="负数金额反向计入本期应收账单" value="CURRENT_AR_BILL" /></el-select></div>
      <div class="setting-row"><div class="setting-meta"><b>条款生效周期 <i>*</i></b></div><el-date-picker v-model="form.effectPeriod" type="daterange" value-format="YYYY-MM-DD" range-separator="~" start-placeholder="开始日期" end-placeholder="结束日期" /></div>
    </section>
  </div>
</template>

<style scoped>
.config-editor{padding:0 4px 24px;color:#303746}.rule-card{border:1px solid #dfe4ec;background:#fff}.rule-head{height:54px;padding:0 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e7eaf0;background:#f8f9fb}.rule-head strong{font-size:16px}.config-no-bar{min-height:42px;padding:8px 18px;display:flex;align-items:center;gap:14px;background:#fff8e8;border-bottom:1px solid #f0dfb6}.config-no-bar span,.config-no-bar small{color:#767e8d}.config-no-bar b{color:#25334b}.setting-row{min-height:70px;margin:0 18px;display:grid;grid-template-columns:320px minmax(300px,400px);gap:22px;align-items:center;border-bottom:1px solid #edf0f4}.setting-meta{display:flex;flex-direction:column;gap:5px}.setting-meta b{font-size:13px;font-weight:600}.setting-meta small{font-size:12px;color:#8992a1;line-height:1.5}.setting-meta i{color:#e34d59;font-style:normal}.setting-row>.el-select,.setting-row>.el-date-editor,.setting-row>.el-input-number{width:400px}.matrix-row{grid-template-columns:320px minmax(0,1fr);align-items:start;padding:16px 0}.matrix-wrap{min-width:0}.fallback{color:#596579}.account-fields{display:grid;gap:7px}.deduct-title :deep(span){color:var(--primary)}.refund-tip{width:260px;line-height:1.5}.refund-tip p{margin:7px 0}
@media(max-width:760px){.config-editor{padding:0}.config-no-bar{align-items:flex-start;flex-direction:column;gap:4px}.setting-row{grid-template-columns:1fr;gap:8px;margin:0 12px;padding:12px 0;align-items:start}.setting-row>.el-select,.setting-row>.el-date-editor,.setting-row>.el-input-number{width:100%}.matrix-row{grid-template-columns:1fr}.rule-head{padding:0 12px}}
</style>
