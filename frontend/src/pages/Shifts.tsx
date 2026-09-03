import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, TimePicker, InputNumber, Switch, ColorPicker, message, Popconfirm, Card } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import api from '../api'
import dayjs from 'dayjs'
import PageHeader from '../components/PageHeader'

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
    { title: '名称', dataIndex: 'name', key: 'name', render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span> },
    {
      title: '颜色',
      dataIndex: 'color',
      key: 'color',
      width: 80,
      render: (color: string) => (
        <div style={{ width: 24, height: 24, background: color, borderRadius: 6, border: '1px solid var(--gm-outline)' }} />
      ),
    },
    { title: '上班时间', dataIndex: 'start_time', key: 'start_time' },
    { title: '下班时间', dataIndex: 'end_time', key: 'end_time' },
    { title: '上班提前(分)', dataIndex: 'remind_before_min', key: 'remind_before_min', width: 120 },
    { title: '下班延后(分)', dataIndex: 'remind_after_min', key: 'remind_after_min', width: 120 },
    { title: '加班(分)', dataIndex: 'overtime_min', key: 'overtime_min', width: 100 },
    { title: '休息', dataIndex: 'is_rest', key: 'is_rest', width: 80, render: (v: boolean) => (v ? '是' : '否') },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: any, record: Shift) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="link" icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} style={{ padding: 0 }}>
            编辑
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />} size="small" style={{ padding: 0 }}>
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
      <Card bodyStyle={{ padding: 0 }}>
        <Table rowKey="id" columns={columns} dataSource={shifts} loading={loading} pagination={false} />
      </Card>
      <Modal title={editing ? '编辑班次' : '新建班次'} open={modalOpen} onOk={() => form.submit()} onCancel={() => setModalOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：早班" />
          </Form.Item>
          <Form.Item name="color" label="颜色" rules={[{ required: true }]}>
            <ColorPicker showText />
          </Form.Item>
          <Form.Item name="is_rest" label="休息类型" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="start_time" label="上班时间">
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="end_time" label="下班时间">
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="remind_before_min" label="上班提醒提前量（分钟）">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="remind_after_min" label="下班提醒延后量（分钟）">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="overtime_min" label="加班时长（分钟）">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Shifts
