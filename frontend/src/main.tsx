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

// Google Material 3 风格主题令牌
const gmTheme = {
  token: {
    colorPrimary: '#1a73e8',
    colorSuccess: '#34a853',
    colorWarning: '#fbbc05',
    colorError: '#ea4335',
    colorInfo: '#1a73e8',
    colorTextBase: '#202124',
    colorBgLayout: '#f8f9fa',
    colorBgContainer: '#ffffff',
    colorBorder: '#dadce0',
    colorBorderSecondary: '#e8eaed',
    borderRadius: 8,
    fontFamily:
      "'Roboto', 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    fontSize: 14,
    controlHeight: 40,
    boxShadow: '0 1px 3px rgba(60, 64, 67, 0.06)',
    boxShadowSecondary: '0 1px 3px rgba(60, 64, 67, 0.1), 0 4px 8px 3px rgba(60, 64, 67, 0.05)',
  },
  components: {
    Button: {
      borderRadius: 8,
      borderRadiusLG: 8,
      controlHeight: 40,
      fontWeight: 500,
    },
    Card: {
      borderRadiusLG: 12,
      paddingLG: 24,
    },
    Table: {
      headerBg: '#f8f9fa',
      headerColor: '#5f6368',
      headerSplitColor: 'transparent',
      rowHoverBg: '#f1f3f4',
      cellPaddingBlock: 14,
    },
    Modal: {
      borderRadiusLG: 12,
    },
    Drawer: {
      paddingLG: 24,
    },
    Menu: {
      itemBorderRadius: 28,
      itemMarginInline: 12,
      itemHeight: 44,
      itemSelectedBg: '#d3e3fd',
      itemSelectedColor: '#041e49',
    },
    Tag: {
      borderRadiusSM: 999,
    },
    Input: {
      borderRadius: 8,
      activeShadow: '0 0 0 3px rgba(26, 115, 232, 0.12)',
    },
    DatePicker: {
      borderRadius: 8,
    },
    Select: {
      borderRadius: 8,
    },
    Pagination: {
      itemActiveBg: '#1a73e8',
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
