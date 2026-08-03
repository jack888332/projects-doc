<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  total: { type: Number, default: 0 },
  pageSize: { type: Number, default: 20 },
  layout: { type: String, default: 'sizes, prev, pager, next, jumper' },
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
    <span>{{ summary || `共 ${total} 条` }}</span>
    <el-pagination
      v-model:current-page="currentPage"
      v-model:page-size="currentPageSize"
      :layout="layout"
      :total="total"
      @update:page-size="handlePageSizeChange"
      @update:current-page="handleCurrentPageChange"
    />
  </div>
</template>
