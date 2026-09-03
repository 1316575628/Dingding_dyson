import { useEffect, useState, useRef } from 'react'
import { Form, Input, Button, Tabs, message, Space } from 'antd'
import {
  UploadOutlined,
  ReloadOutlined,
  SaveOutlined,
  SettingOutlined,
  ImportOutlined,
  NotificationOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons'
import api from '../api'
import PageHeader from '../components/PageHeader'
import SectionCard from '../components/SectionCard'

function Settings() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [reloadLoading, setReloadLoading] = useState(false)
  const [importing, setImporting] = useState(false)
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

  const handleReload = async () => {
    setReloadLoading(true)
    try {
      const res = await api.post('/config/reload')
      message.success(res.data.message)
      await fetchConfig()
    } catch (e) {
      message.error('重载失败')
    } finally {
      setReloadLoading(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (importing) return
    setImporting(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await api.post('/import/schedule-json', formData)
      message.success(`导入成功：创建 ${res.data.created_shifts} 个班次，导入 ${res.data.imported_days} 天`)
    } catch (err) {
      message.error('导入失败')
    } finally {
      setImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const coreItems = [
    { name: 'API_KEY', label: '维格表 API Key', extra: '用于查询云端打卡记录的密钥' },
    { name: 'DST_ID', label: '维格表 DST ID', extra: '维格表中数据表 ID' },
    { name: 'fs_webhook', label: '飞书 Webhook', extra: '飞书机器人推送地址' },
    { name: 'fw_webhook', label: 'fwalert Webhook', extra: 'fwalert 推送地址，消息拼接在 URL 后' },
    { name: 'log_retention_days', label: '日志保留天数', extra: '超过该天数的日志会在每日凌晨自动清理' },
  ]

  const emailItems = [
    { name: 'email_smtp_host', label: 'SMTP 服务器', extra: '如 smtp.qq.com' },
    { name: 'email_smtp_port', label: 'SMTP 端口', extra: '通常为 465 或 587' },
    { name: 'email_username', label: '邮箱账号', extra: '发件邮箱地址' },
    { name: 'email_password', label: '邮箱密码/授权码', extra: '服务商生成的授权码，非登录密码' },
    { name: 'email_to', label: '收件人', extra: '接收提醒的邮箱地址' },
  ]

  const smsItems = [
    { name: 'sms_provider', label: '短信服务商', extra: '预留字段' },
    { name: 'sms_api_key', label: '短信 API Key', extra: '预留字段' },
  ]

  const renderFormItems = (items: { name: string; label: string; extra?: string }[]) =>
    items.map((item) => (
      <Form.Item key={item.name} name={item.name} label={item.label} extra={item.extra}>
        <Input allowClear />
      </Form.Item>
    ))

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div
      style={{
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: 0.5,
        color: 'var(--gm-primary)',
        textTransform: 'uppercase',
        margin: '8px 0 16px',
      }}
    >
      {children}
    </div>
  )

  return (
    <div>
      <PageHeader title="系统设置" subtitle="配置通知渠道、日志保留与数据导入" />
      <Tabs
        className="gm-tabs"
        defaultActiveKey="core"
        items={[
          {
            key: 'core',
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <SettingOutlined /> 核心配置
              </span>
            ),
            children: (
              <SectionCard>
                <Form form={form} layout="vertical" onFinish={handleSave}>
                  <SectionTitle>接入凭证</SectionTitle>
                  {renderFormItems(coreItems.slice(0, 2))}
                  <SectionTitle>推送渠道</SectionTitle>
                  {renderFormItems(coreItems.slice(2, 4))}
                  <SectionTitle>运行策略</SectionTitle>
                  {renderFormItems(coreItems.slice(4))}
                  <Form.Item style={{ marginTop: 28, marginBottom: 0 }}>
                    <Space size={12}>
                      <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
                        保存
                      </Button>
                      <Button icon={<ReloadOutlined />} loading={reloadLoading} onClick={handleReload}>
                        从 config.json 热重载
                      </Button>
                    </Space>
                  </Form.Item>
                </Form>
              </SectionCard>
            ),
          },
          {
            key: 'import',
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ImportOutlined /> 数据导入
              </span>
            ),
            children: (
              <SectionCard>
                <SectionTitle>导入排班 JSON</SectionTitle>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 16,
                    padding: '48px 24px',
                    borderRadius: 12,
                    border: '2px dashed var(--gm-outline)',
                    background: 'var(--gm-surface-1)',
                    textAlign: 'center',
                  }}
                >
                  <span
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      background: 'var(--gm-primary-container)',
                      color: 'var(--gm-on-primary-container)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 28,
                    }}
                  >
                    <CloudUploadOutlined />
                  </span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--gm-on-surface)', marginBottom: 4 }}>
                      上传 data.json 排班文件
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--gm-on-surface-variant)' }}>
                      支持与原 data.json 格式一致的文件（年 → 月 → 日 → 班次名），大小不超过 5MB
                    </div>
                  </div>
                  <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
                  <Button type="primary" icon={<UploadOutlined />} loading={importing} onClick={() => fileInputRef.current?.click()}>
                    选择文件
                  </Button>
                </div>
              </SectionCard>
            ),
          },
          {
            key: 'extend',
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <NotificationOutlined /> 扩展通知（预留）
              </span>
            ),
            children: (
              <SectionCard>
                <p style={{ color: 'var(--gm-on-surface-variant)', marginTop: 0 }}>
                  以下配置本期仅作预留，发送逻辑将在后续版本实现。
                </p>
                <Form form={form} layout="vertical" onFinish={handleSave}>
                  <SectionTitle>邮件通知</SectionTitle>
                  {renderFormItems(emailItems)}
                  <SectionTitle>短信通知</SectionTitle>
                  {renderFormItems(smsItems)}
                  <Form.Item style={{ marginTop: 28, marginBottom: 0 }}>
                    <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
                      保存
                    </Button>
                  </Form.Item>
                </Form>
              </SectionCard>
            ),
          },
        ]}
      />
    </div>
  )
}

export default Settings
