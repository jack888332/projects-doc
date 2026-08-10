<script setup>
import { nextTick, ref } from 'vue'
import { ElMessage } from 'element-plus/es/components/message/index.mjs'
import { Rank, RefreshLeft } from '@element-plus/icons-vue'
import { applyTableColumnOrder, readTableColumnOrder } from './tableColumns'

const props = defineProps({
  tableRoot: { type: [Object, HTMLElement], default: null },
})
const emit = defineEmits(['change'])
const visible = ref(false)
const triggerRef = ref(null)
const columns = ref([])
const defaultColumns = ref([])
const draggingIndex = ref(-1)

function resolveTableRoot() {
  const trigger = triggerRef.value?.$el || triggerRef.value
  return props.tableRoot
    || trigger?.closest('.data-table-frame')
    || trigger?.closest('.table-reference-toolbar')?.parentElement
}

function readColumns() {
  const root = resolveTableRoot()
  const storedLabels = readTableColumnOrder(root)
  const labels = storedLabels.length
    ? storedLabels
    : [...(root?.querySelectorAll('.el-table__header-wrapper th.is-leaf .cell') || [])]
      .filter((cell) => {
        const header = cell.closest('th')
        return !header?.classList.contains('el-table-fixed-column--left')
          && !header?.classList.contains('el-table-fixed-column--right')
      })
      .map((cell) => cell.textContent.trim())
      .filter((label, index, values) => label && label !== '操作' && values.indexOf(label) === index)
  if (!defaultColumns.value.length) defaultColumns.value = [...labels]
  columns.value = labels.length ? labels : [...defaultColumns.value]
}

async function handleOpen() {
  await nextTick()
  readColumns()
}

function handleDragStart(index) {
  draggingIndex.value = index
}

function handleDrop(index) {
  if (draggingIndex.value < 0 || draggingIndex.value === index) return
  const next = [...columns.value]
  const [item] = next.splice(draggingIndex.value, 1)
  next.splice(index, 0, item)
  columns.value = next
  draggingIndex.value = -1
}

function resetColumns() {
  columns.value = [...defaultColumns.value]
}

function applyColumns() {
  const applied = applyTableColumnOrder(resolveTableRoot(), columns.value)
  if (!applied) {
    ElMessage.warning('当前表格暂不支持列排列')
    return
  }
  emit('change', [...columns.value])
  visible.value = false
  ElMessage.success('列顺序已更新')
}
</script>

<template>
  <el-popover
    v-model:visible="visible"
    placement="bottom-end"
    :width="320"
    :show-arrow="false"
    trigger="click"
    popper-class="column-sort-popover"
    @show="handleOpen"
  >
    <template #reference>
      <el-button
        ref="triggerRef"
        class="table-field-sort-button"
        title="列排列"
        aria-label="列排列"
      >
        <span>排列</span>
      </el-button>
    </template>
    <div class="column-sort-panel">
      <div class="column-sort-panel-header">
        <strong>列排列</strong>
        <el-button link :icon="RefreshLeft" title="恢复默认" aria-label="恢复默认" @click="resetColumns" />
      </div>
      <div class="column-sort-list">
        <div
          v-for="(column, index) in columns"
          :key="column"
          class="column-sort-item"
          draggable="true"
          @dragstart="handleDragStart(index)"
          @dragover.prevent
          @drop="handleDrop(index)"
        >
          <el-icon><Rank /></el-icon>
          <span>{{ column }}</span>
        </div>
      </div>
      <div class="column-sort-panel-footer">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="applyColumns">应用</el-button>
      </div>
    </div>
  </el-popover>
</template>
