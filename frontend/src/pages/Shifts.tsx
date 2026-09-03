import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, TimePicker, InputNumber, Switch, ColorPicker, message, Popconfirm, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import api from '../api'
import dayjs from 'dayjs'
import PageHeader from '../components/PageHeader'
import SectionCard from '../components/SectionCard'

interface Shift {
  id: number
  name: string
  color: string
  start_time: string
  end_time: string
  remind_before_min: number
  remind_after_min: number
  overtime_min: number
  is_rest: boolean
}

function Shifts() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Shift | null>(null)
  const [form] = Form.useForm()
  const isRest = !!Form.useWatch('is_rest', form)

  const fetchShifts = async () => {
    setLoading(true)
    try {
      const res = await api.get('/shifts')
      setShifts(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchShifts()
  }, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ color: '#1a73e8', remind_before_min: 15, remind_after_min: 30, overtime_min: 0, is_rest: false })
    setModalOpen(true)
  }

  const openEdit = (shift: Shift) => {
    setEditing(shift)
    form.setFieldsValue({
      ...shift,
      start_time: shift.start_time ? dayjs(shift.start_time, 'HH:mm') : null,
      end_time: shift.end_time ? dayjs(shift.end_time, 'HH:mm') : null,
      color: shift.color,
    })
    setModalOpen(true)
  }

  const handleSave = async (values: any) => {
    const payload = {
      ...values,
      start_time: values.start_time ? values.start_time.format('HH:mm') : null,
      end_time: values.end_time ? values.end_time.format('HH:mm') : null,
      color: typeof values.color === 'string' ? values.color : values.color?.toHexString?.(),
    }
    try {
      if (editing) {
        await api.put(`/shifts/${editing.id}`, payload)
        message.success('更新成功')
      } else {
        await api.post('/shifts', payload)
        message.success('创建成功')
      }
      setModalOpen(false)
      fetchShifts()
    } catch (e: any) {
      message.error(e.response?.data?.detail || '保存失败')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/shifts/${id}`)
      message.success('删除成功')
      fetchShifts()
    } catch (e: any) {
      message.error(e.response?.data?.detail || '删除失败')
    }
  }

  const columns = [
    {
      title: '班次',
      dataIndex: 'name',
      key: 'name',
      render: (v: string, record: Shift) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 4,
              background: record.color,
              flexShrink: 0,
            }}
          />
          <span style={{ fontWeight: 500, fontSize: 15 }}>{v}</span>
          {record.is_rest && <Tag style={{ borderRadius: 999, marginInlineEnd: 0 }}>休息</Tag>}
        </div>
      ),
    },
    {
      title: '工作时间',
      key: 'hours',
      width: 180,
      render: (_: any, record: Shift) =>
        record.is_rest ? (
          <span style={{ color: 'var(--gm-on-surface-faint)' }}>—</span>
        ) : (
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {record.start_time} – {record.end_time}
          </span>
        ),
    },
    {
      title: '上班提醒',
      key: 'before',
      width: 120,
      render: (_: any, record: Shift) =>
        record.is_rest ? '—' : `提前 ${record.remind_before_min} 分钟`,
    },
    {
      title: '下班提醒',
      key: 'after',
      width: 120,
      render: (_: any, record: Shift) =>
        record.is_rest ? '—' : `延后 ${record.remind_after_min} 分钟`,
    },
    {
      title: '加班',
      key: 'overtime',
      width: 100,
      render: (_: any, record: Shift) =>
        record.is_rest ? '—' : record.overtime_min > 0 ? `${record.overtime_min} 分钟` : '无',
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      align: 'right' as const,
      render: (_: any, record: Shift) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <Button type="text" icon={<EditOutlined />} size="small" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除该班次？" onConfirm={() => handleDelete(record.id)}>
            <Button type="text" danger icon={<DeleteOutlined />} size="small">
              删除
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="班次管理"
        subtitle="管理班次模板，设置上下班时间与提醒规则"
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建班次
          </Button>
        }
      />
      <SectionCard padding={0}>
        <Table rowKey="id" columns={columns} dataSource={shifts} loading={loading} pagination={false} />
      </SectionCard>
      <Modal
        title={editing ? '编辑班次' : '新建班次'}
        open={modalOpen}
        onOk={() => form.submit()}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        width={560}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 20 }}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：早班" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 16 }}>
            <Form.Item name="color" label="颜色" rules={[{ required: true }]}>
              <ColorPicker showText />
            </Form.Item>
            <Form.Item name="is_rest" label="休息类型" valuePropName="checked">
              <Switch checkedChildren="休息" unCheckedChildren="上班" />
            </Form.Item>
          </div>
          {!isRest && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 16 }}>
              <Form.Item
                name="start_time"
                label="上班时间"
                rules={[{ required: true, message: '必须填写上班时间' }]}
              >
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                name="end_time"
                label="下班时间"
                rules={[{ required: true, message: '必须填写下班时间' }]}
              >
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </div>
          )}
          {!isRest && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', columnGap: 16 }}>
              <Form.Item name="remind_before_min" label="上班提醒提前（分钟）">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="remind_after_min" label="下班提醒延后（分钟）">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="overtime_min" label="加班时长（分钟）">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </div>
          )}
        </Form>
      </Modal>
    </div>
  )
}

export default Shifts
