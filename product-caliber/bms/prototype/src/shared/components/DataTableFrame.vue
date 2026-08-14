<script setup>
import { computed, provide, ref } from 'vue'
import TablePagination from './TablePagination.vue'
import TableFieldSortButton from './TableFieldSortButton.vue'

const props = defineProps({
  total: { type: Number, default: 0 },
  selectedCount: { type: Number, default: null },
  pageSize: { type: Number, default: 20 },
  pageSizes: { type: Array, default: () => [10, 20, 50, 100] },
  toolbar: { type: Boolean, default: true },
  showToolbar: { type: Boolean, default: true },
  selectionSummary: { type: Boolean, default: false },
  pagination: { type: Boolean, default: true },
  showPagination: { type: Boolean, default: true },
  stickyToolbar: { type: Boolean, default: true },
  stickyPagination: { type: Boolean, default: true },
  columnSort: { type: Boolean, default: true },
  columnDataSort: { type: Boolean, default: true },
  autoContentWidth: { type: Boolean, default: false },
  autoWidthRows: { type: Array, default: () => [] },
  autoWidthMax: { type: Number, default: 260 },
  autoWidthDenseThreshold: { type: Number, default: 10 },
  autoWidthDenseMax: { type: Number, default: 180 },
  autoWidthSampleSize: { type: Number, default: 100 },
  summary: { type: String, default: '' },
})

const emit = defineEmits(['update:pageSize', 'update:currentPage', 'column-order-change'])
const frameRef = ref(null)
const autoWidthColumnCount = ref(0)
const autoWidthColumnIds = new Set()

function registerAutoWidthColumn(columnId) {
  autoWidthColumnIds.add(columnId)
  autoWidthColumnCount.value = autoWidthColumnIds.size
}

function unregisterAutoWidthColumn(columnId) {
  autoWidthColumnIds.delete(columnId)
  autoWidthColumnCount.value = autoWidthColumnIds.size
}

provide('prototypeTableColumnDataSort', computed(() => props.columnDataSort))
provide('prototypeTableAutoWidth', computed(() => ({
  enabled: props.autoContentWidth,
  rows: props.autoWidthRows,
  maxWidth: autoWidthColumnCount.value >= props.autoWidthDenseThreshold
    ? Math.min(props.autoWidthMax, props.autoWidthDenseMax)
    : props.autoWidthMax,
  sampleSize: props.autoWidthSampleSize,
  registerColumn: registerAutoWidthColumn,
  unregisterColumn: unregisterAutoWidthColumn,
})))
</script>

<template>
  <div ref="frameRef" class="data-table-frame">
    <div
      v-if="toolbar && showToolbar"
      class="table-reference-toolbar"
      :class="{ 'is-static': !stickyToolbar }"
    >
      <div class="table-reference-leading">
        <slot name="toolbar-leading">
          <span v-if="summary">{{ summary }}</span>
          <span v-else-if="selectionSummary" class="table-reference-summary">
            <span>共 {{ total }} 行</span>
            <span class="table-reference-summary-divider">|</span>
            <span>已选 {{ selectedCount ?? 0 }} 行</span>
          </span>
          <span v-else>共 {{ total }} 行</span>
        </slot>
      </div>
      <div v-if="$slots.actions || columnSort" class="table-reference-actions">
        <slot name="actions" />
        <TableFieldSortButton
          v-if="columnSort"
          :table-root="frameRef"
          @change="emit('column-order-change', $event)"
        />
      </div>
    </div>
    <slot />
    <TablePagination
      v-if="pagination && showPagination"
      :total="total"
      :page-size="pageSize"
      :page-sizes="pageSizes"
      :sticky="stickyPagination"
      @update:page-size="$emit('update:pageSize', $event)"
      @update:current-page="$emit('update:currentPage', $event)"
    />
  </div>
</template>
