import { apiClient } from './client'

export interface FetchEIAInventoryParams {
  region?: string
  commodity?: string
  start_date?: string
  end_date?: string
}

export interface FetchEIAPricesParams {
  commodity?: string
  start_date?: string
  end_date?: string
}

export async function fetchEIAInventory(params?: FetchEIAInventoryParams) {
  const { data } = await apiClient.get('/v1/eia/inventory', { params })
  return data
}

export async function fetchEIAPrices(params?: FetchEIAPricesParams) {
  const { data } = await apiClient.get('/v1/eia/prices', { params })
  return data
}
