<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  total: { type: Number, default: 0 },
  pageSize: { type: Number, default: 20 },
  pageSizes: { type: Array, default: () => [10, 20, 50, 100] },
  layout: { type: String, default: 'sizes, prev, pager, next' },
  summary: { type: String, default: '' },
})
const emit = defineEmits(['update:pageSize', 'update:currentPage'])
const currentPage = ref(1)
const currentPageSize = ref(props.pageSize)

watch(() => props.pageSize, (value) => {
  currentPageSize.value = value
})

watch(() => props.total, () => {
  currentPage.value = 1
})

const handlePageSizeChange = (value) => emit('update:pageSize', value)
const handleCurrentPageChange = (value) => emit('update:currentPage', value)
</script>

<template>
  <div class="table-pagination">
    <el-pagination
      v-model:current-page="currentPage"
      v-model:page-size="currentPageSize"
      :layout="layout"
      :page-sizes="pageSizes"
      :total="total"
      @update:page-size="handlePageSizeChange"
      @update:current-page="handleCurrentPageChange"
    />
    <span>{{ summary || `共 ${total} 行` }}</span>
  </div>
</template>
