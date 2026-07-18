<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { CircleCheck, Document, MagicStick, Refresh, UploadFilled, Warning } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { suppliers } from '../data'

const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue'])
const active = ref(0)
const identifying = ref(false)
const submitting = ref(false)
const showIssuesOnly = ref(false)
const fileInput = ref()

const form = reactive({
  supplier: 'SUP-DF-001', module: '派送成本', period: ['2026-07-01', '2026-07-15'], currency: 'TWD',
  file: '台湾端派送（东风.xlsx', sheet: '東風', headerRow: 1, settleStatus: '待结清', duplicateConfirmed: false,
})

const mappings = reactive([
  { role: '关键单号', source: '追蹤號', meaning: '尾程运单号', confidence: 98, required: true },
  { role: '成本费项', source: '運費', meaning: '派送费', confidence: 96, required: true },
  { role: '成本费项', source: '拖車及疊貨費', meaning: '派送附加费', confidence: 91, required: false },
  { role: '币种', source: '未提供', meaning: '使用供应商默认币种 TWD', confidence: 100, required: true },
  { role: '业务辅助字段', source: '重量', meaning: '重量', confidence: 89, required: false },
  { role: '业务辅助字段', source: '司機', meaning: '承运商', confidence: 82, required: false },
])

const previewRows = ref([
  { row: 2, key: 'LWD032402', rawItem: '運費', item: '派送费', amount: '1,050.000', currency: 'TWD', type: '直接成本', match: '尾程包裹 LWD032402', issue: '' },
  { row: 2, key: 'LWD032402', rawItem: '拖車及疊貨費', item: '派送附加费', amount: '18.400', currency: 'TWD', type: '直接成本', match: '尾程包裹 LWD032402', issue: '' },
  { row: 3, key: 'DH53419', rawItem: '運費', item: '派送费', amount: '100.000', currency: 'TWD', type: '直接成本', match: '业务订单 SO260504419', issue: '' },
  { row: 7, key: 'JC10121467-1', rawItem: '拖車及疊貨費', item: '派送附加费', amount: '43.200', currency: 'TWD', type: '直接成本', match: '尾程包裹 JC10121467-1', issue: '' },
  { row: 11, key: 'AT78237951', rawItem: '運費', item: '派送费', amount: '145.000', currency: 'TWD', type: '直接成本', match: '匹配到 4 个尾程包裹', issue: '单号关系需确认' },
  { row: 16, key: '', rawItem: '續倉費', item: '续仓费', amount: '484.000', currency: 'TWD', type: '间接成本', match: '待选择分摊池', issue: '无关键单号' },
])

const sampleFiles = {
  'SUP-DF-001': { file: '台湾端派送（东风.xlsx', module: '派送成本', currency: 'TWD', sheets: ['帳單總表', '東風', '新竹', '大榮', '稅金', '車趟費'] },
  'SUP-FG-003': { file: '海快清关（福广.xlsx', module: '清关成本', currency: 'TWD', sheets: ['帳單總表', '清關費', '稅金', '實名認證', '遠雄進倉重'] },
  'SUP-LB-006': { file: '空运头程（力宝.xls', module: '空运成本', currency: 'USD', sheets: ['Sheet1', '费用明细'] },
  'SUP-LD-008': { file: '海快船公司（联多.xlsx', module: '海运成本', currency: 'USD', sheets: ['账单汇总', '海运费', '附加费'] },
}

const availableSuppliers = computed(() => suppliers.filter((item) => item.status === '启用'))
const selectedSupplier = computed(() => suppliers.find((item) => item.code === form.supplier))
const sheets = computed(() => sampleFiles[form.supplier]?.sheets || ['Sheet1'])
const visiblePreview = computed(() => showIssuesOnly.value ? previewRows.value.filter((row) => row.issue) : previewRows.value)
const totalAmount = computed(() => previewRows.value.reduce((sum, row) => sum + Number(row.amount.replaceAll(',', '')), 0))

