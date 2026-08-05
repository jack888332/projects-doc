<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Delete, Download, EditPen, Plus, RefreshRight, Search, Setting, Upload, View } from '@element-plus/icons-vue'
import MetricGrid from '../components/MetricGrid.vue'
import HoverActionMenu from '../components/HoverActionMenu.vue'
import ModuleToolbar from '../components/ModuleToolbar.vue'
import PageHeader from '../components/PageHeader.vue'
import StackedCell from '../components/StackedCell.vue'
import StatusTag from '../components/StatusTag.vue'
import { useDemoDataset } from '../data/useDemoDataset.js'

const props = defineProps({
  mode: { type: String, required: true },
  embedded: { type: Boolean, default: false },
})
const baseTab = ref('fees')
const query = reactive({ keyword: '', status: '', type: '', purpose: '', creator: '', dateRange: [] })
const detailVisible = ref(false)
const selectedAudit = ref(null)
const exportDetailVisible = ref(false)
const exportConfigVisible = ref(false)
const selectedExport = ref(null)
const migrationScopes = ref(['订单扩展', '费用明细'])
const migration = reactive({ sourceShop: '深圳集运店', sourceUser: 'U-700127', sourceMember: 'M-700127', sourceCustomer: 'OG4155', timeField: '订单创建时间', dateRange: ['2026-07-30', '2026-07-31'], orderNos: 'SO-260731-004188, SO-260731-004221', targetShop: '测试集运店', targetUser: 'TEST-U-001', targetMember: 'TEST-M-001', targetCustomer: 'TEST-C-001', warehouse: '测试一号仓', customerName: '迁移演示客户', shopName: '迁移演示店铺', testSourceTag: 'PROD_MIGRATION_20260802', suffix: '-MIG', batchSize: 500 })
const migrationPreviewReady = ref(false)
const migrationDone = ref(false)
const financeReportReady = ref(false)
const systemReportReady = ref(false)
const comparisonReady = ref(false)

const meta = computed(() => ({
  base: { eyebrow: 'BASE CONFIGURATION', title: '基础配置' },
  exports: { eyebrow: 'EXPORT JOBS', title: '导出管理' },
  audit: { eyebrow: 'AUDIT TRAIL', title: '内部审计' },
  compare: { eyebrow: 'REPORT RECONCILIATION', title: '报表比对' },
  migration: { eyebrow: 'TEST DATA MIGRATION', title: '数据迁移' },
}[props.mode]))

watch(() => props.mode, () => Object.assign(query, { keyword: '', status: '', type: '', purpose: '', creator: '', dateRange: [] }))

