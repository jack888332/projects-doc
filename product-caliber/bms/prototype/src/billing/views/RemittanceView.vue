<script setup>
import { computed, ref } from 'vue'
import { Download, View } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus/es/components/message/index.mjs'
import BillDetailPanel from '../components/BillDetailPanel.vue'
import ConditionFilter from '../../shared/components/ConditionFilter.vue'
import MetricGrid from '../../shared/components/MetricGrid.vue'
import PageHeader from '../../shared/components/PageHeader.vue'
import StackedCell from '../../shared/components/StackedCell.vue'
import StatusTag from '../../shared/components/StatusTag.vue'
import TablePagination from '../../shared/components/TablePagination.vue'
import { useStagedQuery } from '../../shared/composables/useStagedQuery.js'
import { useDemoDataset } from '../data/useDemoDataset.js'
import { prototypeDb } from '../../data/prototypeDb.js'

const showFx = ref(false)
const billVisible = ref(false)
const linkedBill = ref(null)
const initialQuery = { keyword: '', recoveryStatus: '', refundStatus: '' }
const { query, appliedQuery, applyQuery, resetQuery } = useStagedQuery(initialQuery)
const packages = useDemoDataset('billingRemittances', [
  { tracking: 'YT682941503GB', order: 'SO-260731-004188', customer: 'OceanGate Logistics', shop: '深圳集运店', signStatus: '正常签收', signedAt: '2026-07-31 16:20', original: 'GBP 286.40', originalCurrency: 'GBP', originalAmount: 286.4, carrier: 'Royal Mail', recoveryStatus: '已回款', refundStatus: '待返款', recoveredAt: '2026-08-01 10:12', refundedAt: '-', recoveryCurrency: 'GBP', recoveryAmount: 286.4, refunded: 'GBP 0.00', method: '银行转账', serialNo: 'RC-20260801-0184', recoveryRate: '9.462800', mode: '回款返款', billNo: 'RFB-OG4155-20260728-912c', refundable: 'GBP 273.20', refundableAmount: 273.2, fx: 'CNY +18.42' },
  { tracking: '1Z999AA10123456784', order: 'SO-260731-004221', customer: 'TopKing Supply', shop: '义乌集运店', signStatus: '正常签收', signedAt: '2026-07-31 11:08', original: 'USD 421.80', originalCurrency: 'USD', originalAmount: 421.8, carrier: 'UPS', recoveryStatus: '已回款', refundStatus: '已返款', recoveredAt: '2026-08-01 09:42', refundedAt: '2026-08-02 08:30', recoveryCurrency: 'USD', recoveryAmount: 421.8, refunded: 'USD 401.60', method: '银行转账', serialNo: 'RC-20260801-0179', recoveryRate: '7.184600', mode: '签收返款', billNo: 'RFB-TK9012-20260721-a11f', refundable: 'USD 401.60', refundableAmount: 401.6, fx: 'CNY -6.81' },
  { tracking: 'CA849204178CN', order: 'SO-260730-003952', customer: 'NorthWind Cargo', shop: '上海集运店', signStatus: '正常签收', signedAt: '2026-07-30 18:14', original: 'CAD 198.50', originalCurrency: 'CAD', originalAmount: 198.5, carrier: 'Canada Post', recoveryStatus: '待回款', refundStatus: '待返款', recoveredAt: '-', refundedAt: '-', recoveryCurrency: 'CAD', recoveryAmount: 0, refunded: 'CAD 0.00', method: '-', serialNo: '-', recoveryRate: '-', mode: '回款返款', billNo: '-', refundable: 'CAD 188.58', refundableAmount: 188.58, fx: '-' },
  { tracking: 'AU9031847265', order: 'SO-260730-003811', customer: 'Hualei Express', shop: '广州同行店', signStatus: '异常签收', signedAt: '2026-07-30 14:26', original: 'AUD 316.00', originalCurrency: 'AUD', originalAmount: 316, carrier: 'Australia Post', recoveryStatus: '不回款', refundStatus: '不返款', recoveredAt: '-', refundedAt: '-', recoveryCurrency: 'AUD', recoveryAmount: 0, refunded: 'AUD 0.00', method: '-', serialNo: '-', recoveryRate: '-', mode: '回款返款', billNo: '-', refundable: 'AUD 0.00', refundableAmount: 0, fx: '-' },
], 2)
const rows = computed(() => packages.value.filter((item) => {
  const text = `${item.tracking}${item.order}${item.customer}${item.billNo}`.toLowerCase()
  return (!appliedQuery.keyword || text.includes(appliedQuery.keyword.toLowerCase()))
    && (!appliedQuery.recoveryStatus || item.recoveryStatus === appliedQuery.recoveryStatus)
    && (!appliedQuery.refundStatus || item.refundStatus === appliedQuery.refundStatus)
}))
const summary = computed(() => [
  { label: 'COD 包裹', value: packages.value.length, tone: 'blue' },
  { label: '已回款', value: packages.value.filter((item) => item.recoveryStatus === '已回款').length, tone: 'green' },
  { label: '待回款', value: packages.value.filter((item) => item.recoveryStatus === '待回款').length, tone: 'amber' },
  { label: '待返款', value: packages.value.filter((item) => item.refundStatus === '待返款').length, tone: 'violet' },
])
async function openBill(row) {
  const records = await prototypeDb.demoRecords.where('dataset').equals('billingBills').toArray()
  linkedBill.value = records.map((record) => record.value).find((bill) => bill.billNo === row.billNo) || {
    type: 'RF', billNo: row.billNo, status: row.refundStatus === '已返款' ? '已结清' : '待结清', closeStatus: '已收口', issued: true,
    customer: row.customer, customerNo: row.customer.split(' ')[0], memberCode: '-', shop: row.shop, country: '-', periodType: '周', periodStart: '2026/07/21', periodEnd: '2026/07/27', sentAt: '2026/07/28', refundMode: row.mode,
    currency: row.originalCurrency, original: row.originalAmount, deduction: Math.max(row.originalAmount - row.refundableAmount, 0), amount: row.refundableAmount, paid: row.refundStatus === '已返款' ? row.refundableAmount : 0,
  }
  billVisible.value = true
}
</script>

