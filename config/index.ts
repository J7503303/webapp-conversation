import type { AppInfo } from '@/types/app'

// 默认从环境变量获取配置
const DEFAULT_APP_ID = `${process.env.NEXT_PUBLIC_APP_ID}`
const DEFAULT_API_KEY = `${process.env.NEXT_PUBLIC_APP_KEY}`
const DEFAULT_API_URL = `${process.env.NEXT_PUBLIC_API_URL}`

// 这些变量将在客户端被动态替换
export let APP_ID = DEFAULT_APP_ID
export let API_KEY = DEFAULT_API_KEY
export let API_URL = DEFAULT_API_URL

// 在客户端初始化时更新配置
export function updateConfig(appId?: string | null, apiKey?: string | null, apiUrl?: string | null) {
  if (appId) APP_ID = appId
  if (apiKey) API_KEY = apiKey
  if (apiUrl) API_URL = apiUrl
}
export const APP_INFO: AppInfo = {
  title: 'AI助手',
  description: '',
  copyright: '',
  privacy_policy: '',
  default_language: 'zh-Hans',
}

export const isShowPrompt = false
export const promptTemplate = 'I want you to act as a javascript console.'

export const API_PREFIX = '/api'

export const LOCALE_COOKIE_NAME = 'locale'

export const DEFAULT_VALUE_MAX_LEN = 48

// 控制聊天界面头像显示
export const isShowAvatar = false
