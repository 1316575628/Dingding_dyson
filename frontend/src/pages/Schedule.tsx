import { useEffect, useState } from 'react'
import { Calendar, Modal, Select, message, Card } from 'antd'
import { CalendarOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import api from '../api'
import PageHeader from '../components/PageHeader'

interface Shift {
  id: number
  name: string
  color: string
  is_rest: boolean
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
  const [selectedShift, setSelectedShift] = useState<number | null>(null)
  const [currentMonth, setCurrentMonth] = useState(dayjs())

  const fetchData = async (year: number, month: number) => {
    try {
      const [shiftsRes, scheduleRes] = await Promise.all([
        api.get('/shifts'),
        api.get('/schedule', { params: { year, month } }),
      ])
      setShifts(shiftsRes.data)
      const map: Record<string, ScheduleItem> = {}
      scheduleRes.data.forEach((item: ScheduleItem) => {
        map[item.date] = item
      })
      setScheduleMap(map)
    } catch (e) {
      message.error('加载排班失败')
    }
  }

  useEffect(() => {
    fetchData(currentMonth.year(), currentMonth.month() + 1)
  }, [currentMonth])

  const handleDateSelect = (date: Dayjs) => {
    setSelectedDate(date)
    const item = scheduleMap[date.format('YYYY-MM-DD')]
    setSelectedShift(item ? item.shift_template_id : null)
  }

  const handleSave = async () => {
    if (!selectedDate) return
    try {
      await api.post('/schedule/set', {
        date: selectedDate.format('YYYY-MM-DD'),
        shift_template_id: selectedShift,
      })
      message.success('保存成功')
      setSelectedDate(null)
      fetchData(currentMonth.year(), currentMonth.month() + 1)
    } catch (e) {
      message.error('保存失败')
    }
  }

  const dateCellRender = (date: Dayjs) => {
    const item = scheduleMap[date.format('YYYY-MM-DD')]
    if (!item) return null
    return (
      <div
        style={{
          marginTop: 6,
          padding: '4px 8px',
          borderRadius: 8,
          background: item.color,
          color: '#fff',
          fontSize: 12,
          fontWeight: 600,
          textAlign: 'center',
          boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
        }}
      >
        {item.shift_name}
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="排班日历" subtitle="点击日期设置当天的班次模板" />
      <Card bodyStyle={{ padding: 0 }}>
        <Calendar
          value={currentMonth}
          onChange={setCurrentMonth}
          onSelect={handleDateSelect}
          cellRender={dateCellRender}
          fullscreen
        />
      </Card>
      <Modal
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarOutlined style={{ color: 'var(--gm-primary)' }} />
            设置 {selectedDate?.format('YYYY年MM月DD日')} 排班
          </span>
        }
        open={!!selectedDate}
        onOk={handleSave}
        onCancel={() => setSelectedDate(null)}
      >
        <Select
          style={{ width: '100%' }}
          placeholder="选择班次"
          value={selectedShift}
          onChange={setSelectedShift}
          allowClear
          options={shifts.map((s) => ({ label: s.name, value: s.id }))}
        />
      </Modal>
    </div>
  )
}

export default SchedulePage
