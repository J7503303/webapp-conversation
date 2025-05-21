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

import { decodeBase64ToString } from './base64-utils'

/**
 * 从URL参数中获取患者ID和病历类型
 * 支持从URL参数中获取患者相关信息
 */
export function getPatientInfoFromUrlParams() {
  if (typeof window === 'undefined') {
    return {
      patientId: null,
      recordType: null,
    }
  }

  const urlParams = new URLSearchParams(window.location.search)

  // 获取患者ID和病历类型
  const patientId = urlParams.get('patient_id')
  const recordType = urlParams.get('record_type')

  return {
    patientId,
    recordType,
  }
}

/**
 * 从URL参数中获取inputs参数
 * 支持从URL参数中获取GZIP压缩并base64编码的inputs参数
 */
export function getInputsFromUrlParams() {
  if (typeof window === 'undefined') {
    return {}
  }

  const urlParams = new URLSearchParams(window.location.search)
  const inputs: Record<string, any> = {}

  // 遍历所有URL参数
  for (const [key, value] of urlParams.entries()) {
    // 检查是否是inputs参数
    try {
      // 尝试解码base64编码的值
      if (value && value.length > 0) {
        // 对于workflow应用，参数格式为 key=base64编码值
        // 先进行URL解码
        const decodedValue = decodeURIComponent(value)
        // 尝试进行base64解码
        try {
          // 使用自定义函数进行base64解码
          const base64Decoded = decodeBase64ToString(decodedValue)
          // 将解码后的值存入inputs对象
          inputs[key] = base64Decoded
        } catch (e) {
          // 如果base64解码失败，则直接使用原始值
          inputs[key] = decodedValue
        }
      }
    } catch (e) {
      console.error(`Error parsing input parameter ${key}:`, e)
    }
  }

  return inputs
}
