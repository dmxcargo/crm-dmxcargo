import client, { unwrap } from './client'
import type {
  Prospect, ProspectCreatePayload, ProspectUpdatePayload, ProspectContact,
  Deal, Customer, FollowUp, Activity, StageHistoryEntry, Target, MasterItem,
  ImportRow, ImportJob, ExportJob, DashboardBoard, PipelineBoardRow, PerformanceRow,
  Paginated, User, Stage, Priority, FollowUpPriority, FollowUpStatus, FollowUpMode,
  PaymentStatusValue, PeriodType, ActivityType, Attendance, Completion, ImportDecision,
  ImportRowStatus, CustomerTypeValue,
} from '../types'

/** Nilai query yang boleh dikirim; undefined/null/'' otomatis di-drop (tidak dikirim ke server). */
type QueryValue = string | number | boolean | undefined | null
type QueryParams = Record<string, QueryValue>

const q = (p: QueryParams = {}): string => {
  const s = new URLSearchParams()
  Object.entries(p).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') s.append(k, String(v))
  })
  const str = s.toString()
  return str ? `?${str}` : ''
}

const g = async <T>(url: string): Promise<T> => unwrap<T>(await client.get(url))

const idem = (): { 'Idempotency-Key': string } => ({
  'Idempotency-Key': (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
})

/** Membersihkan body: field undefined/null/'' tidak dikirim (server juga menolak field prohibited kosong-string). */
const clean = <T extends object>(b: T = {} as T): Partial<T> => {
  const o: Record<string, unknown> = {}
  Object.entries(b as Record<string, unknown>).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') o[k] = v
  })
  return o as Partial<T>
}

const post = async <T>(url: string, body: object = {}): Promise<T> => unwrap<T>(await client.post(url, clean(body)))
const put = async <T>(url: string, body: object = {}): Promise<T> => unwrap<T>(await client.put(url, clean(body)))
const del = async <T>(url: string): Promise<T> => unwrap<T>(await client.delete(url))

interface RowsResult<T> {
  rows: T[]
  page: number
  pageSize?: number
  total: number
  pages: number
}