const feeRows = useDemoDataset('billingFeeItems', [
  { code: 'FREIGHT_BASE', name: '基础运费', type: '应收类', scenes: '集运订单、同行订单', object: '业务订单', sources: 'OFP订单费项', status: '启用', references: 8, integrity: '完整' },
  { code: 'COD_RETURN', name: '应返货款', type: '代付类', scenes: 'COD返款', object: '尾程包裹', sources: '订单费项报表', status: '启用', references: 4, integrity: '完整' },
  { code: 'COD_SERVICE', name: '代收服务费', type: '应收扣减类', scenes: 'COD返款', object: '尾程包裹', sources: 'OFP包裹费', status: '启用', references: 3, integrity: '完整' },
  { code: 'CLAIM_REFERENCE', name: '理赔参考金额', type: '非费项', scenes: '理赔核对', object: '业务订单', sources: '理赔单', status: '停用', references: 1, integrity: '待完善' },
])
const sceneRows = useDemoDataset('billingScenes', [
  { scene: '集运订单', fee: '基础运费', dataset: 'OFP_ORDER_FEE', table: 'sale_order_fee_detail', amountField: 'base_freight', currencyField: 'currency', timing: '跟随账单配置', priority: 10, status: '启用', integrity: '完整' },
  { scene: 'COD返款', fee: '应返货款', dataset: 'OFP_PACKAGE_FEE', table: 'sale_order_package_fee', amountField: 'recovery_money', currencyField: 'cod_currency', timing: '签收时间', priority: 10, status: '启用', integrity: '完整' },
  { scene: 'COD返款', fee: '代收服务费', dataset: 'OFP_PACKAGE_FEE', table: 'sale_order_package_fee', amountField: 'service_fee', currencyField: 'fee_currency', timing: '新增时间', priority: 20, status: '启用', integrity: '完整' },
])
const sourceRows = useDemoDataset('billingSources', [
  { code: 'OFP_ORDER_FEE', name: 'OFP订单费用数据集', system: 'OFP', database: 'ofp_ofdb1', table: 'sale_order_fee_detail', relation: 'sale_order_no', nodes: '出库、订单完结', timing: '履约节点', window: '账期 + 2天', pageSize: 1000, status: '启用', references: 12 },
  { code: 'OFP_PACKAGE_FEE', name: 'OFP包裹费用数据集', system: 'OFP', database: 'ofp_ofdb1', table: 'sale_order_package_fee', relation: 'tracking_no', nodes: '签收', timing: '签收/新增', window: '最近30天', pageSize: 1000, status: '启用', references: 6 },
  { code: 'OFP_CLAIM', name: 'OFP理赔数据集', system: 'OFP', database: 'ofp_ofdb1', table: 'claim_order', relation: 'sale_order_no', nodes: '理赔完成', timing: '理赔完成时间', window: '最近90天', pageSize: 500, status: '停用', references: 1 },
])
const templateRows = useDemoDataset('billingCurrencyTemplates', [
  { no: 'CUR-TPL-001', name: '欧美客户默认模板', default: 'USD', mapping: '基础运费→USD；操作费→USD；附加费→CNY', status: '启用', operator: '谭清辉', updatedAt: '2026-08-01 15:42' },
  { no: 'CUR-TPL-002', name: '英国客户模板', default: 'GBP', mapping: '全部应收费项→GBP', status: '启用', operator: '郑雅雯', updatedAt: '2026-07-28 11:05' },
])
const exportRows = useDemoDataset('billingExports', [
  { no: 'EXP-20260802-0018', billType: '应收账单', purpose: '导出给客户', fileType: '压缩包', bills: 8, processed: 8, success: 7, failed: 1, status: '部分成功', progress: 100, creator: '谭清辉', createdAt: '2026-08-02 10:02', finishedAt: '2026-08-02 10:05', expiresAt: '2026-08-03 10:05' },
  { no: 'EXP-20260802-0017', billType: '应收账单', purpose: '导出给内部', fileType: '表格文件', bills: 12, processed: 12, success: 12, failed: 0, status: '导出成功', progress: 100, creator: '郑雅雯', createdAt: '2026-08-02 09:46', finishedAt: '2026-08-02 09:48', expiresAt: '2026-08-03 09:48' },
  { no: 'EXP-20260802-0016', billType: '返款账单', purpose: '导出给客户', fileType: '表格文件', bills: 10, processed: 6, success: 6, failed: 0, status: '导出中', progress: 62, creator: '谭清辉', createdAt: '2026-08-02 09:31', finishedAt: '-', expiresAt: '-' },
  { no: 'EXP-20260802-0015', billType: '返款账单', purpose: '导出给客户', fileType: '压缩包', bills: 5, processed: 0, success: 0, failed: 0, status: '待执行', progress: 0, creator: '谭清辉', createdAt: '2026-08-02 09:26', finishedAt: '-', expiresAt: '-' },
  { no: 'EXP-20260801-0041', billType: '应收账单', purpose: '导出给客户', fileType: '压缩包', bills: 6, processed: 6, success: 0, failed: 6, status: '导出失败', progress: 100, creator: '郑雅雯', createdAt: '2026-08-01 17:10', finishedAt: '2026-08-01 17:12', expiresAt: '-' },
], 2)
const exportItems = useDemoDataset('billingExportItems', [
  { taskNo: 'EXP-20260802-0018', billNo: 'ARB-OG0370-20260707-81FF', result: '成功', output: '客户账单.xlsx', reason: '-' },
  { taskNo: 'EXP-20260802-0018', billNo: 'ARB-OG0271-20260731-81FF', result: '失败', output: '-', reason: '客户邮箱及导出通知信息不完整' },
  { taskNo: 'EXP-20260801-0041', billNo: 'ARB-OG0360-20260601-81FF', result: '失败', output: '-', reason: '费项明细文件生成失败' },
])
const auditRows = useDemoDataset('billingAudits', [
  { module: '账单配置', objectType: '客户账单配置', objectNo: 'BC-OG4155-AR@V13', action: '启用新版本', operator: '谭清辉', time: '2026-08-02 09:28:16', reason: '英国线路改为月结', result: '成功', relation: 'OG4155', impactCny: 0, impactUsd: 0, objectCount: 1, before: '{"version":"V12","status":"生效"}', after: '{"version":"V13","status":"生效"}' },
  { module: '应收账单', objectType: '应收账单', objectNo: 'ARB-TK9012-20260725-41b7', action: '审核通过', operator: '郑雅雯', time: '2026-08-02 09:14:08', reason: '金额与汇率核对完成', result: '成功', relation: 'TK9012', impactCny: 18.42, impactUsd: -2.56, objectCount: 1, before: '{"status":"待审核"}', after: '{"status":"待结清","notification":"已通知"}' },
  { module: '调账中心', objectType: '调账记录', objectNo: 'ADJ-c412-9071', action: '审核通过', operator: '陈嘉明', time: '2026-08-02 08:52:41', reason: '服务费率更正凭证有效', result: '成功', relation: 'RFB-TK9012-20260721-a11f', impactCny: 22.99, impactUsd: 3.2, objectCount: 2, before: '{"status":"待审核"}', after: '{"status":"审核通过"}' },
  { module: '汇率配置', objectType: '基准汇率', objectNo: 'CAD-CNY@20260802', action: '确认生效', operator: '谭清辉', time: '2026-08-02 08:40:03', reason: '汇率值超出允许范围', result: '阻断', relation: 'CAD/CNY', impactCny: 0, impactUsd: 0, objectCount: 1, before: '{}', after: '{}' },
], 2)
const compareRows = useDemoDataset('billingComparisons', [
  { order: 'SO-260731-004188', checkedAt: '2026-08-02 09:48', finance: true, system: true, financeFees: 8, systemFees: 8, financeFreight: 126.36, systemFreight: 126.36, financeSurcharge: 18, systemSurcharge: 18, currency: 'CNY' },
  { order: 'SO-260731-004221', checkedAt: '2026-08-02 09:42', finance: true, system: false, financeFees: 6, systemFees: 0, financeFreight: 421.8, systemFreight: null, financeSurcharge: 0, systemSurcharge: null, currency: 'USD' },
  { order: 'SO-260730-003952', checkedAt: '2026-08-01 17:20', finance: true, system: true, financeFees: 7, systemFees: 6, financeFreight: 198.5, systemFreight: 198.5, financeSurcharge: 18.5, systemSurcharge: 0, currency: 'CAD' },
  { order: 'SO-260730-003811', checkedAt: '2026-08-01 16:51', finance: false, system: true, financeFees: 0, systemFees: 5, financeFreight: null, systemFreight: 316, financeSurcharge: null, systemSurcharge: 0, currency: 'AUD' },
], 2)
const feeMappings = useDemoDataset('billingComparisonFeeMappings', [
  { finance: '基础运费', system: '基础运费' },
  { finance: '附加服务费', system: '派送附加费' },
  { finance: '操作服务费', system: '操作费' },
])
const migrationPreviewStats = useDemoDataset('billingMigrationPreviewStats', [
  { label: '来源订单', value: 2, tone: 'blue' },
  { label: '源扩展', value: 2, tone: 'slate' },
  { label: '源附加费', value: 6, tone: 'amber' },
  { label: '源包裹费', value: 8, tone: 'violet' },
  { label: '源费用明细', value: 36, tone: 'blue' },
  { label: '源理赔单', value: 1, tone: 'green' },
])
const migrationResultStats = useDemoDataset('billingMigrationResultStats', [
  { label: '已写入订单', value: '2', tone: 'green' },
  { label: '写入扩展 / 附加费', value: '2 / 6', tone: 'green' },
  { label: '写入包裹费 / 理赔', value: '8 / 1', tone: 'green' },
  { label: '费用明细成功 / 失败', value: '35 / 1', tone: 'red' },
])
const migrationResultRows = useDemoDataset('billingMigrationResults', [
  { object: '费用明细 FEE-260731-0098', result: '失败', reason: '目标费项编码不存在' },
  { object: '订单 SO-260731-004188-MIG', result: '成功', reason: '-' },
])

