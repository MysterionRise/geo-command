import useSWR from 'swr'
import { api } from './api'

export function useApi<T>(path: string | null) {
  return useSWR<T>(path, (url: string) => api<T>(url))
}
