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
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" width={200}>
        <div className="logo">钉钉打卡提醒</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <AntLayout>
        <Header style={{ background: '#fff', padding: '0 24px' }}>
          <h2 style={{ margin: 0 }}>
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
