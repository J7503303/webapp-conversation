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

// 添加缓存机制，避免重复解析URL参数
let cachedPatientInfo: { patientId: string | null; recordType: string | null } | null = null
let lastUrl: string | null = null

// 手动设置的病历类型（用于WPF应用无法通过URL传递时）
let manualRecordType: string | null = null

/**
 * 手动设置病历类型（用于WPF应用调用）
 * @param recordType 病历类型，如"入院记录"、"出院记录"等
 */
export function setRecordType(recordType: string) {
  manualRecordType = recordType
  // 清除缓存，强制重新解析
  cachedPatientInfo = null
  lastUrl = null
  console.log('手动设置病历类型为:', recordType)
}

/**
 * 获取手动设置的病历类型
 */
export function getManualRecordType(): string | null {
  return manualRecordType
}

/**
 * 清除手动设置的病历类型
 */
export function clearManualRecordType() {
  manualRecordType = null
  // 清除缓存，强制重新解析
  cachedPatientInfo = null
  lastUrl = null
  console.log('清除手动设置的病历类型')
}

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

  // 检查缓存，如果URL没有变化则直接返回缓存结果
  const currentUrl = window.location.href
  if (cachedPatientInfo && lastUrl === currentUrl) {
    return cachedPatientInfo
  }

  const urlParams = new URLSearchParams(window.location.search)

  // 只在第一次或URL变化时输出调试信息
  const shouldDebug = !lastUrl || lastUrl !== currentUrl
  if (shouldDebug) {
    console.log('=== URL参数调试信息 ===')
    console.log('完整URL:', window.location.href)
    console.log('查询字符串:', window.location.search)
    console.log('所有URL参数:')
    for (const [key, value] of urlParams.entries()) {
      console.log(`  ${key}: ${value}`)
    }
  }

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
      if (shouldDebug) {
        console.log('解码失败，使用原始值:', value)
      }
      // 如果解码失败，使用原始值
      return value
    }
  }

  // 尝试解码
  const patientId = tryDecode(patientIdRaw)
  let recordType = tryDecode(recordTypeRaw)

  if (shouldDebug) {
    console.log('获取到的患者ID:', patientIdRaw, '解码后:', patientId)
    console.log('获取到的病历类型:', recordTypeRaw, '解码后:', recordType)
  }

  // 优先级：手动设置 > URL参数 > localStorage缓存
  if (manualRecordType) {
    recordType = manualRecordType
    if (shouldDebug) {
      console.log('使用手动设置的病历类型:', recordType)
    }
  } else if (!recordType && patientId && typeof localStorage !== 'undefined') {
    // 如果URL参数中没有record_type，尝试从localStorage获取上次使用的病历类型
    const lastUsedRecordTypeKey = `lastUsedRecordType_${patientId}`

    // 正常的回填逻辑
    const lastUsedRecordType = localStorage.getItem(lastUsedRecordTypeKey)
    if (lastUsedRecordType) {
      recordType = lastUsedRecordType
      if (shouldDebug) {
        console.log('URL参数中没有病历类型，使用上次使用的病历类型:', recordType)
      }
    }
  }

  if (shouldDebug) {
    console.log('最终确定的病历类型:', recordType)
    console.log('=== URL参数调试信息结束 ===')
  }

  // 缓存结果
  cachedPatientInfo = { patientId, recordType }
  lastUrl = currentUrl

  return cachedPatientInfo
}

/**
 * 从URL参数中获取会话ID
 * 支持从URL参数中获取会话相关信息，用于直接跳转到特定会话
 */
export function getConversationIdFromUrlParams() {
  if (typeof window === 'undefined') {
    return null
  }

  const urlParams = new URLSearchParams(window.location.search)

  // 获取会话ID，支持多种参数名
  const conversationId = urlParams.get('conversation_id') || urlParams.get('conv_id') || urlParams.get('cid')

  if (conversationId) {
    // 尝试解码（如果是编码的）
    try {
      const urlDecoded = decodeURIComponent(conversationId)
      return decodeBase64ToString(urlDecoded)
    } catch (e) {
      console.log('会话ID解码失败，使用原始值:', conversationId)
      return conversationId
    }
  }

  return null
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
