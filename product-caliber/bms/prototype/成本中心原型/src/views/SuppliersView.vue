<script setup>
import { computed, reactive, ref } from 'vue'
import { Edit, Plus, Search, View } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { db, recordOperation } from '../db'
import { useLiveData } from '../composables/useLiveData'

const query = reactive({ keyword: '', module: '', status: '' })
const drawerVisible = ref(false)
const formVisible = ref(false)
const selected = ref({ modules: [], name: '', code: '' })
const form = reactive({ code: '', name: '', modules: [], cycle: '月', currency: 'TWD', status: '启用', remark: '' })
const { data: suppliers } = useLiveData(() => db.suppliers.orderBy('code').toArray())

const filtered = computed(() => suppliers.value.filter((item) => {
  const keywordMatch = !query.keyword || `${item.code}${item.name}`.toLowerCase().includes(query.keyword.toLowerCase())
  return keywordMatch && (!query.module || item.modules.includes(query.module)) && (!query.status || item.status === query.status)
}))

function viewSupplier(row) {
  selected.value = row
  drawerVisible.value = true
}

function openForm(row) {
  Object.assign(form, row ? { ...row, modules: [...row.modules] } : { code: '', name: '', modules: [], cycle: '月', currency: 'TWD', status: '启用', remark: '' })
  formVisible.value = true
}

async function submitForm() {
  if (!form.code || !form.name || !form.modules.length) return ElMessage.warning('请补充必填信息')
  const existing = await db.suppliers.get(form.code)
  await db.suppliers.put({
    ...existing,
    code: form.code,
    name: form.name,
    modules: [...form.modules],
    cycle: form.cycle,
    currency: form.currency,
    status: form.status,
    remark: form.remark,
    currentPeriod: existing?.currentPeriod || '尚未形成成本账期',
    bills: existing?.bills || 0,
    pending: existing?.pending || 0,
    pendingAmount: existing?.pendingAmount || `0.000 ${form.currency}`,
    total: existing?.total || `0.000 ${form.currency}`,
    snapshot: existing?.snapshot || '暂无',
  })
  await recordOperation('供应商', form.code, existing ? '编辑供应商财务档案' : '新增供应商财务档案')
  formVisible.value = false
  ElMessage.success(existing ? '供应商档案已保存' : '供应商档案已创建')
}
</script>

