interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-header-title">{title}</h1>
        {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 12 }}>{actions}</div>}
    </div>
  )
}

export default PageHeader
