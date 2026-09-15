import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const TONES: Record<string, string> = {
  critical: 'border-red-200 bg-red-50 text-red-700',
  high: 'border-red-200 bg-red-50 text-red-700',
  major: 'border-amber-200 bg-amber-50 text-amber-800',
  medium: 'border-amber-200 bg-amber-50 text-amber-800',
  minor: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  low: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'pending triage': 'border-yellow-200 bg-yellow-50 text-yellow-800',
}

export function ToneBadge({
  tone,
  className,
  children,
}: {
  tone: string | null | undefined
  className?: string
  children: React.ReactNode
}) {
  const classes = TONES[(tone ?? '').toLowerCase()] ?? 'bg-muted text-muted-foreground'
  return (
    <Badge variant="outline" className={cn('font-medium', classes, className)}>
      {children}
    </Badge>
  )
}
