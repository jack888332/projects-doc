<script setup>
import { nextTick, ref } from 'vue'
import { ElMessage } from 'element-plus/es/components/message/index.mjs'
import { Lock, Rank, RefreshLeft } from '@element-plus/icons-vue'
import { applyTableColumnOrder, applyTableSort, readTableColumns } from './tableColumns'
import SortDirectionIcon from './SortDirectionIcon.vue'

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
  const storedColumns = readTableColumns(root)
  const fallbackColumns = [...(root?.querySelectorAll('.el-table__header-wrapper th.is-leaf .cell') || [])]
      .filter((cell) => {
        const header = cell.closest('th')
        return !header?.classList.contains('el-table-fixed-column--left')
          && !header?.classList.contains('el-table-fixed-column--right')
      })
      .map((cell) => cell.textContent.trim())
      .filter((label, index, values) => label && label !== '操作' && values.indexOf(label) === index)
      .map((label) => ({ label, reorderable: true, sortable: false, order: null }))
  const nextColumns = storedColumns.length ? storedColumns : fallbackColumns
  if (!defaultColumns.value.length) defaultColumns.value = nextColumns.map((column) => column.label)
  columns.value = nextColumns.length
    ? nextColumns.map((column) => ({ ...column }))
    : defaultColumns.value.map((label) => ({ label, reorderable: true, sortable: false, order: null }))
}

async function handleOpen() {
  await nextTick()
  readColumns()
}

function handleDragStart(index) {
  if (!columns.value[index]?.reorderable) return
  draggingIndex.value = index
}

function handleDrop(index) {
  if (draggingIndex.value < 0 || draggingIndex.value === index || !columns.value[index]?.reorderable) return
  const next = [...columns.value]
  const [item] = next.splice(draggingIndex.value, 1)
  next.splice(index, 0, item)
  draggingIndex.value = -1
  commitColumns(next)
}

function resetColumns() {
  const byLabel = new Map(columns.value.map((column) => [column.label, column]))
  const next = defaultColumns.value.map((label) => ({
    ...(byLabel.get(label) || { label, sortable: false }),
    order: null,
  }))
  commitColumns(next)
}

function setSort(column, order) {
  if (!column.sortable) return
  const next = columns.value.map((item) => ({
    ...item,
    order: item.label === column.label ? order : null,
  }))
  commitColumns(next)
}

function cycleSort(column) {
  const nextOrder = column.order === 'ascending'
    ? 'descending'
    : column.order === 'descending'
      ? null
      : 'ascending'
  setSort(column, nextOrder)
}

function sortButtonTitle(column) {
  if (column.order === 'ascending') return '当前升序，点击切换为降序'
  if (column.order === 'descending') return '当前降序，点击取消排序'
  return '未排序，点击切换为升序'
}

function commitColumns(nextColumns) {
  const root = resolveTableRoot()
  const applied = applyTableColumnOrder(root, nextColumns.map((column) => column.label))
  if (!applied) {
    ElMessage.warning('当前表格暂不支持列排序')
    return false
  }
  const sortedColumn = nextColumns.find((column) => column.order)
  if (!applyTableSort(root, sortedColumn?.label, sortedColumn?.order)) {
    ElMessage.warning('当前字段暂不支持排序')
    return false
  }
  columns.value = readTableColumns(root)
  emit('change', columns.value.map((column) => ({ ...column })))
  return true
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
        title="排序"
        aria-label="排序"
      >
        <span>排序</span>
      </el-button>
    </template>
    <div class="column-sort-panel">
      <div class="column-sort-panel-header">
        <strong>排序</strong>
        <el-button link :icon="RefreshLeft" title="恢复默认" aria-label="恢复默认" @click="resetColumns" />
      </div>
      <div class="column-sort-list">
        <div
          v-for="(column, index) in columns"
          :key="column.label"
          :class="['column-sort-item', { 'is-position-locked': !column.reorderable }]"
          :draggable="column.reorderable"
          @dragstart="handleDragStart(index)"
          @dragend="draggingIndex = -1"
          @dragover.prevent
          @drop="handleDrop(index)"
        >
          <el-tooltip content="列位置排序" placement="top" :show-after="0" :hide-after="0">
            <el-icon v-if="column.reorderable"><Rank /></el-icon>
            <el-icon v-else><Lock /></el-icon>
          </el-tooltip>
          <span class="column-sort-item-label">{{ column.label }}</span>
          <div v-if="column.sortable" class="column-sort-direction" aria-label="排序方向">
            <el-tooltip content="列数据排序" placement="top" :show-after="0" :hide-after="0">
              <button
                type="button"
                :class="['column-sort-direction-button', {
                  'is-ascending': column.order === 'ascending',
                  'is-descending': column.order === 'descending',
                }]"
                :aria-label="sortButtonTitle(column)"
                @click.stop="cycleSort(column)"
              >
                <SortDirectionIcon />
              </button>
            </el-tooltip>
          </div>
        </div>
      </div>
    </div>
  </el-popover>
</template>
