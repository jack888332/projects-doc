<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { CircleCheck, Document, MagicStick, Refresh, UploadFilled, Warning } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { createBusinessId, db } from '../db'
import { useLiveData } from '../composables/useLiveData'

const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue'])
const active = ref(0)
const identifying = ref(false)
const submitting = ref(false)
const showIssuesOnly = ref(false)
const fileInput = ref()
const { data: suppliers } = useLiveData(() => db.suppliers.orderBy('code').toArray())

const form = reactive({
  supplier: 'SUP-DF-001', module: '派送成本', period: ['2026-07-01', '2026-07-15'], currency: 'TWD',
  file: '台湾端派送（东风.xlsx', sheet: '東風', headerRow: 1, settleStatus: '待结清', duplicateConfirmed: false,
})

const mappings = reactive([
  { role: '关键单号', source: '追蹤號', meaning: '供应商追踪号', confidence: 98, required: true },
  { role: '成本费项', source: '運費', meaning: '派送费', confidence: 96, required: true, inference: '混合', basis: '直接 2,010 / 间接 127' },
  { role: '成本费项', source: '拖車及疊貨費', meaning: '派送附加费', confidence: 91, required: false, inference: '混合', basis: '直接 124 / 间接 553' },
  { role: '币种', source: '未提供', meaning: '使用供应商默认币种 TWD', confidence: 100, required: true },
])

const previewRows = ref([
  { row: 2, key: 'LWD032402', rawItem: '運費', item: '派送费', amount: '1,050.000', currency: 'TWD', type: '直接成本', match: '尾程运单号 TP-TW-LWD032402', issue: '' },
  { row: 2, key: 'LWD032402', rawItem: '拖車及疊貨費', item: '派送附加费', amount: '18.400', currency: 'TWD', type: '直接成本', match: '尾程运单号 TP-TW-LWD032402', issue: '' },
  { row: 3, key: 'DH53419', rawItem: '運費', item: '派送费', amount: '100.000', currency: 'TWD', type: '直接成本', match: '业务订单号 SO260504419', issue: '' },
  { row: 7, key: 'JC10121467-1', rawItem: '拖車及疊貨費', item: '派送附加费', amount: '43.200', currency: 'TWD', type: '直接成本', match: '尾程运单号 TP-TW-JC10121467-1', issue: '' },
  { row: 11, key: 'AT78237951', rawItem: '運費', item: '派送费', amount: '145.000', currency: 'TWD', type: '间接成本', match: '追溯到 4 个业务对象，金额未拆分', issue: '无法形成唯一直接归属' },
  { row: 16, key: '', rawItem: '續倉費', item: '续仓费', amount: '484.000', currency: 'TWD', type: '间接成本', match: '关键单号为空', issue: '无关键单号' },
])

const sampleFiles = {
  'SUP-DF-001': { file: '台湾端派送（东风.xlsx', module: '派送成本', currency: 'TWD', sheets: ['帳單總表', '東風', '新竹', '大榮', '稅金', '車趟費'] },
  'SUP-FG-003': { file: '海快清关（福广.xlsx', module: '清关成本', currency: 'TWD', sheets: ['帳單總表', '清關費', '稅金', '實名認證', '遠雄進倉重'] },
  'SUP-LB-006': { file: '空运头程（力宝.xls', module: '空运成本', currency: 'USD', sheets: ['Sheet1', '费用明细'] },
  'SUP-LD-008': { file: '海快船公司（联多.xlsx', module: '海运成本', currency: 'USD', sheets: ['账单汇总', '海运费', '附加费'] },
}

