<script setup>
import { ref } from 'vue'
import TablePagination from './TablePagination.vue'
import TableFieldSortButton from './TableFieldSortButton.vue'

defineProps({
  total: { type: Number, default: 0 },
  selectedCount: { type: Number, default: null },
  pageSize: { type: Number, default: 20 },
  pageSizes: { type: Array, default: () => [10, 20, 50, 100] },
  toolbar: { type: Boolean, default: true },
  selectionSummary: { type: Boolean, default: false },
  pagination: { type: Boolean, default: true },
  columnSort: { type: Boolean, default: true },
  summary: { type: String, default: '' },
})

const emit = defineEmits(['update:pageSize', 'update:currentPage', 'column-order-change'])
const frameRef = ref(null)
</script>

<template>
  <div ref="frameRef" class="data-table-frame">
    <div v-if="toolbar" class="table-reference-toolbar">
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
      v-if="pagination"
      :total="total"
      :page-size="pageSize"
      :page-sizes="pageSizes"
      @update:page-size="$emit('update:pageSize', $event)"
      @update:current-page="$emit('update:currentPage', $event)"
    />
  </div>
</template>
