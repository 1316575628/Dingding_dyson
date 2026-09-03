import { Layout as AntLayout, Menu, Avatar } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  DashboardOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  FileTextOutlined,
  SettingOutlined,
} from '@ant-design/icons'

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

  const activeLabel = menuItems.find((item) => item.key === location.pathname)?.label || '钉钉打卡提醒'

  return (
    <AntLayout style={{ minHeight: '100vh', background: 'var(--gm-background)' }}>
      <Sider theme="light" width={256} style={{ background: 'var(--gm-surface)' }}>
        <div className="logo">钉钉打卡提醒</div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0, paddingTop: 8 }}
        />
      </Sider>
      <AntLayout style={{ background: 'var(--gm-background)' }}>
        <Header style={{ padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--gm-on-surface)' }}>
            {activeLabel}
          </h2>
          <Avatar style={{ background: 'var(--gm-primary-container)', color: 'var(--gm-on-primary-container)' }}>
            D
          </Avatar>
        </Header>
        <Content style={{ margin: 24 }}>
          <div className="site-layout-content">
            <Outlet />
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  )
}

export default Layout
