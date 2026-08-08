import { createRouter, createWebHashHistory } from 'vue-router'
import { BILLING_PATHS, COST_PATHS } from '../domain/constants.ts'

const billingRoute = (path, billingMenu, title, taskTab = 'list') => ({
  path,
  component: () => import('../billing/BillingRoute.vue'),
  meta: { domain: 'billing', billingMenu, title, taskTab },
})

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: BILLING_PATHS.receivableSummary },
    billingRoute(BILLING_PATHS.receivableSummary, 'receivableSummary', '营收总览'),
    billingRoute(BILLING_PATHS.receivable, 'receivable', '应收账单'),
    billingRoute(BILLING_PATHS.refund, 'refund', '返款账单'),
    billingRoute(BILLING_PATHS.remittance, 'remittance', '回款管理'),
    billingRoute(BILLING_PATHS.adjustments, 'adjustments', '调账中心'),
    billingRoute(BILLING_PATHS.config, 'config', '账单配置'),
    billingRoute(BILLING_PATHS.rates, 'rates', '汇率配置'),
    billingRoute(BILLING_PATHS.tasks, 'tasks', '生成任务'),
    billingRoute(BILLING_PATHS.base, 'tasks', '基础配置', 'base'),
    billingRoute(BILLING_PATHS.exports, 'exports', '导出管理'),
    billingRoute(BILLING_PATHS.audit, 'audit', '内部审计'),
    billingRoute(BILLING_PATHS.compare, 'compare', '报表比对'),
    billingRoute(BILLING_PATHS.migration, 'migration', '数据迁移'),
    { path: COST_PATHS.overview, component: () => import('../cost/views/OverviewView.vue'), meta: { domain: 'cost', costView: 'overview', title: '成本总览' } },
    { path: COST_PATHS.suppliers, component: () => import('../cost/views/SupplierView.vue'), meta: { domain: 'cost', costView: 'suppliers', title: '供应商管理' } },
    { path: COST_PATHS.bills, component: () => import('../cost/views/CostBillView.vue'), meta: { domain: 'cost', costView: 'bills', title: '成本账单' } },
    { path: COST_PATHS.billImport, component: () => import('../cost/views/CostBillImportView.vue'), meta: { domain: 'cost', costView: 'bills', title: '导入供应商账单', back: COST_PATHS.bills } },
    { path: `${COST_PATHS.bills}/:id`, component: () => import('../cost/views/CostBillDetailView.vue'), meta: { domain: 'cost', costView: 'bills', title: '成本账单详情', back: COST_PATHS.bills } },
    { path: COST_PATHS.pool, component: () => import('../cost/views/CostPoolView.vue'), meta: { domain: 'cost', costView: 'pool', title: '成本池' } },
    { path: COST_PATHS.rules, component: () => import('../cost/views/AllocationRuleView.vue'), meta: { domain: 'cost', costView: 'rules', title: '分摊规则' } },
    { path: COST_PATHS.profit, component: () => import('../cost/views/ProfitView.vue'), meta: { domain: 'cost', costView: 'profit', title: '利润分析' } },
    { path: COST_PATHS.fees, component: () => import('../cost/views/FeeIndexView.vue'), meta: { domain: 'cost', costView: 'fees', title: '成本费项索引' } },
    { path: '/:pathMatch(.*)*', redirect: BILLING_PATHS.receivableSummary },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

