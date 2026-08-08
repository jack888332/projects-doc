<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import BillingApp from './App.vue'

const route = useRoute()
const menu = computed(() => route.meta.billingMenu || 'receivableSummary')
const taskTab = computed(() => route.meta.taskTab || 'list')
</script>

<template>
  <div class="billing-content">
    <BillingApp :key="route.fullPath" :initial-menu="menu" :initial-task-tab="taskTab" embedded />
  </div>
</template>