watch(() => form.supplier, (value) => {
  const sample = sampleFiles[value]
  if (sample) {
    form.file = sample.file
    form.module = sample.module
    form.currency = sample.currency
    form.sheet = sample.sheets[1] || sample.sheets[0]
  }
})

watch(() => props.modelValue, (visible) => {
  if (visible) active.value = 0
})

function close() { emit('update:modelValue', false) }
function next() {
  if (active.value === 0 && (!form.supplier || !form.file || !form.period?.length)) return ElMessage.warning('请先补充供应商、账期和账单文件')
  if (active.value === 1 && mappings.some((item) => item.required && !item.source)) return ElMessage.warning('请完成关键字段配对')
  active.value += 1
}
function reidentify() {
  identifying.value = true
  setTimeout(() => { identifying.value = false; ElMessage.success('已重新识别文件结构，请核对更新后的结果') }, 900)
}
function selectFile(event) {
  const file = event.target.files?.[0]
  if (file) form.file = file.name
}
function submit() {
  submitting.value = true
  setTimeout(() => {
    submitting.value = false
    active.value = 3
    ElMessage.success('账单导入任务已创建')
  }, 1100)
}
function resolveIssue(row) {
  row.issue = ''
  row.match = row.key ? '业务订单 SO260715951' : '租车费用分摊池 07月'
  ElMessage.success('异常已处理')
}
</script>

