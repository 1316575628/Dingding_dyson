import { useEffect, useState } from 'react'
import { Layout as AntLayout, Menu, Avatar, Tooltip } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  DashboardOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  FileTextOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ScheduleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

const { Sider, Content, Header } = AntLayout

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/shifts', icon: <ClockCircleOutlined />, label: '班次管理' },
  { key: '/schedule', icon: <CalendarOutlined />, label: '排班日历' },
  { key: '/logs', icon: <FileTextOutlined />, label: '推送日志' },
  { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
]

function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [now, setNow] = useState(dayjs())

  // 顶部栏实时时钟
  useEffect(() => {
    const timer = window.setInterval(() => setNow(dayjs()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const activeLabel = menuItems.find((item) => item.key === location.pathname)?.label || '钉钉打卡提醒'

  return (
    <AntLayout style={{ minHeight: '100vh', background: 'var(--gm-background)' }}>
      <Sider
        theme="light"
        width={240}
        collapsedWidth={72}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        style={{ background: 'var(--gm-surface)', height: '100vh', position: 'sticky', top: 0 }}
      >
        <div className={`logo${collapsed ? ' logo-collapsed' : ''}`}>
          <ScheduleOutlined style={{ fontSize: 24, flexShrink: 0 }} />
          {!collapsed && <span>钉钉打卡提醒</span>}
        </div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0, paddingTop: 8, paddingBottom: 24 }}
        />
        <div
          onClick={() => setCollapsed(!collapsed)}
          style={{
            position: 'absolute',
            bottom: 16,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--gm-on-surface-variant)',
            fontSize: 16,
            padding: 8,
          }}
        >
          <Tooltip title={collapsed ? '展开菜单' : '收起菜单'} placement="right">
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </Tooltip>
        </div>
      </Sider>
      <AntLayout style={{ background: 'var(--gm-background)' }}>
        <Header
          style={{
            padding: '0 24px',
            height: 64,
            lineHeight: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--gm-on-surface)' }}>{activeLabel}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <span
              style={{
                fontSize: 14,
                fontVariantNumeric: 'tabular-nums',
                fontWeight: 500,
                color: 'var(--gm-on-surface-variant)',
              }}
            >
              {now.format('YYYY年MM月DD日 dddd HH:mm:ss')}
            </span>
            <Avatar style={{ background: 'var(--gm-primary-container)', color: 'var(--gm-on-primary-container)' }}>
              D
            </Avatar>
          </div>
        </Header>
        <Content style={{ padding: 24 }}>
          <div className="site-layout-content" key={location.pathname}>
            <div className="page-fade">
              <Outlet />
            </div>
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  )
}

export default Layout
