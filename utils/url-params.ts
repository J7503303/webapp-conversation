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
 * 支持从URL参数中获取患者相关信息，并进行base64解码
 */
export function getPatientInfoFromUrlParams() {
  if (typeof window === 'undefined') {
    return {
      patientId: null,
      recordType: null,
    }
  }

  const urlParams = new URLSearchParams(window.location.search)

  // 获取患者ID和病历类型的原始值
  const patientIdRaw = urlParams.get('patient_id')
  const recordTypeRaw = urlParams.get('record_type')

  // 解码函数 - 尝试base64解码，如果失败则使用原始值
  const tryDecode = (value: string | null): string | null => {
    if (!value) return null

    try {
      // 先进行URL解码
      const urlDecoded = decodeURIComponent(value)
      // 尝试base64解码
      return decodeBase64ToString(urlDecoded)
    } catch (e) {
      console.log('解码失败，使用原始值:', value)
      // 如果解码失败，使用原始值
      return value
    }
  }

  // 尝试解码
  const patientId = tryDecode(patientIdRaw)
  const recordType = tryDecode(recordTypeRaw)

  console.log('获取到的患者ID:', patientIdRaw, '解码后:', patientId)
  console.log('获取到的病历类型:', recordTypeRaw, '解码后:', recordType)

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
