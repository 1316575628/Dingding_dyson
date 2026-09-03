import { Card } from 'antd'

interface SectionCardProps {
  title?: React.ReactNode
  children: React.ReactNode
  extra?: React.ReactNode
  style?: React.CSSProperties
  bodyStyle?: React.CSSProperties
}

function SectionCard({ title, children, extra, style, bodyStyle }: SectionCardProps) {
  return (
    <Card
      title={title}
      extra={extra}
      style={{ borderRadius: 20, border: '1px solid var(--gm-outline-variant)', ...style }}
      bodyStyle={{ padding: 24, ...bodyStyle }}
    >
      {children}
    </Card>
  )
}

export default SectionCard
