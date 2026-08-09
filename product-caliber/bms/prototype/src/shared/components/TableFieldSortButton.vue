<script setup>
import { ElMessage } from 'element-plus/es/components/message/index.mjs'
import { Sort } from '@element-plus/icons-vue'

function openFieldSort() {
  ElMessage.success('字段排序已打开')
}
</script>

<template>
  <el-button class="table-field-sort-button" :icon="Sort" @click="openFieldSort">字段排序</el-button>
</template>
