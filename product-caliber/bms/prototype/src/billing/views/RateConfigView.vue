<script setup>
import { ElMessage } from 'element-plus/es/components/message/index.mjs'
import { ElMessageBox } from 'element-plus/es/components/message-box/index.mjs'
import { Delete, Download, EditPen, Plus, RefreshRight, View } from '@element-plus/icons-vue'
import HoverActionMenu from '../../shared/components/HoverActionMenu.vue'
import PageHeader from '../../shared/components/PageHeader.vue'
import TablePagination from '../../shared/components/TablePagination.vue'
import { useDemoDataset } from '../data/useDemoDataset.js'

const baseRates = useDemoDataset('billingBaseRates', [
  { pair: 'USD / CNY', direction: 'USD -> CNY', rate: 7.1846, source: '手动导入', sourceAt: '2026-08-02 09:00', status: '生效', current: '是', operator: '谭清辉' },
  { pair: 'GBP / CNY', direction: 'GBP -> CNY', rate: 9.4628, source: '手动添加', sourceAt: '2026-08-02 09:12', status: '生效', current: '是', operator: '郑雅雯' },
  { pair: 'CAD / CNY', direction: 'CAD -> CNY', rate: 5.2184, source: '手动导入', sourceAt: '2026-08-02 09:00', status: '待确认', current: '否', operator: '谭清辉' },
  { pair: 'AUD / CNY', direction: 'CNY -> AUD', rate: 0.2146, source: '手动添加', sourceAt: '2026-08-01 16:20', status: '停用', current: '否', operator: '郑雅雯' },
])

const customerRates = useDemoDataset('billingCustomerRates', [
  { customerNo: 'OG4155', customer: 'OceanGate Logistics', shop: '深圳集运店', pair: 'GBP / CNY', direction: 'GBP -> CNY', method: '百分比缩放', adjustDirection: '上浮', adjustValue: '1.5%', base: 9.4628, result: 9.604742, status: '启用', operator: '谭清辉', updatedAt: '2026-08-02 09:28' },
  { customerNo: 'TK9012', customer: 'TopKing Supply', shop: '义乌集运店', pair: 'USD / CNY', direction: 'USD -> CNY', method: '固定汇率差', adjustDirection: '下浮', adjustValue: '0.0200', base: 7.1846, result: 7.1646, status: '启用', operator: '郑雅雯', updatedAt: '2026-08-01 18:41' },
  { customerNo: 'NW2048', customer: 'NorthWind Cargo', shop: '上海集运店', pair: 'CAD / CNY', direction: 'CAD -> CNY', method: '固定汇率值', adjustDirection: '直接指定', adjustValue: '5.2500', base: '--', result: 5.25, status: '停用', operator: '谭清辉', updatedAt: '2026-07-30 11:02' },
], 2)

const formatDirection = (direction) => direction.replace('->', '→')
const formatRate = (rate) => Number(rate).toFixed(6)
const simpleAction = (name) => ElMessage.success(`${name}已提交`)

async function removeBaseRate(row) {
  await ElMessageBox.confirm(`确认删除 ${formatDirection(row.direction)} 的基准汇率？`, '删除基准汇率', { type: 'warning' })
  baseRates.value.splice(baseRates.value.indexOf(row), 1)
  ElMessage.success('基准汇率已删除')
}

function viewCustomerRate(row) {
  ElMessage.info(`打开 ${row.customer} 的客户特调汇率明细`)
}
</script>

<template>
  <div class="module-page rate-config-page">
    <PageHeader>
      <template #actions>
        <el-button :icon="Download" @click="simpleAction('导入任务')">导入</el-button>
        <el-button :icon="RefreshRight" disabled>抓取</el-button>
        <el-button type="primary" :icon="Plus" @click="simpleAction('新增客户特调汇率')">添加</el-button>
      </template>
    </PageHeader>
    <div class="rate-config-grid">
      <section class="rate-panel base-rate-panel">
        <header class="rate-panel-head">
          <div>
            <h2>基准汇率表</h2>
            <p>维护外币到财务本位币的默认汇率</p>
          </div>
        </header>

        <div class="rate-table-frame">
          <el-table :data="baseRates" class="clean-table rate-table" border height="100%">
            <el-table-column label="货币对" min-width="130">
              <template #default="scope"><strong>{{ formatDirection(scope.row.direction) }}</strong></template>
            </el-table-column>
            <el-table-column label="汇率" width="112">
              <template #default="scope"><strong class="rate-value">{{ formatRate(scope.row.rate) }}</strong></template>
            </el-table-column>
            <el-table-column label="操作" width="64" fixed="right">
              <template #default="scope">
                <HoverActionMenu>
                  <el-dropdown-item :icon="EditPen" @click="simpleAction('汇率编辑')">编辑</el-dropdown-item>
                  <el-dropdown-item class="danger-action" :icon="Delete" @click="removeBaseRate(scope.row)">删除</el-dropdown-item>
                </HoverActionMenu>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <TablePagination :total="baseRates.length" :page-size="20" layout="prev, pager, next" />
      </section>

      <section class="rate-panel customer-rate-panel">
        <header class="rate-panel-head">
          <div>
            <h2>客户特调汇率</h2>
            <p>客户维度覆盖默认汇率</p>
          </div>
        </header>

        <div class="rate-table-frame">
          <el-table :data="customerRates" class="clean-table rate-table" border height="100%">
            <el-table-column prop="customerNo" label="客户编号" width="130" />
            <el-table-column prop="customer" label="客户名称" min-width="190" />
            <el-table-column prop="shop" label="所属店铺" min-width="150" />
            <el-table-column label="货币对" width="145">
              <template #default="scope"><strong>{{ formatDirection(scope.row.direction) }}</strong></template>
            </el-table-column>
            <el-table-column label="汇率" width="130">
              <template #default="scope"><strong class="rate-value">{{ formatRate(scope.row.result) }}</strong></template>
            </el-table-column>
            <el-table-column label="操作" width="90" fixed="right">
              <template #default="scope">
                <el-button class="table-detail-button" link type="primary" :icon="View" title="详情" aria-label="详情" @click="viewCustomerRate(scope.row)" />
              </template>
            </el-table-column>
          </el-table>
        </div>
        <TablePagination :total="customerRates.length" :page-size="20" layout="prev, pager, next" />
      </section>
    </div>
  </div>
</template>