<template>
  <div class="module-page">
    <PageHeader><template #export><el-button :icon="Download">导出</el-button></template></PageHeader>
    <section class="condition-query-panel">
      <div class="condition-filter-bar"><ConditionFilter v-model="query.keyword" label="关键词" type="text" search-placeholder="尾程运单号 / 订单 / 客户 / 返款账单" /><ConditionFilter v-model="query.recoveryStatus" label="回款状态" :options="['已回款','待回款','不回款']" /><ConditionFilter v-model="query.refundStatus" label="返款状态" :options="['已返款','待返款','不返款']" /><div class="condition-filter-actions"><el-button type="primary" @click="applyQuery">查询</el-button><el-button @click="resetQuery">重置</el-button></div></div>
    </section>
    <MetricGrid :items="summary" />
    <section class="module-panel filter-table-panel">
      <div class="table-reference-toolbar"><TableFieldSortButton /><span>已选 0 行</span><div class="table-reference-actions"><el-checkbox v-model="showFx" border>查看汇兑损益</el-checkbox></div></div>
      <el-table :data="rows" class="clean-table" row-key="tracking" border>
        <el-table-column prop="tracking" label="尾程运单号" width="160" fixed /><el-table-column prop="order" label="所属内部订单" width="155" /><el-table-column label="客户" min-width="180"><template #default="scope"><StackedCell :primary="scope.row.customer" :secondary="scope.row.shop" /></template></el-table-column><el-table-column prop="signStatus" label="签收状态" width="95" /><el-table-column prop="signedAt" label="签收时间" width="155" /><el-table-column prop="original" label="货款原始金额" width="120" align="right" /><el-table-column prop="carrier" label="尾程派送商" width="130" />
        <el-table-column label="回款状态" width="90"><template #default="scope"><StatusTag :label="scope.row.recoveryStatus" /></template></el-table-column><el-table-column label="返款状态" width="90"><template #default="scope"><StatusTag :label="scope.row.refundStatus" /></template></el-table-column><el-table-column prop="recoveredAt" label="回款时间" width="150" /><el-table-column prop="method" label="回款方式" width="100" /><el-table-column prop="serialNo" label="回款流水号" width="160" /><el-table-column prop="recoveryCurrency" label="回款币种" width="90" /><el-table-column label="回款金额" width="115" align="right"><template #default="scope">{{ scope.row.recoveryAmount.toFixed(2) }}</template></el-table-column><el-table-column prop="recoveryRate" label="回款汇率" width="100" /><el-table-column prop="refundedAt" label="返款时间" width="150" /><el-table-column prop="refunded" label="实返货款金额" width="120" align="right" /><el-table-column prop="mode" label="返款模式" width="100" /><el-table-column prop="billNo" label="关联返款账单" width="205" /><el-table-column prop="refundable" label="应返货款金额" width="120" align="right" />
        <el-table-column v-if="showFx" prop="fx" label="汇兑损益" width="105" align="right" class-name="fx-column" label-class-name="fx-column-header" />
        <el-table-column label="操作" width="90" fixed="right"><template #default="scope"><el-button class="table-detail-button" link type="primary" :icon="View" title="详情" aria-label="详情" :disabled="scope.row.billNo === '-'" @click="openBill(scope.row)" /></template></el-table-column>
      </el-table>
      <TablePagination :total="rows.length" :page-size="10" />
    </section>
    <el-dialog v-model="billVisible" title="关联返款账单详情" width="86%" align-center destroy-on-close><BillDetailPanel v-if="linkedBill" :bill="linkedBill" :is-receivable="false" @action="(name) => ElMessage.success(`${name}已提交`)" /></el-dialog>
  </div>
</template>
