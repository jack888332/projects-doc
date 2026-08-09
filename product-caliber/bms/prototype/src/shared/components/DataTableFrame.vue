<script setup>
import TablePagination from './TablePagination.vue'

defineProps({
  total: { type: Number, default: 0 },
  selectedCount: { type: Number, default: null },
  pageSize: { type: Number, default: 20 },
  pageSizes: { type: Array, default: () => [10, 20, 50, 100] },
  toolbar: { type: Boolean, default: true },
  pagination: { type: Boolean, default: true },
  summary: { type: String, default: '' },
})

defineEmits(['update:pageSize', 'update:currentPage'])
</script>

<template>
  <div class="data-table-frame">
    <div v-if="toolbar && ($slots['toolbar-leading'] || $slots.actions)" class="table-reference-toolbar">
      <div v-if="$slots['toolbar-leading']" class="table-reference-leading"><slot name="toolbar-leading" /></div>
      <div v-if="$slots.actions" class="table-reference-actions"><slot name="actions" /></div>
    </div>
    <slot />
    <TablePagination
      v-if="pagination"
      :total="total"
      :page-size="pageSize"
      :page-sizes="pageSizes"
      :summary="summary"
      @update:page-size="$emit('update:pageSize', $event)"
      @update:current-page="$emit('update:currentPage', $event)"
    />
  </div>
</template>