async function listRows<T>(url: string): Promise<RowsResult<T>> {
  const r = await client.get<Paginated<T>>(url)
  return {
    rows: r.data?.data ?? [],
    page: r.data?.page ?? 1,
    pageSize: r.data?.pageSize ?? 25,
    total: r.data?.totalItems ?? 0,
    pages: r.data?.totalPages ?? 1,
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  accessToken: string
  tokenType: string
  expiresAt: string
  user: User
}

export const authApi = {
  login: (login: string, password: string) => post<LoginResponse>('/auth/login', { login, password, deviceName: 'DMX Web' }),
  me: () => g<{ user?: User } | User>('/auth/me'),
  logout: () => post<{ message: string }>('/auth/logout'),
  revokeAll: () => post<{ message: string }>('/auth/revoke-all'),
}

// ─────────────────────────────────────────────────────────────────────────
// Prospects
// ─────────────────────────────────────────────────────────────────────────

export interface ProspectListQuery extends QueryParams {
  q?: string
  page?: number
  pageSize?: number
  stage?: Stage | ''
  priority?: Priority | ''
  sourceCode?: string
  owner?: string
  city?: string
  sort?: string
  dateFrom?: string
  dateTo?: string
  includeArchived?: boolean
}

export interface DuplicateCandidate {
  prospectId: string
  reason: 'EXTERNAL_ID' | 'PHONE' | 'EMAIL' | 'NAME_CITY'
  matchedValue: string
}

export interface AddActivityPayload {
  type: ActivityType
  notes: string
  activityAt?: string
  answered?: boolean
  durationMinutes?: number
  attendance?: Attendance
  completion?: Completion
  lastProgress?: string
  nextAction?: string
  nextFollowUpAt?: string
  taskPriority?: FollowUpPriority
}

export interface AddFollowUpPayload {
  scheduledAt: string
  description: string
  priority?: FollowUpPriority
  assigneeUserId?: string
  notes?: string
}

export const prospectApi = {
  list: (p: ProspectListQuery) => listRows<Prospect>(`/prospects${q(p)}`),
  get: (id: string) => g<Prospect>(`/prospects/${id}`),
  create: (b: ProspectCreatePayload, key?: string) =>
    client.post('/prospects', clean(b), { headers: key ? { 'Idempotency-Key': key } : idem() }).then((r) => unwrap<Prospect>(r)),
  update: (id: string, b: ProspectUpdatePayload) => put<Prospect>(`/prospects/${id}`, b),
  remove: (id: string) => del<{ message: string }>(`/prospects/${id}`),
  assign: (id: string, ownerUserId: string) => post<Prospect>(`/prospects/${id}/assign`, { ownerUserId }),
  stage: (id: string, stage: Stage, version: number) => post<Prospect>(`/prospects/${id}/stage`, { stage, version }),
  archive: (id: string, archived: boolean) => post<Prospect>(`/prospects/${id}/archive`, { archived }),
  addContact: (id: string, b: { name: string; position?: string; phone?: string; email?: string }) =>
    post<ProspectContact>(`/prospects/${id}/contacts`, b),
  removeContact: (id: string, cid: string) => del<{ message: string }>(`/prospects/${id}/contacts/${cid}`),
  duplicates: (p: { phone?: string; email?: string; accountName?: string; city?: string }) =>
    g<DuplicateCandidate[]>(`/prospects/duplicates${q(p)}`),
  activities: (id: string, type?: ActivityType) => g<Activity[]>(`/prospects/${id}/activities${q({ type })}`),
  addActivity: (id: string, b: AddActivityPayload) => post<Activity>(`/prospects/${id}/activities`, b),
  stageHistory: (id: string) => g<StageHistoryEntry[]>(`/prospects/${id}/stage-history`),
  deals: (id: string) => g<Deal[]>(`/prospects/${id}/deals`),
  createDeal: (id: string, b: { quotationNumber?: string; potentialValue?: number; quotationValue?: number }) =>
    post<Deal>(`/prospects/${id}/deals`, b),
  followUps: (id: string, b: AddFollowUpPayload) => post<FollowUp>(`/prospects/${id}/follow-ups`, b),
}

// ─────────────────────────────────────────────────────────────────────────
// Follow-ups
// ─────────────────────────────────────────────────────────────────────────

export interface FollowUpListQuery extends QueryParams {
  mode?: FollowUpMode
  status?: FollowUpStatus | ''
  page?: number
  pageSize?: number
  prospectId?: string
  assignee?: string
}

export const fuApi = {
  list: (p: FollowUpListQuery) => listRows<FollowUp>(`/follow-ups${q(p)}`),
  complete: (id: string) => post<FollowUp>(`/follow-ups/${id}/complete`),
  reschedule: (id: string, scheduledAt: string, version: number) =>
    post<FollowUp>(`/follow-ups/${id}/reschedule`, { scheduledAt, version }),
}

// ─────────────────────────────────────────────────────────────────────────
// Deals
// ─────────────────────────────────────────────────────────────────────────

export interface DealUpdatePayload {
  version: number
  quotationNumber?: string
  potentialValue?: number
  quotationValue?: number
  paymentStatus?: PaymentStatusValue
}

export interface DealWonPayload {
  closingDate: string
  closingValue: number
  customerMode?: 'new'
  customerId?: string
}

export const dealApi = {
  update: (id: string, b: DealUpdatePayload) => put<Deal>(`/deals/${id}`, b),
  won: (id: string, b: DealWonPayload) => post<Deal>(`/deals/${id}/won`, b),
  lost: (id: string, b: { lostReasonCode: string }) => post<Deal>(`/deals/${id}/lost`, b),
  candidates: (id: string) => g<Customer[]>(`/deals/${id}/customer-candidates`),
  payment: (id: string, paymentStatus: PaymentStatusValue) => post<Deal>(`/deals/${id}/payment-status`, { paymentStatus }),
  paymentHistory: (id: string) => g<Array<{ id?: string; fromStatus?: string; toStatus?: string; actorUserId?: string; createdAt: string }>>(`/deals/${id}/payment-history`),
}

// ─────────────────────────────────────────────────────────────────────────
// Customers
// ─────────────────────────────────────────────────────────────────────────

export interface CustomerListQuery extends QueryParams {
  q?: string
  page?: number
  pageSize?: number
}

export interface CustomerCreatePayload {
  accountName: string
  phone?: string
  email?: string
  city?: string
  province?: string
  industryCode?: string
}

export interface CustomerUpdatePayload extends Partial<CustomerCreatePayload> {
  version: number
  isActive?: boolean
}

export const customerApi = {
  list: (p: CustomerListQuery) => listRows<Customer>(`/customers${q(p)}`),
  get: (id: string) => g<Customer>(`/customers/${id}`),
  create: (b: CustomerCreatePayload) => post<Customer>('/customers', b),
  update: (id: string, b: CustomerUpdatePayload) => put<Customer>(`/customers/${id}`, b),
  deals: (id: string) => g<Deal[]>(`/customers/${id}/deals`),
  repeatOrder: (id: string, prospectId: string) => post<Deal>(`/customers/${id}/deals`, { prospectId }),
}

// ─────────────────────────────────────────────────────────────────────────
// Dashboard / Reports / Pipeline
// ─────────────────────────────────────────────────────────────────────────

export interface DashboardQuery extends QueryParams {
  owner?: string
  stage?: Stage | ''
  sourceCode?: string
  customerType?: CustomerTypeValue | ''
  priority?: Priority | ''
  from?: string
  to?: string
}

export interface PipelineQuery extends QueryParams {
  owner?: string
  /** Sesuai backend PipelineController: nama param query adalah `all`, BUKAN `allStages`. */
  all?: boolean
  dateFrom?: string
  dateTo?: string
}

export interface PerformanceQuery extends QueryParams {
  periodType: PeriodType
  period: string
  groupBy?: 'sales' | 'self'
  owner?: string
}

export interface AnnualQuery extends QueryParams {
  year: string
  owner?: string
}

export const dashApi = {
  board: (p?: DashboardQuery) => g<DashboardBoard>(`/dashboard${q(p)}`),
  pipeline: (p?: PipelineQuery) => g<PipelineBoardRow[]>(`/pipeline${q(p)}`),
  performance: (p: PerformanceQuery) => g<PerformanceRow[]>(`/reports/performance${q(p)}`),
  annual: (p: AnnualQuery) => g<{ year: string; totals: Record<string, unknown>; perSales: PerformanceRow[] }>(`/reports/annual${q(p)}`),
}

// ─────────────────────────────────────────────────────────────────────────
// Targets
// ─────────────────────────────────────────────────────────────────────────

export interface TargetListQuery extends QueryParams {
  userId?: string
  periodType?: PeriodType
  period?: string
}

export interface TargetCreatePayload {
  userId: string
  periodType: PeriodType
  period: string
  targetValue: number
}

export const targetApi = {
  list: (p: TargetListQuery) => listRows<Target>(`/targets${q(p)}`),
  create: (b: TargetCreatePayload) => post<Target>('/targets', b),
  update: (id: string, b: { targetValue: number; version: number }) => put<Target>(`/targets/${id}`, b),
}

// ─────────────────────────────────────────────────────────────────────────
// Master data
// ─────────────────────────────────────────────────────────────────────────

export interface MasterListQuery extends QueryParams {
  /** Kirim true untuk menyertakan item nonaktif (default backend: hanya aktif). */
  all?: boolean
}

export const masterApi = {
  sources: (p?: MasterListQuery) => g<MasterItem[]>(`/prospect-sources${q(p)}`),
  createSource: (b: { code: string; label: string }) => post<MasterItem>('/prospect-sources', b),
  updateSource: (code: string, b: { label?: string; isActive?: boolean }) => put<MasterItem>(`/prospect-sources/${code}`, b),
  industries: (p?: MasterListQuery) => g<MasterItem[]>(`/industries${q(p)}`),
  createIndustry: (b: { code: string; label: string }) => post<MasterItem>('/industries', b),
  updateIndustry: (code: string, b: { label?: string; isActive?: boolean }) => put<MasterItem>(`/industries/${code}`, b),
  reasons: (p?: MasterListQuery) => g<MasterItem[]>(`/lost-reasons${q(p)}`),
  createReason: (b: { code: string; label: string }) => post<MasterItem>('/lost-reasons', b),
  updateReason: (code: string, b: { label?: string; isActive?: boolean }) => put<MasterItem>(`/lost-reasons/${code}`, b),
}

// ─────────────────────────────────────────────────────────────────────────
// Users / Roles / Audit
// ─────────────────────────────────────────────────────────────────────────

export interface UserListQuery extends QueryParams {
  q?: string
  page?: number
  pageSize?: number
}

export interface UserCreatePayload {
  name: string
  username: string
  email: string
  password: string
  role: string
}

export interface UserUpdatePayload {
  version: number
  name?: string
  email?: string
  role?: string
  password?: string
  isActive?: boolean
}

export const userApi = {
  list: (p: UserListQuery) => listRows<User>(`/users${q(p)}`),
  get: (id: string) => g<User>(`/users/${id}`),
  create: (b: UserCreatePayload, key?: string) =>
    client.post('/users', clean(b), { headers: key ? { 'Idempotency-Key': key } : idem() }).then((r) => unwrap<User>(r)),
  update: (id: string, b: UserUpdatePayload) => put<User>(`/users/${id}`, b),
  revokeAll: (id: string) => post<{ message: string }>(`/users/${id}/revoke-all`),
}

export interface AuditListQuery extends QueryParams {
  action?: string
  page?: number
  pageSize?: number
}

export interface AuditLogEntry {
  id?: string
  actorUserId?: string | null
  action: string
  entityType?: string | null
  entityId?: string | null
  traceId?: string | null
  ipAddress?: string | null
  beforeData?: unknown
  afterData?: unknown
  createdAt: string
}

export const auditApi = {
  list: (p: AuditListQuery) => listRows<AuditLogEntry>(`/audit-logs${q(p)}`),
}

export interface RoleInfo {
  role?: string
  name?: string
  description?: string
  permissions?: Array<{ name?: string } | string>
}

export const roleApi = {
  list: () => g<RoleInfo[]>('/roles'),
}

// ─────────────────────────────────────────────────────────────────────────
// Import CSV
// ─────────────────────────────────────────────────────────────────────────

export interface ImportRowsQuery extends QueryParams {
  status?: ImportRowStatus | string
  page?: number
  pageSize?: number
}

export interface ImportReviewItem {
  rowNumber: number
  decision: ImportDecision
  version: number
  approvedFields?: string[]
}

export const importApi = {
  create: (fileName: string, content: string) => post<ImportJob>('/imports', { fileName, content }),
  validate: (id: string) => post<{ message: string; data: { id: string } }>(`/imports/${id}/validate`),
  show: (id: string) => g<ImportJob>(`/imports/${id}`),
  rows: (id: string, p: ImportRowsQuery) => listRows<ImportRow>(`/imports/${id}/rows${q(p)}`),
  review: (id: string, reviews: ImportReviewItem[]) => post<ImportJob>(`/imports/${id}/review`, { reviews }),
  commit: (id: string) => post<{ message: string; data: { id: string } }>(`/imports/${id}/commit`),
  cancel: (id: string) => post<ImportJob>(`/imports/${id}/cancel`),
}

// ─────────────────────────────────────────────────────────────────────────
// Archive Cold
// ─────────────────────────────────────────────────────────────────────────

export interface ArchiveCriteria {
  owner?: string
  dateFrom?: string
  dateTo?: string
}

export interface ArchiveJob {
  id: string
  status: string
  secondCopyVerified?: boolean
  purged?: boolean
  manifest?: Record<string, unknown>
}

export interface ArchiveStagingRow {
  id: string
  status: 'STAGED' | 'CONFLICT'
  accountName?: string
  conflict?: string | null
}

export interface ArchiveStagingQuery extends QueryParams {
  status?: string
  page?: number
  pageSize?: number
}

export const archiveApi = {
  preview: (b: ArchiveCriteria) => post<Record<string, unknown>>('/archives/preview', b),
  create: (b: ArchiveCriteria) => post<ArchiveJob>('/archives', b),
  show: (id: string) => g<ArchiveJob>(`/archives/${id}`),
  verify: (id: string) => post<Record<string, unknown>>(`/archives/${id}/verify`),
  copy: (id: string) => post<ArchiveJob>(`/archives/${id}/copy`),
  restore: (id: string) => post<Record<string, unknown>>(`/archives/${id}/restore`),
  staging: (id: string, p: ArchiveStagingQuery) => g<ArchiveStagingRow[]>(`/archives/${id}/staging${q(p)}`),
  purge: (id: string) => post<ArchiveJob>(`/archives/${id}/purge`, { approved: true }),
}

// ─────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────

export interface ExportProspectsPayload {
  q?: string
  stage?: Stage | ''
  priority?: Priority | ''
  city?: string
  sourceCode?: string
  dateFrom?: string
  dateTo?: string
  owner?: string
}

export interface ExportPerformancePayload {
  periodType: PeriodType
  period: string
  owner?: string
}

export const exportApi = {
  prospects: (b: ExportProspectsPayload) => post<ExportJob>('/exports/prospects', b),
  performance: (b: ExportPerformancePayload) => post<ExportJob>('/exports/performance', b),
  show: (id: string) => g<ExportJob>(`/exports/${id}`),
}

export const downloadExport = (id: string) => client.get(`/exports/${id}/download`, { responseType: 'blob' })
