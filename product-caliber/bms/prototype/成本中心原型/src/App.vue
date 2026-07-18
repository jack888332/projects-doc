<script setup>
import { computed, ref } from 'vue'
import {
  ArrowDown, Bell, Box, Coin, DataAnalysis, Document, Expand, Fold,
  Menu, OfficeBuilding, QuestionFilled, Search, Setting, Share, Upload,
  User,
} from '@element-plus/icons-vue'
import OverviewView from './views/OverviewView.vue'
import SuppliersView from './views/SuppliersView.vue'
import BillsView from './views/BillsView.vue'
import CostPoolView from './views/CostPoolView.vue'
import AllocationView from './views/AllocationView.vue'
import ImportWizard from './components/ImportWizard.vue'

const active = ref('overview')
const collapsed = ref(false)
const importVisible = ref(false)
const notifications = ref(4)

const menuItems = [
  { key: 'overview', label: '成本概览', icon: DataAnalysis },
  { key: 'suppliers', label: '供应商管理', icon: OfficeBuilding },
  { key: 'bills', label: '成本账单', icon: Document },
  { key: 'cost-pool', label: '成本池', icon: Box },
  { key: 'allocation', label: '分摊池', icon: Share },
]

const current = computed(() => menuItems.find((item) => item.key === active.value))
const components = {
  overview: OverviewView,
  suppliers: SuppliersView,
  bills: BillsView,
  'cost-pool': CostPoolView,
  allocation: AllocationView,
}

function openImport() {
  importVisible.value = true
}
</script>

<template>
  <div class="app-shell" :class="{ 'is-collapsed': collapsed }">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark"><Coin /></div>
        <div v-if="!collapsed" class="brand-copy">
          <strong>BMS</strong>
          <span>账单管理系统</span>
        </div>
      </div>

      <nav class="main-nav" aria-label="成本中心菜单">
        <div v-if="!collapsed" class="nav-section-label">成本中心</div>
        <button
          v-for="item in menuItems"
          :key="item.key"
          class="nav-item"
          :class="{ active: active === item.key }"
          :title="collapsed ? item.label : ''"
          @click="active = item.key"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <span v-if="!collapsed">{{ item.label }}</span>
          <i v-if="item.key === 'cost-pool' && !collapsed" class="nav-count">3</i>
        </button>
      </nav>

      <div class="sidebar-spacer" />
      <div class="side-meta" v-if="!collapsed">
        <span class="meta-dot" />
        <div><strong>数据更新正常</strong><small>刚刚完成同步</small></div>
      </div>
      <button class="collapse-button" @click="collapsed = !collapsed" :title="collapsed ? '展开菜单' : '收起菜单'">
        <el-icon><Expand v-if="collapsed" /><Fold v-else /></el-icon>
        <span v-if="!collapsed">收起菜单</span>
      </button>
    </aside>

    <section class="workspace">
      <header class="topbar">
        <div class="topbar-left">
          <el-icon class="mobile-menu"><Menu /></el-icon>
          <span>账单系统</span><i>/</i><strong>成本中心</strong><i>/</i><span>{{ current?.label }}</span>
        </div>
        <div class="topbar-actions">
          <button class="icon-action" title="全局搜索"><el-icon><Search /></el-icon></button>
          <button class="icon-action notification" title="通知" @click="notifications = 0">
            <el-icon><Bell /></el-icon><b v-if="notifications">{{ notifications }}</b>
          </button>
          <button class="icon-action" title="帮助"><el-icon><QuestionFilled /></el-icon></button>
          <span class="topbar-divider" />
          <button class="profile-action">
            <span class="avatar"><User /></span>
            <span class="profile-copy"><strong>谭清辉</strong><small>财务管理员</small></span>
            <el-icon><ArrowDown /></el-icon>
          </button>
        </div>
      </header>

      <main class="page-main">
        <div class="page-heading">
          <div>
            <div class="eyebrow">COST CENTER</div>
            <h1>{{ current?.label }}</h1>
          </div>
          <div class="heading-actions">
            <el-button v-if="active !== 'overview'" :icon="Setting">页面设置</el-button>
            <el-button type="primary" :icon="Upload" @click="openImport">导入供应商账单</el-button>
          </div>
        </div>

        <component :is="components[active]" @open-import="openImport" @navigate="active = $event" />
      </main>
    </section>

    <ImportWizard v-model="importVisible" />
  </div>
</template>
