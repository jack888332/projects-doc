<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, RefreshRight, Search, Setting, View } from '@element-plus/icons-vue'
import PageHeader from '../components/PageHeader.vue'

const props = defineProps({ billType: { type: String, required: true } })
const isReceivable = computed(() => props.billType === 'AR')
const title = computed(() => isReceivable.value ? '应收账单' : '返款账单')
const query = reactive({ billNo: '', customer: '', shop: '', country: '', periodType: '', period: [] })
const activeStatus = ref('待审核')
const selectedRows = ref([])
const detailVisible = ref(false)
const selectedBill = ref(null)

const bills = ref([
  { type: 'AR', billNo: 'ARB-OG0271-20260731-81FF', status: '待审核', customer: '渣渣辉3号', customerNo: 'OG0271', shop: '星际货运(中转)', country: '台湾', sector: '默认业务板块', periodType: '日', periodStart: '2026/07/31', periodEnd: '2026/07/31', sentAt: '2026/08/03', dueAt: '2026/08/03', overdueDays: 0, notice: '已通知', currency: 'CNY', amount: 68, paid: 0, secondCurrency: 'TWD', secondAmount: -721 },
  { type: 'AR', billNo: 'ARB-OG0370-20260707-81FF', status: '待审核', customer: 'JYK-深圳立杰海快', customerNo: 'OG0370', shop: '星际中转2', country: '台湾', sector: '默认业务板块', periodType: '7天', periodStart: '2026/07/07', periodEnd: '2026/07/13', sentAt: '2026/07/14', dueAt: '2026/07/20', overdueDays: 0, notice: '已通知', currency: 'CNY', amount: 3096.09, paid: 0 },
  { type: 'AR', billNo: 'ARB-OG0360-20260601-81FF', status: '待结清', customer: 'liujiaya1', customerNo: 'OG0360', shop: '测试专用', country: '-', sector: '-', periodType: '月', periodStart: '2026/06/01', periodEnd: '2026/06/30', sentAt: '2026/07/03', dueAt: '2026/06/30', overdueDays: 33, notice: '已通知', currency: 'CNY', amount: 11760.5, paid: 8000, secondCurrency: 'TWD', secondAmount: 23712 },
  { type: 'AR', billNo: 'ARB-OG0347-20260401-9A35', status: '已结清', customer: '测试1', customerNo: 'OG0347', shop: '星际中转2', country: '中國臺灣', sector: '默认业务板块', periodType: '周', periodStart: '2026/04/01', periodEnd: '2026/04/05', sentAt: '2026/04/08', dueAt: '2026/04/12', overdueDays: 0, notice: '已通知', currency: 'TWD', amount: 10678, paid: 10678 },
  { type: 'RF', billNo: 'RFB-OG0271-20260728-6C2A', status: '待审核', customer: '渣渣辉3号', customerNo: 'OG0271', shop: '星际货运(中转)', country: '台湾', periodType: '周', periodStart: '2026/07/28', periodEnd: '2026/08/03', sentAt: '-', refundMode: '回款返款', currency: 'TWD', original: 28640, deduction: 1320, amount: 27320, paid: 0 },
  { type: 'RF', billNo: 'RFB-OG0370-20260721-821F', status: '待结清', customer: 'JYK-深圳立杰海快', customerNo: 'OG0370', shop: '星际中转2', country: '台湾', periodType: '周', periodStart: '2026/07/21', periodEnd: '2026/07/27', sentAt: '2026/07/29', refundMode: '签收返款', currency: 'CNY', original: 91640, deduction: 3020, amount: 88620, paid: 52000 },
  { type: 'RF', billNo: 'RFB-OG0347-20260623-113B', status: '已结清', customer: '测试1', customerNo: 'OG0347', shop: '星际中转2', country: '中國臺灣', periodType: '周', periodStart: '2026/06/23', periodEnd: '2026/06/29', sentAt: '2026/07/01', refundMode: '回款返款', currency: 'TWD', original: 59380.2, deduction: 4261.3, amount: 55118.9, paid: 55118.9 },
])

const statuses = computed(() => isReceivable.value
  ? ['待审核', '待结清', '逾期未结清', '已结清', '起草中', '全部']
  : ['待审核', '待结清', '已结清', '全部'])
const typeBills = computed(() => bills.value.filter((item) => item.type === props.billType))
const filteredBills = computed(() => typeBills.value.filter((item) => {
  const statusMatch = activeStatus.value === '全部'
    || (activeStatus.value === '逾期未结清' ? item.status === '待结清' && item.overdueDays > 0 : item.status === activeStatus.value)
  return statusMatch && (!query.billNo || item.billNo.includes(query.billNo))
    && (!query.customer || `${item.customer}${item.customerNo}`.includes(query.customer))
    && (!query.shop || item.shop.includes(query.shop)) && (!query.country || item.country === query.country)
    && (!query.periodType || item.periodType === query.periodType)
}))
const countStatus = (status) => status === '逾期未结清'
  ? typeBills.value.filter((item) => item.status === '待结清' && item.overdueDays > 0).length
  : typeBills.value.filter((item) => item.status === status).length
