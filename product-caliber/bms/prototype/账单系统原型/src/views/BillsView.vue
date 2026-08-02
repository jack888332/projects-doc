<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Download, EditPen, Plus, RefreshRight, Search, View } from '@element-plus/icons-vue'
import PageHeader from '../components/PageHeader.vue'

const props = defineProps({ billType: { type: String, required: true } })
const query = reactive({ keyword: '', status: '', closeStatus: '', overdue: '' })
const detailVisible = ref(false)
const detailTab = ref('summary')
const selectedBill = ref(null)

const allBills = ref([
  { type: 'AR', billNo: 'ARB-OG4155-20260701-f802', status: '待审核', closeStatus: '已收口', customer: 'OceanGate Logistics', customerNo: 'OG4155', country: '英国', period: '2026-07-01 至 2026-07-31', sentAt: '-', dueDate: '2026-08-31', notification: '未发送', currency: 'GBP', amount: 68542.18, paid: 0, feeCount: 3298, overdue: false, mode: '-', config: 'BC-OG4155-M-UK · V13' },
  { type: 'AR', billNo: 'ARB-TK9012-20260725-41b7', status: '待结清', closeStatus: '已收口', customer: 'TopKing Supply', customerNo: 'TK9012', country: '美国', period: '2026-07-25 至 2026-07-31', sentAt: '2026-08-01', dueDate: '2026-08-08', notification: '已通知', currency: 'USD', amount: 126840.6, paid: 89200, feeCount: 4821, overdue: false, mode: '-', config: 'BC-TK9012-D · V8' },
  { type: 'AR', billNo: 'ARB-NW2048-20260601-7f3c', status: '待结清', closeStatus: '已收口', customer: 'NorthWind Cargo', customerNo: 'NW2048', country: '加拿大', period: '2026-06-01 至 2026-06-30', sentAt: '2026-07-02', dueDate: '2026-07-17', notification: '通知失败', currency: 'CAD', amount: 93560.25, paid: 22300, feeCount: 2610, overdue: true, mode: '-', config: 'BC-NW2048-M-CA · V9' },
  { type: 'AR', billNo: 'ARB-HL2388-20260623-3d90', status: '已结清', closeStatus: '已收口', customer: 'Hualei Express', customerNo: 'HL2388', country: '澳大利亚', period: '2026-06-23 至 2026-06-29', sentAt: '2026-07-01', dueDate: '2026-07-08', notification: '已通知', currency: 'AUD', amount: 77210.8, paid: 77210.8, feeCount: 1984, overdue: false, mode: '-', config: 'BC-HL2388-WEEK · V6' },
  { type: 'RF', billNo: 'RFB-OG4155-20260728-912c', status: '待审核', closeStatus: '已收口', customer: 'OceanGate Logistics', customerNo: 'OG4155', country: '英国', period: '2026-07-28 至 2026-07-31', sentAt: '-', dueDate: '-', notification: '未发送', currency: 'GBP', amount: 42580.4, paid: 0, feeCount: 368, overdue: false, mode: '回款返款', config: 'RC-OG4155-HALF · V5', recovered: 46820.4, deduction: 4240 },
  { type: 'RF', billNo: 'RFB-TK9012-20260721-a11f', status: '待结清', closeStatus: '已收口', customer: 'TopKing Supply', customerNo: 'TK9012', country: '美国', period: '2026-07-21 至 2026-07-27', sentAt: '2026-07-29', dueDate: '2026-08-05', notification: '已通知', currency: 'USD', amount: 88620, paid: 52000, feeCount: 614, overdue: false, mode: '签收返款', config: 'RC-TK9012-WEEK · V4', recovered: 91640, deduction: 3020 },
  { type: 'RF', billNo: 'RFB-NW2048-20260623-4e8a', status: '已结清', closeStatus: '已收口', customer: 'NorthWind Cargo', customerNo: 'NW2048', country: '加拿大', period: '2026-06-23 至 2026-06-29', sentAt: '2026-07-01', dueDate: '2026-07-08', notification: '已通知', currency: 'CAD', amount: 55118.9, paid: 55118.9, feeCount: 429, overdue: false, mode: '回款返款', config: 'RC-NW2048-WEEK · V3', recovered: 59380.2, deduction: 4261.3 },
  { type: 'RF', billNo: 'RFB-HL2388-20260728-85d2', status: '待审核', closeStatus: '未收口', customer: 'Hualei Express', customerNo: 'HL2388', country: '澳大利亚', period: '2026-07-28 至 2026-08-03', sentAt: '-', dueDate: '-', notification: '未发送', currency: 'AUD', amount: 31260.5, paid: 0, feeCount: 217, overdue: false, mode: '回款返款', config: 'RC-HL2388-WEEK · V7', recovered: 33800, deduction: 2539.5 },
])

