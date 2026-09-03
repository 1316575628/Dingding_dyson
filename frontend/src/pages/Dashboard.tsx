import { useEffect, useState, useRef } from 'react'
import { Row, Col, Tag, Button, message, Skeleton, Progress } from 'antd'
import {
  CheckCircleOutlined,
  PauseCircleOutlined,
  FieldTimeOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  CloudOutlined,
  SyncOutlined,
  LoginOutlined,
  LogoutOutlined,
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

/** 计算打卡窗口进度（0-100），基于上班时间与提醒提前量 */
function windowProgress(shift: Shift | null, now: dayjs.Dayjs): number | null {
  if (!shift || !shift.start_time || !shift.end_time || shift.is_rest) return null
  const [sh, sm] = shift.start_time.split(':').map(Number)
  const [eh, em] = shift.end_time.split(':').map(Number)
  let start = now.hour(sh).minute(sm).second(0)
  let end = now.hour(eh).minute(em).second(0)
  if (end.isBefore(start) || end.isSame(start)) end = end.add(1, 'day')
  if (now.isBefore(start.subtract(2, 'hour'))) return 0
  const total = end.diff(start, 'minute')
  const passed = now.diff(start, 'minute')
  return Math.min(100, Math.max(0, Math.round((passed / Math.max(total, 1)) * 100)))
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
  const progress = windowProgress(data?.shift || null, now)

  // 下次检测倒计时：scheduler 每分钟第 0 秒触发（CronTrigger minute="*"）
  const secondsLeft = 60 - now.second()
  const countdownPercent = Math.round(((60 - secondsLeft) / 60) * 100)

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

      {/* Hero 状态卡：极淡渐变色块 */}
      <SectionCard style={{ marginBottom: 24 }}>
        {showSkeleton ? (
          <Skeleton active paragraph={{ rows: 2 }} title={{ width: '40%' }} />
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 24,
              background: 'linear-gradient(135deg, rgba(26,115,232,0.04) 0%, rgba(52,168,83,0.04) 100%)',
              borderRadius: 12,
              padding: 24,
              margin: -24,
              width: 'calc(100% + 48px)',
            }}
          >
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
                    <Tag color={data.shift.color} style={{ fontSize: 13, borderRadius: 999, marginRight: 0 }}>
                      {data.shift.start_time} - {data.shift.end_time}
                    </Tag>
                  )}
                  <Tag
                    icon={inWindow ? <CheckCircleOutlined /> : <PauseCircleOutlined />}
                    color={inWindow ? 'success' : 'default'}
                    style={{ fontSize: 13, borderRadius: 999, marginRight: 0 }}
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
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  color: 'var(--gm-on-surface)',
                  letterSpacing: '-1px',
                  lineHeight: 1.2,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {now.format('HH:mm:ss')}
              </div>
              <div style={{ fontSize: 14, color: 'var(--gm-on-surface-variant)', fontWeight: 500, marginTop: 4 }}>
                {now.format('YYYY年MM月DD日 dddd')}
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* 状态卡区：今日班次 / 班次进度 / 下次检测 */}
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
            title="班次进度"
            value={progress === null ? '—' : `${progress}%`}
            loading={showSkeleton}
            color="var(--gm-primary)"
            icon={<FieldTimeOutlined />}
            description={
              progress === null ? '无有效班次' : progress >= 100 ? '班次已结束' : '当前班次进行中'
            }
          >
            {progress !== null && (
              <Progress
                percent={progress}
                showInfo={false}
                strokeColor={{ from: '#1a73e8', to: '#34a853' }}
                trailColor="#e8eaed"
                style={{ marginTop: 12, marginBottom: 0 }}
              />
            )}
          </StatusCard>
        </Col>
        <Col xs={24} md={8}>
          <StatusCard
            title="下次检测"
            value={`${secondsLeft} 秒后`}
            color="var(--gm-primary)"
            icon={<SyncOutlined spin={secondsLeft <= 5} />}
            description="系统每分钟整点检测一次打卡状态"
          >
            <Progress
              percent={countdownPercent}
              showInfo={false}
              strokeColor="#1a73e8"
              trailColor="#e8eaed"
              style={{ marginTop: 12, marginBottom: 0 }}
            />
          </StatusCard>
        </Col>
      </Row>

      {/* 云端状态：大模块内上下班两个对等子模块 */}
      <SectionCard
        style={{ marginBottom: 24 }}
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CloudOutlined style={{ color: 'var(--gm-primary)' }} /> 云端状态
          </span>
        }
      >
        <Skeleton active loading={showSkeleton} paragraph={{ rows: 2 }} title={false}>
          <Row gutter={[24, 24]}>
            <Col xs={24} md={12}>
              <CloudStatusItem
                icon={<LoginOutlined />}
                label="上班打卡"
                status={data?.clock_in_status || '未配置'}
              />
            </Col>
            <Col xs={24} md={12}>
              <CloudStatusItem
                icon={<LogoutOutlined />}
                label="下班打卡"
                status={data?.clock_out_status || '未配置'}
              />
            </Col>
          </Row>
        </Skeleton>
      </SectionCard>

      {/* 详细信息 */}
      <SectionCard
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarOutlined style={{ color: 'var(--gm-primary)' }} /> 详细信息
          </span>
        }
      >
        <Skeleton active loading={showSkeleton} paragraph={{ rows: 5 }} title={false}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '20px 48px',
            }}
          >
            <InfoRow label="日期" value={data?.today} icon={<CalendarOutlined />} />
            <InfoRow
              label="当前时间"
              value={now.format('YYYY-MM-DD HH:mm:ss')}
              icon={<ClockCircleOutlined />}
            />
            <InfoRow
              label="班次"
              value={
                data?.shift ? (
                  <Tag color={data.shift.color} style={{ fontSize: 13, borderRadius: 999 }}>
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
                <Tag
                  icon={inWindow ? <CheckCircleOutlined /> : <PauseCircleOutlined />}
                  color={inWindow ? 'success' : 'default'}
                  style={{ fontSize: 13, borderRadius: 999 }}
                >
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

function CloudStatusItem({
  icon,
  label,
  status,
}: {
  icon: React.ReactNode
  label: string
  status: string
}) {
  // 状态语义配色
  const isError = status.includes('未打卡') || status.includes('失败')
  const isSuccess = status.includes('已打卡') || status.includes('已提醒')
  const tone = isError ? 'var(--gm-error)' : isSuccess ? 'var(--gm-success)' : 'var(--gm-on-surface-variant)'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        padding: '20px 24px',
        borderRadius: 12,
        background: 'var(--gm-surface-variant)',
        border: `1px solid var(--gm-outline-variant)`,
        height: '100%',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: 'var(--gm-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: tone,
          fontSize: 26,
          flexShrink: 0,
          boxShadow: 'var(--shadow-1)',
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            color: 'var(--gm-on-surface-variant)',
            fontWeight: 500,
            marginBottom: 4,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: tone,
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={status}
        >
          {status}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 28 }}>
      {icon && <span style={{ color: 'var(--gm-on-surface-variant)', fontSize: 16 }}>{icon}</span>}
      <span style={{ color: 'var(--gm-on-surface-variant)', minWidth: 80, fontWeight: 500, fontSize: 14 }}>
        {label}
      </span>
      <span style={{ color: 'var(--gm-on-surface)', fontWeight: 600, fontSize: 14 }}>{value}</span>
    </div>
  )
}

export default Dashboard
