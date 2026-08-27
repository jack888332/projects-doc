import dayjs from 'dayjs'

const periodFromCycle = (cycle = '') => {
  if (cycle.includes('半周')) return 'HALF_WEEK'
  if (cycle.includes('半月')) return 'HALF_MONTH'
  if (cycle.includes('月')) return 'MONTH'
  if (cycle.includes('10')) return 'DAY_10'
  if (cycle.includes('15')) return 'DAY_15'
  if (cycle.includes('7')) return 'DAY_7'
  if (cycle.includes('1')) return 'DAY_1'
  return 'WEEK'
}

const rollingDays = period => Number(period?.replace('DAY_', '')) || 0

function intersectEffectPeriods(schemePeriod, customerPeriod) {
  const starts = [schemePeriod?.[0], customerPeriod?.[0]].filter(Boolean).map(value => dayjs(value).startOf('day'))
  const ends = [schemePeriod?.[1], customerPeriod?.[1]]
    .filter(value => value && value !== '长期')
    .map(value => dayjs(value).endOf('day'))
  const start = starts.reduce((latest, value) => (!latest || value.isAfter(latest) ? value : latest), null)
  const end = ends.reduce((earliest, value) => (!earliest || value.isBefore(earliest) ? value : earliest), null)
  return [start?.format('YYYY-MM-DD'), end?.format('YYYY-MM-DD') || '长期']
}

