import { describe, expect, it } from 'vitest'
import reducer, {
  emptyDraft,
  extractionFailed,
  extractionStarted,
  extractionSucceeded,
  loadComplaint,
  messageAdded,
  resetDraft,
  setField,
  type Complaint,
  type IntakeResult,
} from './intakeSlice'

const result: IntakeResult = {
  fields: {
    customer_name: 'MedPharma Distributors Ltd',
    batch_lot_number: 'MF-2409-114',
    quantity_affected: '1200.000',
    quantity_unit: null,
    initial_severity: 'Major',
    priority: 'High',
    manufacturing_date: null,
  },
  risk: { severity: 'Major', priority: 'High', rationale: 'Visible defect.', risk_factors: ['x'] },
  missing_fields: ['complaint_date'],
  source_text: 'raw email',
}

describe('intakeSlice', () => {
  it('sets a field and reset returns the empty draft', () => {
    const edited = reducer(undefined, setField({ field: 'customer_name', value: 'MedPharma' }))
    expect(edited.draft.customer_name).toBe('MedPharma')
    expect(edited.draft.quantity_unit).toBe('kg')
    expect(reducer(edited, resetDraft()).draft).toEqual(emptyDraft)
  })

  it('applies only non-null extracted fields, tracks AI fields until edited', () => {
    let state = reducer(undefined, setField({ field: 'product_name', value: 'typed by user' }))
    state = reducer(state, extractionStarted())
    expect(state.extraction.status).toBe('running')

    state = reducer(state, extractionSucceeded(result))
    expect(state.draft.customer_name).toBe('MedPharma Distributors Ltd')
    expect(state.draft.initial_severity).toBe('Major')
    expect(state.draft.quantity_unit).toBe('kg')
    expect(state.draft.manufacturing_date).toBe('')
    expect(state.draft.product_name).toBe('typed by user')
    expect(state.draft.source_text).toBe('raw email')
    expect(state.aiFields).toEqual([
      'customer_name',
      'batch_lot_number',
      'quantity_affected',
      'initial_severity',
      'priority',
    ])
    expect(state.risk?.severity).toBe('Major')
    expect(state.missingFields).toEqual(['complaint_date'])
    expect(state.extraction).toEqual({
      status: 'done',
      progress: 100,
      message: 'Extraction complete.',
    })

    state = reducer(state, setField({ field: 'customer_name', value: 'edited' }))
    expect(state.aiFields).not.toContain('customer_name')

    state = reducer(state, extractionFailed('boom'))
    expect(state.extraction).toEqual({ status: 'error', progress: 0, message: 'boom' })
    expect(reducer(state, resetDraft())).toEqual(reducer(undefined, { type: 'init' }))
  })

  it('loads a saved complaint into a fresh draft and keeps chat messages until reset', () => {
    const row = {
      ...Object.fromEntries(Object.keys(emptyDraft).map((k) => [k, null])),
      id: 12,
      status: 'pending_triage',
      created_at: '2026-09-15T10:00:00',
      customer_name: 'NovaCare',
      quantity_unit: 'kg',
      initial_severity: 'Major',
      ai_risk: { severity: 'Major', priority: 'High', rationale: 'r', risk_factors: [] },
    } as unknown as Complaint
    let state = reducer(undefined, messageAdded({ role: 'user', content: 'old question' }))
    state = reducer(state, loadComplaint(row))
    expect(state.complaintId).toBe(12)
    expect(state.status).toBe('pending_triage')
    expect(state.risk?.rationale).toBe('r')
    expect(state.draft.customer_name).toBe('NovaCare')
    expect(state.draft.batch_lot_number).toBe('')
    expect(state.messages).toEqual([])

    state = reducer(state, messageAdded({ role: 'assistant', content: 'hi', error: true }))
    expect(state.messages).toHaveLength(1)
    expect(reducer(state, resetDraft()).complaintId).toBeNull()
  })
})
