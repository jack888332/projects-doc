<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Delete, Download, EditPen, Plus, RefreshRight, Search, Setting, Upload, View } from '@element-plus/icons-vue'
import PageHeader from '../components/PageHeader.vue'

const props = defineProps({ mode: { type: String, required: true } })
const baseTab = ref('fees')
const query = reactive({ keyword: '', status: '', type: '' })
const detailVisible = ref(false)
const selectedAudit = ref(null)
const migrationScopes = ref(['订单主表', '订单扩展', '费用明细'])
const comparisonReady = ref(false)

const meta = computed(() => ({
  base: { eyebrow: 'BASE CONFIGURATION', title: '基础配置' },
  exports: { eyebrow: 'EXPORT JOBS', title: '导出管理' },
  audit: { eyebrow: 'AUDIT TRAIL', title: '内部审计' },
  compare: { eyebrow: 'REPORT RECONCILIATION', title: '报表比对' },
  migration: { eyebrow: 'TEST DATA MIGRATION', title: '数据迁移' },
}[props.mode]))

const feeRows = ref([
  { code: 'FREIGHT_BASE', name: '基础运费', type: '应收类', scenes: '集运订单、同行订单', object: '业务订单', sources: 'OFP订单费项', status: '启用', references: 8, integrity: '完整' },
  { code: 'COD_RETURN', name: '应返货款', type: '代付类', scenes: 'COD返款', object: '尾程包裹', sources: '订单费项报表', status: '启用', references: 4, integrity: '完整' },
  { code: 'COD_SERVICE', name: '代收服务费', type: '应收扣减类', scenes: 'COD返款', object: '尾程包裹', sources: 'OFP包裹费', status: '启用', references: 3, integrity: '完整' },
  { code: 'CLAIM_REFERENCE', name: '理赔参考金额', type: '非费项', scenes: '理赔核对', object: '业务订单', sources: '理赔单', status: '停用', references: 1, integrity: '待完善' },
])
const sceneRows = ref([
  { scene: '集运订单', fee: '基础运费', dataset: 'OFP_ORDER_FEE', table: 'sale_order_fee_detail', amountField: 'base_freight', currencyField: 'currency', timing: '跟随账单配置', priority: 10, status: '启用', integrity: '完整' },
  { scene: 'COD返款', fee: '应返货款', dataset: 'OFP_PACKAGE_FEE', table: 'sale_order_package_fee', amountField: 'recovery_money', currencyField: 'cod_currency', timing: '签收时间', priority: 10, status: '启用', integrity: '完整' },
  { scene: 'COD返款', fee: '代收服务费', dataset: 'OFP_PACKAGE_FEE', table: 'sale_order_package_fee', amountField: 'service_fee', currencyField: 'fee_currency', timing: '新增时间', priority: 20, status: '启用', integrity: '完整' },
])
const sourceRows = ref([
  { code: 'OFP_ORDER_FEE', name: 'OFP订单费用数据集', system: 'OFP', database: 'ofp_ofdb1', table: 'sale_order_fee_detail', relation: 'sale_order_no', nodes: '出库、订单完结', timing: '履约节点', window: '账期 + 2天', pageSize: 1000, status: '启用', references: 12 },
  { code: 'OFP_PACKAGE_FEE', name: 'OFP包裹费用数据集', system: 'OFP', database: 'ofp_ofdb1', table: 'sale_order_package_fee', relation: 'tracking_no', nodes: '签收', timing: '签收/新增', window: '最近30天', pageSize: 1000, status: '启用', references: 6 },
  { code: 'OFP_CLAIM', name: 'OFP理赔数据集', system: 'OFP', database: 'ofp_ofdb1', table: 'claim_order', relation: 'sale_order_no', nodes: '理赔完成', timing: '理赔完成时间', window: '最近90天', pageSize: 500, status: '停用', references: 1 },
])
const templateRows = ref([
  { no: 'CUR-TPL-001', name: '欧美客户默认模板', default: 'USD', mapping: '基础运费→USD；操作费→USD；附加费→CNY', status: '启用', operator: '谭清辉', updatedAt: '2026-08-01 15:42' },
  { no: 'CUR-TPL-002', name: '英国客户模板', default: 'GBP', mapping: '全部应收费项→GBP', status: '启用', operator: '郑雅雯', updatedAt: '2026-07-28 11:05' },
])
const exportRows = ref([
  { no: 'EXP-20260802-0018', billType: '应收账单', purpose: '导出给客户', fileType: '压缩包', bills: 8, success: 7, failed: 1, status: '部分成功', progress: 100, creator: '谭清辉', createdAt: '2026-08-02 10:02', finishedAt: '2026-08-02 10:05', expiresAt: '2026-08-03 10:05' },
  { no: 'EXP-20260802-0017', billType: '应收账单', purpose: '导出给内部', fileType: '表格文件', bills: 12, success: 12, failed: 0, status: '导出成功', progress: 100, creator: '郑雅雯', createdAt: '2026-08-02 09:46', finishedAt: '2026-08-02 09:48', expiresAt: '2026-08-03 09:48' },
  { no: 'EXP-20260802-0016', billType: '返款账单', purpose: '导出给客户', fileType: '表格文件', bills: 1, success: 0, failed: 0, status: '导出中', progress: 62, creator: '谭清辉', createdAt: '2026-08-02 09:31', finishedAt: '-', expiresAt: '-' },
  { no: 'EXP-20260802-0015', billType: '返款账单', purpose: '导出给客户', fileType: '压缩包', bills: 5, success: 0, failed: 0, status: '待执行', progress: 0, creator: '谭清辉', createdAt: '2026-08-02 09:26', finishedAt: '-', expiresAt: '-' },
  { no: 'EXP-20260801-0041', billType: '应收账单', purpose: '导出给客户', fileType: '压缩包', bills: 6, success: 0, failed: 6, status: '导出失败', progress: 100, creator: '郑雅雯', createdAt: '2026-08-01 17:10', finishedAt: '2026-08-01 17:12', expiresAt: '-' },
])
const auditRows = ref([
  { module: '账单配置', objectType: '客户账单配置', objectNo: 'BC-OG4155-AR@V13', action: '启用新版本', operator: '谭清辉', time: '2026-08-02 09:28:16', reason: '英国线路改为月结', result: '成功', relation: 'OG4155', before: '{"version":"V12","status":"生效"}', after: '{"version":"V13","status":"生效"}' },
  { module: '应收账单', objectType: '应收账单', objectNo: 'ARB-TK9012-20260725-41b7', action: '审核通过', operator: '郑雅雯', time: '2026-08-02 09:14:08', reason: '金额与汇率核对完成', result: '成功', relation: 'TK9012', before: '{"status":"待审核"}', after: '{"status":"待结清","notification":"已通知"}' },
  { module: '调账中心', objectType: '调账记录', objectNo: 'ADJ-c412-9071', action: '审核通过', operator: '陈嘉明', time: '2026-08-02 08:52:41', reason: '服务费率更正凭证有效', result: '成功', relation: 'RFB-TK9012-20260721-a11f', before: '{"status":"待审核"}', after: '{"status":"审核通过"}' },
  { module: '汇率配置', objectType: '基准汇率', objectNo: 'CAD-CNY@20260802', action: '确认生效', operator: '谭清辉', time: '2026-08-02 08:40:03', reason: '汇率值超出允许范围', result: '阻断', relation: 'CAD/CNY', before: '{}', after: '{}' },
])
const compareRows = ref([
  { order: 'SO-260731-004188', finance: true, system: true, result: '一致', financeFees: 8, systemFees: 8, diff: '0.00 CNY' },
  { order: 'SO-260731-004221', finance: true, system: false, result: '系统侧缺单', financeFees: 6, systemFees: 0, diff: '421.80 USD' },
  { order: 'SO-260730-003952', finance: true, system: true, result: '费项差异', financeFees: 7, systemFees: 6, diff: '18.50 CAD' },
  { order: 'SO-260730-003811', finance: false, system: true, result: '财务侧缺单', financeFees: 0, systemFees: 5, diff: '316.00 AUD' },
])

