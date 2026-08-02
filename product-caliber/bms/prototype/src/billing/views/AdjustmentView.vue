<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Delete, Download, EditPen, Search, UploadFilled, View } from '@element-plus/icons-vue'
import PageHeader from '../components/PageHeader.vue'
import { useDemoDataset } from '../data/useDemoDataset.js'

const query = reactive({ keyword: '', status: '', type: '' })
const selectedRows = ref([])
const records = useDemoDataset('billingAdjustments', [
  { no: 'ADJ-9f7c-1842', submittedAt: '2026-08-02 09:42', type: '应收调账', status: '待审核', party: 'OceanGate Logistics', billNo: 'ARB-OG4155-20260701-f802', fee: '基础运费', object: '业务订单', order: 'SO-260731-004188', tracking: 'YT682941503GB', reason: '重量复核差异', beforeCurrency: 'GBP', delta: -12.6, afterAmount: 114.2, assignedBill: 'ARB-OG4155-20260701-f802', afterCurrency: 'GBP', rate: 1, registrant: '谭清辉' },
  { no: 'ADJ-c412-9071', submittedAt: '2026-08-02 08:15', type: '返款调账', status: '审核通过', party: 'TopKing Supply', billNo: 'RFB-TK9012-20260721-a11f', fee: '代收服务费', object: '尾程包裹', order: 'SO-260731-004221', tracking: '1Z999AA10123456784', reason: '服务费率更正', beforeCurrency: 'USD', delta: 3.2, afterAmount: 9.4, assignedBill: 'RFB-TK9012-20260721-a11f', afterCurrency: 'USD', rate: 1, registrant: '郑雅雯' },
  { no: 'ADJ-5de8-6320', submittedAt: '2026-08-01 16:38', type: '成本金额冲正', status: '审核驳回', party: 'FastLine UK', billNo: 'CB-FLU-202607-0041', fee: '尾程派送费', object: '尾程包裹', order: 'SO-260729-003605', tracking: 'RM84720193GB', reason: '供应商重复收费', beforeCurrency: 'GBP', delta: -18.4, afterAmount: 0, assignedBill: 'CB-FLU-202607-0041', afterCurrency: 'GBP', rate: 1, registrant: '谭清辉' },
  { no: 'ADJ-a91e-2485', submittedAt: '2026-08-01 14:22', type: '成本核销冲正', status: '待审核', party: 'Ocean Carrier Ltd.', billNo: 'CB-OCL-202607-0018', fee: '海运费', object: '成本结清记录', order: 'SO-260701-001821', tracking: '-', reason: '结清币种登记错误', beforeCurrency: 'USD', delta: 680, afterAmount: 680, assignedBill: 'CB-OCL-202607-0018', afterCurrency: 'CNY', rate: 7.1846, registrant: '谭清辉' },
])
const rows = computed(() => records.value.filter((item) => {
  const text = JSON.stringify(item).toLowerCase(); return (!query.keyword || text.includes(query.keyword.toLowerCase())) && (!query.status || item.status === query.status) && (!query.type || item.object === query.type)
}))
const onlyPendingSelected = computed(() => selectedRows.value.length > 0 && selectedRows.value.every((item) => item.status === '待审核'))
const statusClass = (status) => status === '审核通过' ? 'success' : status === '待审核' ? 'warning' : 'danger'

async function review(row, approved = true) { await ElMessageBox.confirm(`确认${approved ? '通过' : '驳回'}调账记录 ${row.no}？`, '调账审核', { type: 'warning' }); row.status = approved ? '审核通过' : '审核驳回'; ElMessage.success(`调账记录已${approved ? '通过' : '驳回'}`) }
function batchReview() { selectedRows.value.forEach((row) => { row.status = '审核通过' }); ElMessage.success(`已审核通过 ${selectedRows.value.length} 条记录`) }
</script>

<template>
  <div class="module-page">
    <PageHeader eyebrow="" title="调账中心" description="统一处理调账记录的提交、归属确认、审核通过与驳回"><template #actions><el-button :icon="Download">下载模板</el-button><el-button type="primary" :icon="UploadFilled">选择文件</el-button></template></PageHeader>
    <section class="module-panel">
      <div class="module-toolbar"><div class="module-filters"><el-input v-model="query.keyword" :prefix-icon="Search" placeholder="调账单号 / 关联账单号 / 客户名称" clearable class="module-search" /><el-select v-model="query.type" placeholder="挂靠对象" clearable><el-option v-for="s in ['账单','订单','首程运单','尾程运单']" :key="s" :label="s" :value="s" /></el-select><el-select v-model="query.status" placeholder="审核状态" clearable><el-option v-for="s in ['待审核','审核通过','审核驳回']" :key="s" :label="s" :value="s" /></el-select></div><div class="module-toolbar-actions"><el-button :icon="Delete" :disabled="!onlyPendingSelected">删除</el-button><el-button type="primary" :icon="Check" :disabled="!onlyPendingSelected" @click="batchReview">通过</el-button></div></div>
      <el-table :data="rows" class="clean-table" row-key="no" border @selection-change="selectedRows = $event"><el-table-column type="selection" width="44" fixed /><el-table-column prop="no" label="调账单号" width="145" fixed /><el-table-column prop="submittedAt" label="批次提交时间" width="155" /><el-table-column label="审核状态" width="95"><template #default="scope"><span :class="['status-tag', statusClass(scope.row.status)]">{{ scope.row.status }}</span></template></el-table-column><el-table-column prop="party" label="客户名称" width="165" /><el-table-column prop="billNo" label="触发账单号" width="205" /><el-table-column prop="fee" label="冲正费项" width="110" /><el-table-column prop="object" label="费项挂靠对象" width="115" /><el-table-column prop="order" label="业务订单号" width="155" /><el-table-column prop="tracking" label="尾程运单号" width="145" /><el-table-column prop="reason" label="冲正理由" min-width="160" /><el-table-column prop="beforeCurrency" label="冲正前币种" width="105" /><el-table-column prop="delta" label="金额变幅" width="100" align="right" /><el-table-column prop="afterAmount" label="冲正后金额" width="105" align="right" /><el-table-column prop="assignedBill" label="归属账单号" width="205" /><el-table-column prop="afterCurrency" label="冲正后币种" width="105" /><el-table-column prop="rate" label="锁定汇率" width="90" /><el-table-column prop="registrant" label="登记人" width="85" /><el-table-column label="操作" width="210" fixed="right"><template #default="scope"><el-button link type="primary" :icon="View">查看</el-button><el-button v-if="scope.row.status !== '审核通过'" link type="primary" :icon="EditPen">修改</el-button><el-button v-if="scope.row.status === '待审核'" link type="primary" :icon="Check" @click="review(scope.row)">审核</el-button></template></el-table-column></el-table>
    </section>
  </div>
</template>
