import { useEffect, useState } from 'react'
import { Card, Row, Col, Tag, Button, Statistic, Spin, message } from 'antd'
import api from '../api'

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

  if (!data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" />
      </div>
    )
  }

  const inWindow = data.window === '上班打卡时间' || data.window === '下班打卡时间'

  return (
    <div>
      <Row gutter={[20, 20]}>
        <Col xs={24} sm={8}>
          <Card bodyStyle={{ padding: 24 }}>
            <Statistic
              title="今日班次"
              value={data.shift?.name || '休息'}
              valueStyle={{ color: data.shift ? '#1a73e8' : '#5f6368' }}
            />
            {data.shift && (
              <Tag color={data.shift.color} style={{ marginTop: 12, fontSize: 13 }}>
                {data.shift.name}
              </Tag>
            )}
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bodyStyle={{ padding: 24 }}>
            <Statistic
              title="上班窗口"
              value={data.window === '上班打卡时间' ? '进行中' : '未开启'}
              valueStyle={{ color: data.window === '上班打卡时间' ? '#34a853' : '#5f6368' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bodyStyle={{ padding: 24 }}>
            <Statistic
              title="下班窗口"
              value={data.window === '下班打卡时间' ? '进行中' : '未开启'}
              valueStyle={{ color: data.window === '下班打卡时间' ? '#34a853' : '#5f6368' }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 24 }} title="详细信息" loading={loading}>
        <div style={{ display: 'grid', gap: 12, color: '#202124' }}>
          <p style={{ margin: 0 }}>
            <span style={{ color: '#5f6368' }}>日期：</span>
            {data.today}
          </p>
          <p style={{ margin: 0 }}>
            <span style={{ color: '#5f6368' }}>当前时间：</span>
            {data.now}
          </p>
          <p style={{ margin: 0 }}>
            <span style={{ color: '#5f6368' }}>班次：</span>
            {data.shift ? (
              <Tag color={data.shift.color} style={{ fontSize: 13 }}>
                {data.shift.name} {data.shift.start_time}-{data.shift.end_time}
              </Tag>
            ) : (
              '休息'
            )}
          </p>
          <p style={{ margin: 0 }}>
            <span style={{ color: '#5f6368' }}>当前是否在打卡时间段：</span>
            <Tag color={inWindow ? '#34a853' : '#9aa0a6'} style={{ fontSize: 13 }}>
              {data.window}
            </Tag>
          </p>
          <p style={{ margin: 0 }}>
            <span style={{ color: '#5f6368' }}>上班状态（云端）：</span>
            {data.clock_in_status || '未配置'}
          </p>
          <p style={{ margin: 0 }}>
            <span style={{ color: '#5f6368' }}>下班状态（云端）：</span>
            {data.clock_out_status || '未配置'}
          </p>
        </div>
        <Button
          type={data.skipped ? 'default' : 'primary'}
          danger={!data.skipped}
          onClick={toggleSkip}
          style={{ marginTop: 24, borderRadius: 8 }}
        >
          {data.skipped ? '取消跳过今日' : '今日跳过'}
        </Button>
      </Card>
    </div>
  )
}

export default Dashboard
