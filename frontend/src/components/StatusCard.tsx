import { Card, Skeleton, Statistic } from 'antd'

interface StatusCardProps {
  title: string
  value: string | number
  loading?: boolean
  valueStyle?: React.CSSProperties
  suffix?: React.ReactNode
  icon?: React.ReactNode
}

function StatusCard({ title, value, loading, valueStyle, suffix, icon }: StatusCardProps) {
  return (
    <Card bodyStyle={{ padding: 24 }} className="status-card">
      {loading ? (
        <Skeleton active paragraph={{ rows: 1 }} title={{ width: '60%' }} />
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Statistic title={title} value={value} valueStyle={{ ...valueStyle, fontWeight: 700, fontSize: 28 }} />
          {icon && (
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'var(--gm-surface-variant)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--gm-primary)',
                fontSize: 20,
              }}
            >
              {icon}
            </div>
          )}
        </div>
      )}
      {!loading && suffix && <div style={{ marginTop: 12 }}>{suffix}</div>}
    </Card>
  )
}

export default StatusCard
