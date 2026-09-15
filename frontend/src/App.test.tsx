// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { makeStore } from './store'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const ndjson = (lines: unknown[]) => {
  const text = lines.map((l) => JSON.stringify(l)).join('\n') + '\n'
  const cut = Math.floor(text.length / 2)
  const chunks = [text.slice(0, cut), text.slice(cut)].map((c) => new TextEncoder().encode(c))
  return new Response(
    new ReadableStream({
      start(controller) {
        chunks.forEach((c) => controller.enqueue(c))
        controller.close()
      },
    }),
    { status: 200, headers: { 'content-type': 'application/x-ndjson' } },
  )
}

const renderApp = () =>
  render(
    <Provider store={makeStore()}>
      <App />
    </Provider>,
  )

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.location.hash = ''
})

const savedRow = {
  id: 12,
  status: 'pending_triage',
  created_at: '2026-09-15T10:00:00',
  complaint_source: 'Letter',
  customer_name: 'NovaCare Formulations Pvt. Ltd.',
  product_name: 'Atorvastatin Calcium API',
  product_strength_grade: 'EP, micronized',
  batch_lot_number: 'ATC-2406-021',
  manufacturing_date: '2026-06-01',
  expiry_date: '2028-05-01',
  quantity_affected: '50.000',
  quantity_unit: 'kg',
  complaint_type: 'Potency / Assay OOS',
  complaint_date: '2026-09-12',
  description: 'Assay 97.1% vs spec 98.0-102.0%.',
  initial_severity: 'Major',
  priority: 'High',
  source_text: 'letter text',
  ai_risk: {
    severity: 'Major',
    priority: 'High',
    rationale: 'Assay below specification.',
    risk_factors: ['potency'],
  },
}

