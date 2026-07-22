import Dexie from 'dexie'
import { allocationPools, bills, costRows, suppliers } from './data'

const DATABASE_NAME = 'BmsCostCenterPrototype'
const SEED_VERSION = 2

export const db = new Dexie(DATABASE_NAME)

db.version(1).stores({
  suppliers: '&code,name,status,*modules,cycle',
  costBills: '&id,supplier,module,settled,importedAt',
  costItems: '&id,bill,supplier,module,type,status,key',
  costItemAliases: '++id,&[supplier+module+rawName],supplier,module,rawName,item',
  importSnapshots: '&supplier,updatedAt',
  allocationRules: '&id,module,item,supplier,status',
  allocationPools: '&id,module,item,supplier,status',
  allocationResults: '++id,poolId,orderNo',
  operationLogs: '++id,entityType,entityId,action,createdAt',
  appSettings: '&key',
})

const managedTables = [
  'suppliers',
  'costBills',
  'costItems',
  'costItemAliases',
  'importSnapshots',
  'allocationRules',
  'allocationPools',
  'allocationResults',
  'operationLogs',
  'appSettings',
]

const clone = (value) => JSON.parse(JSON.stringify(value))

const seedAliases = [
  { supplier: '东风速运有限公司', module: '派送成本', rawName: '派件費', item: '派送费' },
  { supplier: '东风速运有限公司', module: '派送成本', rawName: '拖車及疊貨費', item: '派送附加费' },
  { supplier: '福广国际报关有限公司', module: '清关成本', rawName: '稅費金額', item: '进口税金' },
  { supplier: '福广国际报关有限公司', module: '清关成本', rawName: '倉租', item: '仓租费' },
  { supplier: '联多国际货运', module: '海运成本', rawName: 'DOC FEE', item: '文件费' },
  { supplier: '桃园仓配车队', module: '租车成本', rawName: '車趟費', item: '租车费' },
]

const seedSnapshots = suppliers
  .filter((item) => item.snapshot !== '暂无')
  .map((item) => ({
    supplier: item.code,
    supplierName: item.name,
    module: item.modules[0],
    fileStructure: '当前供应商最近一次确认的字段配对',
    updatedAt: item.snapshot,
  }))

const seedRules = [
  { id: 'RULE-SEA-DOC', module: '海运成本', item: '文件费', supplier: '联多国际货运', factor: '计费重量', fallback: '业务订单件数', status: '启用' },
  { id: 'RULE-TRUCK', module: '租车成本', item: '租车费', supplier: '桃园仓配车队', factor: '业务订单件数', fallback: '平均分摊', status: '启用' },
  { id: 'RULE-CUSTOMS-WH', module: '清关成本', item: '仓租费', supplier: '福广国际报关有限公司', factor: '清关重量', fallback: '业务订单件数', status: '启用' },
]

const seedResults = [
  { poolId: 'POOL-TRUCK-202606', orderNo: 'SO260605018', amount: 42.318, currency: 'TWD', version: 1 },
  { poolId: 'POOL-TRUCK-202606', orderNo: 'SO260605026', amount: 38.611, currency: 'TWD', version: 1 },
]

async function writeSeedData() {
  await db.suppliers.bulkPut(clone(suppliers))
  await db.costBills.bulkPut(clone(bills))
  await db.costItems.bulkPut(clone(costRows))
  await db.costItemAliases.bulkPut(clone(seedAliases))
  await db.importSnapshots.bulkPut(clone(seedSnapshots))
  await db.allocationRules.bulkPut(clone(seedRules))
  await db.allocationPools.bulkPut(clone(allocationPools))
  await db.allocationResults.bulkPut(clone(seedResults))
  await db.operationLogs.add({ entityType: '系统', entityId: DATABASE_NAME, action: '初始化模拟数据', createdAt: new Date().toISOString() })
  await db.appSettings.put({ key: 'seedVersion', value: SEED_VERSION })
}

export async function initializeDatabase() {
  await db.open()
  const seedState = await db.appSettings.get('seedVersion')
  if (seedState?.value === SEED_VERSION) return
  if (seedState) {
    await db.transaction('rw', [db.costItems, db.appSettings], async () => {
      const targetUpdates = {
        'COST-260716-00128': { keyType: '供应商追踪号', target: '尾程运单号 AG099649-1' },
        'COST-260716-00129': { keyType: '供应商追踪号', target: '尾程运单号 LWD032402' },
        'COST-260714-00316': { target: '业务订单号 SO260619036' },
        'COST-260714-00317': { target: '业务订单号 SO260623686' },
      }
      for (const [id, changes] of Object.entries(targetUpdates)) await db.costItems.update(id, changes)
      await db.appSettings.put({ key: 'seedVersion', value: SEED_VERSION })
    })
    return
  }
  await db.transaction('rw', db.tables, writeSeedData)
}

export async function resetDatabase() {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()))
    await writeSeedData()
  })
}

export async function exportDatabase() {
  const data = {}
  for (const tableName of managedTables) data[tableName] = await db.table(tableName).toArray()
  return {
    format: 'bms-cost-center-prototype',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  }
}

export async function importDatabase(payload) {
  if (payload?.format !== 'bms-cost-center-prototype' || !payload.data) throw new Error('不是有效的成本中心模拟数据文件')
  for (const tableName of managedTables) {
    if (!Array.isArray(payload.data[tableName])) throw new Error(`模拟数据缺少 ${tableName}`)
  }

  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()))
    for (const tableName of managedTables) {
      const rows = clone(payload.data[tableName])
      if (rows.length) await db.table(tableName).bulkAdd(rows)
    }
    await db.operationLogs.add({ entityType: '系统', entityId: DATABASE_NAME, action: '导入模拟数据', createdAt: new Date().toISOString() })
  })
}

export async function recordOperation(entityType, entityId, action, detail = '') {
  return db.operationLogs.add({ entityType, entityId, action, detail, createdAt: new Date().toISOString() })
}

export function createBusinessId(prefix) {
  const now = new Date()
  const date = [now.getFullYear(), `${now.getMonth() + 1}`.padStart(2, '0'), `${now.getDate()}`.padStart(2, '0')].join('')
  const suffix = Math.random().toString(16).slice(2, 8).toUpperCase().padEnd(6, '0')
  return `${prefix}-${date}-${suffix}`
}
