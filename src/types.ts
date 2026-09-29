/**
 * Kontrak API pusat — SATU-SATUNYA sumber kebenaran untuk tipe data yang
 * dipertukarkan antara frontend dan backend Laravel.
 *
 * PENTING: Nilai enum di bawah ini disalin PERSIS dari backend, agar TypeScript
 * menolak kompilasi jika frontend mengirim/membaca nilai yang tidak sesuai
 * kontrak API. Jangan ubah nilai di sini tanpa mengubah backend juga.
 *
 * Sumber acuan:
 * - backend/app/Shared/Presentation/ApiRequest.php   (validasi request)
 * - backend/app/Sales/Domain/ProspectStage.php
 * - backend/app/Sales/Domain/ProspectPriority.php
 * - backend/app/Sales/Domain/CustomerType.php
 * - backend/app/Sales/Domain/StageTransition.php
 * - backend/app/Sales/Domain/Prospect.php / Deal.php / Customer.php / Target.php
 * - backend/API.md
 */

// ─────────────────────────────────────────────────────────────────────────
// Enum kontrak (union type literal — TypeScript akan menolak nilai di luar ini)
// ─────────────────────────────────────────────────────────────────────────

/** ProspectStage.php */
export const STAGES = [
  'NEW', 'FOLLOW_UP', 'OPPORTUNITY', 'QUOTATION', 'NEGOTIATION',
  'CLOSING', 'WON', 'LOST', 'MAINTENANCE',
] as const
export type Stage = (typeof STAGES)[number]

export const STAGE_LABEL: Record<Stage, string> = {
  NEW: 'Baru', FOLLOW_UP: 'Follow Up', OPPORTUNITY: 'Opportunity', QUOTATION: 'Quotation',
  NEGOTIATION: 'Negosiasi', CLOSING: 'Closing', WON: 'Won', LOST: 'Lost', MAINTENANCE: 'Maintenance',
}

/** ProspectPriority.php */
export const PRIORITIES = ['HOT', 'WARM', 'COLD'] as const
export type Priority = (typeof PRIORITIES)[number]

/** CustomerType.php */
export const CUSTOMER_TYPES = ['B2B', 'B2C'] as const
export type CustomerTypeValue = (typeof CUSTOMER_TYPES)[number]

