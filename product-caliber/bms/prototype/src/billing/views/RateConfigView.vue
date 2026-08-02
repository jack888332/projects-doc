<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Delete, Download, EditPen, Plus, RefreshRight, Search } from '@element-plus/icons-vue'
import PageHeader from '../components/PageHeader.vue'
import { useDemoDataset } from '../data/useDemoDataset.js'

const activeTab = ref('base')
const query = reactive({ keyword: '', status: '' })
const baseRates = useDemoDataset('billingBaseRates', [
  { pair: 'USD / CNY', direction: 'USD -> CNY', rate: 7.1846, source: '手动导入', sourceAt: '2026-08-02 09:00', status: '生效', current: '是', operator: '谭清辉' },
  { pair: 'GBP / CNY', direction: 'GBP -> CNY', rate: 9.4628, source: '手动添加', sourceAt: '2026-08-02 09:12', status: '生效', current: '是', operator: '郑雅雯' },
  { pair: 'CAD / CNY', direction: 'CAD -> CNY', rate: 5.2184, source: '手动导入', sourceAt: '2026-08-02 09:00', status: '待确认', current: '否', operator: '谭清辉' },
  { pair: 'AUD / CNY', direction: 'CNY -> AUD', rate: 0.2146, source: '手动添加', sourceAt: '2026-08-01 16:20', status: '停用', current: '否', operator: '郑雅雯' },
])
const customerRates = useDemoDataset('billingCustomerRates', [
  { customerNo: 'OG4155', customer: 'OceanGate Logistics', shop: '深圳集运店', pair: 'GBP / CNY', direction: 'GBP -> CNY', method: '百分比缩放', adjust: '上浮 1.5%', base: 9.4628, result: 9.604742, status: '启用', operator: '谭清辉', updatedAt: '2026-08-02 09:28' },
  { customerNo: 'TK9012', customer: 'TopKing Supply', shop: '义乌集运店', pair: 'USD / CNY', direction: 'USD -> CNY', method: '固定汇率差', adjust: '下浮 0.0200', base: 7.1846, result: 7.1646, status: '启用', operator: '郑雅雯', updatedAt: '2026-08-01 18:41' },
  { customerNo: 'NW2048', customer: 'NorthWind Cargo', shop: '上海集运店', pair: 'CAD / CNY', direction: 'CAD -> CNY', method: '固定汇率值', adjust: '5.2500', base: '不适用', result: 5.25, status: '停用', operator: '谭清辉', updatedAt: '2026-07-30 11:02' },
])
const rows = computed(() => {
  const source = activeTab.value === 'base' ? baseRates.value : customerRates.value
  return source.filter((item) => {
    const text = JSON.stringify(item).toLowerCase()
    return (!query.keyword || text.includes(query.keyword.toLowerCase())) && (!query.status || item.status === query.status)
  })
})

async function confirmRate(row) {
  await ElMessageBox.confirm(`确认 ${row.direction} 汇率 ${row.rate} 生效？`, '确认基准汇率', { type: 'warning' })
  row.status = '生效'; row.current = '是'; ElMessage.success('基准汇率已确认生效')
}

function simpleAction(name) { ElMessage.success(`${name}已提交`) }
</script>

<template>
  <div class="module-page">
    <PageHeader eyebrow="" title="汇率配置" description="维护外币到财务本位币的默认汇率及客户维度特调规则">
      <template #actions><el-button :icon="Download" @click="simpleAction('导入任务')">导入</el-button><el-button :icon="RefreshRight" disabled>抓取</el-button><el-button type="primary" :icon="Plus" @click="simpleAction('新增汇率')">添加</el-button></template>
    </PageHeader>
    <el-tabs v-model="activeTab" class="module-tabs" @tab-change="query.status = ''"><el-tab-pane label="基准汇率表" name="base" /><el-tab-pane label="客户特调汇率" name="customer" /></el-tabs>
    <section class="module-panel">
      <div class="module-toolbar"><div class="module-filters"><el-input v-model="query.keyword" :prefix-icon="Search" :placeholder="activeTab === 'base' ? '货币对 / 操作人' : '客户 / 货币对 / 店铺'" clearable class="module-search" /><el-select v-model="query.status" placeholder="全部状态" clearable><el-option v-for="s in (activeTab === 'base' ? ['待确认','生效','停用'] : ['启用','停用'])" :key="s" :label="s" :value="s" /></el-select></div><span class="module-result-count">{{ rows.length }} 条汇率配置</span></div>
      <el-table v-if="activeTab === 'base'" :data="rows" class="clean-table" border>
        <el-table-column prop="pair" label="货币对" width="120" /><el-table-column prop="direction" label="汇兑方向" width="130" /><el-table-column prop="rate" label="基准汇率" width="120" align="right" /><el-table-column prop="source" label="汇率来源" width="105" /><el-table-column prop="sourceAt" label="来源时间" width="160" /><el-table-column label="确认状态" width="90"><template #default="scope"><span :class="['status-tag', scope.row.status === '生效' ? 'success' : scope.row.status === '待确认' ? 'warning' : 'neutral']">{{ scope.row.status }}</span></template></el-table-column><el-table-column prop="current" label="当前生效" width="90" /><el-table-column prop="operator" label="最近操作人" /><el-table-column label="操作" width="230" fixed="right"><template #default="scope"><el-button v-if="scope.row.status === '待确认'" link type="primary" :icon="Check" @click="confirmRate(scope.row)">确认</el-button><el-button link type="primary" :icon="EditPen" @click="simpleAction('汇率修改')">修改</el-button><el-button link type="danger" :icon="Delete" @click="simpleAction('汇率移除')">移除</el-button></template></el-table-column>
      </el-table>
      <el-table v-else :data="rows" class="clean-table" border>
        <el-table-column label="客户" min-width="190"><template #default="scope"><div class="main-cell"><strong>{{ scope.row.customer }}</strong><small>{{ scope.row.customerNo }} · {{ scope.row.shop }}</small></div></template></el-table-column><el-table-column prop="pair" label="货币对" width="110" /><el-table-column prop="direction" label="汇兑方向" width="125" /><el-table-column prop="method" label="调整方式" width="110" /><el-table-column prop="adjust" label="调整值" width="120" /><el-table-column prop="base" label="基准汇率" width="105" /><el-table-column prop="result" label="客户汇率" width="120" /><el-table-column label="命中级别" width="110"><template #default>客户特调汇率</template></el-table-column><el-table-column label="状态" width="80"><template #default="scope"><span :class="['status-tag', scope.row.status === '启用' ? 'success' : 'neutral']">{{ scope.row.status }}</span></template></el-table-column><el-table-column label="最近操作" min-width="155"><template #default="scope"><div class="main-cell"><strong>{{ scope.row.operator }}</strong><small>{{ scope.row.updatedAt }}</small></div></template></el-table-column><el-table-column label="操作" width="190" fixed="right"><template #default><el-button link type="primary">查看明细</el-button><el-button link type="primary" :icon="EditPen" @click="simpleAction('客户特调修改')">编辑</el-button><el-button link type="warning">日志</el-button></template></el-table-column>
      </el-table>
    </section>
  </div>
</template>
