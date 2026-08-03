import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { DEMO_DATA_CHANGED_EVENT, prototypeDb } from '../../data/prototypeDb.js'

const clone = (value) => JSON.parse(JSON.stringify(value))

export function useDemoDataset(dataset, seedRows, seedVersion = 1) {
  const rows = ref([])
  const ready = ref(false)
  let saveTimer = null

  async function readDataset() {
    const records = await prototypeDb.demoRecords.where('dataset').equals(dataset).sortBy('position')
    rows.value = records.map((record) => record.value)
  }

  async function seedDataset() {
    const versionKey = `demoDatasetVersion:${dataset}`
    const currentVersion = await prototypeDb.settings.get(versionKey)
    const recordCount = await prototypeDb.demoRecords.where('dataset').equals(dataset).count()
    if (recordCount && Number(currentVersion?.value || 0) >= seedVersion) return

    await prototypeDb.transaction('rw', prototypeDb.demoRecords, prototypeDb.settings, async () => {
      await prototypeDb.demoRecords.where('dataset').equals(dataset).delete()
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
  }

  async function hydrate() {
    window.clearTimeout(saveTimer)
    ready.value = false
    await seedDataset()
    await readDataset()
    ready.value = true
  }

  async function persist() {
    const snapshot = clone(rows.value)
    await prototypeDb.transaction('rw', prototypeDb.demoRecords, async () => {
      await prototypeDb.demoRecords.where('dataset').equals(dataset).delete()
      if (snapshot.length) {
        await prototypeDb.demoRecords.bulkPut(snapshot.map((value, position) => ({
          key: `${dataset}:${position}`,
          dataset,
          position,
          value,
        })))
      }
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
