<script setup>
import { ArrowRight, Check, Clock, Coin, TrendCharts, Upload, Warning } from '@element-plus/icons-vue'
import { db } from '../db'
import { useLiveData } from '../composables/useLiveData'

defineEmits(['open-import', 'navigate'])

const { data: bills } = useLiveData(() => db.costBills.orderBy('importedAt').reverse().toArray())

const kpis = [
  { label: '本月成本（人民币）', value: '¥ 2,846,391.520', delta: '较上月 +6.8%', direction: 'up', icon: Coin, note: '已归属成本' },
  { label: '待结清账单', value: '6', delta: '3 种币种', direction: 'plain', icon: Clock, note: '折合 ¥ 926,418.260' },
  { label: '待处理成本', value: '328', delta: '较昨日 -42', direction: 'down', icon: Warning, note: '含 24 条匹配冲突' },
  { label: '本月成本覆盖率', value: '94.6%', delta: '较上月 +1.2%', direction: 'up', icon: Check, note: '1,892 个订单成本已齐' },
]

const costMix = [
  { label: '派送成本', value: 1084230, percent: 38, color: '#2864dc' },
  { label: '清关成本', value: 741064, percent: 26, color: '#13a083' },
  { label: '海运成本', value: 512350, percent: 18, color: '#6c52b8' },
  { label: '空运成本', value: 341567, percent: 12, color: '#d7872d' },
  { label: '租车成本', value: 167180, percent: 6, color: '#687386' },
]

const todos = [
  { tone: 'danger', title: '24 条单号关系冲突', desc: '直接成本无法确定唯一归属', action: '去处理', target: 'cost-pool' },
  { tone: 'warning', title: '4 个分摊池待确认', desc: '涉及 3,607 个业务订单', action: '去确认', target: 'allocation' },
  { tone: 'warning', title: '1 个分摊池执行失败', desc: '空运安检费缺少兜底因子', action: '查看原因', target: 'allocation' },
  { tone: 'info', title: '2 张供应商账单待结清', desc: '账龄已超过 15 天', action: '查看账单', target: 'bills' },
]
</script>

<template>
  <div class="dashboard-stack">
    <section class="kpi-grid">
      <article v-for="kpi in kpis" :key="kpi.label" class="kpi-card">
        <div class="kpi-top"><span>{{ kpi.label }}</span><span class="kpi-icon"><el-icon><component :is="kpi.icon" /></el-icon></span></div>
        <strong class="kpi-value">{{ kpi.value }}</strong>
        <div class="kpi-foot">
          <span :class="['delta', kpi.direction]"><el-icon v-if="kpi.direction !== 'plain'"><TrendCharts /></el-icon>{{ kpi.delta }}</span>
          <span>{{ kpi.note }}</span>
        </div>
      </article>
    </section>

    <section class="overview-grid">
      <article class="panel cost-mix-panel">
        <header class="panel-header"><div><h2>本月成本构成</h2><p>按财务本位币人民币折算</p></div><el-button text @click="$emit('navigate', 'cost-pool')">查看明细 <el-icon><ArrowRight /></el-icon></el-button></header>
        <div class="cost-total"><strong>¥ 2,846,391.520</strong><span>已确认与已分摊成本</span></div>
        <div class="stacked-bar"><i v-for="item in costMix" :key="item.label" :style="{ width: `${item.percent}%`, background: item.color }" /></div>
        <div class="mix-rows">
          <div v-for="item in costMix" :key="item.label" class="mix-row">
            <span><i :style="{ background: item.color }" />{{ item.label }}</span><strong>¥ {{ item.value.toLocaleString() }}</strong><em>{{ item.percent }}%</em>
          </div>
        </div>
      </article>

      <article class="panel todo-panel">
        <header class="panel-header"><div><h2>待办事项</h2><p>优先处理会影响利润成熟度的事项</p></div><span class="total-badge">31</span></header>
        <div class="todo-list">
          <div v-for="todo in todos" :key="todo.title" class="todo-row">
            <span :class="['todo-indicator', todo.tone]" />
            <div><strong>{{ todo.title }}</strong><small>{{ todo.desc }}</small></div>
            <el-button link type="primary" @click="$emit('navigate', todo.target)">{{ todo.action }}</el-button>
          </div>
        </div>
      </article>
    </section>

    <section class="panel recent-panel">
      <header class="panel-header">
        <div><h2>最近导入的成本账单</h2><p>数据取自供应商账单样本，金额按原币种展示</p></div>
        <div class="header-actions"><el-button :icon="Upload" @click="$emit('open-import')">继续导入</el-button><el-button text @click="$emit('navigate', 'bills')">全部账单 <el-icon><ArrowRight /></el-icon></el-button></div>
      </header>
      <el-table :data="bills.slice(0, 5)" class="clean-table" row-key="id">
        <el-table-column prop="id" label="成本账单编号" min-width="205" />
        <el-table-column prop="supplier" label="供应商" min-width="178" />
        <el-table-column prop="module" label="成本板块" width="110"><template #default="scope"><span :class="['module-pill', scope.row.module]">{{ scope.row.module }}</span></template></el-table-column>
        <el-table-column prop="period" label="成本账期" width="190" />
        <el-table-column label="账单金额" min-width="145" align="right"><template #default="scope"><strong class="amount-cell">{{ scope.row.amount.toLocaleString('zh-CN', { minimumFractionDigits: 3 }) }} {{ scope.row.currency }}</strong></template></el-table-column>
        <el-table-column prop="rows" label="成本明细" width="98" align="right" />
        <el-table-column prop="settled" label="结清状态" width="105"><template #default="scope"><span :class="['status-tag', scope.row.settled === '已结清' ? 'success' : 'warning']">{{ scope.row.settled }}</span></template></el-table-column>
      </el-table>
    </section>
  </div>
</template>
