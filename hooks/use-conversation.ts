import { useState } from 'react'
import produce from 'immer'
import { useGetState } from 'ahooks'
import type { ConversationItem } from '@/types/app'
import { getPatientInfoFromUrlParams } from '@/utils/url-params'

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
      // 获取患者ID和病历类型
      const { patientId, recordType } = getPatientInfoFromUrlParams()

      // 使用患者特定的存储键
      const storageKey = getPatientSpecificStorageKey(appId, patientId, recordType)

      const conversationIdInfo = globalThis.localStorage?.getItem(storageConversationIdKey) ? JSON.parse(globalThis.localStorage?.getItem(storageConversationIdKey) || '') : {}
      const id = conversationIdInfo[storageKey]
      return id
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