describe('Log Customer Complaint form', () => {
  it('renders all 13 fields empty with the AI placeholder and the Pending Triage badge', () => {
    renderApp()
    expect(screen.getByText('Pending Triage')).toBeTruthy()
    expect(screen.getAllByPlaceholderText('Awaiting AI extraction...')).toHaveLength(11)
    expect(screen.getAllByRole('combobox')).toHaveLength(2)
  })

  it('shows the API validation error when saving a blank form', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        json(422, { detail: [{ loc: ['body', 'description'], msg: 'Field required' }] }),
      )
    vi.stubGlobal('fetch', fetchMock)
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: /save complaint/i }))

    expect(await screen.findByText('description: Field required')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    fireEvent.change(screen.getByLabelText('Detailed Complaint Description'), {
      target: { value: 'now filled' },
    })
    expect(screen.queryByText('description: Field required')).toBeNull()
  })

  it('posts the draft, shows the saved id and resets the form', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        json(201, { id: 7, status: 'pending_triage', description: 'Brown spots on tablets' }),
      )
    vi.stubGlobal('fetch', fetchMock)
    renderApp()

    const description = screen.getByLabelText('Detailed Complaint Description')
    fireEvent.change(description, { target: { value: 'Brown spots on tablets' } })
    fireEvent.change(screen.getByLabelText('Initial Severity'), { target: { value: 'Major' } })
    fireEvent.click(screen.getByRole('button', { name: /save complaint/i }))

    expect(await screen.findByText(/Saved as CC-000007/)).toBeTruthy()
    const [url, init] = fetchMock.mock.calls[0] as [Request | string, RequestInit | undefined]
    const request = url instanceof Request ? url : new Request(url, init)
    expect(request.method).toBe('POST')
    expect(new URL(request.url).pathname).toBe('/api/complaints')
    expect(await request.json()).toMatchObject({
      description: 'Brown spots on tablets',
      initial_severity: 'Major',
      quantity_unit: 'kg',
      ai_risk: null,
    })
    expect((description as HTMLTextAreaElement).value).toBe('')
  })

  it('pastes text, streams progress, fills the form and shows the risk card', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      ndjson([
        { progress: 15, message: 'Analyzing document content...' },
        { progress: 60, message: 'Assessing risk...' },
        {
          result: {
            fields: {
              customer_name: 'MedPharma Distributors Ltd',
              batch_lot_number: 'MF-2409-114',
              initial_severity: 'Major',
              priority: 'High',
              complaint_date: null,
            },
            risk: {
              severity: 'Major',
              priority: 'High',
              rationale: 'Discolouration suggests degradation.',
              risk_factors: ['distributed batch'],
            },
            missing_fields: ['complaint_date'],
            source_text: 'raw',
          },
        },
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: /paste complaint text/i }))
    fireEvent.change(screen.getByLabelText('Complaint text'), {
      target: {
        value: 'Dear QA team, brown spots were observed on Metformin tablets, batch MF-2409-114.',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: /extract details/i }))

    expect(await screen.findByText('AI Copilot Risk Assessment')).toBeTruthy()
    expect(screen.getByText('Extraction complete.')).toBeTruthy()
    expect((screen.getByLabelText(/Customer Name/) as HTMLInputElement).value).toBe(
      'MedPharma Distributors Ltd',
    )
    expect((screen.getByLabelText(/Initial Severity/) as HTMLSelectElement).value).toBe('Major')
    expect(screen.getByText(/Not found in the document:/).parentElement?.textContent).toContain(
      'Complaint Date',
    )
    expect(screen.getByText('Discolouration suggests degradation.')).toBeTruthy()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/intake/extract')
    expect(JSON.parse(String(init.body)).text).toContain('MF-2409-114')
  })

  it('rejects an unsupported file locally without calling the API', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { container } = renderApp()
    const input = container.querySelector('input[type=file]') as HTMLInputElement
    const photo = new File(['x'], 'photo.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [photo] } })
    expect(screen.getByText(/Unsupported file type ".png"/)).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('lists saved complaints in the register and opens one into the form for update', async () => {
    const fetchMock = vi.fn(async (input: Request | string, init?: RequestInit) => {
      const req = input instanceof Request ? input : new Request(input, init)
      if (req.method === 'GET') return json(200, [savedRow])
      return json(200, { ...savedRow, priority: 'Low' })
    })
    vi.stubGlobal('fetch', fetchMock)
    window.location.hash = '#/register'
    renderApp()

    expect(await screen.findByText('CC-000012')).toBeTruthy()
    expect(screen.getByText('ATC-2406-021')).toBeTruthy()
    expect(screen.getByText('1 complaints')).toBeTruthy()

    fireEvent.click(screen.getByText('CC-000012'))
    expect(await screen.findByText('Log Customer Complaint')).toBeTruthy()
    expect((screen.getByLabelText(/Customer Name/) as HTMLInputElement).value).toBe(
      'NovaCare Formulations Pvt. Ltd.',
    )
    expect(screen.getByText(/CC-000012 · Pending Triage/)).toBeTruthy()
    expect(screen.getByText('AI Copilot Risk Assessment')).toBeTruthy()
    expect(screen.getByText('Assay below specification.')).toBeTruthy()
    expect(screen.getByText(/Complaint CC-000012 is open/)).toBeTruthy()

    fireEvent.change(screen.getByLabelText(/^Priority/), { target: { value: 'Low' } })
    fireEvent.click(screen.getByRole('button', { name: /update complaint/i }))
    expect(await screen.findByText(/Updated CC-000012/)).toBeTruthy()
    const put = fetchMock.mock.calls.map(([i, init]) =>
      i instanceof Request ? i : new Request(i, init),
    )
    const putReq = put.find((r) => r.method === 'PUT')!
    expect(new URL(putReq.url).pathname).toBe('/api/complaints/12')
    expect(await putReq.json()).toMatchObject({
      priority: 'Low',
      batch_lot_number: 'ATC-2406-021',
      ai_risk: { severity: 'Major', rationale: 'Assay below specification.' },
    })
  })

  it('sends a copilot question with the draft as context and shows the reply', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json(200, { reply: 'Quarantine batch MF-2409-114 and open a deviation.' }))
    vi.stubGlobal('fetch', fetchMock)
    renderApp()

    fireEvent.change(screen.getByLabelText('Batch/Lot Number'), {
      target: { value: 'MF-2409-114' },
    })
    fireEvent.change(screen.getByLabelText('Ask the copilot'), {
      target: { value: 'What should we do first?' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(screen.getByText('What should we do first?')).toBeTruthy()
    expect(await screen.findByText(/Quarantine batch MF-2409-114/)).toBeTruthy()
    const [url, init] = fetchMock.mock.calls[0] as [Request | string, RequestInit | undefined]
    const req = url instanceof Request ? url : new Request(url, init)
    expect(new URL(req.url).pathname).toBe('/api/copilot/chat')
    const body = await req.json()
    expect(body.message).toBe('What should we do first?')
    expect(body.complaint.batch_lot_number).toBe('MF-2409-114')
    expect(body.history).toEqual([])
    expect((screen.getByLabelText('Ask the copilot') as HTMLInputElement).value).toBe('')
  })
})
