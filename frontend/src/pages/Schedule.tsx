import { useEffect, useRef, useState } from 'react'
import { Calendar, Drawer, message, Card, Button } from 'antd'
import { LeftOutlined, RightOutlined, CloseOutlined, CalendarOutlined } from '@ant-design/icons'
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

function SchedulePage() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [scheduleMap, setScheduleMap] = useState<Record<string, ScheduleItem>>({})
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null)
  const [currentMonth, setCurrentMonth] = useState(dayjs())
  const [saving, setSaving] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

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

  const handleDateSelect = (date: Dayjs) => {
    setSelectedDate(date)
  }

  const handleSelectShift = async (shiftId: number | null) => {
    if (!selectedDate) return
    setSaving(true)
    try {
      await api.post('/schedule/set', {
        date: selectedDate.format('YYYY-MM-DD'),
        shift_template_id: shiftId,
      })
      message.success('排班已保存')
      setSelectedDate(null)
      fetchData(currentMonth.year(), currentMonth.month() + 1)
    } catch (e) {
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    await handleSelectShift(null)
  }

  // Google Calendar 风格单元格：圆点标记班次
  const dateCellRender = (date: Dayjs) => {
    const item = scheduleMap[date.format('YYYY-MM-DD')]
    if (!item) return null
    return (
      <div className="gm-calendar-cell">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, maxWidth: '100%' }}>
          <span className="gm-calendar-dot" style={{ background: item.color }} />
          <span className="gm-calendar-shift-name">{item.shift_name}</span>
        </div>
      </div>
    )
  }

  const selectedItem = selectedDate ? scheduleMap[selectedDate.format('YYYY-MM-DD')] : null

  return (
    <div>
      <PageHeader title="排班日历" subtitle="点击日期快速设置班次" />
      <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 20, border: '1px solid var(--gm-outline-variant)' }}>
        {/* 自定义月份切换头：Google Calendar 风格左右箭头 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '16px 24px',
            borderBottom: '1px solid var(--gm-outline-variant)',
          }}
        >
          <Button
            shape="circle"
            icon={<LeftOutlined />}
            onClick={() => setCurrentMonth(currentMonth.subtract(1, 'month'))}
            aria-label="上个月"
          />
          <Button
            shape="circle"
            icon={<RightOutlined />}
            onClick={() => setCurrentMonth(currentMonth.add(1, 'month'))}
            aria-label="下个月"
          />
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--gm-on-surface)', marginLeft: 8 }}>
            {currentMonth.format('YYYY年M月')}
          </div>
          <Button
            style={{ marginLeft: 'auto' }}
            onClick={() => setCurrentMonth(dayjs())}
          >
            今天
          </Button>
        </div>
        <Calendar
          value={currentMonth}
          onChange={setCurrentMonth}
          onSelect={handleDateSelect}
          cellRender={dateCellRender}
          fullscreen
          headerRender={() => null}
        />
      </Card>
      {/* 抽屉选择班次 */}
      <Drawer
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarOutlined style={{ color: 'var(--gm-primary)' }} />
            选择 {selectedDate?.format('YYYY年MM月DD日')} 的班次
          </span>
        }
        open={!!selectedDate}
        onClose={() => setSelectedDate(null)}
        width={440}
        styles={{ body: { padding: '24px 32px 32px' } }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {shifts.map((shift) => {
            const active = selectedItem?.shift_template_id === shift.id
            return (
              <button
                key={shift.id}
                disabled={saving}
                onClick={() => handleSelectShift(shift.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: 16,
                  borderRadius: 16,
                  border: active ? `2px solid ${shift.color}` : '1px solid var(--gm-outline)',
                  background: active ? `${shift.color}12` : 'var(--gm-surface)',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: shift.color,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
                  }}
                />
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--gm-on-surface)' }}>{shift.name}</span>
                {shift.is_rest ? (
                  <span style={{ fontSize: 12, color: 'var(--gm-on-surface-variant)' }}>休息</span>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--gm-on-surface-variant)' }}>
                    {shift.start_time} - {shift.end_time}
                  </span>
                )}
              </button>
            )
          })}
          <button
            disabled={saving}
            onClick={handleClear}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: 16,
              borderRadius: 16,
              border: '1px dashed var(--gm-outline)',
              background: 'var(--gm-surface)',
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              opacity: saving ? 0.6 : 1,
            }}
          >
            <CloseOutlined style={{ fontSize: 20, color: 'var(--gm-on-surface-variant)' }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--gm-on-surface)' }}>无排班</span>
            <span style={{ fontSize: 12, color: 'var(--gm-on-surface-variant)' }}>清除班次</span>
          </button>
        </div>
      </Drawer>
    </div>
  )
}

export default SchedulePage
