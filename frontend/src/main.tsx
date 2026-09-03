import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider, App as AntApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import App from './App'
import './index.css'

dayjs.locale('zh-cn')

// Google Material 风格主题令牌
const gmTheme = {
  token: {
    colorPrimary: '#1a73e8',
    colorSuccess: '#188038',
    colorWarning: '#ea8600',
    colorError: '#d93025',
    colorInfo: '#1a73e8',
    colorText: '#202124',
    colorTextSecondary: '#5f6368',
    colorTextTertiary: '#80868b',
    colorBgLayout: '#f8f9fa',
    colorBgContainer: '#ffffff',
    colorBorder: '#dadce0',
    colorBorderSecondary: '#e8eaed',
    borderRadius: 8,
    fontFamily:
      "'Roboto', 'Google Sans', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif",
    fontSize: 14,
    controlHeight: 40,
    lineHeight: 1.6,
  },
  components: {
    Button: {
      borderRadius: 8,
      borderRadiusLG: 8,
      borderRadiusSM: 6,
      controlHeight: 40,
      controlHeightSM: 32,
      fontWeight: 500,
      primaryShadow: 'none',
      defaultShadow: 'none',
      dangerShadow: 'none',
    },
    Card: {
      borderRadiusLG: 12,
      paddingLG: 24,
    },
    Table: {
      headerBg: 'transparent',
      headerColor: '#80868b',
      headerSplitColor: 'transparent',
      rowHoverBg: '#f1f3f4',
      cellPaddingBlock: 14,
      cellPaddingInline: 16,
    },
    Modal: {
      borderRadiusLG: 16,
      paddingContentHorizontal: 28,
    },
    Drawer: {
      paddingLG: 24,
    },
    Tag: {
      borderRadiusSM: 999,
    },
    Input: {
      borderRadius: 8,
      activeShadow: '0 0 0 3px rgba(26, 115, 232, 0.1)',
    },
    DatePicker: {
      borderRadius: 8,
    },
    Select: {
      borderRadius: 8,
    },
    Progress: {
      defaultColor: '#1a73e8',
    },
    Switch: {
      handleSize: 20,
    },
  },
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={gmTheme}>
      <AntApp>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
)
