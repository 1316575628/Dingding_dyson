import { Card, Skeleton, Statistic } from 'antd'

interface StatusCardProps {
  title: string
  value: string | number
  loading?: boolean
  valueStyle?: React.CSSProperties
  suffix?: React.ReactNode
}

function StatusCard({ title, value, loading, valueStyle, suffix }: StatusCardProps) {
  return (
    <Card
      bodyStyle={{ padding: 24 }}
      className="status-card"
      style={{
        background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
        border: '1px solid #f1f3f4',
      }}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 1 }} title={{ width: '60%' }} />
      ) : (
        <>
          <Statistic title={title} value={value} valueStyle={{ ...valueStyle, fontWeight: 600 }} />
          {suffix && <div style={{ marginTop: 8 }}>{suffix}</div>}
        </>
      )}
    </Card>
  )
}

export default StatusCard
