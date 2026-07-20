<script setup>
import { computed, reactive, ref } from 'vue'
import { Plus, Search, VideoPlay, View } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { createBusinessId, db, recordOperation } from '../db'
import { useLiveData } from '../composables/useLiveData'

const status = ref('全部')
const keyword = ref('')
const drawerVisible = ref(false)
const createVisible = ref(false)
const selected = ref({ id: '', amount: '0.000 CNY', orders: 0 })
const form = reactive({ name: '', module: '海运成本', item: '', supplier: '', period: '', factor: '计费重量', fallback: '业务订单件数' })
const { data: allocationPools } = useLiveData(() => db.allocationPools.orderBy('id').reverse().toArray())
const filtered = computed(() => allocationPools.value.filter((item) => (status.value === '全部' || item.status === status.value) && (!keyword.value || `${item.name}${item.supplier}${item.item}`.includes(keyword.value))))
function view(row) { selected.value = row; drawerVisible.value = true }
async function createPool() {
  if (!form.name || !form.item || !form.supplier) return ElMessage.warning('请补充必填信息')
  const id = createBusinessId('POOL')
  const period = Array.isArray(form.period) ? form.period.map((item) => new Date(item).toISOString().slice(0, 10)).join(' - ') : '待确定'
  await db.allocationPools.add({ id, name: form.name, module: form.module, item: form.item, supplier: form.supplier, period, amount: '0.000 CNY', factor: form.factor, fallback: form.fallback, orders: 0, status: '待试算', progress: 0 })
  await recordOperation('分摊池', id, '新建间接成本分摊池')
  createVisible.value = false
  ElMessage.success('分摊池已创建，可继续选择成本明细')
}
async function trial(row) {
  await db.allocationPools.update(row.id, { progress: Math.max(row.progress || 0, 86), status: '待确认', trialAt: new Date().toISOString() })
  await recordOperation('分摊池', row.id, '执行分摊试算')
  ElMessage.success('试算完成，请核对分摊结果和尾差')
}
</script>

