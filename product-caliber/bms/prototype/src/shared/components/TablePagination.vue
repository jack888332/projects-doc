<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  total: { type: Number, default: 0 },
  pageSize: { type: Number, default: 20 },
  pageSizes: { type: Array, default: () => [10, 20, 50, 100] },
  sticky: { type: Boolean, default: true },
})
const emit = defineEmits(['update:pageSize', 'update:currentPage'])
const currentPage = ref(1)
const currentPageSize = ref(props.pageSize)
const anchor = ref(null)
const docked = ref(false)
const dockStyle = ref({})
let frameId = 0

function syncDock() {
  cancelAnimationFrame(frameId)
  if (!props.sticky) {
    docked.value = false
    dockStyle.value = {}
    return
  }
  frameId = requestAnimationFrame(() => {
    const element = anchor.value
    const frame = element?.closest('.data-table-frame') || element?.parentElement
    if (!element || !frame) return
    const anchorRect = element.getBoundingClientRect()
    const frameRect = frame.getBoundingClientRect()
    const barHeight = 56
    const shouldDock = frameRect.top < window.innerHeight - barHeight
      && frameRect.bottom > 0
      && anchorRect.top > window.innerHeight - barHeight
    docked.value = shouldDock
    dockStyle.value = shouldDock
      ? { left: `${frameRect.left}px`, width: `${frameRect.width}px` }
      : {}
  })
}

watch(() => props.pageSize, (value) => {
  currentPageSize.value = value
})

watch(() => props.total, () => {
  currentPage.value = 1
  nextTick(syncDock)
})

onMounted(() => {
  if (props.sticky) {
    window.addEventListener('scroll', syncDock, { passive: true })
    window.addEventListener('resize', syncDock)
  }
  nextTick(syncDock)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frameId)
  if (props.sticky) {
    window.removeEventListener('scroll', syncDock)
    window.removeEventListener('resize', syncDock)
  }
})

const handlePageSizeChange = (value) => emit('update:pageSize', value)
const handleCurrentPageChange = (value) => emit('update:currentPage', value)
</script>

<template>
  <div ref="anchor" class="table-pagination">
    <div class="table-pagination-inner" :class="{ 'is-docked': docked }" :style="dockStyle">
      <div class="table-pagination-left">
        <el-pagination
          class="table-pagination-pager"
          v-model:current-page="currentPage"
          layout="prev, pager, next"
          :total="total"
          @update:current-page="handleCurrentPageChange"
        />
      </div>
      <el-select
        class="table-pagination-size"
        v-model="currentPageSize"
        @change="handlePageSizeChange"
      >
        <el-option
          v-for="size in pageSizes"
          :key="size"
          :label="`${size} 行/页`"
          :value="size"
        />
      </el-select>
    </div>
  </div>
</template>
