<script setup>
import { ref } from 'vue'
import { Download, RefreshLeft, Upload } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { exportDatabase, importDatabase, resetDatabase } from '../db'

const fileInput = ref()

async function exportData() {
  const payload = await exportDatabase()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `BMS成本中心模拟数据-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
  ElMessage.success('模拟数据已导出')
}

async function selectImport(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  try {
    const payload = JSON.parse(await file.text())
    await ElMessageBox.confirm('导入会覆盖当前浏览器中的全部模拟数据，是否继续？', '导入模拟数据', { confirmButtonText: '确认导入', cancelButtonText: '取消', type: 'warning' })
    await importDatabase(payload)
    ElMessage.success('模拟数据已导入，各页面已同步刷新')
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(error?.message || '模拟数据导入失败')
  }
}

async function resetData() {
  await ElMessageBox.confirm('恢复后，当前浏览器中的编辑、导入和分摊结果都会被初始样本覆盖。', '恢复初始数据', { confirmButtonText: '确认恢复', cancelButtonText: '取消', type: 'warning' })
  await resetDatabase()
  ElMessage.success('已恢复初始模拟数据')
}
</script>

<template>
  <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="selectImport" />
  <el-dropdown trigger="click">
    <el-button>模拟数据</el-button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item :icon="Download" @click="exportData">导出模拟数据</el-dropdown-item>
        <el-dropdown-item :icon="Upload" @click="fileInput?.click()">导入模拟数据</el-dropdown-item>
        <el-dropdown-item divided :icon="RefreshLeft" @click="resetData">恢复初始数据</el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>