<template>
  <section class="panel work-panel">
    <div class="tabs-toolbar">
      <el-segmented v-model="status" :options="['全部','待试算','待确认','已生效','分摊失败']" />
      <el-button type="primary" :icon="Plus" @click="createVisible = true">新建分摊池</el-button>
    </div>
    <div class="filter-toolbar inner-filter"><div class="filter-group"><el-input v-model="keyword" :prefix-icon="Search" placeholder="分摊池 / 供应商 / 费项" clearable class="keyword-input wide" /><el-select placeholder="全部成本板块" clearable><el-option v-for="item in ['派送成本','清关成本','海运成本','空运成本','租车成本']" :key="item" :label="item" :value="item" /></el-select><el-date-picker type="daterange" range-separator="至" start-placeholder="账期开始" end-placeholder="账期结束" /></div></div>
    <el-table :data="filtered" class="clean-table" row-key="id">
      <el-table-column prop="name" label="分摊池" min-width="210" fixed><template #default="scope"><div class="pool-name"><strong>{{ scope.row.name }}</strong><small>{{ scope.row.id }}</small></div></template></el-table-column>
      <el-table-column prop="module" label="成本板块" width="110"><template #default="scope"><span :class="['module-pill', scope.row.module]">{{ scope.row.module }}</span></template></el-table-column>
      <el-table-column prop="item" label="标准成本费项" width="125" />
      <el-table-column prop="supplier" label="供应商" min-width="180" />
      <el-table-column prop="period" label="分摊范围" width="195" />
      <el-table-column prop="amount" label="待分摊金额" width="155" align="right"><template #default="scope"><strong class="amount-cell">{{ scope.row.amount }}</strong></template></el-table-column>
      <el-table-column prop="factor" label="分摊因子" width="115" />
      <el-table-column prop="orders" label="候选订单" width="95" align="right" />
      <el-table-column label="分摊进度" width="155"><template #default="scope"><el-progress :percentage="scope.row.progress" :status="scope.row.status === '分摊失败' ? 'exception' : undefined" /></template></el-table-column>
      <el-table-column prop="status" label="状态" width="100"><template #default="scope"><span :class="['status-tag', scope.row.status === '已生效' ? 'success' : scope.row.status === '分摊失败' ? 'danger' : 'warning']">{{ scope.row.status }}</span></template></el-table-column>
      <el-table-column label="操作" width="155" fixed="right"><template #default="scope"><el-button link type="primary" :icon="View" @click="view(scope.row)">详情</el-button><el-button v-if="scope.row.status !== '已生效'" link :icon="VideoPlay" @click="trial(scope.row)">试算</el-button></template></el-table-column>
    </el-table>
  </section>

  <el-drawer v-model="drawerVisible" size="650px" class="detail-drawer">
    <template #header><div class="drawer-title"><span>分摊池详情</span><small>{{ selected.id }}</small></div></template>
    <div class="allocation-hero"><div><span>待分摊金额</span><strong>{{ selected.amount }}</strong></div><div><span>候选业务订单</span><strong>{{ selected.orders.toLocaleString() }}</strong></div><div><span>当前状态</span><strong>{{ selected.status }}</strong></div></div>
    <h4 class="section-title">分摊口径</h4>
    <dl class="detail-grid"><div><dt>分摊池名称</dt><dd>{{ selected.name }}</dd></div><div><dt>成本板块</dt><dd>{{ selected.module }}</dd></div><div><dt>标准成本费项</dt><dd>{{ selected.item }}</dd></div><div><dt>适用供应商</dt><dd>{{ selected.supplier }}</dd></div><div><dt>分摊范围</dt><dd>{{ selected.period }}</dd></div><div><dt>优先分摊因子</dt><dd>{{ selected.factor }}</dd></div></dl>
    <h4 class="section-title">分摊原理</h4>
    <div class="allocation-formula"><span>订单分摊金额</span><b>=</b><span>池内原币金额</span><b>×</b><span>订单因子值 ÷ 全部订单因子合计</span></div>
    <div class="notice-box">间接成本仅分摊到业务订单。同一成本明细不能同时进入多个有效分摊池；规则和结果按版本留痕。</div>
    <div class="drawer-actions"><el-button @click="drawerVisible = false">关闭</el-button><el-button v-if="selected.status !== '已生效'" type="primary" :icon="VideoPlay" @click="trial(selected)">重新试算</el-button></div>
  </el-drawer>

  <el-dialog v-model="createVisible" title="新建间接成本分摊池" width="700px">
    <el-form label-position="top" class="two-column-form">
      <el-form-item label="分摊池名称" required class="span-2"><el-input v-model="form.name" placeholder="例如 海运文件费分摊池 07月" /></el-form-item>
      <el-form-item label="成本板块" required><el-select v-model="form.module"><el-option v-for="item in ['派送成本','清关成本','海运成本','空运成本','租车成本']" :key="item" :label="item" :value="item" /></el-select></el-form-item>
      <el-form-item label="标准成本费项" required><el-input v-model="form.item" placeholder="搜索费项" /></el-form-item>
      <el-form-item label="适用供应商" required><el-input v-model="form.supplier" placeholder="搜索供应商" /></el-form-item>
      <el-form-item label="成本账期"><el-date-picker v-model="form.period" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" /></el-form-item>
      <el-form-item label="优先分摊因子" required><el-select v-model="form.factor"><el-option v-for="item in ['计费重量','业务订单件数','申报金额','清关重量','体积']" :key="item" :label="item" :value="item" /></el-select></el-form-item>
      <el-form-item label="兜底分摊因子" required><el-select v-model="form.fallback"><el-option v-for="item in ['业务订单件数','计费重量','平均分摊']" :key="item" :label="item" :value="item" /></el-select></el-form-item>
    </el-form>
    <template #footer><el-button @click="createVisible = false">取消</el-button><el-button type="primary" @click="createPool">创建并选取成本</el-button></template>
  </el-dialog>
</template>
