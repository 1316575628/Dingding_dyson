import { useEffect, useState, useRef } from 'react'
import { Form, Input, Button, Tabs, message, Card } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import api from '../api'

function Settings() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchConfig = async () => {
    try {
      const res = await api.get('/config')
      form.setFieldsValue(res.data)
    } catch (e) {
      message.error('加载配置失败')
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  const handleSave = async (values: any) => {
    setLoading(true)
    try {
      await api.post('/config', { config: values })
      message.success('保存成功')
    } catch (e) {
      message.error('保存失败')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await api.post('/import/schedule-json', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      message.success(`导入成功：创建 ${res.data.created_shifts} 个班次，导入 ${res.data.imported_days} 天`)
    } catch (err) {
      message.error('导入失败')
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const coreItems = [
    { name: 'API_KEY', label: '维格表 API Key' },
    { name: 'DST_ID', label: '维格表 DST ID' },
    { name: 'fs_webhook', label: '飞书 Webhook' },
    { name: 'fw_webhook', label: 'fwalert Webhook' },
    { name: 'log_retention_days', label: '日志保留天数' },
  ]

  const emailItems = [
    { name: 'email_smtp_host', label: 'SMTP 服务器' },
    { name: 'email_smtp_port', label: 'SMTP 端口' },
    { name: 'email_username', label: '邮箱账号' },
    { name: 'email_password', label: '邮箱密码/授权码' },
    { name: 'email_to', label: '收件人' },
  ]

  const smsItems = [
    { name: 'sms_provider', label: '短信服务商' },
    { name: 'sms_api_key', label: '短信 API Key' },
  ]

  const renderFormItems = (items: { name: string; label: string }[]) =>
    items.map((item) => (
      <Form.Item key={item.name} name={item.name} label={item.label}>
        <Input />
      </Form.Item>
    ))

  return (
    <Tabs
      defaultActiveKey="core"
      items={[
        {
          key: 'core',
          label: '核心配置',
          children: (
            <Card>
              <Form form={form} layout="vertical" onFinish={handleSave}>
                {renderFormItems(coreItems)}
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading}>保存</Button>
                </Form.Item>
              </Form>
            </Card>
          ),
        },
        {
          key: 'import',
          label: '数据导入',
          children: (
            <Card title="导入排班 JSON">
              <p>支持导入与原 data.json 格式一致的文件（年 → 月 → 日 → 班次名）</p>
              <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
              <Button icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}>
                上传 data.json
              </Button>
            </Card>
          ),
        },
        {
          key: 'extend',
          label: '扩展通知（预留）',
          children: (
            <Card>
              <p>以下配置本期仅作预留，发送逻辑将在后续版本实现。</p>
              <Form form={form} layout="vertical" onFinish={handleSave}>
                <h4>邮件通知</h4>
                {renderFormItems(emailItems)}
                <h4 style={{ marginTop: 24 }}>短信通知</h4>
                {renderFormItems(smsItems)}
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading}>保存</Button>
                </Form.Item>
              </Form>
            </Card>
          ),
        },
      ]}
    />
  )
}

export default Settings