const filtered = computed(() => {
  const map = { fees: feeRows.value, scenes: sceneRows.value, sources: sourceRows.value, templates: templateRows.value }
  const source = props.mode === 'base' ? map[baseTab.value] : props.mode === 'exports' ? exportRows.value : props.mode === 'audit' ? auditRows.value : compareRows.value
  return source.filter((item) => { const text = JSON.stringify(item).toLowerCase(); return (!query.keyword || text.includes(query.keyword.toLowerCase())) && (!query.status || item.status === query.status) && (!query.type || item.module === query.type || item.billType === query.type) && (!query.purpose || item.purpose === query.purpose) && (!query.creator || item.creator === query.creator) })
})

function action(name) { ElMessage.success(`${name}已提交`) }
function openAudit(row) { selectedAudit.value = row; detailVisible.value = true }
function openExport(row) { selectedExport.value = row; exportDetailVisible.value = true }
function deleteExport(row) { exportRows.value.splice(exportRows.value.indexOf(row), 1); ElMessage.success('导出任务已删除') }
const selectedExportItems = computed(() => exportItems.value.filter((item) => item.taskNo === selectedExport.value?.no))
async function runMigration() { await ElMessageBox.confirm(`确认向测试环境同步订单主表及 ${migrationScopes.value.join('、')}，并重置同步数据的 BMS 标记？`, '执行数据迁移', { type: 'warning' }); migrationDone.value = true; ElMessage.success('数据迁移完成，1 条费用明细失败，其余数据已写入') }
function previewMigration() { migrationPreviewReady.value = true; migrationDone.value = false; ElMessage.success('预览已生成，尚未写入数据或重置 BMS 标记') }
function runComparison() { comparisonReady.value = true; ElMessage.success('比对结果已生成，仅并排展示两侧原始金额') }
</script>

