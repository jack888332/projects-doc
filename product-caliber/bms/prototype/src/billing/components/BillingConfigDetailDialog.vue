<script setup>
import { ref } from 'vue'
import ConfigSchemeOverview from './ConfigSchemeOverview.vue'
import ReceivableConfigEditor from './ReceivableConfigEditor.vue'
import RefundConfigEditor from './RefundConfigEditor.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  config: { type: Object, default: null },
  detailMode: { type: String, default: 'edit' },
  activeType: { type: String, default: 'AR' },
  referenceStats: { type: Object, default: () => ({ exact: 0, total: 0 }) },
  editingReferences: { type: Array, default: () => [] },
  editingImpactText: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'save'])
const editorRef = ref(null)

function updateConfig(field, value) {
  if (props.config) props.config[field] = value
}

defineExpose({
  validate: () => editorRef.value?.validate(),
  getSchemeSnapshot: () => editorRef.value?.getSchemeSnapshot?.(),
  getRefundSnapshot: () => editorRef.value?.getRefundSnapshot?.(),
})
</script>

<template>
  <el-dialog
    :model-value="props.modelValue"
    class="module-dialog module-dialog-wide"
    align-center
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="drawer-title">
        <span>{{ props.detailMode === 'view' ? '查看客户引用准确版本' : props.config?.no === '新配置' ? '新建配置' : '发布配置新版本' }}</span>
        <small>{{ props.activeType === 'AR' ? '应收账单配置' : '返款账单配置' }}</small>
      </div>
    </template>

    <template v-if="props.config">
      <div class="scope-info-bar">
        <div><span>配置：</span><strong>{{ props.config.name || '待填写' }}</strong></div>
        <div><span>准确版本：</span><strong>{{ props.config.version }}</strong></div>
        <div>
          <span>{{ props.detailMode === 'view' ? '本版本有效引用：' : '全部有效引用：' }}</span>
          <strong>{{ props.detailMode === 'view' ? props.referenceStats.exact : props.referenceStats.total }}</strong>
        </div>
      </div>

      <template v-if="props.detailMode === 'view'">
        <section class="exact-version-view">
          <ConfigSchemeOverview v-if="props.config.type === 'AR'" :snapshot="props.config.schemeSnapshot" />
          <dl v-else class="inline-detail-grid">
            <div><dt>返款模式</dt><dd>{{ props.config.mode }}</dd></div>
            <div><dt>账期类型</dt><dd>{{ props.config.cycle }}</dd></div>
            <div><dt>发出规则</dt><dd>{{ props.config.sentRule }}</dd></div>
            <div><dt>默认结算币种</dt><dd>{{ props.config.currency }}</dd></div>
          </dl>
          <div class="config-version-meta">本页读取客户引用记录锁定的准确版本快照，不随配置当前版本变化。</div>
        </section>
      </template>

      <template v-else>
        <el-alert
          v-if="props.editingReferences.length && props.config.no !== '新配置'"
          class="editing-impact"
          :title="`当前有效引用客户：${props.editingImpactText}`"
          :type="props.editingReferences.length > 1 ? 'warning' : 'info'"
          :closable="false"
          show-icon
        />
        <section class="config-version-panel">
          <el-form label-position="top" class="config-version-grid">
            <el-form-item label="配置名称"><el-input :model-value="props.config.name" @update:model-value="updateConfig('name', $event)" /></el-form-item>
            <el-form-item label="生效开始日"><el-date-picker :model-value="props.config.effectStart" value-format="YYYY-MM-DD" type="date" @update:model-value="updateConfig('effectStart', $event)" /></el-form-item>
            <el-form-item label="生效结束日"><el-input :model-value="props.config.effectEnd" @update:model-value="updateConfig('effectEnd', $event)" /></el-form-item>
            <el-form-item label="变更原因"><el-input :model-value="props.config.changeReason" @update:model-value="updateConfig('changeReason', $event)" /></el-form-item>
          </el-form>
          <div class="config-version-meta">发布新版本不会自动升级客户；发布完成后按客户选择是否切换到新准确版本。</div>
        </section>
        <ReceivableConfigEditor v-if="props.config.type === 'AR'" :key="props.config.id" ref="editorRef" :config="props.config" />
        <RefundConfigEditor v-else :key="props.config.id" ref="editorRef" :config="props.config" />
      </template>
    </template>

    <template #footer>
      <div class="config-drawer-footer">
        <el-button @click="emit('update:modelValue', false)">{{ props.detailMode === 'view' ? '关闭' : '取消' }}</el-button>
        <el-button v-if="props.detailMode !== 'view'" type="primary" @click="emit('save')">发布版本</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.scope-info-bar{min-height:48px;margin-bottom:var(--space-3);padding:0 var(--space-4);display:flex;align-items:center;gap:48px;border:1px solid #dfe4ec;background:#f7f9fb;color:#687386}.scope-info-bar div{display:flex;gap:4px}.scope-info-bar strong{color:#29364c}.editing-impact{margin-bottom:var(--space-3)}.editing-impact :deep(.el-alert__title){line-height:1.5}.exact-version-view,.config-version-panel{margin-bottom:var(--space-3);padding:var(--space-3) var(--space-4);border:1px solid #dfe4ec;background:#fff}.config-version-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.config-version-grid :deep(.el-form-item){margin-bottom:0}.config-version-grid :deep(.el-select),.config-version-grid :deep(.el-date-editor){width:100%}.config-version-meta{margin-top:var(--space-2);color:#7b8798;font-size:var(--font-size-sm)}.config-drawer-footer{display:flex;justify-content:flex-end;gap:8px;padding-right:var(--space-2)}
@media(max-width:760px){.scope-info-bar{align-items:flex-start;flex-direction:column;gap:6px;padding:var(--space-2) var(--space-3)}.config-version-grid{grid-template-columns:1fr}}
</style>
