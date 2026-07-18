<script setup>
import { computed, reactive, ref } from 'vue'
import { Link, Plus, RefreshRight, Search, View } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { formatAmount } from '../data'
import { createBusinessId, db, recordOperation } from '../db'
import { useLiveData } from '../composables/useLiveData'

const tab = ref('全部')
const query = reactive({ keyword: '', module: '', status: '' })
const selected = ref({ id: '', amount: 0, currency: '', module: '' })
const drawerVisible = ref(false)
const supplementVisible = ref(false)
const supplement = reactive({ supplier: '', module: '', item: '', amount: '', currency: 'TWD', keyType: '', key: '', type: '直接成本' })
const { data: costRows } = useLiveData(() => db.costItems.orderBy('id').reverse().toArray())

const stats = [
  { label: '成本明细', value: '11,301', meta: '5 个成本板块' },
  { label: '已归属', value: '10,721', meta: '94.9%' },
  { label: '待人工匹配', value: '24', meta: '含 7 条冲突' },
  { label: '待分摊', value: '556', meta: '4 个分摊池' },
]

const filtered = computed(() => costRows.value.filter((item) => (tab.value === '全部' || item.type === tab.value) && (!query.keyword || `${item.id}${item.bill}${item.key}${item.item}`.toLowerCase().includes(query.keyword.toLowerCase())) && (!query.module || item.module === query.module) && (!query.status || item.status === query.status)))

function view(row) { selected.value = row; drawerVisible.value = true }
async function toggleType(row) {
  const next = row.type === '直接成本' ? '间接成本' : '直接成本'
  await ElMessageBox.confirm(`将该明细切换为${next}？系统会重新校验关键单号与业务对象关系。`, '切换成本类型', { confirmButtonText: '确认切换', cancelButtonText: '取消', type: 'warning' })
  await db.costItems.update(row.id, {
    type: next,
    status: next === '间接成本' ? '待处理' : '待人工匹配',
    target: next === '间接成本' ? '尚未选择分摊池' : '待匹配业务对象',
  })
  await recordOperation('成本明细', row.id, `切换为${next}`)
  ElMessage.success(`已切换为${next}`)
}
async function submitSupplement() {
  if (!supplement.supplier || !supplement.module || !supplement.item || !supplement.amount) return ElMessage.warning('请补充必填字段')
  const id = createBusinessId('COST-MANUAL')
  await db.costItems.add({
    id,
    bill: '成本池手工补录',
    supplier: supplement.supplier,
    module: supplement.module,
    rawItem: supplement.item,
    item: supplement.item,
    keyType: supplement.keyType || '无关键单号',
    key: supplement.key,
    amount: Number(supplement.amount),
    currency: supplement.currency,
    type: supplement.type,
    target: supplement.type === '间接成本' ? '尚未选择分摊池' : '待匹配业务对象',
    status: supplement.type === '间接成本' ? '待处理' : '待人工匹配',
  })
  await recordOperation('成本明细', id, '手工补录成本')
  supplementVisible.value = false
  ElMessage.success('成本明细已补录至成本池')
}
</script>

