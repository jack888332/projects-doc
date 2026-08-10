<template>
  <el-table-column
    label="操作"
    :width="columnWidth"
    :fixed="fixed"
    class-name="table-operation-column"
    label-class-name="table-operation-column"
  >
    <template #default="scope">
      <div class="table-operation-content">
        <slot v-bind="scope" />
      </div>
    </template>
  </el-table-column>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  compact: { type: Boolean, default: false },
  fixed: { type: [String, Boolean], default: 'right' },
  width: { type: Number, default: 0 },
})

const columnWidth = computed(() => props.width || (props.compact ? 52 : 84))
</script>
