import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, TimePicker, InputNumber, Switch, ColorPicker, message, Popconfirm } from 'antd'
import api from '../api'
import dayjs from 'dayjs'

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
    form.setFieldsValue({ color: '#1890ff', remind_before_min: 15, remind_after_min: 30, overtime_min: 0, is_rest: false })
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
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '颜色',
      dataIndex: 'color',
      key: 'color',
      render: (color: string) => <div style={{ width: 24, height: 24, background: color, borderRadius: 4 }} />,
    },
    { title: '上班时间', dataIndex: 'start_time', key: 'start_time' },
    { title: '下班时间', dataIndex: 'end_time', key: 'end_time' },
    { title: '上班提前(分)', dataIndex: 'remind_before_min', key: 'remind_before_min' },
    { title: '下班延后(分)', dataIndex: 'remind_after_min', key: 'remind_after_min' },
    { title: '加班(分)', dataIndex: 'overtime_min', key: 'overtime_min' },
    { title: '休息', dataIndex: 'is_rest', key: 'is_rest', render: (v: boolean) => (v ? '是' : '否') },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Shift) => (
        <>
          <Button type="link" onClick={() => openEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger>删除</Button>
          </Popconfirm>
        </>
      ),
    },
  ]

  return (
    <div>
      <Button type="primary" onClick={openCreate} style={{ marginBottom: 16 }}>新建班次</Button>
      <Table rowKey="id" columns={columns} dataSource={shifts} loading={loading} />
      <Modal
        title={editing ? '编辑班次' : '新建班次'}
        open={modalOpen}
        onOk={() => form.submit()}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="color" label="颜色" rules={[{ required: true }]}>
            <ColorPicker showText />
          </Form.Item>
          <Form.Item name="is_rest" label="休息类型" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="start_time" label="上班时间">
            <TimePicker format="HH:mm" />
          </Form.Item>
          <Form.Item name="end_time" label="下班时间">
            <TimePicker format="HH:mm" />
          </Form.Item>
          <Form.Item name="remind_before_min" label="上班提醒提前量（分钟）">
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item name="remind_after_min" label="下班提醒延后量（分钟）">
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item name="overtime_min" label="加班时长（分钟）">
            <InputNumber min={0} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Shifts
