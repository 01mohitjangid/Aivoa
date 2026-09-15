import { buttonVariants } from '@/components/ui/button-variants'
import { cn } from '@/lib/utils'
import { ComplaintForm } from './features/complaint/ComplaintForm'
import { IntakeAssistant } from './features/intake/IntakeAssistant'
import { ComplaintsRegister } from './features/register/ComplaintsRegister'
import { useHashRoute } from './useHashRoute'

const NAV = [
  { href: '#/', route: '/', label: 'Log Complaint' },
  { href: '#/register', route: '/register', label: 'Complaint Register' },
]

export default function App() {
  const route = useHashRoute()
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2 px-4 sm:px-6">
          <span className="mr-auto text-sm font-semibold tracking-tight sm:text-base">
            Customer Complaints
          </span>
          <nav className="flex items-center gap-1" aria-label="Main">
            {NAV.map((item) => (
              <a
                key={item.route}
                href={item.href}
                aria-current={route === item.route ? 'page' : undefined}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  route === item.route && 'bg-muted text-primary',
                )}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        {route === '/register' ? (
          <ComplaintsRegister />
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(380px,2fr)]">
            <ComplaintForm />
            <IntakeAssistant />
          </div>
        )}
      </main>
    </div>
  )
}
