import { liveQuery } from 'dexie'
import { onMounted, onUnmounted, ref } from 'vue'
import { initializeDatabase } from '../db'

export function useLiveData(query, initialValue = []) {
  const data = ref(initialValue)
  const loading = ref(true)
  const error = ref(null)
  let subscription

  onMounted(async () => {
    await initializeDatabase()
    subscription = liveQuery(query).subscribe({
      next(value) {
        data.value = value
        loading.value = false
      },
      error(reason) {
        error.value = reason
        loading.value = false
      },
    })
  })

  onUnmounted(() => subscription?.unsubscribe())

  return { data, loading, error }
}
