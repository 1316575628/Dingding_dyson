interface SectionCardProps {
  title?: React.ReactNode
  children: React.ReactNode
  extra?: React.ReactNode
  style?: React.CSSProperties
  /** 内容内边距，默认 24 */
  padding?: number
}

function SectionCard({ title, children, extra, style, padding = 24 }: SectionCardProps) {
  return (
    <section className="gm-card" style={style}>
      {(title || extra) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px 0',
          }}
        >
          {title && <div className="gm-title">{title}</div>}
          {extra}
        </div>
      )}
      <div style={{ padding }}>{children}</div>
    </section>
  )
}

export default SectionCard