<template>
  <div class="dashboard-stack">
    <section class="mini-kpi-grid"><div v-for="item in stats" :key="item.label" class="mini-kpi"><span>{{ item.label }}</span><strong>{{ item.value }}</strong><small>{{ item.meta }}</small></div></section>
    <section class="panel work-panel">
      <div class="tabs-toolbar">
        <el-segmented v-model="tab" :options="['全部','直接成本','间接成本']" />
        <el-button type="primary" :icon="Plus" @click="supplementVisible = true">补录成本</el-button>
      </div>
      <div class="filter-toolbar inner-filter">
        <div class="filter-group"><el-input v-model="query.keyword" :prefix-icon="Search" placeholder="成本编号 / 账单 / 单号 / 费项" clearable class="keyword-input wide" /><el-select v-model="query.module" placeholder="全部成本板块" clearable><el-option v-for="item in ['派送成本','清关成本','海运成本','空运成本','租车成本']" :key="item" :label="item" :value="item" /></el-select><el-select v-model="query.status" placeholder="全部处理状态" clearable><el-option v-for="item in ['已归属','待人工匹配','待分摊','已分摊','待处理']" :key="item" :label="item" :value="item" /></el-select></div>
      </div>
      <el-table :data="filtered" class="clean-table" row-key="id">
        <el-table-column prop="id" label="成本明细编号" width="180" fixed />
        <el-table-column prop="module" label="成本板块" width="110"><template #default="scope"><span :class="['module-pill', scope.row.module]">{{ scope.row.module }}</span></template></el-table-column>
        <el-table-column prop="supplier" label="供应商" min-width="180" />
        <el-table-column label="供应商费项 → 常规成本费项" min-width="220"><template #default="scope"><div class="mapping-cell"><span>{{ scope.row.rawItem }}</span><i>→</i><strong>{{ scope.row.item }}</strong></div></template></el-table-column>
        <el-table-column label="关键单号" min-width="175"><template #default="scope"><div class="key-cell"><small>{{ scope.row.keyType }}</small><strong>{{ scope.row.key }}</strong></div></template></el-table-column>
        <el-table-column label="成本金额" min-width="145" align="right"><template #default="scope"><strong class="amount-cell">{{ formatAmount(scope.row.amount, scope.row.currency) }}</strong></template></el-table-column>
        <el-table-column prop="type" label="成本类型" width="105"><template #default="scope"><span :class="['status-tag', scope.row.type === '直接成本' ? 'info' : 'violet']">{{ scope.row.type }}</span></template></el-table-column>
        <el-table-column prop="status" label="处理状态" width="110"><template #default="scope"><span :class="['status-tag', ['已归属','已分摊'].includes(scope.row.status) ? 'success' : 'warning']">{{ scope.row.status }}</span></template></el-table-column>
        <el-table-column label="操作" width="185" fixed="right"><template #default="scope"><el-button link type="primary" :icon="View" @click="view(scope.row)">详情</el-button><el-button link :icon="RefreshRight" @click="toggleType(scope.row)">切换类型</el-button></template></el-table-column>
      </el-table>
    </section>

    <el-drawer v-model="drawerVisible" size="620px" class="detail-drawer">
      <template #header><div class="drawer-title"><span>成本明细详情</span><small>{{ selected.id }}</small></div></template>
      <div class="cost-detail-hero"><span :class="['module-pill', selected.module]">{{ selected.module }}</span><h3>{{ selected.item }}</h3><strong>{{ formatAmount(selected.amount, selected.currency) }}</strong></div>
      <h4 class="section-title">标准成本字段</h4>
      <dl class="detail-grid"><div><dt>供应商</dt><dd>{{ selected.supplier }}</dd></div><div><dt>成本账单编号</dt><dd>{{ selected.bill }}</dd></div><div><dt>供应商原始费项</dt><dd>{{ selected.rawItem }}</dd></div><div><dt>常规成本费项</dt><dd>{{ selected.item }}</dd></div><div><dt>关键单号类型</dt><dd>{{ selected.keyType }}</dd></div><div><dt>关键单号</dt><dd>{{ selected.key }}</dd></div></dl>
      <h4 class="section-title">成本识别与归属</h4>
      <div class="relation-path"><span>供应商侧单号<br><strong>{{ selected.key }}</strong></span><el-icon><Link /></el-icon><span>成本类型<br><strong>{{ selected.type }}</strong></span><el-icon><Link /></el-icon><span>当前归属<br><strong>{{ selected.target }}</strong></span></div>
      <div class="notice-box">系统依据供应商侧单号与尾程运单号、我方业务订单号的关系建议成本类型。人工切换后仍会保留判断依据与操作记录。</div>
    </el-drawer>

    <el-dialog v-model="supplementVisible" title="补录成本明细" width="680px">
      <el-form label-position="top" class="two-column-form">
        <el-form-item label="供应商" required><el-select v-model="supplement.supplier" filterable><el-option v-for="item in ['东风速运有限公司','福广国际报关有限公司','力宝国际物流','联多国际货运']" :key="item" :label="item" :value="item" /></el-select></el-form-item>
        <el-form-item label="成本板块" required><el-select v-model="supplement.module"><el-option v-for="item in ['派送成本','清关成本','海运成本','空运成本','租车成本']" :key="item" :label="item" :value="item" /></el-select></el-form-item>
        <el-form-item label="常规成本费项" required><el-input v-model="supplement.item" placeholder="选择或搜索费项" /></el-form-item>
        <el-form-item label="成本类型" required><el-radio-group v-model="supplement.type"><el-radio-button value="直接成本">直接成本</el-radio-button><el-radio-button value="间接成本">间接成本</el-radio-button></el-radio-group></el-form-item>
        <el-form-item label="成本金额" required><el-input v-model="supplement.amount" placeholder="0.000"><template #append><el-select v-model="supplement.currency" style="width: 82px"><el-option label="CNY" value="CNY" /><el-option label="TWD" value="TWD" /><el-option label="USD" value="USD" /></el-select></template></el-input></el-form-item>
        <el-form-item label="关键单号类型"><el-select v-model="supplement.keyType" clearable><el-option v-for="item in ['业务订单号','尾程运单号','提单号','柜号','无关键单号']" :key="item" :label="item" :value="item" /></el-select></el-form-item>
        <el-form-item label="关键单号" class="span-2"><el-input v-model="supplement.key" placeholder="直接成本须提供可追溯的关键单号" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="supplementVisible = false">取消</el-button><el-button type="primary" @click="submitSupplement">确认补录</el-button></template>
    </el-dialog>
  </div>
</template>