/** ApiRequest::rules() — activities.log 'type' */
export const ACT_TYPES = ['CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'VISIT', 'NOTE'] as const
export type ActivityType = (typeof ACT_TYPES)[number]

/** ApiRequest::rules() — activities.log 'attendance' (khusus VISIT) */
export const ATTENDANCE_VALUES = ['HADIR', 'TIDAK_HADIR', 'TERJADWAL'] as const
export type Attendance = (typeof ATTENDANCE_VALUES)[number]

/** ApiRequest::rules() — activities.log 'completion' (khusus VISIT) */
export const COMPLETION_VALUES = ['SELESAI', 'BATAL', 'TERJADWAL'] as const
export type Completion = (typeof COMPLETION_VALUES)[number]

/**
 * ApiRequest::rules() — followups.store / reschedule / activities.log 'taskPriority':
 * 'priority' => 'sometimes|in:PENTING,SEDANG,RENDAH'
 * CATATAN: bukan HOT/WARM/COLD, dan bukan 'TINGGI' — persis PENTING/SEDANG/RENDAH.
 */
export const FU_PRIORITIES = ['PENTING', 'SEDANG', 'RENDAH'] as const
export type FollowUpPriority = (typeof FU_PRIORITIES)[number]

/** ApiRequest::rules() — followups.reschedule 'status' */
export const FU_STATUSES = ['BELUM_DIMULAI', 'BERJALAN', 'SELESAI', 'BATAL'] as const
export type FollowUpStatus = (typeof FU_STATUSES)[number]

/** Mode filter GET /follow-ups (backend/app/Sales/Presentation/FollowUpController.php) */
export const FU_MODES = [
  { v: 'today', l: 'Hari Ini' },
  { v: 'overdue', l: 'Terlambat' },
  { v: 'upcoming', l: 'Mendatang' },
  { v: 'all', l: 'Semua' },
] as const
export type FollowUpMode = (typeof FU_MODES)[number]['v']

/** ManagePayments::FLOW — status pembayaran deal/prospect */
export const PAY_STATUSES = ['BELUM_DITAGIH', 'INVOICE', 'TERTAGIH', 'LUNAS', 'OVERDUE'] as const
export type PaymentStatusValue = (typeof PAY_STATUSES)[number]

/** DealStatus (backend/app/Sales/Domain/DealStatus.php) */
export const DEAL_STATUSES = ['OPEN', 'WON', 'LOST'] as const
export type DealStatusValue = (typeof DEAL_STATUSES)[number]

/** Role sistem — tepat tiga (PRD): ADMIN, BILLING, SALES */
export const ROLES = ['ADMIN', 'BILLING', 'SALES'] as const
export type Role = (typeof ROLES)[number]

/** TargetPeriod.php */
export const PERIOD_TYPES = ['MONTH', 'YEAR'] as const
export type PeriodType = (typeof PERIOD_TYPES)[number]

/** Keputusan review baris import CSV (backend/app/Sales/Application/ManageImports.php) */
export const IMPORT_DECISIONS = ['SKIP', 'CREATE_NEW', 'UPDATE_EXISTING', 'MERGE_SELECTED_FIELDS'] as const
export type ImportDecision = (typeof IMPORT_DECISIONS)[number]

/** Status baris staging import */
export const IMPORT_ROW_STATUSES = ['VALID', 'WARNING', 'INVALID', 'DUPLICATE', 'IMPORTED', 'SKIPPED'] as const
export type ImportRowStatus = (typeof IMPORT_ROW_STATUSES)[number]

// ─────────────────────────────────────────────────────────────────────────
// Aturan transisi stage (StageTransition::can()) — dipakai untuk validasi FE
// sebelum request dikirim, supaya tidak selalu gagal 422 ILLEGAL_TRANSITION.
// ─────────────────────────────────────────────────────────────────────────

const STAGE_ORDER: Stage[] = ['NEW', 'FOLLOW_UP', 'OPPORTUNITY', 'QUOTATION', 'NEGOTIATION', 'CLOSING']
const TERMINAL_STAGES: Stage[] = ['WON', 'LOST', 'MAINTENANCE']

/**
 * Menentukan daftar stage tujuan yang valid dari stage `from` melalui endpoint
 * POST /prospects/{id}/stage. WON dan LOST TIDAK PERNAH valid lewat endpoint ini
 * (hanya via POST /deals/{id}/won atau /lost). MAINTENANCE hanya dari WON.
 * `privileged` = user memiliki permission `sales.all` (ADMIN/BILLING).
 */
export function nextStageOptions(from: Stage, privileged: boolean): Stage[] {
  if (from === 'WON' || from === 'LOST') {
    return privileged ? ['FOLLOW_UP'] : []
  }
  const idx = STAGE_ORDER.indexOf(from)
  if (idx === -1) return []
  return STAGE_ORDER.slice(idx + 1)
}

export function isTerminalStage(s: Stage): boolean {
  return TERMINAL_STAGES.includes(s)
}

// ─────────────────────────────────────────────────────────────────────────
// Interface entitas domain (bentuk publicData() masing-masing model backend)
// ─────────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  username: string
  email: string
  role: Role
  isActive: boolean
  version: number
}

export interface ProspectContact {
  id: string
  name: string
  position?: string | null
  phone?: string | null
  email?: string | null
  primary?: boolean
}

/** Prospect.php::publicData() */
export interface Prospect {
  id: string
  legacyId?: string | null
  legacySourceRow?: number | null
  entryDate?: string | null
  accountName: string
  picName?: string | null
  picPosition?: string | null
  phone?: string | null
  phoneNormalized?: string | null
  email?: string | null
  city?: string | null
  province?: string | null
  industryCode?: string | null
  sourceCode: string
  ownerUserId: string
  stage: Stage
  priority: Priority
  lastProgress?: string | null
  nextFollowUpAt?: string | null
  nextAction?: string | null
  potentialValue?: string | null
  paymentStatus?: PaymentStatusValue | null
  customerType?: CustomerTypeValue | null
  notes?: string | null
  archived: boolean
  version: number
  contacts?: ProspectContact[]
}

/** Payload untuk POST/PUT /prospects — 'stage' dilarang di update (prohibited) */
export interface ProspectCreatePayload {
  accountName: string
  phone: string
  email?: string
  picName?: string
  picPosition?: string
  city?: string
  province?: string
  sourceCode: string
  industryCode?: string
  priority: Priority
  stage?: Stage
  entryDate?: string
  nextFollowUpAt?: string
  nextAction?: string
  lastProgress?: string
  notes?: string
  potentialValue?: number
  paymentStatus?: PaymentStatusValue
  customerType: CustomerTypeValue
  legacyId?: string
  legacySourceRow?: number
}