const isReceivable = computed(() => props.billType === 'AR')
const title = computed(() => isReceivable.value ? '应收账单' : '返款账单')
const records = computed(() => allBills.value.filter((item) => {
  const keyword = `${item.billNo}${item.customer}${item.customerNo}`.toLowerCase()
  return item.type === props.billType
    && (!query.keyword || keyword.includes(query.keyword.toLowerCase()))
    && (!query.status || item.status === query.status)
    && (!query.closeStatus || item.closeStatus === query.closeStatus)
    && (!query.overdue || (query.overdue === '是') === item.overdue)
}))

const summary = computed(() => [
  { label: '账单总数', value: records.value.length, tone: 'blue' },
  { label: '待审核', value: records.value.filter((item) => item.status === '待审核').length, tone: 'amber' },
  { label: '待结清', value: records.value.filter((item) => item.status === '待结清').length, tone: 'violet' },
  { label: '已结清', value: records.value.filter((item) => item.status === '已结清').length, tone: 'green' },
])

function money(value, currency) {
  return `${currency} ${Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
}

function statusClass(status) {
  return { 待审核: 'warning', 待结清: 'running', 已结清: 'success', 已作废: 'neutral' }[status] || 'neutral'
}

function openDetail(row) {
  selectedBill.value = row
  detailTab.value = 'summary'
  detailVisible.value = true
}

async function approve(row) {
  if (row.status !== '待审核' || row.closeStatus !== '已收口') return
  await ElMessageBox.confirm(`确认审核通过账单 ${row.billNo}？`, '审核账单', { type: 'warning' })
  row.status = '待结清'
  row.notification = '已通知'
  row.sentAt = '2026-08-02'
  ElMessage.success('账单已审核，客户通知任务已提交')
}

function createExport(row) {
  ElMessage.success(`已创建客户对账导出任务：${row.billNo}`)
}

function submitOperation(name) {
  ElMessage.success(`${name}请求已进入任务队列`)
}
</script>

<template>
  <div class="module-page">
    <PageHeader :eyebrow="isReceivable ? 'ACCOUNTS RECEIVABLE' : 'COD REFUND'" :title="title">
      <template #actions>
        <el-button :icon="Download">批量导出</el-button>
        <el-button type="primary" :icon="Plus">新增调账</el-button>
      </template>
    </PageHeader>

    <div class="module-kpis four">
      <button v-for="item in summary" :key="item.label" :class="['module-kpi', item.tone]" @click="query.status = item.label === '账单总数' ? '' : item.label">
        <span>{{ item.label }}</span><strong>{{ item.value }}</strong>
      </button>
    </div>

    <section class="module-panel">
      <div class="module-toolbar">
        <div class="module-filters">
          <el-input v-model="query.keyword" :prefix-icon="Search" placeholder="账单编号 / 客户名称 / 客户编码" clearable class="module-search" />
          <el-select v-model="query.status" placeholder="全部账单状态" clearable><el-option v-for="status in ['待审核','待结清','已结清','已作废']" :key="status" :label="status" :value="status" /></el-select>
          <el-select v-model="query.closeStatus" placeholder="全部收口状态" clearable><el-option label="未收口" value="未收口" /><el-option label="已收口" value="已收口" /></el-select>
          <el-select v-if="isReceivable" v-model="query.overdue" placeholder="是否逾期" clearable><el-option label="是" value="是" /><el-option label="否" value="否" /></el-select>
        </div>
        <span class="module-result-count">{{ records.length }} 条账单</span>
      </div>

      <el-table :data="records" class="clean-table" row-key="billNo">
        <el-table-column prop="billNo" label="账单编号" width="210" fixed />
        <el-table-column label="状态" width="105"><template #default="scope"><span :class="['status-tag', statusClass(scope.row.status)]">{{ scope.row.status }}</span></template></el-table-column>
        <el-table-column label="收口状态" width="90"><template #default="scope"><span :class="['status-tag', scope.row.closeStatus === '已收口' ? 'success' : 'warning']">{{ scope.row.closeStatus }}</span></template></el-table-column>
        <el-table-column label="客户" min-width="190"><template #default="scope"><div class="main-cell"><strong>{{ scope.row.customer }}</strong><small>{{ scope.row.customerNo }} · {{ scope.row.country }}</small></div></template></el-table-column>
        <el-table-column v-if="!isReceivable" prop="mode" label="返款模式" width="105" />
        <el-table-column prop="period" label="账期" width="190" />
        <el-table-column label="账单金额" width="150" align="right"><template #default="scope"><strong>{{ money(scope.row.amount, scope.row.currency) }}</strong></template></el-table-column>
        <el-table-column :label="isReceivable ? '已收金额' : '已返金额'" width="145" align="right"><template #default="scope">{{ money(scope.row.paid, scope.row.currency) }}</template></el-table-column>
        <el-table-column prop="notification" label="通知状态" width="96" />
        <el-table-column prop="dueDate" label="信用期结束日" width="112" />
        <el-table-column v-if="isReceivable" label="逾期" width="70"><template #default="scope"><span v-if="scope.row.overdue" class="status-tag danger">逾期</span><span v-else>-</span></template></el-table-column>
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="scope">
            <el-button link type="primary" :icon="View" @click="openDetail(scope.row)">详情</el-button>
            <el-button v-if="scope.row.status === '待审核' && scope.row.closeStatus === '已收口'" link type="primary" :icon="Check" @click="approve(scope.row)">审核</el-button>
            <el-button link type="primary" :icon="Download" @click="createExport(scope.row)">导出</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="table-pagination"><span>展示 1-{{ records.length }} 条</span><el-pagination layout="prev, pager, next" :total="records.length" :page-size="10" /></div>
    </section>

    <el-drawer v-model="detailVisible" size="820px" class="detail-drawer module-drawer">
      <template #header><div class="drawer-title"><span>{{ title }}详情</span><small>{{ selectedBill?.billNo }}</small></div></template>
      <template v-if="selectedBill">
        <div class="drawer-summary">
          <div><span :class="['status-tag', statusClass(selectedBill.status)]">{{ selectedBill.status }}</span><span :class="['status-tag', selectedBill.closeStatus === '已收口' ? 'success' : 'warning']">{{ selectedBill.closeStatus }}</span></div>
          <strong>{{ money(selectedBill.amount, selectedBill.currency) }}</strong>
          <div class="drawer-summary-actions">
            <el-button v-if="selectedBill.status === '待审核' && selectedBill.sentAt === '-'" :icon="RefreshRight" @click="submitOperation('补充生成')">补充生成</el-button>
            <el-button v-if="selectedBill.status === '待审核'" :icon="EditPen" @click="submitOperation('账单重算')">重算</el-button>
            <el-button :icon="Download" @click="createExport(selectedBill)">导出</el-button>
          </div>
        </div>

        <el-tabs v-model="detailTab" class="drawer-tabs">
          <el-tab-pane label="账单概况" name="summary">
            <dl class="detail-grid">
              <div><dt>账单编号</dt><dd>{{ selectedBill.billNo }}</dd></div><div><dt>客户</dt><dd>{{ selectedBill.customer }} / {{ selectedBill.customerNo }}</dd></div>
              <div><dt>运抵国</dt><dd>{{ selectedBill.country }}</dd></div><div><dt>账期</dt><dd>{{ selectedBill.period }}</dd></div>
              <div><dt>账单发送日</dt><dd>{{ selectedBill.sentAt }}</dd></div><div><dt>信用期结束日</dt><dd>{{ selectedBill.dueDate }}</dd></div>
              <div><dt>账单配置</dt><dd>{{ selectedBill.config }}</dd></div><div><dt>费项数量</dt><dd>{{ selectedBill.feeCount.toLocaleString() }}</dd></div>
            </dl>
          </el-tab-pane>
          <el-tab-pane :label="isReceivable ? '应收金额' : '返款金额'" name="amount">
            <el-table :data="isReceivable ? [{currency:selectedBill.currency, original:selectedBill.amount + 1266.4, adjustment:-1266.4, final:selectedBill.amount, cny:selectedBill.amount * 8.94}] : [{currency:selectedBill.currency, recovered:selectedBill.recovered, deduction:selectedBill.deduction, final:selectedBill.amount}]" class="clean-table">
              <el-table-column prop="currency" label="费项结算币种" width="120" />
              <el-table-column v-if="isReceivable" prop="original" label="原始应收金额" align="right" /><el-table-column v-if="isReceivable" prop="adjustment" label="往期账单冲正" align="right" />
              <el-table-column v-if="!isReceivable" prop="recovered" label="回款金额" align="right" /><el-table-column v-if="!isReceivable" prop="deduction" label="扣减费项" align="right" />
              <el-table-column prop="final" :label="isReceivable ? '最终应收金额' : '最终应返金额'" align="right" />
              <el-table-column v-if="isReceivable" prop="cny" label="财务本位币金额" align="right" />
            </el-table>
          </el-tab-pane>
          <el-tab-pane :label="isReceivable ? '费项明细' : '返款与扣减明细'" name="fees">
            <el-table :data="[{order:'SO-260731-004188', fee:'基础运费', currency:selectedBill.currency, amount:126.8},{order:'SO-260731-004221', fee:isReceivable?'操作费':'代收服务费', currency:selectedBill.currency, amount:isReceivable?18.5:-6.2},{order:'SO-260731-004295', fee:isReceivable?'附加费':'应返货款', currency:selectedBill.currency, amount:isReceivable?9.6:238.4}]" class="clean-table">
              <el-table-column prop="order" label="业务订单号" /><el-table-column prop="fee" label="费项" /><el-table-column prop="currency" label="币种" width="80" /><el-table-column prop="amount" label="金额" align="right" />
            </el-table>
          </el-tab-pane>
          <el-tab-pane label="账单特调汇率" name="rates">
            <el-table :data="[{pair:`${selectedBill.currency} -> CNY`, source:'客户级默认汇率', defaultRate:8.91, lockedRate:8.94, operator:'谭清辉'}]" class="clean-table">
              <el-table-column prop="pair" label="货币对" /><el-table-column prop="source" label="来源" /><el-table-column prop="defaultRate" label="客户级默认汇率" /><el-table-column prop="lockedRate" label="账单级锁定汇率" /><el-table-column prop="operator" label="操作人" />
            </el-table>
          </el-tab-pane>
          <el-tab-pane label="核销记录" name="writeoff">
            <el-table :data="selectedBill.paid ? [{no:'WO-20260801-0068', date:'2026-08-01', currency:selectedBill.currency, amount:selectedBill.paid, method:'银行转账', operator:'郑雅雯'}] : []" empty-text="暂无核销记录" class="clean-table">
              <el-table-column prop="no" label="核销记录号" /><el-table-column prop="date" label="核销日期" /><el-table-column prop="currency" label="币种" /><el-table-column prop="amount" label="核销金额" /><el-table-column prop="method" label="方式" /><el-table-column prop="operator" label="操作人" />
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </template>
    </el-drawer>
  </div>
</template>
