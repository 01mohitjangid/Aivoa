import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface ComplaintDraft {
  complaint_source: string
  customer_name: string
  product_name: string
  product_strength_grade: string
  batch_lot_number: string
  manufacturing_date: string
  expiry_date: string
  quantity_affected: string
  quantity_unit: string
  complaint_type: string
  complaint_date: string
  description: string
  initial_severity: string
  priority: string
  source_text: string
}

export const emptyDraft: ComplaintDraft = {
  complaint_source: '',
  customer_name: '',
  product_name: '',
  product_strength_grade: '',
  batch_lot_number: '',
  manufacturing_date: '',
  expiry_date: '',
  quantity_affected: '',
  quantity_unit: 'kg',
  complaint_type: '',
  complaint_date: '',
  description: '',
  initial_severity: '',
  priority: '',
  source_text: '',
}

export interface RiskAssessment {
  severity: string | null
  priority: string | null
  rationale: string
  risk_factors: string[]
}

export interface IntakeResult {
  fields: Partial<Record<keyof ComplaintDraft, string | null>>
  risk: RiskAssessment
  missing_fields: string[]
  source_text: string
}

type ExtractionStatus = 'idle' | 'running' | 'done' | 'error'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string

  error?: boolean
}

export type Complaint = { [K in keyof ComplaintDraft]: string | null } & {
  id: number
  status: string
  created_at: string
  ai_risk: RiskAssessment | null
}

export type ComplaintPayload = ComplaintDraft & { ai_risk: RiskAssessment | null }

interface IntakeState {
  draft: ComplaintDraft

  complaintId: number | null
  status: string
  messages: ChatMessage[]
  extraction: { status: ExtractionStatus; progress: number; message: string }
  risk: RiskAssessment | null
  missingFields: string[]

  aiFields: (keyof ComplaintDraft)[]
}

const initialState: IntakeState = {
  draft: emptyDraft,
  complaintId: null,
  status: 'pending_triage',
  messages: [],
  extraction: { status: 'idle', progress: 0, message: '' },
  risk: null,
  missingFields: [],
  aiFields: [],
}

const intakeSlice = createSlice({
  name: 'intake',
  initialState,
  reducers: {
    setField(state, { payload }: PayloadAction<{ field: keyof ComplaintDraft; value: string }>) {
      state.draft[payload.field] = payload.value
      state.aiFields = state.aiFields.filter((f) => f !== payload.field)
    },
    extractionStarted(state) {
      state.extraction = { status: 'running', progress: 5, message: 'Uploading complaint...' }
      state.risk = null
      state.missingFields = []
    },
    extractionProgress(state, { payload }: PayloadAction<{ progress: number; message: string }>) {
      state.extraction = { status: 'running', ...payload }
    },
    extractionSucceeded(state, { payload }: PayloadAction<IntakeResult>) {
      const filled: (keyof ComplaintDraft)[] = []
      for (const [key, value] of Object.entries(payload.fields)) {
        if (value !== null && value !== undefined && key in state.draft) {
          state.draft[key as keyof ComplaintDraft] = String(value)
          filled.push(key as keyof ComplaintDraft)
        }
      }
      state.draft.source_text = payload.source_text
      state.aiFields = filled
      state.risk = payload.risk
      state.missingFields = payload.missing_fields
      state.extraction = { status: 'done', progress: 100, message: 'Extraction complete.' }
    },
    extractionFailed(state, { payload }: PayloadAction<string>) {
      state.extraction = { status: 'error', progress: 0, message: payload }
    },

    loadComplaint(_state, { payload }: PayloadAction<Complaint>) {
      const draft = { ...emptyDraft }
      for (const key of Object.keys(emptyDraft) as (keyof ComplaintDraft)[]) {
        const value = payload[key]
        if (value !== null && value !== undefined) draft[key] = value
      }
      return {
        ...initialState,
        draft,
        complaintId: payload.id,
        status: payload.status,
        risk: payload.ai_risk,
      }
    },
    messageAdded(state, { payload }: PayloadAction<ChatMessage>) {
      state.messages.push(payload)
    },
    resetDraft: () => initialState,
  },
})

export const {
  setField,
  extractionStarted,
  extractionProgress,
  extractionSucceeded,
  extractionFailed,
  loadComplaint,
  messageAdded,
  resetDraft,
} = intakeSlice.actions
export default intakeSlice.reducer