export type ProspectUpdatePayload = Partial<Omit<ProspectCreatePayload, 'stage' | 'customerType'>> & {
  version: number
  customerType?: CustomerTypeValue
}

/** Deal.php::publicData() */
export interface Deal {
  id: string
  prospectId: string
  customerId?: string | null
  dealNumber?: string | null
  quotationNumber?: string | null
  potentialValue?: string | null
  quotationValue?: string | null
  closingValue?: string | null
  closingDate?: string | null
  status: DealStatusValue
  lostReasonCode?: string | null
  paymentStatus?: PaymentStatusValue | null
  closingOwnerId?: string | null
  version: number
}

/** Customer.php::publicData() */
export interface Customer {
  id: string
  accountName: string
  phone?: string | null
  phoneNormalized?: string | null
  email?: string | null
  city?: string | null
  province?: string | null
  industryCode?: string | null
  active: boolean
  version: number
}

/** FollowUp (backend/app/Sales/Domain/FollowUp.php) + prospectName dari controller */
export interface FollowUp {
  id: string
  prospectId: string
  prospectName?: string | null
  assigneeUserId: string
  scheduledAt: string
  priority: FollowUpPriority
  status: FollowUpStatus
  description: string
  notes?: string | null
  version: number
  completedAt?: string | null
}

/** Activity (backend/app/Sales/Domain/Activity.php) */
export interface Activity {
  id: string
  prospectId: string
  type: ActivityType
  activityAt?: string | null
  createdAt?: string | null
  notes?: string | null
  answered?: boolean
  durationMinutes?: number
  attendance?: Attendance | null
  completion?: Completion | null
  nextAction?: string | null
}

/** StageHistory row */
export interface StageHistoryEntry {
  id?: string
  fromStage: Stage | null
  toStage: Stage
  actorUserId?: string | null
  createdAt: string
  durationSeconds?: number
}

/** Target.php::publicData() */
export interface Target {
  id: string
  userId: string
  periodType: PeriodType
  period: string
  targetValue: string
  version: number
}

/** Master data (prospect_sources / industries / lost_reasons) */
export interface MasterItem {
  code: string
  label: string
  active: boolean
}

/** ImportRow publicData() */
export interface ImportRow {
  rowNumber: number
  status: ImportRowStatus
  codes?: string[]
  decision?: ImportDecision | null
  approvedFields?: string[]
  result?: string | null
  version: number
}

export interface ImportJob {
  id: string
  fileName: string
  status: string
  counters?: Record<string, number | boolean>
  reconciliation?: {
    inserted?: number
    updated?: number
    skipped?: number
    failed?: number
    pending?: number
    balanced?: boolean
  }
}

export interface ExportJob {
  id: string
  type: 'prospect' | 'performance'
  status: 'PROCESSING' | 'DONE' | 'FAILED'
  expiresAt?: string | null
  result?: string | null
  version: number
}

/** MetricsService::dashboard() */
export interface DashboardBoard {
  activeProspect: number
  byStage: Array<{ stage: Stage; count: number }>
  byPriority: Array<{ priority: Priority; count: number }>
  followUpsToday: number
  followUpsOverdue: number
  potentialValue: string
  quotationValue: string
  closingValue: string
}

/** PipelineService::board() */
export interface PipelineBoardRow {
  stage: Stage
  count: number
  totalValue: number
  closingValue: number
}

/** MetricsService::perOwner() */
export interface PerformanceRow {
  ownerUserId: string
  ownerName?: string
  targetValue: string | null
  actualValue: string
  achievement: number | null
  closingRate: number | null
  totalProspect: number
  closingCount: number
  hotCount: number
  warmCount: number
  coldCount: number
  followUpCount: number
  activities: Array<{ type: ActivityType; c: number; answered?: number }>
  overdueFollowUps: number
}

/** Standar respons paginasi backend */
export interface Paginated<T> {
  data: T[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

/** Bentuk error standar backend: {code, message, traceId, fieldErrors} */
export interface ApiErrorBody {
  code?: string
  message?: string
  traceId?: string
  fieldErrors?: Record<string, string[]>
  errors?: Record<string, string[]>
}
