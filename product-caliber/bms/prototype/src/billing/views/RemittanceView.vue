<script setup>
import { computed, reactive, ref } from 'vue'
import { Search, View } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import PageHeader from '../components/PageHeader.vue'
import { useDemoDataset } from '../data/useDemoDataset.js'

const showFx = ref(false)
const query = reactive({ keyword: '', recoveryStatus: '', refundStatus: '' })
const packages = useDemoDataset('billingRemittances', [
  { tracking: 'YT682941503GB', order: 'SO-260731-004188', customer: 'OceanGate Logistics', shop: '深圳集运店', signStatus: '正常签收', signedAt: '2026-07-31 16:20', original: 'GBP 286.40', carrier: 'Royal Mail', recoveryStatus: '已回款', refundStatus: '待返款', recoveredAt: '2026-08-01 10:12', refundedAt: '-', recovered: 'GBP 286.40', refunded: 'GBP 0.00', method: '银行转账', serialNo: 'RC-20260801-0184', recoveryRate: '9.462800', mode: '回款返款', billNo: 'RFB-OG4155-20260728-912c', refundable: 'GBP 273.20', fx: 'CNY +18.42' },
  { tracking: '1Z999AA10123456784', order: 'SO-260731-004221', customer: 'TopKing Supply', shop: '义乌集运店', signStatus: '正常签收', signedAt: '2026-07-31 11:08', original: 'USD 421.80', carrier: 'UPS', recoveryStatus: '已回款', refundStatus: '已返款', recoveredAt: '2026-08-01 09:42', refundedAt: '2026-08-02 08:30', recovered: 'USD 421.80', refunded: 'USD 401.60', mode: '签收返款', billNo: 'RFB-TK9012-20260721-a11f', refundable: 'USD 401.60', fx: 'CNY -6.81' },
  { tracking: 'CA849204178CN', order: 'SO-260730-003952', customer: 'NorthWind Cargo', shop: '上海集运店', signStatus: '正常签收', signedAt: '2026-07-30 18:14', original: 'CAD 198.50', carrier: 'Canada Post', recoveryStatus: '待回款', refundStatus: '待返款', recoveredAt: '-', refundedAt: '-', recovered: 'CAD 0.00', refunded: 'CAD 0.00', mode: '回款返款', billNo: '-', refundable: 'CAD 188.58', fx: '-' },
  { tracking: 'AU9031847265', order: 'SO-260730-003811', customer: 'Hualei Express', shop: '广州同行店', signStatus: '异常签收', signedAt: '2026-07-30 14:26', original: 'AUD 316.00', carrier: 'Australia Post', recoveryStatus: '不回款', refundStatus: '不返款', recoveredAt: '-', refundedAt: '-', recovered: 'AUD 0.00', refunded: 'AUD 0.00', mode: '回款返款', billNo: '-', refundable: 'AUD 0.00', fx: '-' },
])
const rows = computed(() => packages.value.filter((item) => {
  const text = `${item.tracking}${item.order}${item.customer}${item.billNo}`.toLowerCase()
  return (!query.keyword || text.includes(query.keyword.toLowerCase())) && (!query.recoveryStatus || item.recoveryStatus === query.recoveryStatus) && (!query.refundStatus || item.refundStatus === query.refundStatus)
}))
const statusClass = (status) => status.startsWith('已') ? 'success' : status.startsWith('待') ? 'warning' : 'neutral'
</script>

<template>
  <div class="module-page">
    <PageHeader eyebrow="" title="回款管理" description="按尾程包裹查看 COD 货款回款、返款结果与汇兑损益锁定快照"><template #actions><el-checkbox v-model="showFx" border>查看汇兑损益</el-checkbox></template></PageHeader>
    <div class="module-kpis four"><div class="module-kpi blue"><span>COD 包裹</span><strong>{{ packages.length }}</strong></div><div class="module-kpi green"><span>已回款</span><strong>{{ packages.filter(i => i.recoveryStatus === '已回款').length }}</strong></div><div class="module-kpi amber"><span>待回款</span><strong>{{ packages.filter(i => i.recoveryStatus === '待回款').length }}</strong></div><div class="module-kpi violet"><span>待返款</span><strong>{{ packages.filter(i => i.refundStatus === '待返款').length }}</strong></div></div>
    <section class="module-panel">
      <div class="module-toolbar"><div class="module-filters"><el-input v-model="query.keyword" :prefix-icon="Search" placeholder="尾程运单号 / 订单 / 客户 / 返款账单" clearable class="module-search" /><el-select v-model="query.recoveryStatus" placeholder="全部回款状态" clearable><el-option v-for="s in ['已回款','待回款','不回款']" :key="s" :label="s" :value="s" /></el-select><el-select v-model="query.refundStatus" placeholder="全部返款状态" clearable><el-option v-for="s in ['已返款','待返款','不返款']" :key="s" :label="s" :value="s" /></el-select></div><span class="module-result-count">{{ rows.length }} 个尾程包裹</span></div>
      <el-table :data="rows" class="clean-table" row-key="tracking" border>
        <el-table-column prop="tracking" label="尾程运单号" width="160" fixed /><el-table-column prop="order" label="所属内部订单" width="155" /><el-table-column label="客户" min-width="180"><template #default="scope"><div class="main-cell"><strong>{{ scope.row.customer }}</strong><small>{{ scope.row.shop }}</small></div></template></el-table-column><el-table-column prop="signStatus" label="签收状态" width="95" /><el-table-column prop="signedAt" label="签收时间" width="155" /><el-table-column prop="original" label="货款原始金额" width="120" align="right" /><el-table-column prop="carrier" label="尾程派送商" width="130" />
        <el-table-column label="回款状态" width="90"><template #default="scope"><span :class="['status-tag', statusClass(scope.row.recoveryStatus)]">{{ scope.row.recoveryStatus }}</span></template></el-table-column><el-table-column label="返款状态" width="90"><template #default="scope"><span :class="['status-tag', statusClass(scope.row.refundStatus)]">{{ scope.row.refundStatus }}</span></template></el-table-column><el-table-column prop="recoveredAt" label="回款时间" width="150" /><el-table-column prop="method" label="回款方式" width="100" /><el-table-column prop="serialNo" label="回款流水号" width="160" /><el-table-column prop="recoveryRate" label="回款汇率" width="100" /><el-table-column prop="refundedAt" label="返款时间" width="150" /><el-table-column prop="recovered" label="实回货款金额" width="120" align="right" /><el-table-column prop="refunded" label="实返货款金额" width="120" align="right" /><el-table-column prop="mode" label="返款模式" width="100" /><el-table-column prop="billNo" label="关联返款账单" width="205" /><el-table-column prop="refundable" label="应返货款金额" width="120" align="right" />
        <el-table-column v-if="showFx" prop="fx" label="汇兑损益" width="105" align="right" class-name="fx-column" label-class-name="fx-column-header" />
        <el-table-column label="操作" width="95" fixed="right"><template #default="scope"><el-button link type="primary" :icon="View" :disabled="scope.row.billNo === '-'" @click="ElMessage.success(`打开返款账单：${scope.row.billNo}`)">账单</el-button></template></el-table-column>
      </el-table>
    </section>
  </div>
</template>
