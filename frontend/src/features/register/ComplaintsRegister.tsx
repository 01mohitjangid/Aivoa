import { ToneBadge } from '@/components/tone-badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAppDispatch } from '../../store'
import { useListComplaintsQuery } from '../../store/api'
import { loadComplaint, type Complaint } from '../../store/intakeSlice'
import { complaintNumber, statusLabel } from '../complaint/fields'

export function ComplaintsRegister() {
  const dispatch = useAppDispatch()
  const { data, isLoading, error } = useListComplaintsQuery()

  const open = (c: Complaint) => {
    dispatch(loadComplaint(c))
    window.location.assign('#/')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Complaint Register</CardTitle>
        <CardDescription>{data ? `${data.length} complaints` : 'Loading…'}</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="text-sm text-destructive">Could not load complaints. Is the API running?</p>
        )}
        {data && data.length === 0 && !isLoading && (
          <p className="text-sm text-muted-foreground">
            No complaints logged yet. Use “Log Complaint” to add the first one.
          </p>
        )}
        {data && data.length > 0 && (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Complaint date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Batch/Lot</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => open(c)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        open(c)
                      }
                    }}
                    tabIndex={0}
                    role="button"
                  >
                    <TableCell className="font-medium">{complaintNumber(c.id)}</TableCell>
                    <TableCell>{c.complaint_date ?? '—'}</TableCell>
                    <TableCell>{c.customer_name ?? '—'}</TableCell>
                    <TableCell>
                      {c.product_name ?? '—'}
                      {c.product_strength_grade && (
                        <span className="text-muted-foreground"> · {c.product_strength_grade}</span>
                      )}
                    </TableCell>
                    <TableCell>{c.batch_lot_number ?? '—'}</TableCell>
                    <TableCell>{c.complaint_type ?? '—'}</TableCell>
                    <TableCell>
                      {c.initial_severity ? (
                        <ToneBadge tone={c.initial_severity}>{c.initial_severity}</ToneBadge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      {c.priority ? <ToneBadge tone={c.priority}>{c.priority}</ToneBadge> : '—'}
                    </TableCell>
                    <TableCell>
                      <ToneBadge tone={statusLabel(c.status)}>{statusLabel(c.status)}</ToneBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
