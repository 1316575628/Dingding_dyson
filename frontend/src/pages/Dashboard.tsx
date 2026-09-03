import { useEffect, useState, useRef } from 'react'
import { Card, Row, Col, Tag, Button, message, Skeleton } from 'antd'
import { CheckCircleOutlined, PauseCircleOutlined, FieldTimeOutlined, CalendarOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
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
  shift: Shift | null
  window: string
  clock_in_status: string | null
  clock_out_status: string | null
  skipped: boolean
}

const CACHE_KEY = 'dingding_dashboard_cache'

function loadCache(): DashboardData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveCache(data: DashboardData) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch {
    // ignore
  }
}

function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(loadCache)
  const [fetching, setFetching] = useState(false)
  const [now, setNow] = useState(dayjs())
  const intervalRef = useRef<number | null>(null)

  const fetchData = async (silent = false) => {
    if (!silent) setFetching(true)
    try {
      const res = await api.get('/dashboard')
      const payload: DashboardData = {
        today: res.data.today,
        shift: res.data.shift,
        window: res.data.window,
        clock_in_status: res.data.clock_in_status,
        clock_out_status: res.data.clock_out_status,
        skipped: res.data.skipped,
      }
      setData(payload)
      saveCache(payload)
    } catch (e) {
      if (!data) {
        message.error('获取仪表盘数据失败')
      }
    } finally {
      if (!silent) setFetching(false)
    }
  }

  useEffect(() => {
    // 首次进入：有缓存则静默刷新，无缓存才显示加载
    fetchData(!!data)

    intervalRef.current = window.setInterval(() => {
      fetchData(true)
    }, 30000)

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
    }
  }, [])

  useEffect(() => {
    // 客户端实时时钟，每秒更新
    const timer = window.setInterval(() => setNow(dayjs()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const toggleSkip = async () => {
    try {
      await api.post('/skip/today', { skipped: !data?.skipped })
      message.success('操作成功')
      fetchData(true)
    } catch (e) {
      message.error('操作失败')
    }
  }

  const inWindow = data?.window === '上班打卡时间' || data?.window === '下班打卡时间'
  const showSkeleton = !data && fetching

  return (
    <div>
      <Row gutter={[20, 20]}>
        <Col xs={24} sm={8}>
          <StatusCard
            title="今日班次"
            value={data?.shift?.name || '休息'}
            loading={showSkeleton}
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
            loading={showSkeleton}
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
            loading={showSkeleton}
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
        loading={showSkeleton}
      >
        <Skeleton active loading={showSkeleton} paragraph={{ rows: 5 }} title={false}>
          <div style={{ display: 'grid', gap: 14, color: '#202124' }}>
            <InfoRow label="日期" value={data?.today} icon={<CalendarOutlined style={{ color: '#9aa0a6' }} />} />
            <InfoRow label="当前时间" value={now.format('YYYY-MM-DD HH:mm:ss')} />
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
