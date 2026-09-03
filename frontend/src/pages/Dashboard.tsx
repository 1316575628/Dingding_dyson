import { useEffect, useState } from 'react'
import { Card, Row, Col, Tag, Button, message, Skeleton } from 'antd'
import { CheckCircleOutlined, PauseCircleOutlined, FieldTimeOutlined, CalendarOutlined } from '@ant-design/icons'
import api from '../api'
import StatusCard from '../components/StatusCard'

interface Shift {
  id: number
  name: string
  color: string
  start_time: string
  end_time: string
  is_rest: boolean
}

interface DashboardData {
  today: string
  now: string
  shift: Shift | null
  window: string
  clock_in_status: string | null
  clock_out_status: string | null
  skipped: boolean
}

function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await api.get('/dashboard')
      setData(res.data)
    } catch (e) {
      message.error('获取仪表盘数据失败')
    } finally {
      setLoading(false)
    }
  }

  const toggleSkip = async () => {
    try {
      await api.post('/skip/today', { skipped: !data?.skipped })
      message.success('操作成功')
      fetchData()
    } catch (e) {
      message.error('操作失败')
    }
  }

  useEffect(() => {
    fetchData()
    const timer = setInterval(fetchData, 30000)
    return () => clearInterval(timer)
  }, [])

  const inWindow = data?.window === '上班打卡时间' || data?.window === '下班打卡时间'

  return (
    <div>
      <Row gutter={[20, 20]}>
        <Col xs={24} sm={8}>
          <StatusCard
            title="今日班次"
            value={data?.shift?.name || '休息'}
            loading={loading && !data}
            valueStyle={{ color: data?.shift ? '#1a73e8' : '#5f6368' }}
            suffix={
              data?.shift ? (
                <Tag color={data.shift.color} style={{ marginTop: 4, fontSize: 13, borderRadius: 6 }}>
                  {data.shift.name}
                </Tag>
              ) : null
            }
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatusCard
            title="上班窗口"
            value={data?.window === '上班打卡时间' ? '进行中' : '未开启'}
            loading={loading && !data}
            valueStyle={{ color: data?.window === '上班打卡时间' ? '#34a853' : '#5f6368' }}
            suffix={
              <FieldTimeOutlined
                style={{
                  color: data?.window === '上班打卡时间' ? '#34a853' : '#9aa0a6',
                  fontSize: 16,
                  marginTop: 4,
                }}
              />
            }
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatusCard
            title="下班窗口"
            value={data?.window === '下班打卡时间' ? '进行中' : '未开启'}
            loading={loading && !data}
            valueStyle={{ color: data?.window === '下班打卡时间' ? '#34a853' : '#5f6368' }}
            suffix={
              <FieldTimeOutlined
                style={{
                  color: data?.window === '下班打卡时间' ? '#34a853' : '#9aa0a6',
                  fontSize: 16,
                  marginTop: 4,
                }}
              />
            }
          />
        </Col>
      </Row>

      <Card
        style={{ marginTop: 24, border: '1px solid #f1f3f4' }}
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
            <CalendarOutlined style={{ color: '#1a73e8' }} />
            详细信息
          </span>
        }
        loading={loading && !data}
      >
        <Skeleton active loading={loading && !data} paragraph={{ rows: 5 }} title={false}>
          <div style={{ display: 'grid', gap: 14, color: '#202124' }}>
            <InfoRow label="日期" value={data?.today} icon={<CalendarOutlined style={{ color: '#9aa0a6' }} />} />
            <InfoRow label="当前时间" value={data?.now} />
            <InfoRow
              label="班次"
              value={
                data?.shift ? (
                  <Tag color={data.shift.color} style={{ fontSize: 13, borderRadius: 6 }}>
                    {data.shift.name} {data.shift.start_time}-{data.shift.end_time}
                  </Tag>
                ) : (
                  '休息'
                )
              }
            />
            <InfoRow
              label="当前是否在打卡时间段"
              value={
                <Tag
                  icon={inWindow ? <CheckCircleOutlined /> : <PauseCircleOutlined />}
                  color={inWindow ? '#34a853' : '#9aa0a6'}
                  style={{ fontSize: 13, borderRadius: 6 }}
                >
                  {data?.window}
                </Tag>
              }
            />
            <InfoRow label="上班状态（云端）" value={data?.clock_in_status || '未配置'} />
            <InfoRow label="下班状态（云端）" value={data?.clock_out_status || '未配置'} />
          </div>
          <Button
            type={data?.skipped ? 'default' : 'primary'}
            danger={!data?.skipped}
            onClick={toggleSkip}
            style={{ marginTop: 24, borderRadius: 8, minWidth: 120 }}
          >
            {data?.skipped ? '取消跳过今日' : '今日跳过'}
          </Button>
        </Skeleton>
      </Card>
    </div>
  )
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string
  value: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 24 }}>
      {icon}
      <span style={{ color: '#5f6368', minWidth: 140 }}>{label}：</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  )
}

export default Dashboard