<template>
  <div class="module-page">
    <PageHeader v-if="!embedded" :eyebrow="meta.eyebrow" :title="meta.title">
      <template #actions>
        <template v-if="mode === 'base'"><el-button :icon="Check">完整性检查</el-button><el-button type="primary" :icon="Plus" @click="action('新增配置')">新增</el-button></template>
        <template v-else-if="mode === 'exports'"><el-button :icon="Setting" @click="exportConfigVisible = true">对账报表配置</el-button><el-button type="primary" :icon="Plus" @click="action('新建导出任务')">新建导出</el-button></template>
        <template v-else-if="mode === 'audit'"><el-button :icon="Download" @click="action('审计导出任务')">导出审计结果</el-button></template>
        <template v-else-if="mode === 'compare'"><el-button :icon="Upload" @click="financeReportReady = true">上传财务侧报表</el-button><el-button :icon="Upload" @click="systemReportReady = true">上传系统侧报表</el-button><el-button type="primary" :icon="RefreshRight" :disabled="!financeReportReady || !systemReportReady" @click="runComparison">开始比对</el-button></template>
        <template v-else><el-button :icon="View" :disabled="!migrationScopes.length" @click="previewMigration">预览</el-button><el-button type="primary" :icon="RefreshRight" :disabled="!migrationPreviewReady" @click="runMigration">执行同步</el-button></template>
      </template>
    </PageHeader>
    <template v-if="mode === 'base'">
      <el-tabs v-model="baseTab" class="module-tabs"><el-tab-pane label="客户侧费项" name="fees" /><el-tab-pane label="按业务场景配置" name="scenes" /><el-tab-pane label="数据源规则" name="sources" /><el-tab-pane label="费项结算币种模板" name="templates" /></el-tabs>
      <section class="module-panel"><ModuleToolbar :result-text="`${filtered.length} 条配置`"><el-input v-model="query.keyword" :prefix-icon="Search" placeholder="编码 / 名称 / 场景 / 数据源" clearable class="module-search" /></ModuleToolbar>
        <el-table v-if="baseTab === 'fees'" :data="filtered" class="clean-table"><el-table-column prop="code" label="费项编码" width="150" /><el-table-column prop="name" label="费项名称" /><el-table-column prop="type" label="费用类型" /><el-table-column prop="scenes" label="场景标签" min-width="160" /><el-table-column prop="object" label="挂靠对象" /><el-table-column prop="sources" label="适用订单来源" /><el-table-column prop="status" label="状态" /><el-table-column prop="references" label="被引用场景数" /><el-table-column prop="integrity" label="配置完整性" /><el-table-column label="操作" width="64" fixed="right"><template #default><HoverActionMenu><el-dropdown-item :icon="EditPen" @click="action('编辑费项')">编辑</el-dropdown-item><el-dropdown-item @click="action('停用费项')">停用</el-dropdown-item></HoverActionMenu></template></el-table-column></el-table>
        <el-table v-else-if="baseTab === 'scenes'" :data="filtered" class="clean-table"><el-table-column prop="scene" label="业务场景" /><el-table-column prop="fee" label="费项名称" /><el-table-column prop="dataset" label="来源数据集" /><el-table-column prop="table" label="取值表" width="180" /><el-table-column prop="amountField" label="金额字段" /><el-table-column prop="currencyField" label="币种字段" /><el-table-column prop="timing" label="归集时间" /><el-table-column prop="priority" label="优先级" /><el-table-column prop="status" label="状态" /><el-table-column prop="integrity" label="配置完整性" /></el-table>
        <el-table v-else-if="baseTab === 'sources'" :data="filtered" class="clean-table"><el-table-column prop="code" label="数据集编码" /><el-table-column prop="name" label="名称" /><el-table-column prop="system" label="来源系统" /><el-table-column prop="database" label="来源库" /><el-table-column prop="table" label="主表" width="180" /><el-table-column prop="relation" label="关联关系" /><el-table-column prop="nodes" label="支持节点" /><el-table-column prop="timing" label="归集时间" /><el-table-column prop="window" label="查询窗口" /><el-table-column prop="pageSize" label="分页条数" /><el-table-column prop="status" label="状态" /><el-table-column prop="references" label="引用规则数" /></el-table>
        <el-table v-else :data="filtered" class="clean-table"><el-table-column prop="no" label="模板编号" /><el-table-column prop="name" label="模板名称" /><el-table-column prop="default" label="默认结算币种" /><el-table-column prop="mapping" label="费项币种映射" min-width="320" /><el-table-column prop="status" label="状态" /><el-table-column prop="operator" label="操作人" /><el-table-column prop="updatedAt" label="操作时间" /><el-table-column label="操作" width="64"><template #default><HoverActionMenu><el-dropdown-item :icon="EditPen" @click="action('编辑结算币种模板')">编辑</el-dropdown-item></HoverActionMenu></template></el-table-column></el-table>
      </section>
    </template>

    <template v-else-if="mode === 'exports'">
      <section class="module-panel"><ModuleToolbar :result-text="`${filtered.length} 个导出任务`"><el-input v-model="query.keyword" :prefix-icon="Search" placeholder="任务编号" clearable class="module-search" /><el-select v-model="query.type" placeholder="全部账单类型" clearable><el-option label="应收账单" value="应收账单" /><el-option label="返款账单" value="返款账单" /></el-select><el-select v-model="query.purpose" placeholder="全部导出用途" clearable><el-option label="导出给客户" value="导出给客户" /><el-option label="导出给内部" value="导出给内部" /></el-select><el-select v-model="query.status" placeholder="全部任务状态" clearable><el-option v-for="s in ['待执行','导出中','导出成功','部分成功','导出失败','已取消']" :key="s" :label="s" :value="s" /></el-select><el-select v-model="query.creator" placeholder="全部创建人" clearable><el-option label="谭清辉" value="谭清辉" /><el-option label="郑雅雯" value="郑雅雯" /></el-select><el-date-picker v-model="query.dateRange" type="daterange" start-placeholder="创建开始日" end-placeholder="创建结束日" /></ModuleToolbar>
        <el-table :data="filtered" class="clean-table"><el-table-column prop="no" label="任务编号" width="185" fixed /><el-table-column prop="billType" label="账单类型" /><el-table-column prop="purpose" label="导出用途" /><el-table-column prop="fileType" label="结果文件类型" /><el-table-column prop="bills" label="账单数量" /><el-table-column prop="success" label="成功数量" /><el-table-column prop="failed" label="失败数量" /><el-table-column label="任务状态"><template #default="scope"><StatusTag :label="scope.row.status" /></template></el-table-column><el-table-column label="导出进度" width="190"><template #default="scope"><StackedCell :primary="`${scope.row.processed} / ${scope.row.bills}`"><el-progress :percentage="scope.row.progress" :stroke-width="7" /></StackedCell></template></el-table-column><el-table-column prop="creator" label="创建人" /><el-table-column prop="createdAt" label="创建时间" width="155" /><el-table-column prop="finishedAt" label="完成时间" width="155" /><el-table-column prop="expiresAt" label="文件失效时间" width="155" /><el-table-column label="操作" width="112" fixed="right"><template #default="scope"><div class="row-action-cell"><el-button class="table-detail-button" link type="primary" :icon="View" title="详情" aria-label="详情" @click="openExport(scope.row)" /><HoverActionMenu v-if="scope.row.failed || ['导出成功','部分成功','待执行','导出失败','已取消'].includes(scope.row.status)"><el-dropdown-item v-if="['导出成功','部分成功'].includes(scope.row.status)" :icon="Download" @click="action('下载导出文件')">下载</el-dropdown-item><el-dropdown-item v-if="scope.row.failed" :icon="RefreshRight" @click="action('重试失败项')">重试失败项</el-dropdown-item><el-dropdown-item v-if="scope.row.status === '待执行'" class="danger-action" @click="action('取消导出任务')">取消</el-dropdown-item><el-dropdown-item v-if="['导出成功','部分成功','导出失败','已取消'].includes(scope.row.status)" class="danger-action" :icon="Delete" @click="deleteExport(scope.row)">删除</el-dropdown-item></HoverActionMenu></div></template></el-table-column></el-table>
      </section>
      <el-dialog v-model="exportDetailVisible" title="导出任务详情" width="820px" align-center><template v-if="selectedExport"><dl class="detail-grid"><div><dt>任务编号</dt><dd>{{ selectedExport.no }}</dd></div><div><dt>任务状态</dt><dd>{{ selectedExport.status }}</dd></div><div><dt>账单类型 / 用途</dt><dd>{{ selectedExport.billType }} / {{ selectedExport.purpose }}</dd></div><div><dt>处理进度</dt><dd>{{ selectedExport.processed }} / {{ selectedExport.bills }}（{{ selectedExport.progress }}%）</dd></div></dl><el-table :data="selectedExportItems" border><el-table-column prop="billNo" label="账单编号" width="230" /><el-table-column prop="result" label="导出结果" width="100" /><el-table-column prop="output" label="Sheet / 文件" width="180" /><el-table-column prop="reason" label="失败原因" min-width="220" /></el-table></template></el-dialog>
      <el-dialog v-model="exportConfigVisible" title="客户对账报表导出配置" width="760px" align-center><el-form label-width="140px"><el-form-item label="应收客户通知"><el-switch model-value active-text="启用" /></el-form-item><el-form-item label="返款客户通知"><el-switch model-value active-text="启用" /></el-form-item><el-form-item label="收款二维码"><el-input model-value="wechat-pay-og4155.png" /></el-form-item><el-form-item label="收款账户"><el-input model-value="招商银行深圳分行 7559 **** 1842" /></el-form-item></el-form><template #footer><el-button @click="exportConfigVisible=false">取消</el-button><el-button type="primary" @click="exportConfigVisible=false; action('对账报表配置')">保存</el-button></template></el-dialog>
    </template>

    <template v-else-if="mode === 'audit'">
      <section class="module-panel"><ModuleToolbar :result-text="`${filtered.length} 条审计记录`"><el-input v-model="query.keyword" :prefix-icon="Search" placeholder="对象编号 / 关联编号 / 操作人" clearable class="module-search" /><el-select v-model="query.type" placeholder="全部业务模块" clearable><el-option v-for="s in ['账单配置','应收账单','调账中心','汇率配置']" :key="s" :label="s" :value="s" /></el-select><el-date-picker type="daterange" start-placeholder="开始日期" end-placeholder="结束日期" /></ModuleToolbar>
        <el-table :data="filtered" class="clean-table"><el-table-column prop="module" label="业务模块" /><el-table-column prop="objectType" label="对象类型" /><el-table-column prop="objectNo" label="对象编号" width="220" /><el-table-column prop="action" label="操作类型" /><el-table-column prop="operator" label="操作人" /><el-table-column prop="time" label="操作时间" width="160" /><el-table-column prop="reason" label="操作原因" min-width="190" /><el-table-column label="执行结果"><template #default="scope"><StatusTag :label="scope.row.result" /></template></el-table-column><el-table-column prop="relation" label="关联编号" width="205" /><el-table-column label="操作" width="90" fixed="right"><template #default="scope"><el-button class="table-detail-button" link type="primary" :icon="View" title="详情" aria-label="详情" @click="openAudit(scope.row)" /></template></el-table-column></el-table>
      </section>
      <el-drawer v-model="detailVisible" size="760px" class="detail-drawer module-drawer"><template #header><div class="drawer-title"><span>审计详情</span><small>{{ selectedAudit?.objectNo }}</small></div></template><template v-if="selectedAudit"><dl class="detail-grid"><div><dt>业务模块</dt><dd>{{ selectedAudit.module }}</dd></div><div><dt>操作类型</dt><dd>{{ selectedAudit.action }}</dd></div><div><dt>操作人</dt><dd>{{ selectedAudit.operator }}</dd></div><div><dt>操作时间</dt><dd>{{ selectedAudit.time }}</dd></div><div><dt>执行结果</dt><dd>{{ selectedAudit.result }}</dd></div><div><dt>关联编号</dt><dd><el-button link type="primary" @click="action(`打开关联对象 ${selectedAudit.relation}`)">{{ selectedAudit.relation }}</el-button></dd></div><div class="span-2"><dt>操作原因</dt><dd>{{ selectedAudit.reason }}</dd></div></dl><MetricGrid class="inline" :columns="3" :items="[{ label: 'CNY 影响金额', value: selectedAudit.impactCny, tone: 'blue' }, { label: 'USD 影响金额', value: selectedAudit.impactUsd, tone: 'violet' }, { label: '关联对象数', value: selectedAudit.objectCount, tone: 'green' }]" /><div class="snapshot-compare"><div><h4>前值快照</h4><pre>{{ selectedAudit.before }}</pre></div><div><h4>后值快照</h4><pre>{{ selectedAudit.after }}</pre></div></div></template></el-drawer>
    </template>

    <template v-else-if="mode === 'compare'">
      <div class="compare-source-bar"><div><span>财务侧报表</span><strong>{{ financeReportReady ? '财务对账明细_20260802.xlsx' : '尚未上传' }}</strong></div><div><span>系统侧报表</span><strong>{{ systemReportReady ? 'BMS内部费项明细_20260802.xlsx' : '尚未上传' }}</strong></div></div>
      <section class="module-panel"><h3>费项映射</h3><el-table :data="feeMappings" border><el-table-column prop="finance" label="财务侧费项" /><el-table-column prop="system" label="系统侧费项" /><el-table-column label="操作" width="64"><template #default><HoverActionMenu><el-dropdown-item :icon="EditPen" @click="action('调整费项映射')">调整</el-dropdown-item></HoverActionMenu></template></el-table-column></el-table></section>
      <section class="module-panel"><el-alert v-if="comparisonReady" title="结果仅展示两侧报表原始金额，不校验币种、不换算金额，也不判定一致或差异。" type="info" :closable="false" /><el-table :data="comparisonReady ? filtered : []" class="clean-table"><el-table-column prop="order" label="业务订单号" width="165" fixed /><el-table-column prop="checkedAt" label="核重时间" width="155" /><el-table-column label="财务侧报表" width="100"><template #default="scope"><el-checkbox :model-value="scope.row.finance" disabled /></template></el-table-column><el-table-column label="系统侧报表" width="100"><template #default="scope"><el-checkbox :model-value="scope.row.system" disabled /></template></el-table-column><el-table-column prop="financeFees" label="财务侧费项数" width="115" /><el-table-column prop="systemFees" label="系统侧费项数" width="115" /><el-table-column label="基础运费（财务侧）" width="150" align="right"><template #default="scope">{{ scope.row.financeFreight === null ? '' : `${scope.row.financeFreight.toFixed(2)} ${scope.row.currency}` }}</template></el-table-column><el-table-column label="基础运费（系统侧）" width="150" align="right"><template #default="scope">{{ scope.row.systemFreight === null ? '' : `${scope.row.systemFreight.toFixed(2)} ${scope.row.currency}` }}</template></el-table-column><el-table-column label="派送附加费（财务侧）" width="170" align="right"><template #default="scope">{{ scope.row.financeSurcharge === null ? '' : `${scope.row.financeSurcharge.toFixed(2)} ${scope.row.currency}` }}</template></el-table-column><el-table-column label="派送附加费（系统侧）" width="170" align="right"><template #default="scope">{{ scope.row.systemSurcharge === null ? '' : `${scope.row.systemSurcharge.toFixed(2)} ${scope.row.currency}` }}</template></el-table-column></el-table></section>
    </template>

    <template v-else>
      <div class="environment-banner"><strong>测试环境</strong><span>预览不写入数据；执行仅写入目标测试客户，并重置同步数据的 BMS 计费 / 付款标记。</span></div>
      <section class="module-panel migration-panel">
        <h3>来源数据筛选</h3>
        <el-form label-position="top"><div class="form-grid"><el-form-item label="来源店铺"><el-input v-model="migration.sourceShop" /></el-form-item><el-form-item label="来源用户"><el-input v-model="migration.sourceUser" /></el-form-item><el-form-item label="来源会员"><el-input v-model="migration.sourceMember" /></el-form-item><el-form-item label="来源客户"><el-input v-model="migration.sourceCustomer" /></el-form-item><el-form-item label="订单时间字段"><el-select v-model="migration.timeField"><el-option label="订单创建时间" value="订单创建时间" /><el-option label="出库时间" value="出库时间" /><el-option label="订单完结时间" value="订单完结时间" /></el-select></el-form-item><el-form-item label="订单时间范围"><el-date-picker v-model="migration.dateRange" type="daterange" value-format="YYYY-MM-DD" /></el-form-item><el-form-item label="业务订单号" class="span-2"><el-input v-model="migration.orderNos" type="textarea" :rows="2" /></el-form-item></div></el-form>
        <h3>目标数据映射</h3>
        <el-form label-position="top"><div class="form-grid"><el-form-item label="目标店铺"><el-input v-model="migration.targetShop" /></el-form-item><el-form-item label="目标用户"><el-input v-model="migration.targetUser" /></el-form-item><el-form-item label="目标会员"><el-input v-model="migration.targetMember" /></el-form-item><el-form-item label="目标客户"><el-input v-model="migration.targetCustomer" /></el-form-item><el-form-item label="目标仓库"><el-input v-model="migration.warehouse" /></el-form-item><el-form-item label="客户名称"><el-input v-model="migration.customerName" /></el-form-item><el-form-item label="店铺名称"><el-input v-model="migration.shopName" /></el-form-item><el-form-item label="测试来源标记"><el-input v-model="migration.testSourceTag" /></el-form-item><el-form-item label="编号后缀"><el-input v-model="migration.suffix" /></el-form-item></div></el-form>
        <h3>同步范围与批次</h3>
        <el-checkbox-group v-model="migrationScopes"><el-checkbox-button v-for="s in ['订单扩展','附加费','包裹费','费用明细','理赔单']" :key="s" :value="s" /></el-checkbox-group><el-input-number v-model="migration.batchSize" :min="100" :max="2000" :step="100" controls-position="right" style="margin-left:var(--space-4)" />
        <template v-if="migrationPreviewReady"><h3>同步预览</h3><MetricGrid class="inline" :items="migrationPreviewStats" /><el-alert title="预览未写入目标环境，也未重置任何 BMS 标记。" type="info" :closable="false" /></template>
        <template v-if="migrationDone"><h3>同步结果</h3><MetricGrid class="inline" :items="migrationResultStats" /><dl class="detail-grid"><div><dt>来源筛选</dt><dd>{{ migration.sourceCustomer }} · {{ migration.orderNos }}</dd></div><div><dt>目标客户</dt><dd>{{ migration.targetCustomer }} · {{ migration.targetShop }}</dd></div><div class="span-2"><dt>同步后订单号</dt><dd>SO-260731-004188-MIG、SO-260731-004221-MIG</dd></div></dl><el-table :data="migrationResultRows" border><el-table-column prop="object" label="迁移对象" /><el-table-column prop="result" label="结果" /><el-table-column prop="reason" label="失败原因" /></el-table></template>
      </section>
    </template>
  </div>
</template>
