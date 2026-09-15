import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { API_URL } from '../config'
import {
  extractionFailed,
  extractionProgress,
  extractionStarted,
  extractionSucceeded,
  type ChatMessage,
  type Complaint,
  type ComplaintDraft,
  type ComplaintPayload,
  type IntakeResult,
  type RiskAssessment,
} from './intakeSlice'

interface ChatRequest {
  message: string
  history: ChatMessage[]
  complaint: ComplaintDraft
  source_text: string | null
  risk: RiskAssessment | null
}

interface IntakeEvent {
  progress?: number
  message?: string
  result?: IntakeResult
  error?: string
}

export function describeDetail(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (Array.isArray(detail)) {
    return detail
      .map((d: { loc?: unknown[]; msg?: string }) => `${String(d.loc?.at(-1))}: ${d.msg}`)
      .join('; ')
  }
  return typeof detail === 'string' ? detail : fallback
}

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: API_URL }),
  tagTypes: ['Complaint'],
  endpoints: (build) => ({
    listComplaints: build.query<Complaint[], void>({
      query: () => '/api/complaints',
      providesTags: ['Complaint'],
    }),
    createComplaint: build.mutation<Complaint, ComplaintPayload>({
      query: (body) => ({ url: '/api/complaints', method: 'POST', body }),
      invalidatesTags: ['Complaint'],
    }),
    updateComplaint: build.mutation<Complaint, { id: number; body: ComplaintPayload }>({
      query: ({ id, body }) => ({ url: `/api/complaints/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Complaint'],
    }),
    chat: build.mutation<{ reply: string }, ChatRequest>({
      query: (body) => ({ url: '/api/copilot/chat', method: 'POST', body }),
    }),

    extract: build.mutation<IntakeResult, { file: File } | { text: string }>({
      async queryFn(arg, { dispatch }) {
        dispatch(extractionStarted())
        let init: RequestInit
        let path: string
        if ('file' in arg) {
          const form = new FormData()
          form.append('file', arg.file)
          init = { method: 'POST', body: form }
          path = '/api/intake/upload'
        } else {
          init = {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text: arg.text }),
          }
          path = '/api/intake/extract'
        }

        let res: Response
        try {
          res = await fetch(`${API_URL}${path}`, init)
        } catch {
          dispatch(extractionFailed('Could not reach the API. Is the backend running?'))
          return { error: { status: 'FETCH_ERROR', error: 'network' } }
        }
        if (!res.ok || !res.body) {
          const body: unknown = await res.json().catch(() => null)
          const message = describeDetail(body, `Request failed (${res.status})`)
          dispatch(extractionFailed(message))
          return { error: { status: res.status, data: message } }
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let result: IntakeResult | undefined
        let error: string | undefined
        const handle = (line: string) => {
          if (!line.trim()) return
          const event = JSON.parse(line) as IntakeEvent
          if (event.result) result = event.result
          else if (event.error) error = event.error
          else if (event.progress !== undefined) {
            dispatch(extractionProgress({ progress: event.progress, message: event.message ?? '' }))
          }
        }
        try {
          for (;;) {
            const { value, done } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''
            lines.forEach(handle)
          }
          handle(buffer)
        } catch {
          error = 'The extraction stream was interrupted. Please try again.'
        }

        if (result) {
          dispatch(extractionSucceeded(result))
          return { data: result }
        }
        const message = error ?? 'The AI returned no result. Please try again.'
        dispatch(extractionFailed(message))
        return { error: { status: 'CUSTOM_ERROR', error: message } }
      },
    }),
  }),
})

export const {
  useListComplaintsQuery,
  useCreateComplaintMutation,
  useUpdateComplaintMutation,
  useExtractMutation,
  useChatMutation,
} = api
