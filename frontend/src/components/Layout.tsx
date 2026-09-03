import { Layout as AntLayout, Menu } from 'antd'
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

  return (
    <AntLayout style={{ minHeight: '100vh', background: '#f8f9fa' }}>
      <Sider theme="light" width={220} style={{ background: '#fff' }}>
        <div className="logo" style={{ color: '#1a73e8' }}>钉钉打卡提醒</div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <AntLayout style={{ background: '#f8f9fa' }}>
        <Header style={{ background: '#fff', padding: '0 28px', display: 'flex', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 500, color: '#202124' }}>
            {menuItems.find((item) => item.key === location.pathname)?.label || '钉钉打卡提醒'}
          </h2>
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
