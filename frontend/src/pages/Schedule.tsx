import { useEffect, useMemo, useRef, useState } from 'react'
import { Drawer, message, Button, Tooltip } from 'antd'
import { LeftOutlined, RightOutlined, CalendarOutlined, DeleteOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import api from '../api'
import PageHeader from '../components/PageHeader'

interface Shift {
  id: number
  name: string
  color: string
  is_rest: boolean
  start_time: string
  end_time: string
}

interface ScheduleItem {
  date: string
  shift_template_id: number
  shift_name: string
  color: string
  is_rest: boolean
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** 生成以周日开头、固定 6 行的日期网格（与 Google Calendar 一致） */
function buildMonthGrid(month: Dayjs): Dayjs[] {
  const first = month.startOf('month')
  // 周日开头：startOf('week') 默认 locale 周一，手动计算偏移
  const gridStart = first.subtract(first.day(), 'day')
  return Array.from({ length: 42 }, (_, i) => gridStart.add(i, 'day'))
}

function SchedulePage() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [scheduleMap, setScheduleMap] = useState<Record<string, ScheduleItem>>({})
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null)
  const [currentMonth, setCurrentMonth] = useState(dayjs())
  const [saving, setSaving] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const today = dayjs()

  const fetchData = async (year: number, month: number) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller
    try {
      const [shiftsRes, scheduleRes] = await Promise.all([
        api.get('/shifts', { signal: controller.signal }),
        api.get('/schedule', { params: { year, month }, signal: controller.signal }),
      ])
      setShifts(shiftsRes.data)
      const map: Record<string, ScheduleItem> = {}
      scheduleRes.data.forEach((item: ScheduleItem) => {
        map[item.date] = item
      })
      setScheduleMap(map)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        message.error('加载排班失败')
      }
    }
  }

  useEffect(() => {
    fetchData(currentMonth.year(), currentMonth.month() + 1)
  }, [currentMonth])

  const handleSelectShift = async (shiftId: number | null) => {
    if (!selectedDate || saving) return
    setSaving(true)
    try {
      await api.post('/schedule/set', {
        date: selectedDate.format('YYYY-MM-DD'),
        shift_template_id: shiftId,
      })
      message.success(shiftId === null ? '已清除排班' : '排班已保存')
      setSelectedDate(null)
      fetchData(currentMonth.year(), currentMonth.month() + 1)
    } catch (e) {
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const grid = useMemo(() => buildMonthGrid(currentMonth), [currentMonth])
  const selectedItem = selectedDate ? scheduleMap[selectedDate.format('YYYY-MM-DD')] : null

  return (
    <div>
      <PageHeader title="排班日历" subtitle="点击日期快速设置班次，色块表示当天班次" />

      <div
        style={{
          background: 'var(--gm-surface)',
          borderRadius: 16,
          border: '1px solid var(--gm-outline-variant)',
          overflow: 'hidden',
        }}
      >
        {/* 工具栏：Google Calendar 风格 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 20px',
            borderBottom: '1px solid var(--gm-outline-variant)',
          }}
        >
          <Tooltip title="上个月">
            <Button
              type="text"
              shape="circle"
              icon={<LeftOutlined />}
              onClick={() => setCurrentMonth(currentMonth.subtract(1, 'month'))}
              aria-label="上个月"
            />
          </Tooltip>
          <Tooltip title="下个月">
            <Button
              type="text"
              shape="circle"
              icon={<RightOutlined />}
              onClick={() => setCurrentMonth(currentMonth.add(1, 'month'))}
              aria-label="下个月"
            />
          </Tooltip>
          <Button
            style={{ marginLeft: 12, fontWeight: 500 }}
            onClick={() => setCurrentMonth(dayjs())}
          >
            今天
          </Button>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--gm-on-surface)', marginLeft: 16 }}>
            {currentMonth.format('YYYY年M月')}
          </div>
          {/* 班次图例 */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {shifts.map((s) => (
              <span key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--gm-on-surface-variant)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
                {s.name}
              </span>
            ))}
          </div>
        </div>

        {/* 星期表头 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--gm-outline-variant)' }}>
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              style={{
                padding: '10px 12px',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 0.5,
                color: i === 0 || i === 6 ? 'var(--gm-error)' : 'var(--gm-on-surface-variant)',
                textAlign: 'right',
                textTransform: 'uppercase',
              }}
            >
              {w}
            </div>
          ))}
        </div>

        {/* 日期网格 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {grid.map((date) => {
            const key = date.format('YYYY-MM-DD')
            const item = scheduleMap[key]
            const inMonth = date.month() === currentMonth.month()
            const isToday = date.isSame(today, 'day')

            return (
              <div
                key={key}
                onClick={() => setSelectedDate(date)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setSelectedDate(date)
                }}
                style={{
                  minHeight: 104,
                  padding: '8px 10px',
                  borderRight: '1px solid var(--gm-outline-variant)',
                  borderBottom: '1px solid var(--gm-outline-variant)',
                  cursor: 'pointer',
                  background: inMonth ? 'var(--gm-surface)' : '#fafafa',
                  transition: 'background 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  opacity: inMonth ? 1 : 0.55,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--gm-surface-1)')}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = inMonth ? 'var(--gm-surface)' : '#fafafa')
                }
              >
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      fontWeight: isToday ? 700 : 400,
                      background: isToday ? 'var(--gm-primary)' : 'transparent',
                      color: isToday ? '#fff' : 'var(--gm-on-surface)',
                    }}
                  >
                    {date.date()}
                  </span>
                </div>
                {item && (
                  <div
                    style={{
                      background: item.color,
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '3px 10px',
                      borderRadius: 6,
                      textAlign: 'center',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 1px 2px rgba(60,64,67,0.2)',
                    }}
                    title={item.shift_name}
                  >
                    {item.shift_name}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 抽屉选择班次 */}
      <Drawer
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarOutlined style={{ color: 'var(--gm-primary)' }} />
            {selectedDate?.format('YYYY年M月D日 dddd')}
          </span>
        }
        extra={
          selectedItem && (
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              loading={saving}
              onClick={() => handleSelectShift(null)}
            >
              清除排班
            </Button>
          )
        }
        open={!!selectedDate}
        onClose={() => setSelectedDate(null)}
        width={420}
        styles={{ body: { padding: '20px 28px 32px' } }}
      >
        <div style={{ marginBottom: 20, color: 'var(--gm-on-surface-variant)', fontSize: 14 }}>
          {selectedItem ? (
            <span>
              当前班次：
              <span style={{ color: selectedItem.color, fontWeight: 600 }}>{selectedItem.shift_name}</span>
            </span>
          ) : (
            '当前无排班，选择一个班次：'
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shifts.map((shift) => {
            const active = selectedItem?.shift_template_id === shift.id
            return (
              <button
                key={shift.id}
                disabled={saving}
                onClick={() => handleSelectShift(shift.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '14px 18px',
                  borderRadius: 12,
                  border: active ? `2px solid ${shift.color}` : '1px solid var(--gm-outline)',
                  background: active ? `${shift.color}14` : 'var(--gm-surface)',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                  opacity: saving ? 0.6 : 1,
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: shift.color,
                    flexShrink: 0,
                    boxShadow: active ? `0 2px 8px ${shift.color}66` : 'none',
                  }}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--gm-on-surface)' }}>
                    {shift.name}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--gm-on-surface-variant)', marginTop: 2 }}>
                    {shift.is_rest ? '休息日，不检测打卡' : `${shift.start_time} - ${shift.end_time}`}
                  </span>
                </span>
                {active && (
                  <span style={{ color: shift.color, fontSize: 13, fontWeight: 600, flexShrink: 0 }}>当前</span>
                )}
              </button>
            )
          })}
        </div>
      </Drawer>
    </div>
  )
}

export default SchedulePage
