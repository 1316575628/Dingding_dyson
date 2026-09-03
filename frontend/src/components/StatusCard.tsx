import { Skeleton } from 'antd'

interface StatusCardProps {
  label: string
  value: React.ReactNode
  loading?: boolean
  icon?: React.ReactNode
  /** 语义色调 */
  tone?: 'neutral' | 'primary' | 'success' | 'error' | 'warning'
  description?: React.ReactNode
  children?: React.ReactNode
}

const toneTokens = {
  neutral: { color: 'var(--gm-on-surface)', bg: 'var(--gm-surface-1)' },
  primary: { color: 'var(--gm-primary)', bg: 'var(--gm-primary-container)' },
  success: { color: 'var(--gm-success)', bg: 'var(--gm-success-container)' },
  error: { color: 'var(--gm-error)', bg: 'var(--gm-error-container)' },
  warning: { color: 'var(--gm-warning)', bg: 'var(--gm-warning-container)' },
}

function StatusCard({
  label,
  value,
  loading,
  icon,
  tone = 'neutral',
  description,
  children,
}: StatusCardProps) {
  const t = toneTokens[tone]

  return (
    <div className="gm-card gm-card--hoverable" style={{ padding: 24, height: '100%' }}>
      {loading ? (
        <Skeleton active paragraph={{ rows: 2 }} title={{ width: '50%' }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span className="gm-label">{label}</span>
            {icon && (
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  background: t.bg,
                  color: t.color,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                {icon}
              </span>
            )}
          </div>
          <div className="gm-metric" style={{ color: tone === 'neutral' ? undefined : t.color }}>
            {value}
          </div>
          {description && <div className="gm-body" style={{ fontSize: 13 }}>{description}</div>}
          {children}
        </div>
      )}
    </div>
  )
}

export default StatusCard
