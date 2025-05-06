/**
 * 从URL参数中获取配置
 * 这允许通过iframe嵌入时传递参数
 */
export function getConfigFromUrlParams() {
  if (typeof window === 'undefined') {
    return {
      appId: null,
      apiKey: null,
      apiBaseUrl: null,
    }
  }

  const urlParams = new URLSearchParams(window.location.search)
  
  return {
    appId: urlParams.get('app_id'),
    apiKey: urlParams.get('api_key'),
    apiBaseUrl: urlParams.get('api_base_url'),
  }
}
