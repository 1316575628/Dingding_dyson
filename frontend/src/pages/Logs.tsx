import { useEffect, useState } from 'react'
import { Table, Tag, Select, DatePicker, Input, Button, message, Card } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../api'
import PageHeader from '../components/PageHeader'

interface LogItem {
  id: number
  timestamp: string
  log_type: string
  channel: string
  result: string
  level: string
  detail: string | null
}

function Logs() {
  const [logs, setLogs] = useState<LogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [filters, setFilters] = useState({
    log_type: undefined as string | undefined,
    channel: undefined as string | undefined,
    result: undefined as string | undefined,
    level: undefined as string | undefined,
    start_date: undefined as string | undefined,
    end_date: undefined as string | undefined,
    keyword: '',
  })

  const fetchLogs = async (page = 1, pageSize = 20) => {
    setLoading(true)
    try {
      const res = await api.get('/logs', {
        params: {
          page,
          page_size: pageSize,
          ...filters,
        },
      })
      setLogs(res.data.items)
      setPagination({ current: res.data.page, pageSize: res.data.page_size, total: res.data.total })
    } catch (e) {
      message.error('加载日志失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const handleTableChange = (p: any) => {
    fetchLogs(p.current, p.pageSize)
  }

  const levelTag = (level: string) => {
    const colorMap: Record<string, string> = {
      info: 'blue',
      warning: 'orange',
      error: 'red',
    }
    const labelMap: Record<string, string> = {
      info: '信息',
      warning: '警告',
      error: '错误',
    }
    return <Tag color={colorMap[level] || 'default'}>{labelMap[level] || level}</Tag>
  }

  const columns = [
    { title: '时间', dataIndex: 'timestamp', key: 'timestamp', width: 170, render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss') },
    { title: '级别', dataIndex: 'level', key: 'level', width: 90, render: levelTag },
    { title: '类型', dataIndex: 'log_type', key: 'log_type', width: 110, render: (v: string) => {
      const map: Record<string, string> = { work: '上班提醒', worked: '下班提醒', system: '系统' }
      return map[v] || v
    }},
    { title: '渠道', dataIndex: 'channel', key: 'channel', width: 100 },
    { title: '结果', dataIndex: 'result', key: 'result', width: 90, render: (v: string) => (
      <Tag color={v === 'success' ? 'success' : 'error'}>{v === 'success' ? '成功' : '失败'}</Tag>
    )},
    { title: '详情', dataIndex: 'detail', key: 'detail', ellipsis: true },
  ]

  return (
    <div>
      <PageHeader title="推送日志" subtitle="查看打卡提醒发送记录与系统运行日志" />
      <Card style={{ marginBottom: 20, borderRadius: 20, border: '1px solid var(--gm-outline-variant)' }} bodyStyle={{ padding: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Select
            placeholder="级别"
            allowClear
            style={{ width: 120 }}
            value={filters.level}
            onChange={(v) => setFilters({ ...filters, level: v })}
            options={[
              { label: '信息', value: 'info' },
              { label: '警告', value: 'warning' },
              { label: '错误', value: 'error' },
            ]}
          />
          <Select
            placeholder="类型"
            allowClear
            style={{ width: 140 }}
            value={filters.log_type}
            onChange={(v) => setFilters({ ...filters, log_type: v })}
            options={[
              { label: '上班提醒', value: 'work' },
              { label: '下班提醒', value: 'worked' },
              { label: '系统', value: 'system' },
            ]}
          />
          <Select
            placeholder="渠道"
            allowClear
            style={{ width: 140 }}
            value={filters.channel}
            onChange={(v) => setFilters({ ...filters, channel: v })}
            options={[
              { label: '飞书', value: 'feishu' },
              { label: 'fwalert', value: 'fwalert' },
            ]}
          />
          <Select
            placeholder="结果"
            allowClear
            style={{ width: 140 }}
            value={filters.result}
            onChange={(v) => setFilters({ ...filters, result: v })}
            options={[
              { label: '成功', value: 'success' },
              { label: '失败', value: 'fail' },
            ]}
          />
          <DatePicker placeholder="开始日期" onChange={(d) => setFilters({ ...filters, start_date: d?.format('YYYY-MM-DD') })} />
          <DatePicker placeholder="结束日期" onChange={(d) => setFilters({ ...filters, end_date: d?.format('YYYY-MM-DD') })} />
          <Input
            placeholder="关键词"
            value={filters.keyword}
            onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
            style={{ width: 200 }}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={() => fetchLogs(1)}>查询</Button>
        </div>
      </Card>
      <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 20, border: '1px solid var(--gm-outline-variant)' }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={logs}
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
        />
      </Card>
    </div>
  )
}

export default Logs
