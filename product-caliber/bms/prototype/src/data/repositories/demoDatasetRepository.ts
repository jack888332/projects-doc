import { prototypeDb } from '../prototypeDb.js'

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

interface DemoRecord<T> {
  key: string
  dataset: string
  position: number
  value: T
}

export interface DemoDatasetRepository<T> {
  list(): Promise<T[]>
  ensureSeed(seedRows: T[], seedVersion?: number): Promise<void>
  replace(rows: T[]): Promise<void>
}

export function createDemoDatasetRepository<T>(dataset: string): DemoDatasetRepository<T> {
  const versionKey = `demoDatasetVersion:${dataset}`
  const records = prototypeDb.demoRecords.where('dataset').equals(dataset)

  return {
    async list() {
      const rows = await records.sortBy('position') as DemoRecord<T>[]
      return rows.map((record) => clone(record.value))
    },
    async ensureSeed(seedRows, seedVersion = 1) {
      const currentVersion = await prototypeDb.settings.get(versionKey)
      const recordCount = await records.count()
      if (recordCount && Number(currentVersion?.value || 0) >= seedVersion) return

      await prototypeDb.transaction('rw', prototypeDb.demoRecords, prototypeDb.settings, async () => {
        await records.delete()
        if (seedRows.length) {
          await prototypeDb.demoRecords.bulkPut(seedRows.map((value, position) => ({
            key: `${dataset}:${position}`,
            dataset,
            position,
            value: clone(value),
          })))
        }
        await prototypeDb.settings.put({ key: versionKey, value: seedVersion })
      })
    },
    async replace(rows) {
      await prototypeDb.transaction('rw', prototypeDb.demoRecords, async () => {
        await records.delete()
        if (rows.length) {
          await prototypeDb.demoRecords.bulkPut(rows.map((value, position) => ({
            key: `${dataset}:${position}`,
            dataset,
            position,
            value: clone(value),
          })))
        }
      })
    },
  }
}
