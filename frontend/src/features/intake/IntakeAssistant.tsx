import { FileText, Send, Upload } from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react'
import { ToneBadge } from '@/components/tone-badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useAppDispatch, useAppSelector } from '../../store'
import { describeDetail, useChatMutation, useExtractMutation } from '../../store/api'
import { extractionFailed, messageAdded } from '../../store/intakeSlice'
import { complaintNumber, fieldLabel } from '../complaint/fields'

const ACCEPTED = ['pdf', 'docx', 'txt', 'eml']
const MAX_BYTES = 10 * 1024 * 1024

const bubble = 'rounded-lg border px-3 py-2.5 text-sm whitespace-pre-wrap'
const aiBubble = cn(bubble, 'border-primary/20 bg-primary/5')

export function IntakeAssistant() {
  const dispatch = useAppDispatch()
  const { extraction, risk, missingFields, draft, messages, complaintId } = useAppSelector(
    (s) => s.intake,
  )
  const [extract] = useExtractMutation()
  const [chat, { isLoading: replying }] = useChatMutation()
  const [dragging, setDragging] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasted, setPasted] = useState('')
  const [question, setQuestion] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const running = extraction.status === 'running'

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [messages.length, replying])

  const send = async (e: FormEvent) => {
    e.preventDefault()
    const message = question.trim()
    if (!message || replying) return
    setQuestion('')
    dispatch(messageAdded({ role: 'user', content: message }))
    try {
      const { reply } = await chat({
        message,
        history: messages.filter((m) => !m.error).slice(-20),
        complaint: draft,
        source_text: draft.source_text || null,
        risk,
      }).unwrap()
      dispatch(messageAdded({ role: 'assistant', content: reply }))
    } catch (err) {
      const detail = describeDetail(
        (err as { data?: unknown })?.data,
        'The copilot is unavailable.',
      )
      dispatch(messageAdded({ role: 'assistant', content: detail, error: true }))
    }
  }

  const submitFile = (file: File | undefined) => {
    if (!file || running) return
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ACCEPTED.includes(ext)) {
      dispatch(extractionFailed(`Unsupported file type ".${ext}". Use PDF, DOCX, TXT or EML.`))
      return
    }
    if (file.size > MAX_BYTES) {
      dispatch(extractionFailed('File is larger than 10MB.'))
      return
    }
    void extract({ file })
  }

  const submitText = () => {
    if (pasted.trim().length < 20) {
      dispatch(extractionFailed('Paste at least a few sentences of the complaint.'))
      return
    }
    setPasteOpen(false)
    void extract({ text: pasted })
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    submitFile(e.dataTransfer.files[0])
  }
  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    submitFile(e.target.files?.[0])
    e.target.value = ''
  }

  return (
    <Card className="flex min-w-0 flex-col lg:sticky lg:top-20 lg:max-h-[calc(100vh-6.5rem)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">AI Complaint Intake Assistant</CardTitle>
        <CardAction>
          <Badge variant="outline" className="text-primary">
            BETA
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
        <label
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors hover:bg-muted/50 focus-within:ring-3 focus-within:ring-ring/50',
            dragging && 'border-primary bg-primary/5',
            running && 'pointer-events-none opacity-60',
          )}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input
            type="file"
            className="sr-only"
            accept=".pdf,.docx,.txt,.eml"
            aria-label="Upload complaint document"
            disabled={running}
            onChange={onPick}
          />
          <Upload className="mb-1 size-5 text-muted-foreground" />
          <span className="text-sm font-medium">Drag &amp; drop complaint document here</span>
          <span className="text-xs text-muted-foreground">
            or <span className="text-primary underline">click to browse</span>
          </span>
        </label>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Separator className="flex-1" />
          OR
          <Separator className="flex-1" />
        </div>

        {pasteOpen ? (
          <div className="grid gap-2">
            <Textarea
              rows={7}
              autoFocus
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder="Paste the complaint email or letter text here..."
              aria-label="Complaint text"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPasteOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={submitText} disabled={running}>
                Extract details
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setPasteOpen(true)}
            disabled={running}
          >
            <FileText /> Paste Complaint Text / Email
          </Button>
        )}

        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
          <AlertDescription className="text-emerald-800">
            Supported formats: PDF, DOCX, TXT, EML · Max file size: 10MB
          </AlertDescription>
        </Alert>

        {extraction.status !== 'idle' && extraction.status !== 'error' && (
          <section aria-label="Extraction progress" className="grid gap-1.5">
            <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Extraction progress
            </h3>
            <div className="flex items-center gap-3">
              <Progress value={extraction.progress} className="flex-1" />
              <span className="text-xs tabular-nums text-muted-foreground">
                {extraction.progress}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{extraction.message}</p>
          </section>
        )}

        <section
          className="flex min-h-40 flex-1 flex-col gap-3 overflow-y-auto"
          aria-live="polite"
          aria-label="AI Assistant"
        >
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            AI Assistant
          </h3>
          {extraction.status === 'idle' && complaintId === null && (
            <div className={aiBubble}>
              Upload a complaint document or paste text above. I will automatically extract the
              details and populate the form for you.
            </div>
          )}
          {extraction.status === 'idle' && complaintId !== null && (
            <div className={aiBubble}>
              Complaint {complaintNumber(complaintId)} is open. Ask me anything about it, or upload
              a new document to update the form.
            </div>
          )}
          {running && <div className={aiBubble}>Reading the complaint and filling the form…</div>}
          {extraction.status === 'error' && (
            <div className={cn(bubble, 'border-destructive/30 bg-destructive/5 text-destructive')}>
              {extraction.message}
            </div>
          )}
          {extraction.status === 'done' && (
            <div className={aiBubble}>
              I have filled the form from the complaint. Fields marked <b>AI</b> came from the
              document — please review them before saving.
              {missingFields.length > 0 && (
                <>
                  <br />
                  <b>Not found in the document:</b> {missingFields.map(fieldLabel).join(', ')}.
                </>
              )}
            </div>
          )}
          {risk && (
            <div className="grid gap-2 rounded-lg border p-3 text-sm">
              <h4 className="font-semibold">AI Copilot Risk Assessment</h4>
              <div className="flex flex-wrap gap-1.5">
                <ToneBadge tone={risk.severity}>Severity: {risk.severity ?? 'n/a'}</ToneBadge>
                <ToneBadge tone={risk.priority}>Priority: {risk.priority ?? 'n/a'}</ToneBadge>
              </div>
              <p className="text-muted-foreground">{risk.rationale}</p>
              {risk.risk_factors.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-5">
                  {risk.risk_factors.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                m.role === 'user' ? cn(bubble, 'ml-8 bg-muted') : aiBubble,
                m.error && 'border-destructive/30 bg-destructive/5 text-destructive',
              )}
            >
              {m.content}
            </div>
          ))}
          {replying && <div className={cn(aiBubble, 'text-muted-foreground')}>Thinking…</div>}
          <div ref={endRef} />
        </section>
      </CardContent>

      <CardFooter className="grid gap-2 border-t">
        <form className="flex w-full gap-2" onSubmit={send}>
          <Input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask me anything about this complaint..."
            aria-label="Ask the copilot"
            disabled={replying}
          />
          <Button
            type="submit"
            size="icon"
            disabled={replying || !question.trim()}
            aria-label="Send"
          >
            <Send />
          </Button>
        </form>
        <p className="w-full text-center text-[11px] text-muted-foreground">
          AI responses may contain errors. Please verify information.
        </p>
      </CardFooter>
    </Card>
  )
}