const summary = computed(() => isReceivable.value ? [
  { label: '账单总数', value: typeBills.value.length, extra: '当前筛选范围', tone: 'blue' },
  { label: '待审核账单', value: countStatus('待审核'), extra: '需先审核后才能核销', tone: 'amber' },
  { label: '待结清', value: countStatus('待结清'), extra: `未收 ${money(typeBills.value.reduce((s, i) => s + Math.max(i.amount - i.paid, 0), 0))}`, tone: 'violet' },
  { label: '逾期未结清', value: countStatus('逾期未结清'), extra: '按信用期结束日判断', tone: 'red' },
] : [
  { label: '账单总数', value: typeBills.value.length, extra: '当前筛选范围', tone: 'blue' },
  { label: '待审核账单', value: countStatus('待审核'), extra: '需先审核后才能返还', tone: 'amber' },
  { label: '待结清', value: countStatus('待结清'), extra: '存在待返货款金额', tone: 'violet' },
  { label: '已结清', value: countStatus('已结清'), extra: '返还金额已全部核销', tone: 'green' },
])

function money(value) { return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function resetQuery() { Object.assign(query, { billNo: '', customer: '', shop: '', country: '', periodType: '', period: [] }); activeStatus.value = '待审核' }
function openDetail(row) { selectedBill.value = row; detailVisible.value = true }
function action(name) { ElMessage.success(`${name}已提交`) }
</script>

<template>
  <div class="module-page live-reference-page">
    <PageHeader eyebrow="" :title="title" :description="isReceivable ? '按客户、目的国和账期跟踪账单生成、审核、结算与逾期状态' : '按客户、目的国和账期跟踪返款账单的生成、审核、返还与核销状态'">
      <template #actions>
        <el-button :icon="RefreshRight" @click="resetQuery">重置</el-button>
        <el-button type="primary" :icon="Search">查询</el-button>
        <el-button :icon="Download" :disabled="!selectedRows.length" @click="action('导出任务')">导出</el-button>
      </template>
    </PageHeader>

    <section class="module-panel query-panel">
      <el-form label-position="top" class="reference-query-grid">
        <el-form-item label="账单编号"><el-input v-model="query.billNo" placeholder="输入账单编号" clearable /></el-form-item>
        <el-form-item label="客户名称"><el-input v-model="query.customer" placeholder="输入客户名称" clearable /></el-form-item>
        <el-form-item label="店铺"><el-input v-model="query.shop" placeholder="全部店铺" clearable /></el-form-item>
        <el-form-item :label="isReceivable ? '运抵国' : '目的国'"><el-select v-model="query.country" placeholder="全部" clearable><el-option label="台湾" value="台湾" /><el-option label="中國臺灣" value="中國臺灣" /></el-select></el-form-item>
        <el-form-item label="账期类型"><el-select v-model="query.periodType" placeholder="全部" clearable><el-option v-for="item in ['日','7天','周','月']" :key="item" :label="item" :value="item" /></el-select></el-form-item>
        <el-form-item label="账期"><el-date-picker v-model="query.period" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" /></el-form-item>
      </el-form>
    </section>

    <div class="module-kpis four reference-kpis"><div v-for="item in summary" :key="item.label" :class="['module-kpi', item.tone]"><span>{{ item.label }}</span><strong>{{ item.value }}</strong><small>{{ item.extra }}</small></div></div>

    <div class="status-tabs-row"><button v-for="status in statuses" :key="status" :class="{ active: activeStatus === status }" @click="activeStatus = status">{{ status }}</button></div>

    <section class="module-panel">
      <div class="table-reference-toolbar"><span>已选 {{ selectedRows.length }} 个账单</span><el-button :icon="Setting">字段显示</el-button></div>
      <el-table :data="filteredBills" class="clean-table" row-key="billNo" border @selection-change="selectedRows = $event">
        <el-table-column type="selection" width="44" fixed />
        <el-table-column prop="billNo" label="账单编号" width="205" fixed />
        <el-table-column label="账单状态" width="100"><template #default="scope"><span :class="['status-tag', scope.row.status === '已结清' ? 'success' : scope.row.status === '待结清' ? 'running' : 'warning']">{{ scope.row.status }}</span></template></el-table-column>
        <el-table-column v-if="!isReceivable" prop="refundMode" label="返款模式" width="100" />
        <el-table-column :label="isReceivable ? '费项结算币种金额' : '货款结算币种金额'" width="250"><template #default="scope"><div class="amount-lines"><span>{{ isReceivable ? '应收' : '原始货款' }} <b>{{ money(isReceivable ? scope.row.amount : scope.row.original) }} {{ scope.row.currency }}</b></span><span>{{ isReceivable ? '已核销' : '扣除费项' }} {{ money(isReceivable ? scope.row.paid : scope.row.deduction) }} {{ scope.row.currency }}</span><span>{{ isReceivable ? '未核销' : '待返货款' }} <b>{{ money(scope.row.amount - scope.row.paid) }} {{ scope.row.currency }}</b></span></div></template></el-table-column>
        <el-table-column prop="periodType" label="账期类型" width="90" /><el-table-column prop="periodStart" label="账期起始日" width="112" /><el-table-column prop="periodEnd" label="账期结束日" width="112" />
        <el-table-column v-if="isReceivable" prop="sector" label="业务板块" width="125" /><el-table-column prop="country" :label="isReceivable ? '运抵国' : '目的国'" width="100" /><el-table-column prop="customer" label="客户名称" width="160" show-overflow-tooltip /><el-table-column prop="shop" label="店铺" width="155" show-overflow-tooltip /><el-table-column prop="sentAt" label="账单发出日" width="112" />
        <el-table-column v-if="isReceivable" prop="dueAt" label="信用期结束日" width="120" /><el-table-column v-if="isReceivable" prop="overdueDays" label="逾期天数" width="90" /><el-table-column v-if="isReceivable" prop="notice" label="通知状态" width="95" />
        <el-table-column label="操作" width="130" fixed="right"><template #default="scope"><el-button link type="primary" :icon="View" @click="openDetail(scope.row)">详情</el-button><el-button link type="primary">更多</el-button></template></el-table-column>
      </el-table>
      <div class="table-pagination"><span>共 {{ filteredBills.length }} 条</span><el-pagination layout="sizes, prev, pager, next, jumper" :total="filteredBills.length" :page-size="20" /></div>
    </section>

    <el-drawer v-model="detailVisible" size="76%" class="detail-drawer module-drawer">
      <template #header><div class="drawer-title"><span>{{ title }}详情</span><small>{{ selectedBill?.billNo }}</small></div></template>
      <template v-if="selectedBill">
        <div class="detail-hero"><div><span :class="['status-tag', selectedBill.status === '已结清' ? 'success' : 'warning']">{{ selectedBill.status }}</span><strong>{{ selectedBill.customer }}</strong><small>{{ selectedBill.customerNo }} · {{ selectedBill.shop }} · {{ selectedBill.country }}</small></div><div class="drawer-summary-actions"><el-button @click="action('账单审核')">审核通过</el-button><el-button @click="action('账单重跑')">重新跑账单</el-button><el-button type="primary" plain :icon="Download" @click="action('导出任务')">导出明细</el-button></div></div>
        <el-tabs class="drawer-tabs">
          <el-tab-pane label="账单信息"><dl class="detail-grid"><div><dt>账单编号</dt><dd>{{ selectedBill.billNo }}</dd></div><div><dt>账单状态</dt><dd>{{ selectedBill.status }}</dd></div><div><dt>账期类型</dt><dd>{{ selectedBill.periodType }}</dd></div><div><dt>账期</dt><dd>{{ selectedBill.periodStart }} 至 {{ selectedBill.periodEnd }}</dd></div><div><dt>账单发出日</dt><dd>{{ selectedBill.sentAt }}</dd></div><div><dt>{{ isReceivable ? '费项结算币种' : '货款结算币种' }}</dt><dd>{{ selectedBill.currency }}</dd></div></dl></el-tab-pane>
          <el-tab-pane :label="isReceivable ? '费项明细' : '返款明细'"><el-table :data="[{order:'SO-20260731-0081',fee:isReceivable?'基础运费':'原始货款',currency:selectedBill.currency,amount:isReceivable?selectedBill.amount:selectedBill.original},{order:'SO-20260731-0082',fee:isReceivable?'操作费':'扣减费项',currency:selectedBill.currency,amount:isReceivable?18.5:-selectedBill.deduction}]" border><el-table-column prop="order" label="业务订单号" /><el-table-column prop="fee" label="费项" /><el-table-column prop="currency" label="币种" /><el-table-column prop="amount" label="金额" /></el-table></el-tab-pane>
          <el-tab-pane label="账单汇率"><el-table :data="[{pair:`${selectedBill.currency} → CNY`,rate:'7.184600',source:'客户特调汇率',locked:'已锁定'}]" border><el-table-column prop="pair" label="货币对" /><el-table-column prop="rate" label="账单汇率" /><el-table-column prop="source" label="命中级别" /><el-table-column prop="locked" label="状态" /></el-table></el-tab-pane>
          <el-tab-pane :label="isReceivable ? '核销记录' : '返还与核销记录'"><el-empty description="暂无更多记录" /></el-tab-pane>
          <el-tab-pane label="关联调账记录"><el-empty description="暂无关联调账记录" /></el-tab-pane>
        </el-tabs>
      </template>
    </el-drawer>
  </div>
</template>
