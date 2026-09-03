import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Tooltip } from 'antd'
import {
  DashboardOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  FileTextOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons'

interface NavItem {
  key: string
  icon: React.ReactNode
  label: string
}

const navItems: NavItem[] = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/shifts', icon: <ClockCircleOutlined />, label: '班次管理' },
  { key: '/schedule', icon: <CalendarOutlined />, label: '排班日历' },
  { key: '/logs', icon: <FileTextOutlined />, label: '推送日志' },
  { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
]

/** Google 四色时钟 Logo */
function BrandMark() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="14" fill="none" stroke="#e8eaed" strokeWidth="2.5" />
      <path d="M16 6 A10 10 0 0 1 26 16" fill="none" stroke="#1a73e8" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M16 26 A10 10 0 0 1 6 16" fill="none" stroke="#34a853" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="16" y1="16" x2="16" y2="8.5" stroke="#ea4335" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="16" y1="16" x2="22.5" y2="19" stroke="#fbbc05" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2" fill="#202124" />
    </svg>
  )
}

function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    // 移动端默认收起无意义（隐藏导航），桌面保留用户偏好
    const saved = localStorage.getItem('gm-nav-collapsed')
    if (saved !== null) setCollapsed(saved === '1')
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      localStorage.setItem('gm-nav-collapsed', prev ? '0' : '1')
      return !prev
    })
  }

  return (
    <div className="app-shell">
      <aside className={`app-nav${collapsed ? ' app-nav--collapsed' : ''}`}>
        <div className={`app-nav-brand${collapsed ? ' app-nav-brand--collapsed' : ''}`}>
          <BrandMark />
          {!collapsed && (
            <span style={{ fontSize: 17, fontWeight: 500, letterSpacing: -0.2, color: 'var(--gm-on-surface)' }}>
              打卡提醒
            </span>
          )}
        </div>

        <div className="gm-label app-nav-section-label">{collapsed ? '' : '工作台'}</div>

        {navItems.map((item) => {
          const active = location.pathname === item.key
          const btn = (
            <button
              key={item.key}
              className={`app-nav-item${active ? ' app-nav-item--active' : ''}`}
              onClick={() => navigate(item.key)}
              aria-current={active ? 'page' : undefined}
            >
              <span className="app-nav-item-icon">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          )
          return collapsed ? (
            <Tooltip key={item.key} title={item.label} placement="right">
              {btn}
            </Tooltip>
          ) : (
            btn
          )
        })}

        <div className="app-nav-collapse">
          <Tooltip title={collapsed ? '展开' : '收起'} placement="right">
            <button className="app-nav-item" onClick={toggleCollapsed} aria-label="切换侧边栏">
              <span className="app-nav-item-icon">
                {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              </span>
              {!collapsed && <span>收起菜单</span>}
            </button>
          </Tooltip>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0 }}>
        <div className="site-layout-content" key={location.pathname}>
          <div className="page-fade">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}

export default Layout
