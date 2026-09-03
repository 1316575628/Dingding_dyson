import { useEffect, useState } from 'react'
import { Table, Select, DatePicker, Input, Button, message } from 'antd'
import { SearchOutlined, FilterOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../api'
import PageHeader from '../components/PageHeader'
import SectionCard from '../components/SectionCard'

interface LogItem {
  id: number
  timestamp: string
  log_type: string
  channel: string
  result: string
  level: string
  detail: string | null
}

const levelMeta: Record<string, { label: string; color: string; bg: string }> = {
  info: { label: '信息', color: 'var(--gm-primary)', bg: 'var(--gm-primary-container)' },
  warning: { label: '警告', color: 'var(--gm-warning)', bg: 'var(--gm-warning-container)' },
  error: { label: '错误', color: 'var(--gm-error)', bg: 'var(--gm-error-container)' },
}

const typeMap: Record<string, string> = { work: '上班提醒', worked: '下班提醒', system: '系统' }

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

  const columns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 170,
      render: (v: string) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--gm-on-surface-variant)' }}>
          {dayjs(v).format('YYYY-MM-DD HH:mm:ss')}
        </span>
      ),
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (v: string) => {
        const meta = levelMeta[v]
        return meta ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '2px 10px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              color: meta.color,
              background: meta.bg,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color }} />
            {meta.label}
          </span>
        ) : (
          v
        )
      },
    },
    {
      title: '类型',
      dataIndex: 'log_type',
      key: 'log_type',
      width: 110,
      render: (v: string) => typeMap[v] || v,
    },
    { title: '渠道', dataIndex: 'channel', key: 'channel', width: 100 },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      width: 90,
      render: (v: string) => (
        <span
          style={{
            color: v === 'success' ? 'var(--gm-success)' : 'var(--gm-error)',
            fontWeight: 600,
          }}
        >
          {v === 'success' ? '成功' : '失败'}
        </span>
      ),
    },
    {
      title: '详情',
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true,
      render: (v: string | null) => (
        <span style={{ color: 'var(--gm-on-surface-variant)' }}>{v || '—'}</span>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="推送日志" subtitle="查看打卡提醒发送记录与系统运行日志" />
      <SectionCard padding={0}>
        {/* 筛选工具栏 */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid var(--gm-outline-variant)',
          }}
        >
          <FilterOutlined style={{ color: 'var(--gm-on-surface-faint)', fontSize: 16 }} />
          <Select
            placeholder="级别"
            allowClear
            style={{ width: 110 }}
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
            style={{ width: 130 }}
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
            style={{ width: 120 }}
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
            style={{ width: 110 }}
            value={filters.result}
            onChange={(v) => setFilters({ ...filters, result: v })}
            options={[
              { label: '成功', value: 'success' },
              { label: '失败', value: 'fail' },
            ]}
          />
          <DatePicker
            placeholder="开始日期"
            onChange={(d) => setFilters({ ...filters, start_date: d?.format('YYYY-MM-DD') })}
          />
          <DatePicker
            placeholder="结束日期"
            onChange={(d) => setFilters({ ...filters, end_date: d?.format('YYYY-MM-DD') })}
          />
          <Input
            placeholder="搜索关键词"
            prefix={<SearchOutlined style={{ color: 'var(--gm-on-surface-faint)' }} />}
            value={filters.keyword}
            onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
            onPressEnter={() => fetchLogs(1)}
            style={{ width: 200 }}
            allowClear
          />
          <Button type="primary" onClick={() => fetchLogs(1)}>
            查询
          </Button>
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={logs}
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
        />
      </SectionCard>
    </div>
  )
}

export default Logs