<template>
  <section class="panel work-panel">
    <div class="filter-toolbar">
      <div class="filter-group">
        <el-input v-model="query.keyword" :prefix-icon="Search" placeholder="供应商编码 / 名称" clearable class="keyword-input" />
        <el-select v-model="query.module" placeholder="全部成本板块" clearable><el-option v-for="item in ['派送成本','清关成本','海运成本','空运成本','租车成本']" :key="item" :label="item" :value="item" /></el-select>
        <el-select v-model="query.status" placeholder="全部状态" clearable><el-option label="启用" value="启用" /><el-option label="停用" value="停用" /></el-select>
      </div>
      <el-button type="primary" :icon="Plus" @click="openForm()">新增供应商</el-button>
    </div>
    <div class="result-summary">共 <strong>{{ filtered.length }}</strong> 家供应商，金额按原币种分桶统计</div>
    <el-table :data="filtered" class="clean-table" row-key="code">
      <el-table-column prop="code" label="供应商编码" width="135" fixed />
      <el-table-column prop="name" label="供应商名称" min-width="190" fixed />
      <el-table-column label="适用成本板块" min-width="190"><template #default="scope"><div class="tag-row"><span v-for="tag in scope.row.modules" :key="tag" :class="['module-pill', tag]">{{ tag }}</span></div></template></el-table-column>
      <el-table-column prop="cycle" label="账期类型" width="95" />
      <el-table-column prop="currentPeriod" label="当前成本账期" width="190" />
      <el-table-column prop="currency" label="默认币种" width="95" />
      <el-table-column prop="bills" label="成本账单" width="90" align="right" />
      <el-table-column prop="pending" label="待结清" width="85" align="right" />
      <el-table-column prop="pendingAmount" label="待结清金额" min-width="170" align="right"><template #default="scope"><strong class="amount-cell">{{ scope.row.pendingAmount }}</strong></template></el-table-column>
      <el-table-column prop="status" label="状态" width="85"><template #default="scope"><span :class="['status-tag', scope.row.status === '启用' ? 'success' : 'neutral']">{{ scope.row.status }}</span></template></el-table-column>
      <el-table-column label="操作" width="135" fixed="right"><template #default="scope"><el-button link type="primary" :icon="View" @click="viewSupplier(scope.row)">详情</el-button><el-button link :icon="Edit" @click="openForm(scope.row)">编辑</el-button></template></el-table-column>
    </el-table>
    <div class="table-pagination"><span>已显示 {{ filtered.length }} 条</span><el-pagination background layout="prev, pager, next" :total="filtered.length" :page-size="10" /></div>
  </section>

  <el-drawer v-model="drawerVisible" size="540px" class="detail-drawer">
    <template #header><div class="drawer-title"><span>供应商详情</span><small>{{ selected.code }}</small></div></template>
    <div class="supplier-hero"><div class="supplier-avatar">{{ selected.name.slice(0, 1) }}</div><div><h3>{{ selected.name }}</h3><span :class="['status-tag', selected.status === '启用' ? 'success' : 'neutral']">{{ selected.status }}</span></div></div>
    <h4 class="section-title">财务档案</h4>
    <dl class="detail-grid"><div><dt>适用成本板块</dt><dd>{{ selected.modules.join('、') }}</dd></div><div><dt>默认币种</dt><dd>{{ selected.currency }}</dd></div><div><dt>成本账期类型</dt><dd>{{ selected.cycle }}</dd></div><div><dt>当前成本账期</dt><dd>{{ selected.currentPeriod }}</dd></div><div><dt>当前导入设置快照</dt><dd>{{ selected.snapshot }}</dd></div><div><dt>累计成本金额</dt><dd>{{ selected.total }}</dd></div></dl>
    <h4 class="section-title">账单统计</h4>
    <div class="mini-stat-grid"><div><span>成本账单</span><strong>{{ selected.bills }}</strong></div><div><span>待结清</span><strong class="warning-text">{{ selected.pending }}</strong></div><div><span>待结清金额</span><strong>{{ selected.pendingAmount }}</strong></div></div>
    <div class="drawer-actions"><el-button @click="drawerVisible = false">关闭</el-button><el-button type="primary" :icon="Edit" @click="openForm(selected)">编辑档案</el-button></div>
  </el-drawer>

  <el-dialog v-model="formVisible" :title="form.name ? '编辑供应商档案' : '新增供应商档案'" width="660px">
    <el-form label-position="top" class="two-column-form">
      <el-form-item label="供应商编码" required><el-input v-model="form.code" placeholder="例如 SUP-DF-001" /></el-form-item>
      <el-form-item label="供应商名称" required><el-input v-model="form.name" /></el-form-item>
      <el-form-item label="适用成本板块" required class="span-2"><el-checkbox-group v-model="form.modules"><el-checkbox-button v-for="item in ['派送成本','清关成本','海运成本','空运成本','租车成本']" :key="item" :value="item">{{ item }}</el-checkbox-button></el-checkbox-group></el-form-item>
      <el-form-item label="成本账期类型" required><el-select v-model="form.cycle"><el-option v-for="item in ['周','半月','月','自然天','不固定']" :key="item" :label="item" :value="item" /></el-select></el-form-item>
      <el-form-item label="默认币种" required><el-select v-model="form.currency"><el-option v-for="item in ['CNY','TWD','USD']" :key="item" :label="item" :value="item" /></el-select></el-form-item>
      <el-form-item label="状态"><el-radio-group v-model="form.status"><el-radio-button value="启用">启用</el-radio-button><el-radio-button value="停用">停用</el-radio-button></el-radio-group></el-form-item>
      <el-form-item label="备注" class="span-2"><el-input v-model="form.remark" type="textarea" :rows="3" placeholder="可记录供应商对账口径或账期例外" /></el-form-item>
    </el-form>
    <template #footer><el-button @click="formVisible = false">取消</el-button><el-button type="primary" @click="submitForm">保存</el-button></template>
  </el-dialog>
</template>
