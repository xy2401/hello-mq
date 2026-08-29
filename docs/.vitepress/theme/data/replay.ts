export type ReplayProduct = 'rabbitmq' | 'kafka' | 'redis-streams'

export type ReplayEvidenceStatus = 'verified' | 'pending' | 'failed'

export interface EvidenceRef {
  file: string
  line: number
  hash: string
  role: string
  content: string
}
export interface ReplayNodeState {
  id: string
  label: string
  kind: 'producer' | 'broker' | 'queue' | 'consumer' | 'database'
  status: 'idle' | 'active' | 'waiting' | 'failed' | 'done'
}

export interface ReplayMessageState {
  messageId?: string
  location?: string
  attempt?: number
  redelivered?: boolean
  queue?: string
  partition?: string
  offset?: number
  consumer?: string
  status?: string
}

export interface ReplayState {
  nodes: ReplayNodeState[]
  message: ReplayMessageState
  metrics: Record<string, string | number | boolean | null>
  business: Record<string, string | number | boolean | null>
}

export interface ReplayAction {
  id: string
  label: string
  targetTrack: string
  targetStep: number
}

export interface ReplayEvent {
  sequence: number
  relativeMs: number
  delayMs: number
  actor: string
  type: string
  title: string
  track: string
  messageId?: string
  state: ReplayState
  evidence: EvidenceRef[]
  actions?: ReplayAction[]
}

export interface ReplayTrack {
  id: string
  label: string
  description: string
  branchFrom?: { track: string; step: number }
  events: ReplayEvent[]
}

export interface ReplayScenario {
  schemaVersion: 1
  id: string
  product: ReplayProduct
  title: string
  model: string
  description: string
  evidenceStatus: ReplayEvidenceStatus
  image: { reference: string; digest: string }
  capture: {
    capturedAt: string | null
    exitCode: number | null
    tools: Record<string, string>
    sourceRevision: string | null
  }
  topology: ReplayNodeState[]
  defaultTrack: string
  tracks: ReplayTrack[]
  assertions: EvidenceRef[]
  document: string
}

export interface ReplayCatalogEntry {
  id: string
  product: ReplayProduct
  title: string
  model: string
  description: string
  document: string
  expectedTracks: string[]
  evidenceStatus: ReplayEvidenceStatus
  scenario?: ReplayScenario
  problem?: string
}
