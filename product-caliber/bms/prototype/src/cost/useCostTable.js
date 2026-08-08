import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { DEMO_DATA_CHANGED_EVENT, prototypeDb } from '../data/prototypeDb.js'

const clone = (value) => JSON.parse(JSON.stringify(value))

export function useCostTable(tableName) {
  const rows = ref([])
  const ready = ref(false)
  let saveTimer = null

  async function hydrate() {
    window.clearTimeout(saveTimer)
    ready.value = false
    rows.value = await prototypeDb.table(tableName).toArray()
    ready.value = true
  }

  async function persist() {
    const table = prototypeDb.table(tableName)
    const snapshot = clone(rows.value)
    await prototypeDb.transaction('rw', table, async () => {
      await table.clear()
      if (snapshot.length) await table.bulkPut(snapshot)
    })
  }

  function schedulePersist() {
    if (!ready.value) return
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => persist().catch(console.error), 80)
  }

  watch(rows, schedulePersist, { deep: true })
  onMounted(() => {
    hydrate().catch(console.error)
    window.addEventListener(DEMO_DATA_CHANGED_EVENT, hydrate)
  })
  onBeforeUnmount(() => {
    window.clearTimeout(saveTimer)
    if (ready.value) persist().catch(console.error)
    window.removeEventListener(DEMO_DATA_CHANGED_EVENT, hydrate)
  })

  return rows
}
