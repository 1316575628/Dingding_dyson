import { useEffect, useState, useRef } from 'react'
import { Row, Col, Tag, Button, message, Skeleton } from 'antd'
import {
  CheckCircleOutlined,
  PauseCircleOutlined,
  FieldTimeOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../api'
import StatusCard from '../components/StatusCard'
import SectionCard from '../components/SectionCard'
import PageHeader from '../components/PageHeader'

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
  const [skipping, setSkipping] = useState(false)
  const [now, setNow] = useState(dayjs())
  const intervalRef = useRef<number | null>(null)
  const hasDataRef = useRef(false)

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
      hasDataRef.current = true
    } catch (e) {
      if (!hasDataRef.current) {
        message.error('获取仪表盘数据失败')
      }
    } finally {
      if (!silent) setFetching(false)
    }
  }

  useEffect(() => {
    fetchData(!!data)

    intervalRef.current = window.setInterval(() => {
      fetchData(true)
    }, 30000)

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(dayjs()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const toggleSkip = async () => {
    if (skipping) return
    setSkipping(true)
    try {
      await api.post('/skip/today', { skipped: !data?.skipped })
      message.success('操作成功')
      fetchData(true)
    } catch (e) {
      message.error('操作失败')
    } finally {
      setSkipping(false)
    }
  }

  const inWindow = data?.window === '上班打卡时间' || data?.window === '下班打卡时间'
  const showSkeleton = !data && fetching

  return (
    <div>
      <PageHeader
        title="仪表盘"
        subtitle="查看今日班次、打卡窗口状态和系统运行情况"
        actions={
          <Button
            type={data?.skipped ? 'default' : 'primary'}
            danger={!data?.skipped}
            onClick={toggleSkip}
            loading={skipping}
            disabled={skipping}
          >
            {data?.skipped ? '取消跳过今日' : '今日跳过'}
          </Button>
        }
      />

      {/* Hero 状态卡 */}
      <SectionCard style={{ marginBottom: 24 }}>
        {showSkeleton ? (
          <Skeleton active paragraph={{ rows: 2 }} title={{ width: '40%' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 20,
                  background: data?.shift ? `${data.shift.color}18` : 'var(--gm-surface-variant)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: data?.shift ? data.shift.color : 'var(--gm-on-surface-variant)',
                  fontSize: 36,
                }}
              >
                <DashboardOutlined />
              </div>
              <div>
                <div style={{ fontSize: 14, color: 'var(--gm-on-surface-variant)', fontWeight: 500, marginBottom: 4 }}>
                  今日状态
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--gm-on-surface)', marginBottom: 8 }}>
                  {data?.shift ? data.shift.name : '休息'}
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {data?.shift && (
                    <Tag color={data.shift.color} style={{ fontSize: 13, borderRadius: 6, marginRight: 0 }}>
                      {data.shift.start_time} - {data.shift.end_time}
                    </Tag>
                  )}
                  <Tag
                    icon={inWindow ? <CheckCircleOutlined /> : <PauseCircleOutlined />}
                    color={inWindow ? 'success' : 'default'}
                    style={{ fontSize: 13, borderRadius: 6, marginRight: 0 }}
                  >
                    {data?.window}
                  </Tag>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right', minWidth: 200 }}>
              <div style={{ fontSize: 14, color: 'var(--gm-on-surface-variant)', fontWeight: 500, marginBottom: 4 }}>
                当前时间
              </div>
              <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--gm-on-surface)', letterSpacing: '-1px', lineHeight: 1.2 }}>
                {now.format('HH:mm:ss')}
              </div>
              <div style={{ fontSize: 14, color: 'var(--gm-on-surface-variant)', fontWeight: 500, marginTop: 4 }}>
                {now.format('YYYY年MM月DD日 dddd')}
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* 三列等高状态卡 */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={8}>
          <StatusCard
            title="今日班次"
            value={data?.shift?.name || '休息'}
            loading={showSkeleton}
            color={data?.shift ? 'var(--gm-primary)' : 'var(--gm-on-surface-variant)'}
            icon={<DashboardOutlined />}
            description={data?.shift ? `${data.shift.start_time} - ${data.shift.end_time}` : '今日无排班'}
          />
        </Col>
        <Col xs={24} md={8}>
          <StatusCard
            title="上班窗口"
            value={data?.window === '上班打卡时间' ? '进行中' : '未开启'}
            loading={showSkeleton}
            color={data?.window === '上班打卡时间' ? 'var(--gm-success)' : 'var(--gm-on-surface-variant)'}
            icon={<FieldTimeOutlined />}
            description={data?.window === '上班打卡时间' ? '当前在打卡时间范围内' : '不在上班打卡时间'}
          />
        </Col>
        <Col xs={24} md={8}>
          <StatusCard
            title="下班窗口"
            value={data?.window === '下班打卡时间' ? '进行中' : '未开启'}
            loading={showSkeleton}
            color={data?.window === '下班打卡时间' ? 'var(--gm-success)' : 'var(--gm-on-surface-variant)'}
            icon={<ClockCircleOutlined />}
            description={data?.window === '下班打卡时间' ? '当前在打卡时间范围内' : '不在下班打卡时间'}
          />
        </Col>
      </Row>

      {/* 详细信息 */}
      <SectionCard title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CalendarOutlined style={{ color: 'var(--gm-primary)' }} /> 详细信息</span>}>
        <Skeleton active loading={showSkeleton} paragraph={{ rows: 5 }} title={false}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px 48px' }}>
            <InfoRow label="日期" value={data?.today} icon={<CalendarOutlined />} />
            <InfoRow label="当前时间" value={now.format('YYYY-MM-DD HH:mm:ss')} icon={<ClockCircleOutlined />} />
            <InfoRow
              label="班次"
              value={
                data?.shift ? (
                  <Tag color={data.shift.color} style={{ fontSize: 13, borderRadius: 6 }}>
                    {data.shift.name}
                  </Tag>
                ) : (
                  '休息'
                )
              }
            />
            <InfoRow
              label="打卡窗口"
              value={
                <Tag icon={inWindow ? <CheckCircleOutlined /> : <PauseCircleOutlined />} color={inWindow ? 'success' : 'default'} style={{ fontSize: 13, borderRadius: 6 }}>
                  {data?.window}
                </Tag>
              }
            />
            <InfoRow label="上班状态" value={data?.clock_in_status || '未配置'} />
            <InfoRow label="下班状态" value={data?.clock_out_status || '未配置'} />
          </div>
        </Skeleton>
      </SectionCard>
    </div>
  )
}

function InfoRow({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 28 }}>
      {icon && <span style={{ color: 'var(--gm-on-surface-variant)', fontSize: 16 }}>{icon}</span>}
      <span style={{ color: 'var(--gm-on-surface-variant)', minWidth: 80, fontWeight: 500, fontSize: 14 }}>{label}</span>
      <span style={{ color: 'var(--gm-on-surface)', fontWeight: 600, fontSize: 14 }}>{value}</span>
    </div>
  )
}

export default Dashboard
