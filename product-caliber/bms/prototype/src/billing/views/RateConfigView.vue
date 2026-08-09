<script setup>
import { ElMessage } from 'element-plus/es/components/message/index.mjs'
import { ElMessageBox } from 'element-plus/es/components/message-box/index.mjs'
import { Delete, Download, EditPen, Plus, RefreshRight, View } from '@element-plus/icons-vue'
import HoverActionMenu from '../../shared/components/HoverActionMenu.vue'
import DataTableFrame from '../../shared/components/DataTableFrame.vue'
import { billingBaseRateFixtures, billingCustomerRateFixtures } from '../../data/fixtures/billingRates.ts'
import { useDemoDataset } from '../data/useDemoDataset.js'

const baseRates = useDemoDataset('billingBaseRates', billingBaseRateFixtures)

const customerRates = useDemoDataset('billingCustomerRates', billingCustomerRateFixtures, 2)

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
    <div class="rate-config-grid">
      <section class="rate-panel base-rate-panel">
        <header class="rate-panel-head">
          <div>
            <h2>基准汇率表</h2>
            <p>维护外币到财务本位币的默认汇率</p>
          </div>
          <div class="rate-panel-actions"><el-button :icon="Download" @click="simpleAction('导入任务')">导入</el-button><el-button :icon="RefreshRight" disabled>抓取</el-button></div>
        </header>

        <DataTableFrame class="rate-table-frame" :total="baseRates.length" :page-size="20">
<el-table :data="baseRates" class="clean-table rate-table" border height="100%">
            <el-table-column label="货币对" min-width="130">
              <template #default="scope"><strong>{{ formatDirection(scope.row.direction) }}</strong></template>
            </el-table-column>
            <el-table-column label="汇率" width="112">
              <template #default="scope"><strong class="rate-value">{{ formatRate(scope.row.rate) }}</strong></template>
            </el-table-column>
            <el-table-column label="操作" width="64">
              <template #default="scope">
                <HoverActionMenu>
                  <el-dropdown-item :icon="EditPen" @click="simpleAction('汇率编辑')">编辑</el-dropdown-item>
                  <el-dropdown-item class="danger-action" :icon="Delete" @click="removeBaseRate(scope.row)">删除</el-dropdown-item>
                </HoverActionMenu>
              </template>
            </el-table-column>
          </el-table>
        </DataTableFrame>
      </section>

      <section class="rate-panel customer-rate-panel">
        <header class="rate-panel-head">
          <div>
            <h2>客户特调汇率</h2>
            <p>客户维度覆盖默认汇率</p>
          </div>
          <div class="rate-panel-actions"><el-button type="primary" :icon="Plus" @click="simpleAction('新增客户特调汇率')">添加</el-button></div>
        </header>

        <DataTableFrame class="rate-table-frame" :total="customerRates.length" :page-size="20">
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
        </DataTableFrame>
      </section>
    </div>
  </div>
</template>
