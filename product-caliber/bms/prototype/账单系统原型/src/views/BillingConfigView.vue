<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Clock, CopyDocument, EditPen, Plus, Search, View } from '@element-plus/icons-vue'
import PageHeader from '../components/PageHeader.vue'

const activeType = ref('AR')
const query = reactive({ keyword: '', status: '' })
const detailVisible = ref(false)
const editMode = ref(false)
const selectedConfig = ref(null)

const configs = ref([
  { type: 'AR', no: 'BC-OG4155-AR', customer: 'OceanGate Logistics', customerNo: 'OG4155', version: 'V13', status: '生效', effective: '2026-08-01 起', schemes: 3, cycle: '月', node: '订单完结', currency: 'GBP', updatedBy: '谭清辉', updatedAt: '2026-08-01 17:26', reason: '英国线路改用月结配置' },
  { type: 'AR', no: 'BC-TK9012-AR', customer: 'TopKing Supply', customerNo: 'TK9012', version: 'V8', status: '生效', effective: '2026-07-01 起', schemes: 1, cycle: '7自然天', node: '出库时间', currency: 'USD', updatedBy: '郑雅雯', updatedAt: '2026-07-28 09:13', reason: '调整信用期限' },
  { type: 'AR', no: 'BC-NW2048-AR', customer: 'NorthWind Cargo', customerNo: 'NW2048', version: 'V10', status: '待生效', effective: '2026-08-05 起', schemes: 2, cycle: '周', node: '订单完结', currency: 'CAD', updatedBy: '谭清辉', updatedAt: '2026-08-02 08:40', reason: '新增加拿大分支方案' },
  { type: 'RF', no: 'BC-OG4155-RF', customer: 'OceanGate Logistics', customerNo: 'OG4155', version: 'V5', status: '生效', effective: '2026-07-01 起', schemes: 1, cycle: '半周', node: '-', currency: 'GBP', mode: '回款返款', updatedBy: '谭清辉', updatedAt: '2026-07-30 16:08', reason: '调整返款比例' },
  { type: 'RF', no: 'BC-TK9012-RF', customer: 'TopKing Supply', customerNo: 'TK9012', version: 'V4', status: '生效', effective: '2026-06-01 起', schemes: 1, cycle: '周', node: '-', currency: 'USD', mode: '签收返款', updatedBy: '郑雅雯', updatedAt: '2026-07-21 11:19', reason: '更新收款账户' },
  { type: 'RF', no: 'BC-HL2388-RF', customer: 'Hualei Express', customerNo: 'HL2388', version: 'V7', status: '停用', effective: '2026-07-01 至 2026-07-31', schemes: 1, cycle: '周', node: '-', currency: 'AUD', mode: '回款返款', updatedBy: '谭清辉', updatedAt: '2026-08-01 10:02', reason: '合同到期' },
])

const rows = computed(() => configs.value.filter((item) => {
  const keyword = `${item.no}${item.customer}${item.customerNo}`.toLowerCase()
  return item.type === activeType.value && (!query.keyword || keyword.includes(query.keyword.toLowerCase())) && (!query.status || item.status === query.status)
}))

function openDetail(row, editable = false) {
  selectedConfig.value = row
  editMode.value = editable
  detailVisible.value = true
}

async function saveVersion() {
  await ElMessageBox.confirm('保存后形成新的配置版本，仅影响后续创建的任务。', '保存配置版本', { type: 'warning' })
  editMode.value = false
  ElMessage.success('新配置版本已保存并完成互斥校验')
}

function generate(row) {
  ElMessage.success(`已为 ${row.customer} 创建账单生成任务`)
}
</script>

