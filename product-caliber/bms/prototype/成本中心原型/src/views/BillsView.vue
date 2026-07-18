<script setup>
import { computed, reactive, ref } from 'vue'
import { Check, Download, Search, View } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { bills, formatAmount } from '../data'

const query = reactive({ keyword: '', module: '', settled: '' })
const selected = ref(bills[0])
const drawerVisible = ref(false)

const filtered = computed(() => bills.filter((item) => (!query.keyword || `${item.id}${item.supplier}`.toLowerCase().includes(query.keyword.toLowerCase())) && (!query.module || item.module === query.module) && (!query.settled || item.settled === query.settled)))

function view(row) { selected.value = row; drawerVisible.value = true }
async function settle(row) {
  await ElMessageBox.confirm(`确认将 ${row.id} 登记为已结清？结清后不可返结清。`, '登记结清', { confirmButtonText: '确认结清', cancelButtonText: '取消', type: 'warning' })
  row.settled = '已结清'
  ElMessage.success('结清状态已更新')
}
</script>

<template>
  <section class="panel work-panel">
    <div class="filter-toolbar">
      <div class="filter-group">
        <el-input v-model="query.keyword" :prefix-icon="Search" placeholder="账单编号 / 供应商" clearable class="keyword-input" />
        <el-select v-model="query.module" placeholder="全部成本板块" clearable><el-option v-for="item in ['派送成本','清关成本','海运成本','空运成本','租车成本']" :key="item" :label="item" :value="item" /></el-select>
        <el-select v-model="query.settled" placeholder="全部结清状态" clearable><el-option label="待结清" value="待结清" /><el-option label="已结清" value="已结清" /></el-select>
        <el-date-picker type="daterange" range-separator="至" start-placeholder="账期开始" end-placeholder="账期结束" />
      </div>
      <el-button :icon="Download">导出内部明细</el-button>
    </div>
    <div class="result-summary">共 <strong>{{ filtered.length }}</strong> 张成本账单；结清状态与成本归属、分摊进度相互独立</div>
    <el-table :data="filtered" class="clean-table" row-key="id">
      <el-table-column prop="id" label="成本账单编号" width="215" fixed />
      <el-table-column prop="supplier" label="供应商" min-width="190" />
      <el-table-column prop="module" label="成本板块" width="110"><template #default="scope"><span :class="['module-pill', scope.row.module]">{{ scope.row.module }}</span></template></el-table-column>
      <el-table-column prop="period" label="成本账期" width="195" />
      <el-table-column label="账单金额" min-width="165" align="right"><template #default="scope"><strong class="amount-cell">{{ formatAmount(scope.row.amount, scope.row.currency) }}</strong></template></el-table-column>
      <el-table-column prop="rows" label="成本明细" width="95" align="right" />
      <el-table-column label="直接 / 间接" width="120" align="center"><template #default="scope"><span>{{ scope.row.direct }} / {{ scope.row.indirect }}</span></template></el-table-column>
      <el-table-column prop="settled" label="结清状态" width="105"><template #default="scope"><span :class="['status-tag', scope.row.settled === '已结清' ? 'success' : 'warning']">{{ scope.row.settled }}</span></template></el-table-column>
      <el-table-column prop="importedAt" label="导入时间" width="160" />
      <el-table-column label="操作" width="160" fixed="right"><template #default="scope"><el-button link type="primary" :icon="View" @click="view(scope.row)">详情</el-button><el-button v-if="scope.row.settled === '待结清'" link type="success" :icon="Check" @click="settle(scope.row)">登记结清</el-button></template></el-table-column>
    </el-table>
  </section>

  <el-drawer v-model="drawerVisible" size="620px" class="detail-drawer">
    <template #header><div class="drawer-title"><span>成本账单详情</span><small>{{ selected.id }}</small></div></template>
    <div class="bill-summary-strip"><div><span>账单金额</span><strong>{{ formatAmount(selected.amount, selected.currency) }}</strong></div><div><span>成本明细</span><strong>{{ selected.rows.toLocaleString() }}</strong></div><div><span>结清状态</span><strong>{{ selected.settled }}</strong></div></div>
    <h4 class="section-title">账单信息</h4>
    <dl class="detail-grid"><div><dt>供应商</dt><dd>{{ selected.supplier }}</dd></div><div><dt>成本板块</dt><dd>{{ selected.module }}</dd></div><div><dt>成本账期</dt><dd>{{ selected.period }}</dd></div><div><dt>原始文件</dt><dd>{{ selected.file }}</dd></div><div><dt>导入结果</dt><dd>{{ selected.importStatus }}</dd></div><div><dt>导入时间</dt><dd>{{ selected.importedAt }}</dd></div></dl>
    <h4 class="section-title">成本归属概况</h4>
    <div class="progress-block"><div class="progress-copy"><span>直接成本</span><strong>{{ selected.direct.toLocaleString() }} 条</strong></div><el-progress :percentage="Math.round(selected.direct / selected.rows * 100)" :stroke-width="10" /></div>
    <div class="progress-block"><div class="progress-copy"><span>间接成本</span><strong>{{ selected.indirect.toLocaleString() }} 条</strong></div><el-progress :percentage="Math.round(selected.indirect / selected.rows * 100)" :stroke-width="10" color="#d7872d" /></div>
    <h4 class="section-title">来源追溯</h4>
    <div class="file-card"><span class="file-type">XLSX</span><div><strong>{{ selected.file }}</strong><small>保留原始文件、字段映射和逐行数据快照</small></div><el-button link type="primary">下载原文件</el-button></div>
  </el-drawer>
</template>
