import { useState } from 'react'
import produce from 'immer'
import { useGetState } from 'ahooks'
import type { ConversationItem } from '@/types/app'
import { getPatientInfoFromUrlParams, getConversationIdFromUrlParams } from '@/utils/url-params'

const storageConversationIdKey = 'conversationIdInfo'

// 生成与患者和病历类型关联的存储键
const getPatientSpecificStorageKey = (appId: string, patientId?: string | null, recordType?: string | null) => {
  // 如果没有提供患者ID或病历类型，则使用默认的存储键
  if (!patientId && !recordType)
    return appId

  // 生成包含患者ID和病历类型的键
  let key = appId
  if (patientId)
    key += `_patient_${patientId}`
  if (recordType)
    key += `_record_${recordType}`

  return key
}

type ConversationInfoType = Omit<ConversationItem, 'inputs' | 'id'>
function useConversation() {
  const [conversationList, setConversationList] = useState<ConversationItem[]>([])
  const [currConversationId, doSetCurrConversationId, getCurrConversationId] = useGetState<string>('-1')

  // 当设置对话ID时，考虑患者ID和病历类型
  const setCurrConversationId = (id: string, appId: string, isSetToLocalStroge = true, newConversationName = '') => {
    doSetCurrConversationId(id)
    if (isSetToLocalStroge && id !== '-1') {
      // 获取患者ID和病历类型
      const { patientId, recordType } = getPatientInfoFromUrlParams()

      // 使用患者特定的存储键
      const storageKey = getPatientSpecificStorageKey(appId, patientId, recordType)

      // conversationIdInfo: {[appId1]: conversationId1, [appId2]: conversationId2, [appId_patient_1_record_入院记录]: conversationId3}
      const conversationIdInfo = globalThis.localStorage?.getItem(storageConversationIdKey) ? JSON.parse(globalThis.localStorage?.getItem(storageConversationIdKey) || '') : {}
      conversationIdInfo[storageKey] = id
      globalThis.localStorage?.setItem(storageConversationIdKey, JSON.stringify(conversationIdInfo))
    }
  }

  const getConversationIdFromStorage = (appId: string) => {
    try {
      console.log('=== getConversationIdFromStorage 调试信息 ===')

      // 获取患者ID和病历类型
      const { patientId, recordType } = getPatientInfoFromUrlParams()
      console.log('从URL参数获取的患者ID:', patientId)
      console.log('从URL参数获取的病历类型:', recordType)

      // 使用患者特定的存储键
      const storageKey = getPatientSpecificStorageKey(appId, patientId, recordType)
      console.log('生成的存储键:', storageKey)

      const conversationIdInfo = globalThis.localStorage?.getItem(storageConversationIdKey) ? JSON.parse(globalThis.localStorage?.getItem(storageConversationIdKey) || '') : {}
      console.log('localStorage中的conversationIdInfo:', conversationIdInfo)

      const id = conversationIdInfo[storageKey]
      console.log('从localStorage获取的会话ID:', id)

      // 如果找到了精确匹配的会话ID，直接返回
      if (id) {
        console.log('找到精确匹配的会话ID:', id)
        return id
      }

      // 如果没有找到精确匹配，尝试智能匹配
      console.log('没有找到精确匹配，开始智能匹配...')

      // 尝试从localStorage获取上次使用的record_type
      const lastUsedRecordTypeKey = `lastUsedRecordType_${patientId}`
      const lastUsedRecordType = globalThis.localStorage?.getItem(lastUsedRecordTypeKey)
      console.log('上次使用的病历类型:', lastUsedRecordType)

      // 如果有上次使用的record_type，尝试用它构建存储键
      if (lastUsedRecordType && patientId) {
        const smartStorageKey = getPatientSpecificStorageKey(appId, patientId, lastUsedRecordType)
        const smartId = conversationIdInfo[smartStorageKey]
        console.log('使用上次病历类型的存储键:', smartStorageKey, '会话ID:', smartId)
        if (smartId) {
          return smartId
        }
      }

      // 如果还是没找到，查找所有包含当前患者ID的键
      if (patientId) {
        const patientKeys = Object.keys(conversationIdInfo).filter(key =>
          key.includes(appId) && key.includes(`_patient_${patientId}`)
        )
        console.log('找到的患者相关键:', patientKeys)

        if (patientKeys.length > 0) {
          // 优先选择有record_type的键
          const recordTypeKeys = patientKeys.filter(key => key.includes('_record_'))
          if (recordTypeKeys.length > 0) {
            const selectedKey = recordTypeKeys[0] // 选择第一个有record_type的键
            const selectedId = conversationIdInfo[selectedKey]
            console.log('选择有record_type的键:', selectedKey, '会话ID:', selectedId)

            // 提取并保存这个record_type作为上次使用的
            const recordTypeMatch = selectedKey.match(/_record_(.+)$/)
            if (recordTypeMatch) {
              const extractedRecordType = recordTypeMatch[1]
              globalThis.localStorage?.setItem(lastUsedRecordTypeKey, extractedRecordType)
              console.log('保存提取的病历类型为上次使用:', extractedRecordType)
            }

            return selectedId
          } else {
            // 如果没有record_type的键，选择第一个
            const selectedKey = patientKeys[0]
            const selectedId = conversationIdInfo[selectedKey]
            console.log('选择无record_type的键:', selectedKey, '会话ID:', selectedId)
            return selectedId
          }
        }
      }

      // 如果localStorage中没有找到会话ID，尝试从URL参数中获取
      const urlConversationId = getConversationIdFromUrlParams()
      if (urlConversationId) {
        console.log('从URL参数中获取到会话ID:', urlConversationId)
        return urlConversationId
      } else {
        console.log('URL参数中也没有会话ID')
      }

      console.log('=== getConversationIdFromStorage 结束 ===')
      return undefined
    } catch (error) {
      console.error('从本地存储获取会话ID失败:', error)
      return undefined
    }
  }

  // 使用useGetState来获取实时的currConversationId值
  const isNewConversation = getCurrConversationId() === '-1'
  // input can be updated by user
  const [newConversationInputs, setNewConversationInputs] = useState<Record<string, any> | null>(null)
  const resetNewConversationInputs = () => {
    if (!newConversationInputs)
      return
    setNewConversationInputs(produce(newConversationInputs, (draft) => {
      Object.keys(draft).forEach((key) => {
        draft[key] = ''
      })
    }))
  }
  const [existConversationInputs, setExistConversationInputs] = useState<Record<string, any> | null>(null)
  const currInputs = isNewConversation ? newConversationInputs : existConversationInputs
  const setCurrInputs = isNewConversation ? setNewConversationInputs : setExistConversationInputs

  // info is muted
  const [newConversationInfo, setNewConversationInfo] = useState<ConversationInfoType | null>(null)
  const [existConversationInfo, setExistConversationInfo] = useState<ConversationInfoType | null>(null)
  const currConversationInfo = isNewConversation ? newConversationInfo : existConversationInfo

  return {
    conversationList,
    setConversationList,
    currConversationId,
    getCurrConversationId,
    setCurrConversationId,
    getConversationIdFromStorage,
    isNewConversation,
    currInputs,
    newConversationInputs,
    existConversationInputs,
    resetNewConversationInputs,
    setCurrInputs,
    currConversationInfo,
    setNewConversationInfo,
    setExistConversationInfo,
  }
}

export default useConversation