const availableSuppliers = computed(() => suppliers.value.filter((item) => item.status === '启用'))
const selectedSupplier = computed(() => suppliers.value.find((item) => item.code === form.supplier))
const sheets = computed(() => sampleFiles[form.supplier]?.sheets || ['Sheet1'])
const visiblePreview = computed(() => showIssuesOnly.value ? previewRows.value.filter((row) => row.issue) : previewRows.value)
const totalAmount = computed(() => previewRows.value.reduce((sum, row) => sum + Number(row.amount.replaceAll(',', '')), 0))
const keyMappings = computed(() => mappings.filter((item) => item.role === '关键单号'))
const feeMappings = computed(() => mappings.filter((item) => item.role === '成本费项'))

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
async function submit() {
  submitting.value = true
  try {
    const supplier = selectedSupplier.value
    const period = form.period.join(' - ')
    const billId = createBusinessId(`APB-${form.supplier.replace('SUP-', '')}`)
    const importedAt = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const direct = previewRows.value.filter((row) => row.type === '直接成本').length
    const indirect = previewRows.value.length - direct
    const costItems = previewRows.value.map((row) => ({
      id: createBusinessId('COST'),
      bill: billId,
      module: form.module,
      supplier: supplier.name,
      rawItem: row.rawItem,
      item: row.item,
      keyType: row.key ? '尾程运单号' : '无关键单号',
      key: row.key,
      amount: Number(row.amount.replaceAll(',', '')),
      currency: row.currency,
      type: row.type,
      target: row.match,
      status: row.type === '直接成本' ? '已归属' : '待分摊',
    }))

    await db.transaction('rw', [db.costBills, db.costItems, db.costItemAliases, db.importSnapshots, db.suppliers, db.operationLogs], async () => {
      await db.costBills.add({
        id: billId,
        supplier: supplier.name,
        module: form.module,
        period,
        amount: totalAmount.value,
        currency: form.currency,
        rows: costItems.length,
        direct,
        indirect,
        settled: form.settleStatus,
        importStatus: '导入成功',
        importedAt,
        file: form.file,
      })
      await db.costItems.bulkAdd(costItems)

      for (const mapping of mappings.filter((item) => item.role === '成本费项')) {
        const key = [supplier.name, form.module, mapping.source]
        const existing = await db.costItemAliases.where('[supplier+module+rawName]').equals(key).first()
        const alias = { supplier: supplier.name, module: form.module, rawName: mapping.source, item: mapping.meaning, updatedAt: importedAt }
        if (existing) await db.costItemAliases.update(existing.id, alias)
        else await db.costItemAliases.add(alias)
      }

      await db.importSnapshots.put({ supplier: form.supplier, supplierName: supplier.name, module: form.module, fileStructure: mappings.map((item) => ({ role: item.role, source: item.source, meaning: item.meaning })), sheet: form.sheet, headerRow: form.headerRow, updatedAt: importedAt })
      await db.suppliers.update(form.supplier, { snapshot: importedAt })
      await db.operationLogs.add({ entityType: '成本账单', entityId: billId, action: '导入供应商账单', detail: form.file, createdAt: new Date().toISOString() })
    })

    submitting.value = false
    active.value = 3
    ElMessage.success('账单导入任务已创建')
  } catch (error) {
    submitting.value = false
    ElMessage.error(error?.message || '账单导入失败')
  }
}
function resolveIssue(row) {
  row.issue = ''
  if (row.key) {
    row.type = '直接成本'
    row.match = '业务订单号 SO260715951'
  } else {
    row.type = '间接成本'
    row.match = '未追溯到业务订单号或尾程运单号'
  }
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
          <div class="subsection-heading"><div><h3>关键单号识别</h3><p>最多采用一个关键单号。只有该单号可直接追溯到业务订单号或尾程运单号时，对应成本费项才可判为直接成本。</p></div><span>最多 1 个</span></div>
          <el-table :data="keyMappings" class="mapping-table">
            <el-table-column label="原始单号字段" min-width="180"><template #default="scope"><el-select v-model="scope.row.source" filterable><el-option v-for="item in ['追蹤號','提單號碼','轉單號','報單號','稅單號','櫃號','无关键单号']" :key="item" :label="item" :value="item" /></el-select></template></el-table-column>
            <el-table-column label="关键单号类型" min-width="190"><template #default="scope"><el-input v-model="scope.row.meaning" /></template></el-table-column>
            <el-table-column label="追溯检查" min-width="190"><template #default><span class="check-ok"><el-icon><CircleCheck /></el-icon>将逐行追溯我方单号</span></template></el-table-column>
            <el-table-column label="识别结果" width="110"><template #default="scope"><span class="status-tag info">{{ scope.row.confidence }}% 可信</span></template></el-table-column>
          </el-table>
          <div class="rule-note compact"><el-icon><Warning /></el-icon><span>提单号、柜号、账单号、批次号等仅用于定位范围时，不构成直接成本依据；未选中的其它单号只保留在原始账单快照中。</span></div>
          <div class="subsection-heading mapping-subheading"><div><h3>成本费项识别</h3><p>每个金额字段独立映射标准成本费项，成本类型在展开为明细后逐条推导。</p></div><span>{{ feeMappings.length }} 个金额字段</span></div>
          <el-table :data="feeMappings" class="mapping-table">
            <el-table-column label="原始成本费项" min-width="170"><template #default="scope"><el-select v-model="scope.row.source" filterable><el-option v-for="item in ['運費','拖車及疊貨費','續倉費','偏遠費','不导入']" :key="item" :label="item" :value="item" /></el-select></template></el-table-column>
            <el-table-column label="标准成本费项" min-width="180"><template #default="scope"><el-input v-model="scope.row.meaning" /></template></el-table-column>
            <el-table-column label="成本类型推导" min-width="190"><template #default="scope"><div class="key-cell"><span class="status-tag warning">{{ scope.row.inference }}</span><small>{{ scope.row.basis }}</small></div></template></el-table-column>
            <el-table-column label="识别结果" width="110"><template #default="scope"><span class="status-tag success">{{ scope.row.confidence }}% 可信</span></template></el-table-column>
          </el-table>
        </section>
        <aside class="raw-preview">
          <div class="raw-preview-head"><div><h3>原文件预览</h3><p>{{ form.file }} · {{ form.sheet }}</p></div><span>前 6 行</span></div>
          <div class="sheet-preview"><table><thead><tr><th>行</th><th>追蹤號</th><th>司機</th><th>重量</th><th>運費</th><th>拖車及疊貨費</th></tr></thead><tbody><tr><td>2</td><td>LWD032402</td><td>東風大型貨件</td><td>23</td><td class="highlight-blue">1,050</td><td class="highlight-amber">18.4</td></tr><tr><td>3</td><td>DH53419</td><td>A區</td><td>19.46</td><td class="highlight-blue">100</td><td class="highlight-amber">0</td></tr><tr><td>4</td><td>AT78397036-1</td><td>A區</td><td>7.12</td><td class="highlight-blue">—</td><td class="highlight-amber">0</td></tr><tr><td>5</td><td>AT78397036-2</td><td>A區</td><td>7.18</td><td class="highlight-blue">—</td><td class="highlight-amber">0</td></tr><tr><td>6</td><td>JC10121467-1</td><td>A區</td><td>53.7</td><td class="highlight-blue">—</td><td class="highlight-amber">43.2</td></tr></tbody></table></div>
          <div class="preview-legend"><span><i class="blue" />成本金额列</span><span><i class="amber" />第二费用列，将展开为独立成本明细</span></div>
        </aside>
      </div>
      <div class="alias-callout"><el-icon><MagicStick /></el-icon><div><strong>原始字段快照</strong><span>未选为关键单号或成本费项的字段仍会原样保留，用于后续核对，但不会参与直接成本自动判定。</span></div></div>
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
