const PREFIX = 'app_'

export const storage = {
  get<T>(key: string): T | null {
    try {
      const val = localStorage.getItem(PREFIX + key)
      return val ? JSON.parse(val) : null
    } catch {
      return null
    }
  },
  set(key: string, value: unknown) {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  },
  remove(key: string) {
    localStorage.removeItem(PREFIX + key)
  }
}
