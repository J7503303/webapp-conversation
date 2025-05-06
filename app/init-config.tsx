'use client'
import { useEffect } from 'react'
import { getConfigFromUrlParams } from '@/utils/url-params'
import { updateConfig, updateAvatarConfig } from '@/config'

/**
 * 初始化配置组件
 * 在应用启动时从 URL 参数中获取配置并应用到应用中
 */
export default function InitConfig() {
  useEffect(() => {
    // 从 URL 参数中获取配置
    const { appId, apiKey, apiBaseUrl } = getConfigFromUrlParams()

    // 更新配置
    updateConfig(appId, apiKey, apiBaseUrl)

    // 如果是工作流应用，自动开始聊天
    const urlParams = new URLSearchParams(window.location.search)
    const isWorkflow = urlParams.get('is_workflow') === 'true'
    const autoStart = urlParams.get('auto_start') === 'true'
    const hideAvatar = urlParams.get('hide_avatar') === 'true'

    // 可以在这里添加更多的 URL 参数处理逻辑

    // 将参数存储到 localStorage 中，以便其他组件可以使用
    if (isWorkflow) {
      localStorage.setItem('is_workflow', 'true')
    }

    if (autoStart) {
      localStorage.setItem('auto_start', 'true')
    }

    if (hideAvatar) {
      localStorage.setItem('hide_avatar', 'true')
      // 更新头像显示设置
      updateAvatarConfig(false)
    }
  }, [])

  // 这个组件不渲染任何内容
  return null
}
