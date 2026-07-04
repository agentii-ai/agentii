import { apiClient } from './client'

export async function fetchWeatherBaseline(locationId: string, params?: { start_date?: string; end_date?: string }) {
  const { data } = await apiClient.get(`/v1/weather/baselines/${locationId}`, { params })
  return data
}

export async function fetchWeatherAnomaly(locationId: string, date?: string) {
  const dateStr = date || new Date().toISOString().split('T')[0]
  const { data } = await apiClient.get(`/v1/weather/anomalies/${locationId}/${dateStr}`)
  return data
}