<template>
  <el-dialog :model-value="modelValue" width="min(1180px, 94vw)" class="import-dialog" :close-on-click-modal="false" destroy-on-close @close="close">
    <template #header>
      <div class="wizard-header"><div><span>供应商账单导入</span><small>一份文件仅对应一个供应商、一个成本板块和一个实际账期</small></div><span class="wizard-draft">草稿自动保留</span></div>
    </template>

    <div v-if="active < 3" class="wizard-steps"><el-steps :active="active" finish-status="success" align-center><el-step title="选择账单" description="供应商、板块与账期" /><el-step title="核对识别" description="确认字段与费项配对" /><el-step title="预览确认" description="核对金额与异常" /></el-steps></div>

    <div v-if="active === 0" class="wizard-page">
      <div class="wizard-grid">
        <section class="wizard-form-card">
          <h3>账单归属</h3>
          <el-form label-position="top" class="two-column-form">
            <el-form-item label="供应商" required class="span-2"><el-select v-model="form.supplier" filterable><el-option v-for="item in availableSuppliers" :key="item.code" :label="`${item.name}（${item.code}）`" :value="item.code" /></el-select></el-form-item>
            <el-form-item label="成本板块" required><el-select v-model="form.module"><el-option v-for="item in selectedSupplier?.modules" :key="item" :label="item" :value="item" /></el-select></el-form-item>
            <el-form-item label="默认币种" required><el-select v-model="form.currency"><el-option v-for="item in ['CNY','TWD','USD','HKD']" :key="item" :label="item" :value="item" /></el-select></el-form-item>
            <el-form-item label="实际成本账期" required class="span-2"><el-date-picker v-model="form.period" type="daterange" value-format="YYYY-MM-DD" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" /></el-form-item>
          </el-form>
          <div class="snapshot-callout"><el-icon><CircleCheck /></el-icon><div><strong>已找到该供应商上次导入设置</strong><span>保存于 {{ selectedSupplier?.snapshot }}，下一步将自动引用；账单格式变化时可重新识别。</span></div></div>
        </section>
        <section class="upload-card" @click="fileInput?.click()">
          <input ref="fileInput" type="file" accept=".xls,.xlsx" hidden @change="selectFile" />
          <el-icon class="upload-icon"><UploadFilled /></el-icon>
          <h3>{{ form.file || '上传供应商原始账单' }}</h3>
          <p>{{ form.file ? '文件已就绪，点击可替换' : '支持 XLS、XLSX；无需调整原文件格式' }}</p>
          <el-button type="primary" plain>选择文件</el-button>
          <div v-if="form.file" class="file-meta"><span><el-icon><Document /></el-icon>{{ form.file }}</span><small>4.8 MB</small></div>
        </section>
      </div>
      <div class="rule-note"><el-icon><Warning /></el-icon><span>若文件内包含多个供应商，请先按供应商拆分文件后分别导入。系统不会在向导中拆分供应商数据。</span></div>
    </div>

    <div v-else-if="active === 1" class="wizard-page mapping-page">
      <div class="mapping-topbar">
        <div class="source-controls"><label>导入工作表 <el-select v-model="form.sheet"><el-option v-for="sheet in sheets" :key="sheet" :label="sheet" :value="sheet" /></el-select></label><label>表头行 <el-input-number v-model="form.headerRow" :min="1" :max="20" /></label></div>
        <div><span class="snapshot-used"><el-icon><CircleCheck /></el-icon>已引用上次导入设置</span><el-button :icon="MagicStick" :loading="identifying" @click="reidentify">重新自动识别</el-button></div>
      </div>
      <div class="mapping-layout">
        <section class="mapping-table-wrap">
          <div class="subsection-heading"><div><h3>核心字段配对</h3><p>系统先给出建议，财务确认后才会用于导入</p></div><span>识别完成度 100%</span></div>
          <el-table :data="mappings" class="mapping-table">
            <el-table-column label="财务字段" width="140"><template #default="scope"><strong>{{ scope.row.role }}<i v-if="scope.row.required">*</i></strong></template></el-table-column>
            <el-table-column label="原始文件字段" min-width="180"><template #default="scope"><el-select v-model="scope.row.source" filterable><el-option v-for="item in ['追蹤號','提單號碼','運費','拖車及疊貨費','重量','司機','未提供','不导入']" :key="item" :label="item" :value="item" /></el-select></template></el-table-column>
            <el-table-column label="业务含义 / 映射结果" min-width="210"><template #default="scope"><el-input v-model="scope.row.meaning" /></template></el-table-column>
            <el-table-column label="识别可信度" width="128"><template #default="scope"><div class="confidence"><el-progress :percentage="scope.row.confidence" :show-text="false" :stroke-width="6" /><span>{{ scope.row.confidence }}%</span></div></template></el-table-column>
          </el-table>
        </section>
        <aside class="raw-preview">
          <div class="raw-preview-head"><div><h3>原文件预览</h3><p>{{ form.file }} · {{ form.sheet }}</p></div><span>前 6 行</span></div>
          <div class="sheet-preview"><table><thead><tr><th>行</th><th>追蹤號</th><th>司機</th><th>重量</th><th>運費</th><th>拖車及疊貨費</th></tr></thead><tbody><tr><td>2</td><td>LWD032402</td><td>東風大型貨件</td><td>23</td><td class="highlight-blue">1,050</td><td class="highlight-amber">18.4</td></tr><tr><td>3</td><td>DH53419</td><td>A區</td><td>19.46</td><td class="highlight-blue">100</td><td class="highlight-amber">0</td></tr><tr><td>4</td><td>AT78397036-1</td><td>A區</td><td>7.12</td><td class="highlight-blue">—</td><td class="highlight-amber">0</td></tr><tr><td>5</td><td>AT78397036-2</td><td>A區</td><td>7.18</td><td class="highlight-blue">—</td><td class="highlight-amber">0</td></tr><tr><td>6</td><td>JC10121467-1</td><td>A區</td><td>53.7</td><td class="highlight-blue">—</td><td class="highlight-amber">43.2</td></tr></tbody></table></div>
          <div class="preview-legend"><span><i class="blue" />成本金额列</span><span><i class="amber" />第二费用列，将展开为独立成本明细</span></div>
        </aside>
      </div>
      <div class="alias-callout"><el-icon><MagicStick /></el-icon><div><strong>发现 2 个供应商原始费项名称</strong><span>`運費`已映射为派送成本 / 派送费，`拖車及疊貨費`已映射为派送成本 / 派送附加费；确认导入后会更新当前供应商的费项别名。</span></div><el-button link type="primary">查看映射</el-button></div>
    </div>

    <div v-else-if="active === 2" class="wizard-page preview-page">
      <section class="preview-summary">
        <div><span>预计成本明细</span><strong>2,814</strong><small>由 2,137 行展开</small></div><div><span>账单金额</span><strong>{{ totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 3 }) }} TWD</strong><small>按原币种核对</small></div><div><span>直接 / 间接成本</span><strong>2,134 / 680</strong><small>系统建议结果</small></div><div class="has-warning"><span>待确认异常</span><strong>2</strong><small>必须处理后提交</small></div>
      </section>
      <section class="preview-table-section">
        <div class="subsection-heading"><div><h3>导入结果预览</h3><p>每个金额列会展开为独立成本明细，并保留原始行关系</p></div><el-switch v-model="showIssuesOnly" inline-prompt active-text="仅看异常" inactive-text="全部明细" style="--el-switch-on-color: #c27620" /></div>
        <el-table :data="visiblePreview" class="clean-table preview-data-table">
          <el-table-column prop="row" label="来源行" width="75" />
          <el-table-column prop="key" label="关键单号" width="150"><template #default="scope"><span>{{ scope.row.key || '无关键单号' }}</span></template></el-table-column>
          <el-table-column label="费项映射" min-width="195"><template #default="scope"><div class="mapping-cell"><span>{{ scope.row.rawItem }}</span><i>→</i><strong>{{ scope.row.item }}</strong></div></template></el-table-column>
          <el-table-column label="成本金额" width="145" align="right"><template #default="scope"><strong class="amount-cell">{{ scope.row.amount }} {{ scope.row.currency }}</strong></template></el-table-column>
          <el-table-column prop="type" label="成本类型" width="105"><template #default="scope"><span :class="['status-tag', scope.row.type === '直接成本' ? 'info' : 'violet']">{{ scope.row.type }}</span></template></el-table-column>
          <el-table-column prop="match" label="预计归属" min-width="190" />
          <el-table-column label="检查结果" min-width="150"><template #default="scope"><span v-if="!scope.row.issue" class="check-ok"><el-icon><CircleCheck /></el-icon>通过</span><el-button v-else link type="warning" @click="resolveIssue(scope.row)">{{ scope.row.issue }} · 处理</el-button></template></el-table-column>
        </el-table>
      </section>
      <section class="confirm-strip">
        <div><label>账单结清状态</label><el-radio-group v-model="form.settleStatus"><el-radio-button value="待结清">待结清</el-radio-button><el-radio-button value="已结清">已结清</el-radio-button></el-radio-group><small>结清状态与成本归属、分摊进度相互独立</small></div>
        <el-checkbox v-model="form.duplicateConfirmed">我已核对供应商、账期、账单合计和疑似重复提示</el-checkbox>
      </section>
    </div>

    <div v-else class="wizard-success">
      <div class="success-icon"><CircleCheck /></div><h2>账单导入任务已创建</h2><p>系统正在按确认结果写入成本池。导入采用全有或全无处理，不会留下部分成功数据。</p>
      <div class="success-task"><span>任务编号</span><strong>IMP-20260718-00086</strong><span>任务状态</span><strong class="status-tag info">执行中</strong></div>
      <div class="success-actions"><el-button @click="close">返回成本中心</el-button><el-button type="primary" @click="close">查看导入任务</el-button></div>
    </div>

    <template #footer>
      <div v-if="active < 3" class="wizard-footer"><el-button @click="close">取消</el-button><div><el-button v-if="active > 0" @click="active -= 1">上一步</el-button><el-button v-if="active < 2" type="primary" @click="next">下一步</el-button><el-button v-else type="primary" :loading="submitting" :disabled="previewRows.some((row) => row.issue) || !form.duplicateConfirmed" @click="submit">确认导入</el-button></div></div>
    </template>
  </el-dialog>
</template>
