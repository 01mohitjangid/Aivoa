import { RotateCcw, Save } from 'lucide-react'
import { Fragment, useState, type FormEvent } from 'react'
import { ToneBadge } from '@/components/tone-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useAppDispatch, useAppSelector } from '../../store'
import {
  describeDetail,
  useCreateComplaintMutation,
  useUpdateComplaintMutation,
} from '../../store/api'
import { resetDraft, setField, type ComplaintDraft } from '../../store/intakeSlice'
import { SECTIONS, complaintNumber, statusLabel, type FieldSpec } from './fields'

const PLACEHOLDER = 'Awaiting AI extraction...'

const errorMessage = (error: unknown) =>
  describeDetail(
    (error as { data?: unknown })?.data,
    'Could not save the complaint. Is the API running?',
  )

interface FieldProps {
  spec: FieldSpec
  value: string
  suffix?: string

  ai?: boolean
}

function Field({ spec, value, suffix, ai }: FieldProps) {
  const dispatch = useAppDispatch()
  const id = `f-${spec.name}`
  const onChange = (e: { target: { value: string } }) =>
    dispatch(setField({ field: spec.name, value: e.target.value }))

  const aiClass = ai ? 'border-l-2 border-l-primary bg-primary/5' : undefined

  let control
  if (spec.type === 'textarea') {
    control = (
      <Textarea
        id={id}
        rows={3}
        value={value}
        placeholder={PLACEHOLDER}
        onChange={onChange}
        className={cn('min-h-20', aiClass)}
      />
    )
  } else if (spec.type === 'select') {
    control = (
      <NativeSelect id={id} value={value} onChange={onChange} className={cn('w-full', aiClass)}>
        <NativeSelectOption value="">{PLACEHOLDER}</NativeSelectOption>
        {spec.options?.map((o) => (
          <NativeSelectOption key={o}>{o}</NativeSelectOption>
        ))}
      </NativeSelect>
    )
  } else {
    control = (
      <Input
        id={id}
        type={spec.type ?? 'text'}
        value={value}
        placeholder={PLACEHOLDER}
        step={spec.type === 'number' ? 'any' : undefined}
        min={spec.type === 'number' ? 0 : undefined}
        onChange={onChange}
        className={aiClass}
      />
    )
  }

  return (
    <div className={cn('grid gap-1.5', spec.type === 'textarea' && 'sm:col-span-2')}>
      <Label htmlFor={id}>
        {spec.label}
        {ai && (
          <Badge variant="secondary" className="h-4 px-1 text-[10px] text-primary">
            AI
          </Badge>
        )}
      </Label>
      {suffix ? (
        <div className="flex items-center gap-2">
          {control}
          <span className="text-xs whitespace-nowrap text-muted-foreground">{suffix}</span>
        </div>
      ) : (
        control
      )}
    </div>
  )
}

export function ComplaintForm() {
  const { draft, aiFields, complaintId, status, risk } = useAppSelector((s) => s.intake)
  const dispatch = useAppDispatch()
  const [createComplaint, create] = useCreateComplaintMutation()
  const [updateComplaint, update] = useUpdateComplaintMutation()

  const { isLoading, data: saved, error } = complaintId === null ? create : update

  const [attempted, setAttempted] = useState<ComplaintDraft>()

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setAttempted(draft)
    const body = { ...draft, ai_risk: risk }
    if (complaintId === null) {
      const result = await createComplaint(body)
      if ('data' in result) dispatch(resetDraft())
    } else {
      await updateComplaint({ id: complaintId, body })
    }
  }

  return (
    <form onSubmit={onSubmit} className="min-w-0">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Log Customer Complaint</CardTitle>
          <CardDescription>API &amp; FDF Quality Assurance Module</CardDescription>
          <CardAction>
            <ToneBadge tone="pending triage">
              {complaintId !== null && `${complaintNumber(complaintId)} · `}
              {statusLabel(status)}
            </ToneBadge>
          </CardAction>
        </CardHeader>

        <CardContent className="grid gap-6">
          {SECTIONS.map((section, i) => (
            <Fragment key={section.title}>
              {i > 0 && <Separator />}
              <fieldset className="grid gap-3">
                <legend className="mb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {section.title}
                </legend>
                <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                  {section.fields.map((spec) => (
                    <Field
                      key={spec.name}
                      spec={spec}
                      value={draft[spec.name]}
                      suffix={spec.name === 'quantity_affected' ? draft.quantity_unit : undefined}
                      ai={aiFields.includes(spec.name)}
                    />
                  ))}
                </div>
              </fieldset>
            </Fragment>
          ))}
        </CardContent>

        <CardFooter className="flex flex-wrap items-center gap-3 border-t">
          <Button type="button" variant="outline" onClick={() => dispatch(resetDraft())}>
            <RotateCcw /> Reset Form
          </Button>
          <p className="min-w-0 flex-1 text-center text-sm" aria-live="polite">
            {error && attempted === draft && (
              <span className="text-destructive">{errorMessage(error)}</span>
            )}
            {!error && saved && (
              <span className="text-emerald-700">
                {complaintId === null ? 'Saved as' : 'Updated'} {complaintNumber(saved.id)} ·{' '}
                {statusLabel(saved.status)}
              </span>
            )}
          </p>
          <Button type="submit" disabled={isLoading}>
            <Save />
            {isLoading ? 'Saving…' : complaintId === null ? 'Save Complaint' : 'Update Complaint'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