const filtered = computed(() => {
  const map = { fees: feeRows.value, scenes: sceneRows.value, sources: sourceRows.value, templates: templateRows.value }
  const source = props.mode === 'base' ? map[baseTab.value] : props.mode === 'exports' ? exportRows.value : props.mode === 'audit' ? auditRows.value : compareRows.value
  return source.filter((item) => { const text = JSON.stringify(item).toLowerCase(); return (!query.keyword || text.includes(query.keyword.toLowerCase())) && (!query.status || item.status === query.status) && (!query.type || item.module === query.type || item.billType === query.type) })
})

const exportStatusClass = (status) => status === '导出成功' ? 'success' : status === '部分成功' ? 'warning' : status === '导出失败' ? 'danger' : status === '导出中' ? 'running' : 'info'
function action(name) { ElMessage.success(`${name}已提交`) }
function openAudit(row) { selectedAudit.value = row; detailVisible.value = true }
async function runMigration() { await ElMessageBox.confirm(`确认向测试环境同步 ${migrationScopes.value.join('、')}？`, '执行数据迁移', { type: 'warning' }); ElMessage.success('同步任务已创建') }
</script>

<template>
  <div class="module-page">
    <PageHeader :eyebrow="meta.eyebrow" :title="meta.title">
      <template #actions>
        <template v-if="mode === 'base'"><el-button :icon="Check">完整性检查</el-button><el-button type="primary" :icon="Plus" @click="action('新增配置')">新增</el-button></template>
        <template v-else-if="mode === 'exports'"><el-button :icon="Setting" @click="action('打开对账报表导出配置')">对账报表配置</el-button><el-button type="primary" :icon="Plus" @click="action('新建导出任务')">新建导出</el-button></template>
        <template v-else-if="mode === 'audit'"><el-button :icon="Download" @click="action('审计导出任务')">导出审计结果</el-button></template>
        <template v-else-if="mode === 'compare'"><el-button :icon="Upload" @click="comparisonReady = true">上传财务侧报表</el-button><el-button type="primary" :icon="RefreshRight" @click="comparisonReady = true">开始比对</el-button></template>
        <template v-else><el-button type="primary" :icon="RefreshRight" :disabled="!migrationScopes.length" @click="runMigration">执行同步</el-button></template>
      </template>
    </PageHeader>

    <template v-if="mode === 'base'">
      <el-tabs v-model="baseTab" class="module-tabs"><el-tab-pane label="客户侧费项" name="fees" /><el-tab-pane label="按业务场景配置" name="scenes" /><el-tab-pane label="数据源规则" name="sources" /><el-tab-pane label="费项结算币种模板" name="templates" /></el-tabs>
      <section class="module-panel"><div class="module-toolbar"><div class="module-filters"><el-input v-model="query.keyword" :prefix-icon="Search" placeholder="编码 / 名称 / 场景 / 数据源" clearable class="module-search" /></div><span class="module-result-count">{{ filtered.length }} 条配置</span></div>
        <el-table v-if="baseTab === 'fees'" :data="filtered" class="clean-table"><el-table-column prop="code" label="费项编码" width="150" /><el-table-column prop="name" label="费项名称" /><el-table-column prop="type" label="费用类型" /><el-table-column prop="scenes" label="场景标签" min-width="160" /><el-table-column prop="object" label="挂靠对象" /><el-table-column prop="sources" label="适用订单来源" /><el-table-column prop="status" label="状态" /><el-table-column prop="references" label="被引用场景数" /><el-table-column prop="integrity" label="配置完整性" /><el-table-column label="操作" fixed="right"><template #default><el-button link type="primary" :icon="EditPen">编辑</el-button><el-button link type="warning">停用</el-button></template></el-table-column></el-table>
        <el-table v-else-if="baseTab === 'scenes'" :data="filtered" class="clean-table"><el-table-column prop="scene" label="业务场景" /><el-table-column prop="fee" label="费项名称" /><el-table-column prop="dataset" label="来源数据集" /><el-table-column prop="table" label="取值表" width="180" /><el-table-column prop="amountField" label="金额字段" /><el-table-column prop="currencyField" label="币种字段" /><el-table-column prop="timing" label="归集时间" /><el-table-column prop="priority" label="优先级" /><el-table-column prop="status" label="状态" /><el-table-column prop="integrity" label="配置完整性" /></el-table>
        <el-table v-else-if="baseTab === 'sources'" :data="filtered" class="clean-table"><el-table-column prop="code" label="数据集编码" /><el-table-column prop="name" label="名称" /><el-table-column prop="system" label="来源系统" /><el-table-column prop="database" label="来源库" /><el-table-column prop="table" label="主表" width="180" /><el-table-column prop="relation" label="关联关系" /><el-table-column prop="nodes" label="支持节点" /><el-table-column prop="timing" label="归集时间" /><el-table-column prop="window" label="查询窗口" /><el-table-column prop="pageSize" label="分页条数" /><el-table-column prop="status" label="状态" /><el-table-column prop="references" label="引用规则数" /></el-table>
        <el-table v-else :data="filtered" class="clean-table"><el-table-column prop="no" label="模板编号" /><el-table-column prop="name" label="模板名称" /><el-table-column prop="default" label="默认结算币种" /><el-table-column prop="mapping" label="费项币种映射" min-width="320" /><el-table-column prop="status" label="状态" /><el-table-column prop="operator" label="操作人" /><el-table-column prop="updatedAt" label="操作时间" /><el-table-column label="操作"><template #default><el-button link type="primary" :icon="EditPen">编辑</el-button></template></el-table-column></el-table>
      </section>
    </template>

    <template v-else-if="mode === 'exports'">
      <section class="module-panel"><div class="module-toolbar"><div class="module-filters"><el-input v-model="query.keyword" :prefix-icon="Search" placeholder="任务编号 / 创建人" clearable class="module-search" /><el-select v-model="query.type" placeholder="全部账单类型" clearable><el-option label="应收账单" value="应收账单" /><el-option label="返款账单" value="返款账单" /></el-select><el-select v-model="query.status" placeholder="全部任务状态" clearable><el-option v-for="s in ['待执行','导出中','导出成功','部分成功','导出失败','已取消']" :key="s" :label="s" :value="s" /></el-select></div><span class="module-result-count">{{ filtered.length }} 个导出任务</span></div>
        <el-table :data="filtered" class="clean-table"><el-table-column prop="no" label="任务编号" width="185" fixed /><el-table-column prop="billType" label="账单类型" /><el-table-column prop="purpose" label="导出用途" /><el-table-column prop="fileType" label="结果文件类型" /><el-table-column prop="bills" label="账单数量" /><el-table-column prop="success" label="成功数量" /><el-table-column prop="failed" label="失败数量" /><el-table-column label="任务状态"><template #default="scope"><span :class="['status-tag', exportStatusClass(scope.row.status)]">{{ scope.row.status }}</span></template></el-table-column><el-table-column label="导出进度" width="150"><template #default="scope"><el-progress :percentage="scope.row.progress" :stroke-width="7" /></template></el-table-column><el-table-column prop="creator" label="创建人" /><el-table-column prop="createdAt" label="创建时间" width="155" /><el-table-column prop="finishedAt" label="完成时间" width="155" /><el-table-column prop="expiresAt" label="文件失效时间" width="155" /><el-table-column label="操作" width="190" fixed="right"><template #default="scope"><el-button link type="primary" :icon="View">详情</el-button><el-button v-if="['导出成功','部分成功'].includes(scope.row.status)" link type="primary" :icon="Download">下载</el-button><el-button v-if="scope.row.failed" link type="warning" :icon="RefreshRight">重试失败项</el-button><el-button v-if="scope.row.status === '待执行'" link type="danger">取消</el-button></template></el-table-column></el-table>
      </section>
    </template>

    <template v-else-if="mode === 'audit'">
      <section class="module-panel"><div class="module-toolbar"><div class="module-filters"><el-input v-model="query.keyword" :prefix-icon="Search" placeholder="对象编号 / 关联编号 / 操作人" clearable class="module-search" /><el-select v-model="query.type" placeholder="全部业务模块" clearable><el-option v-for="s in ['账单配置','应收账单','调账中心','汇率配置']" :key="s" :label="s" :value="s" /></el-select><el-date-picker type="daterange" start-placeholder="开始日期" end-placeholder="结束日期" /></div><span class="module-result-count">{{ filtered.length }} 条审计记录</span></div>
        <el-table :data="filtered" class="clean-table"><el-table-column prop="module" label="业务模块" /><el-table-column prop="objectType" label="对象类型" /><el-table-column prop="objectNo" label="对象编号" width="220" /><el-table-column prop="action" label="操作类型" /><el-table-column prop="operator" label="操作人" /><el-table-column prop="time" label="操作时间" width="160" /><el-table-column prop="reason" label="操作原因" min-width="190" /><el-table-column label="执行结果"><template #default="scope"><span :class="['status-tag', scope.row.result === '成功' ? 'success' : 'danger']">{{ scope.row.result }}</span></template></el-table-column><el-table-column prop="relation" label="关联编号" width="205" /><el-table-column label="操作" width="90" fixed="right"><template #default="scope"><el-button link type="primary" :icon="View" @click="openAudit(scope.row)">详情</el-button></template></el-table-column></el-table>
      </section>
      <el-drawer v-model="detailVisible" size="760px" class="detail-drawer module-drawer"><template #header><div class="drawer-title"><span>审计详情</span><small>{{ selectedAudit?.objectNo }}</small></div></template><template v-if="selectedAudit"><dl class="detail-grid"><div><dt>业务模块</dt><dd>{{ selectedAudit.module }}</dd></div><div><dt>操作类型</dt><dd>{{ selectedAudit.action }}</dd></div><div><dt>操作人</dt><dd>{{ selectedAudit.operator }}</dd></div><div><dt>操作时间</dt><dd>{{ selectedAudit.time }}</dd></div><div class="span-2"><dt>操作原因</dt><dd>{{ selectedAudit.reason }}</dd></div></dl><div class="snapshot-compare"><div><h4>前值快照</h4><pre>{{ selectedAudit.before }}</pre></div><div><h4>后值快照</h4><pre>{{ selectedAudit.after }}</pre></div></div></template></el-drawer>
    </template>

    <template v-else-if="mode === 'compare'">
      <div class="compare-source-bar"><div><span>财务侧报表</span><strong>{{ comparisonReady ? '财务对账明细_20260802.xlsx' : '尚未上传' }}</strong></div><div><span>系统侧范围</span><strong>2026-07-01 至 2026-07-31 · 应收账单</strong></div></div>
      <section class="module-panel"><div class="module-kpis four inline"><div class="module-kpi blue"><span>比对订单</span><strong>4</strong></div><div class="module-kpi green"><span>一致</span><strong>1</strong></div><div class="module-kpi red"><span>缺单</span><strong>2</strong></div><div class="module-kpi amber"><span>费项差异</span><strong>1</strong></div></div><el-table :data="filtered" class="clean-table"><el-table-column prop="order" label="业务订单号" /><el-table-column label="财务侧报表"><template #default="scope"><el-checkbox :model-value="scope.row.finance" disabled /></template></el-table-column><el-table-column label="系统侧报表"><template #default="scope"><el-checkbox :model-value="scope.row.system" disabled /></template></el-table-column><el-table-column prop="financeFees" label="财务侧费项数" /><el-table-column prop="systemFees" label="系统侧费项数" /><el-table-column prop="diff" label="金额差异" /><el-table-column label="比对结果"><template #default="scope"><span :class="['status-tag', scope.row.result === '一致' ? 'success' : scope.row.result.includes('缺单') ? 'danger' : 'warning']">{{ scope.row.result }}</span></template></el-table-column></el-table></section>
    </template>

    <template v-else>
      <div class="environment-banner"><strong>测试环境</strong><span>数据迁移只同步指定生产数据，不同步账号密码，并与正式账单及审计隔离。</span></div>
      <section class="module-panel migration-panel"><h3>同步范围</h3><el-checkbox-group v-model="migrationScopes"><el-checkbox-button v-for="s in ['订单主表','订单扩展','附加费','包裹费','费用明细','理赔单']" :key="s" :value="s" /></el-checkbox-group><h3>目标对象</h3><div class="form-grid"><el-input placeholder="业务订单号，多个用逗号分隔" model-value="SO-260731-004188, SO-260731-004221" /><el-select model-value="OFP生产库"><el-option label="OFP生产库" value="OFP生产库" /></el-select></div><h3>同步预览</h3><div class="module-kpis four inline"><div class="module-kpi blue"><span>来源订单</span><strong>2</strong></div><div class="module-kpi slate"><span>源扩展</span><strong>2</strong></div><div class="module-kpi violet"><span>源费用明细</span><strong>36</strong></div><div class="module-kpi green"><span>预计写入</span><strong>40</strong></div></div></section>
    </template>
  </div>
</template>