<template>
  <div class="module-page">
    <PageHeader eyebrow="BILLING CONFIGURATION" title="账单配置">
      <template #actions><el-button :icon="CopyDocument">版本对比</el-button><el-button type="primary" :icon="Plus" @click="openDetail({type:activeType,no:'新配置',customer:'',customerNo:'',version:'待创建',status:'草稿',effective:'',schemes:1,cycle:'月',node:'订单完结',currency:'CNY',mode:'回款返款',updatedBy:'谭清辉',updatedAt:'-',reason:''}, true)">新增配置</el-button></template>
    </PageHeader>

    <div class="module-segmented"><button :class="{active: activeType === 'AR'}" @click="activeType = 'AR'">应收账单配置</button><button :class="{active: activeType === 'RF'}" @click="activeType = 'RF'">返款账单配置</button></div>

    <section class="module-panel">
      <div class="module-toolbar">
        <div class="module-filters"><el-input v-model="query.keyword" :prefix-icon="Search" placeholder="配置编号 / 客户名称 / 客户编码" clearable class="module-search" /><el-select v-model="query.status" placeholder="全部状态" clearable><el-option v-for="s in ['生效','待生效','停用']" :key="s" :label="s" :value="s" /></el-select></div>
        <span class="module-result-count">{{ rows.length }} 个客户配置</span>
      </div>
      <el-table :data="rows" class="clean-table" row-key="no">
        <el-table-column prop="no" label="配置编号" width="165" fixed /><el-table-column label="客户" min-width="190"><template #default="scope"><div class="main-cell"><strong>{{ scope.row.customer }}</strong><small>{{ scope.row.customerNo }}</small></div></template></el-table-column>
        <el-table-column prop="version" label="当前版本" width="85" /><el-table-column label="状态" width="88"><template #default="scope"><span :class="['status-tag', scope.row.status === '生效' ? 'success' : scope.row.status === '待生效' ? 'warning' : 'neutral']">{{ scope.row.status }}</span></template></el-table-column>
        <el-table-column prop="effective" label="生效周期" width="180" /><el-table-column prop="cycle" label="账期类型" width="100" /><el-table-column v-if="activeType === 'AR'" prop="node" label="履约节点" width="100" /><el-table-column v-else prop="mode" label="返款模式" width="105" />
        <el-table-column prop="schemes" label="方案数" width="75" align="right" /><el-table-column prop="currency" :label="activeType === 'AR' ? '默认结算币种' : '货款结算币种'" width="120" /><el-table-column label="最近操作" min-width="170"><template #default="scope"><div class="main-cell"><strong>{{ scope.row.updatedBy }}</strong><small>{{ scope.row.updatedAt }}</small></div></template></el-table-column>
        <el-table-column label="操作" width="250" fixed="right"><template #default="scope"><el-button link type="primary" :icon="View" @click="openDetail(scope.row)">详情</el-button><el-button link type="primary" :icon="EditPen" @click="openDetail(scope.row, true)">编辑</el-button><el-button link type="primary" :icon="Clock">版本</el-button><el-button v-if="scope.row.status === '生效'" link type="primary" @click="generate(scope.row)">生成账单</el-button></template></el-table-column>
      </el-table>
    </section>

    <el-drawer v-model="detailVisible" size="820px" class="detail-drawer module-drawer">
      <template #header><div class="drawer-title"><span>{{ editMode ? '编辑账单配置' : '账单配置详情' }}</span><small>{{ selectedConfig?.no }} · {{ selectedConfig?.version }}</small></div></template>
      <template v-if="selectedConfig">
        <div class="config-version-bar"><span :class="['status-tag', selectedConfig.status === '生效' ? 'success' : 'warning']">{{ selectedConfig.status }}</span><strong>{{ selectedConfig.customer || '请选择客户' }}</strong><el-button v-if="editMode" type="primary" @click="saveVersion">保存新版本</el-button></div>
        <el-tabs>
          <el-tab-pane label="版本信息">
            <el-form label-position="top" class="form-grid"><el-form-item label="客户"><el-input v-model="selectedConfig.customer" :disabled="!editMode" /></el-form-item><el-form-item label="生效周期"><el-input v-model="selectedConfig.effective" :disabled="!editMode" /></el-form-item><el-form-item label="变更原因" class="span-2"><el-input v-model="selectedConfig.reason" type="textarea" :disabled="!editMode" /></el-form-item></el-form>
          </el-tab-pane>
          <el-tab-pane :label="activeType === 'AR' ? '默认方案' : '返款条款'">
            <el-form label-position="top" class="form-grid"><el-form-item label="账期类型"><el-select v-model="selectedConfig.cycle" :disabled="!editMode"><el-option v-for="v in (activeType === 'AR' ? ['周','7自然天','月'] : ['周','半周'])" :key="v" :label="v" :value="v" /></el-select></el-form-item><el-form-item v-if="activeType === 'AR'" label="履约节点"><el-select v-model="selectedConfig.node" :disabled="!editMode"><el-option label="出库时间" value="出库时间" /><el-option label="订单完结" value="订单完结" /></el-select></el-form-item><el-form-item v-else label="返款模式"><el-select v-model="selectedConfig.mode" :disabled="!editMode"><el-option label="回款返款" value="回款返款" /><el-option label="签收返款" value="签收返款" /></el-select></el-form-item><el-form-item label="结算币种"><el-select v-model="selectedConfig.currency" :disabled="!editMode"><el-option v-for="v in ['CNY','USD','GBP','CAD','AUD']" :key="v" :label="v" :value="v" /></el-select></el-form-item><el-form-item v-if="activeType === 'AR'" label="信用期限"><el-input model-value="15天" :disabled="!editMode" /></el-form-item><el-form-item v-else label="实返货款比例"><el-input model-value="100%" :disabled="!editMode" /></el-form-item><el-form-item label="账单发出时间"><el-input model-value="账期结束次日 09:00" :disabled="!editMode" /></el-form-item><el-form-item label="合同信息"><el-input model-value="合同主协议 2026-A" :disabled="!editMode" /></el-form-item></el-form>
          </el-tab-pane>
          <el-tab-pane v-if="activeType === 'AR'" label="分支方案与限定情形">
            <el-table :data="[{name:'英国线路',country:'英国',warehouse:'深圳仓',sector:'集运',cycle:'月'},{name:'美国线路',country:'美国',warehouse:'义乌仓',sector:'集运',cycle:'7自然天'}]" class="clean-table"><el-table-column prop="name" label="方案名称" /><el-table-column prop="country" label="运抵国" /><el-table-column prop="warehouse" label="集运仓" /><el-table-column prop="sector" label="业务板块" /><el-table-column prop="cycle" label="账期" /></el-table>
          </el-tab-pane>
          <el-tab-pane label="费项结算币种"><el-table :data="[{fee:'基础运费',default:'USD',specified:'GBP'},{fee:'操作费',default:'USD',specified:'GBP'},{fee:'附加费',default:'CNY',specified:'GBP'}]" class="clean-table"><el-table-column prop="fee" label="费项" /><el-table-column prop="default" label="费项默认结算币种" /><el-table-column prop="specified" label="费项指定结算币种" /></el-table></el-tab-pane>
        </el-tabs>
      </template>
    </el-drawer>
  </div>
</template>
