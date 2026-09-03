import { Card, Skeleton } from 'antd'

interface StatusCardProps {
  title: string
  value: string | number
  loading?: boolean
  color?: string
  icon?: React.ReactNode
  description?: string
}

function StatusCard({ title, value, loading, color = 'var(--gm-primary)', icon, description }: StatusCardProps) {
  return (
    <Card
      bodyStyle={{ padding: 24, height: '100%' }}
      style={{
        height: '100%',
        borderRadius: 20,
        border: '1px solid var(--gm-outline-variant)',
        background: '#fff',
      }}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 2 }} title={{ width: '60%' }} />
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 14, color: 'var(--gm-on-surface-variant)', fontWeight: 500, marginBottom: 8 }}>
                {title}
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color,
                  letterSpacing: '-0.5px',
                  lineHeight: 1.2,
                }}
              >
                {value}
              </div>
            </div>
            {icon && (
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: `${color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color,
                  fontSize: 22,
                  flexShrink: 0,
                }}
              >
                {icon}
              </div>
            )}
          </div>
          {description && (
            <div style={{ marginTop: 16, fontSize: 13, color: 'var(--gm-on-surface-variant)', fontWeight: 500 }}>
              {description}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

export default StatusCard