function latestClosedPeriod(period, effectPeriod, cutoff) {
  const cutoffDate = dayjs(cutoff).startOf('day')
  const effectStart = dayjs(effectPeriod?.[0]).startOf('day')
  const effectEnd = effectPeriod?.[1] && effectPeriod[1] !== '长期' ? dayjs(effectPeriod[1]).endOf('day') : null
  if (!effectStart.isValid() || !cutoffDate.isValid() || !cutoffDate.isAfter(effectStart)) return null

  let start
  let end
  if (period === 'MONTH') {
    end = cutoffDate.startOf('month').subtract(1, 'day')
    start = end.startOf('month')
  } else if (period === 'HALF_MONTH') {
    if (cutoffDate.date() > 15) {
      start = cutoffDate.startOf('month')
      end = start.date(15)
    } else {
      end = cutoffDate.startOf('month').subtract(1, 'day')
      start = end.startOf('month').date(16)
    }
  } else if (period === 'WEEK') {
    const currentMonday = cutoffDate.subtract((cutoffDate.day() + 6) % 7, 'day')
    end = currentMonday.subtract(1, 'day')
    start = end.subtract(6, 'day')
  } else if (period === 'HALF_WEEK') {
    const currentMonday = cutoffDate.subtract((cutoffDate.day() + 6) % 7, 'day')
    if (((cutoffDate.day() + 6) % 7) >= 4) {
      start = currentMonday
      end = currentMonday.add(3, 'day')
    } else {
      start = currentMonday.subtract(3, 'day')
      end = currentMonday.subtract(1, 'day')
    }
  } else {
    const days = rollingDays(period)
    const completed = days ? Math.floor(cutoffDate.diff(effectStart, 'day') / days) : 0
    if (completed < 1) return null
    start = effectStart.add((completed - 1) * days, 'day')
    end = start.add(days - 1, 'day')
  }

  if (end.isBefore(effectStart, 'day')) return null
  if (start.isBefore(effectStart, 'day')) start = effectStart
  if (effectEnd && start.isAfter(effectEnd, 'day')) return null
  if (effectEnd && end.isAfter(effectEnd, 'day')) end = effectEnd
  return { start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') }
}

function schemesFor(master) {
  if (master.type !== 'AR') {
    return [{
      schemeKey: 'REFUND',
      schemeName: '返款配置',
      schemeType: '不适用',
      period: periodFromCycle(master.cycle),
      effectPeriod: [master.effectStart, master.effectEnd],
    }]
  }

  const snapshot = master.schemeSnapshot
  if (!snapshot) return []
  const defaultScheme = { ...snapshot.defaultScheme, schemeKey:'DEFAULT', schemeName:'默认方案', schemeType:'默认方案' }
  const branches = snapshot.branches
    .filter(scheme => scheme.enabled !== false)
    .map((scheme, index) => ({ ...scheme, schemeKey:scheme.schemeKey || `BRANCH-${String(index + 1).padStart(2, '0')}`, schemeName:`分支方案 ${index + 1}`, schemeType:'分支方案' }))
  return [defaultScheme, ...branches]
}

export function buildMasterGenerationScopes({ master, customers, tasks, cutoff }) {
  if (!master) return { rows:[], exactCustomerCount:0, otherVersionCount:0 }
  const references = customers.filter(customer => customer.sourceType === 'MASTER' && customer.masterId === master.id)
  const exactReferences = references.filter(customer => customer.sourceNo === master.no && customer.version === master.version)
  const rows = exactReferences.flatMap(customer => schemesFor(master).map((scheme) => {
    const effectivePeriod = intersectEffectPeriods(scheme.effectPeriod, [customer.effectStart, customer.effectEnd])
    const period = latestClosedPeriod(scheme.period, effectivePeriod, cutoff)
    const periodKey = period ? `${period.start}/${period.end}` : '-'
    const lockKey = `${customer.customerCode}|${master.type}|${scheme.schemeKey}|${periodKey}|BILL_GENERATE`
    const scopeKey = `${customer.customerCode}|${master.type}|${scheme.schemeKey}|${periodKey}|${master.no}@${master.version}`
    const conflict = period && tasks.find(task => !task.deletedAt && ['PENDING','RUNNING','FAILED'].includes(task.status)
      && (task.lockKey === lockKey || (!task.lockKey && task.customerNo === customer.customerCode && task.periodStart === period.start && task.periodEnd === period.end && task.schemeKey === scheme.schemeKey)))
    const reason = !period ? '当前准确版本尚无已结束账期' : conflict ? `同范围任务未结束：${conflict.taskNo}` : ''
    return {
      id: `${customer.id}-${scheme.schemeKey}-${periodKey}`,
      customerId: customer.id,
      customerCode: customer.customerCode,
      customerName: customer.customerName,
      memberCode: customer.memberCode,
      store: customer.store,
      group: customer.group,
      customerReferenceNo: customer.referenceNo,
      billType: master.type,
      schemeKey: scheme.schemeKey,
      schemeName: scheme.schemeName,
      schemeType: scheme.schemeType,
      periodStart: period?.start || '-',
      periodEnd: period?.end || '-',
      scopeKey,
      lockKey,
      blocked: Boolean(reason),
      reason,
    }
  }))

  return {
    rows,
    exactCustomerCount: exactReferences.length,
    otherVersionCount: references.length - exactReferences.length,
  }
}

const nextSequence = (values, prefix) => values.reduce((max, value) => {
  if (!value?.startsWith(prefix)) return max
  return Math.max(max, Number(value.slice(prefix.length)) || 0)
}, 0) + 1

export function createMasterBatchTaskRows({ master, scopes, skippedCount, frozenCustomerCount, cutoff, existingTasks }) {
  const dateKey = dayjs(cutoff).format('YYYYMMDD')
  const batchPrefix = `BMSB-${dateKey}-`
  const taskPrefix = `BMS-${dateKey}-`
  const batchSequence = nextSequence(existingTasks.map(task => task.batchNo), batchPrefix)
  const firstTaskSequence = nextSequence(existingTasks.map(task => task.taskNo), taskPrefix)
  const batchNo = `${batchPrefix}${String(batchSequence).padStart(5, '0')}`
  const firstId = existingTasks.reduce((max, task) => Math.max(max, Number(task.id) || 0), 0) + 1
  const customerCount = frozenCustomerCount ?? new Set(scopes.map(scope => scope.customerCode)).size

  const rows = scopes.map((scope, index) => ({
    id: firstId + index,
    batchNo,
    batchCustomerCount: customerCount,
    batchTaskCount: scopes.length,
    batchSkippedCount: skippedCount,
    batchSkipSummary: skippedCount ? `${skippedCount} 个范围未通过创建校验` : '',
    taskNo: `${taskPrefix}${String(firstTaskSequence + index).padStart(5, '0')}`,
    status: 'PENDING',
    taskType: 'BILL_GENERATE',
    generationMode: 'PENDING',
    triggerType: 'MANUAL',
    billType: master.type,
    configSource: 'MASTER',
    configNo: master.no,
    configVersion: master.version,
    schemeKey: scope.schemeKey,
    schemeName: scope.schemeName,
    schemeType: scope.schemeType,
    customerReferenceNo: scope.customerReferenceNo,
    customerName: scope.customerName,
    customerNo: scope.customerCode,
    memberCode: scope.memberCode,
    shop: scope.store,
    customerGroup: scope.group,
    periodStart: scope.periodStart,
    periodEnd: scope.periodEnd,
    period: `${scope.periodStart} 至 ${scope.periodEnd}`,
    dataCutoff: cutoff,
    createdAt: cutoff,
    startedAt: '-',
    finishedAt: '-',
    duration: '0秒',
    operator: '财务管理员',
    failedStage: '',
    error: '',
    advice: '',
    sourceCount: 0,
    pooledFeeCount: 0,
    billCount: 0,
    netChange: 0,
    resultConclusion: '等待执行',
    resultVersion: '--',
    originalBills: [],
    newBills: [],
    scopeKey: scope.scopeKey,
    lockKey: scope.lockKey,
    sourceSql: 'SELECT ... FROM sale_order_fee_detail WHERE customer_no = :customerNo AND fee_created_at <= :dataCutoff;',
    recalculateScope: '',
    closeResult: '待判定',
    deletedAt: '',
    deletedBy: '',
  }))

  return { batchNo, rows }
}
