import { prototypeDb } from './prototypeDb.js'

const clone = (value) => JSON.parse(JSON.stringify(value))

export function createRepository(tableName) {
  const table = prototypeDb.table(tableName)
  const keyPath = table.schema.primKey.keyPath
  const keyOf = (row) => row?.[keyPath]

  return {
    tableName,
    keyOf,
    list: () => table.toArray(),
    get: (key) => table.get(key),
    put: (row) => table.put(clone(row)),
    bulkPut: (rows) => table.bulkPut(clone(rows)),
    update: (key, changes) => table.update(key, clone(changes)),
    remove: (key) => table.delete(key),
    clear: () => table.clear(),
    async sync(previousRows, nextRows) {
      const previous = new Map(previousRows.map((row) => [keyOf(row), row]))
      const next = new Map(nextRows.map((row) => [keyOf(row), row]))
      const changed = nextRows.filter((row) => JSON.stringify(previous.get(keyOf(row))) !== JSON.stringify(row))
      const removed = [...previous.keys()].filter((key) => !next.has(key))

      await prototypeDb.transaction('rw', table, async () => {
        if (changed.length) await table.bulkPut(clone(changed))
        if (removed.length) await table.bulkDelete(removed)
      })
    },
  }
}

