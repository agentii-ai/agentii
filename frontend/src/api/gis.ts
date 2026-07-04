import { apiClient } from './client'

export interface FetchVesselsParams {
  vessel_type?: string
  bbox?: string
  limit?: number
}

export interface FetchPortsParams {
  country?: string
  commodity?: string
}

export interface FetchGraphParams {
  node_id: string
  depth?: number
  edge_type?: string
  start_date?: string
  end_date?: string
}

export async function fetchVessels(params?: FetchVesselsParams) {
  const { data } = await apiClient.get('/v1/gis/vessels', { params })
  return data
}

export async function fetchPorts(params?: FetchPortsParams) {
  const { data } = await apiClient.get('/v1/gis/ports', { params })
  return data
}

export async function fetchGraph(params: FetchGraphParams) {
  const { data } = await apiClient.get('/v1/gis/graph', { params })
  return data as { nodes: any[]; edges: any[] }
}
