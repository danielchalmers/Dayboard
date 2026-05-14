import type { ReactNode } from "react"

interface PageShellProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  narrow?: boolean
}

export const PageShell = ({
  title,
  subtitle,
  actions,
  children,
  narrow = false
}: PageShellProps) => (
  <main className={narrow ? "page page--narrow" : "page"}>
    <header className="page-header">
      <div>
        <p className="eyebrow">Clockboard</p>
        <h1>{title}</h1>
        {subtitle ? <p className="page-header__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
    {children}
  </main>
)
