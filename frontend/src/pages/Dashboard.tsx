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
    return <Spin size="large" />
  }

  const windowColor = data.window === '上班打卡时间' || data.window === '下班打卡时间' ? 'green' : 'default'

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card>
            <Statistic title="今日班次" value={data.shift?.name || '休息'} />
            {data.shift && (
              <Tag color={data.shift.color} style={{ marginTop: 8 }}>
                {data.shift.name}
              </Tag>
            )}
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="上班窗口" value={data.window === '上班打卡时间' ? '进行中' : '未开启'} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="下班窗口" value={data.window === '下班打卡时间' ? '进行中' : '未开启'} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 24 }} title="详细信息" loading={loading}>
        <p>日期：{data.today}</p>
        <p>当前时间：{data.now}</p>
        <p>
          班次：
          {data.shift ? (
            <Tag color={data.shift.color}>
              {data.shift.name} {data.shift.start_time}-{data.shift.end_time}
            </Tag>
          ) : (
            '休息'
          )}
        </p>
        <p>
          当前是否在打卡时间段：
          <Tag color={windowColor}>{data.window}</Tag>
        </p>
        <p>上班状态（云端）：{data.clock_in_status || '未配置'}</p>
        <p>下班状态（云端）：{data.clock_out_status || '未配置'}</p>
        <Button type={data.skipped ? 'default' : 'primary'} danger={!data.skipped} onClick={toggleSkip}>
          {data.skipped ? '取消跳过今日' : '今日跳过'}
        </Button>
      </Card>
    </div>
  )
}

export default Dashboard
