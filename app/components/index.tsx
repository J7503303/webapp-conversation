/* eslint-disable @typescript-eslint/no-use-before-define */
'use client'
import type { FC } from 'react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import produce, { setAutoFreeze } from 'immer'
import { useBoolean, useGetState } from 'ahooks'
import useConversation from '@/hooks/use-conversation'
import Toast from '@/app/components/base/toast'
import Sidebar from '@/app/components/sidebar'
import ConfigSence from '@/app/components/config-scence'
import Header from '@/app/components/header'
import { fetchAppParams, fetchChatList, fetchConversations, generationConversationName, sendChatMessage, updateFeedback } from '@/service'
import type { ChatItem, ConversationItem, Feedbacktype, PromptConfig, VisionFile, VisionSettings } from '@/types/app'
import { Resolution, TransferMethod, WorkflowRunningStatus } from '@/types/app'
import Chat from '@/app/components/chat'
import { setLocaleOnClient } from '@/i18n/client'
import useBreakpoints, { MediaType } from '@/hooks/use-breakpoints'
import Loading from '@/app/components/base/loading'
import { replaceVarWithValues, userInputsFormToPromptVariables } from '@/utils/prompt'
import AppUnavailable from '@/app/components/app-unavailable'
import { API_KEY, APP_ID, APP_INFO, isShowPrompt, promptTemplate, isShowSidebar as configIsShowSidebar } from '@/config'
import type { Annotation as AnnotationType } from '@/types/log'
import { addFileInfos, sortAgentSorts } from '@/utils/tools'
import { getInputsFromUrlParams } from '@/utils/url-params'

// 添加全局类型声明，修复类型错误
declare global {
  interface Window {
    openingStatement?: string;
    openingQuestions?: string[];
    sendSuggestedQuestion?: CustomEvent;
  }
}

export type IMainProps = {
  params: any
}

const Main: FC<IMainProps> = () => {
  const { t } = useTranslation()
  const media = useBreakpoints()
  const isMobile = media === MediaType.mobile
  const hasSetAppConfig = APP_ID && API_KEY

  /*
  * app info
  */
  const [appUnavailable, setAppUnavailable] = useState<boolean>(false)
  const [isUnknownReason, setIsUnknownReason] = useState<boolean>(false)
  const [promptConfig, setPromptConfig] = useState<PromptConfig | null>(null)
  const [inited, setInited] = useState<boolean>(false)
  // in mobile, show sidebar by click button
  const [isShowSidebar, { setTrue: showSidebar, setFalse: hideSidebar }] = useBoolean(false)
  const [visionConfig, setVisionConfig] = useState<VisionSettings | undefined>({
    enabled: false,
    number_limits: 2,
    detail: Resolution.low,
    transfer_methods: [TransferMethod.local_file],
  })

  useEffect(() => {
    if (APP_INFO?.title)
      document.title = `${APP_INFO.title} - Powered by Dify`
  }, [APP_INFO?.title])

  // onData change thought (the produce obj). https://github.com/immerjs/immer/issues/576
  useEffect(() => {
    setAutoFreeze(false)
    return () => {
      setAutoFreeze(true)
    }
  }, [])

  /*
  * conversation info
  */
  const {
    conversationList,
    setConversationList,
    currConversationId,
    getCurrConversationId,
    setCurrConversationId,
    getConversationIdFromStorage,
    isNewConversation,
    currConversationInfo,
    currInputs,
    newConversationInputs,
    resetNewConversationInputs,
    setCurrInputs,
    setNewConversationInfo,
    setExistConversationInfo,
  } = useConversation()

  const [conversationIdChangeBecauseOfNew, setConversationIdChangeBecauseOfNew, getConversationIdChangeBecauseOfNew] = useGetState(false)
  const [isChatStarted, { setTrue: setChatStarted, setFalse: setChatNotStarted }] = useBoolean(false)
  const handleStartChat = (inputs: Record<string, any>) => {
    createNewChat()
    setConversationIdChangeBecauseOfNew(true)
    setCurrInputs(inputs)
    setChatStarted()
    // parse variables in introduction
    setChatList(generateNewChatListWithOpenStatement('', inputs))
  }
  // 计算hasSetInputs
  const hasSetInputs = (() => {
    if (!isNewConversation)
      return true

    return isChatStarted
  })()

  const conversationName = currConversationInfo?.name || t('app.chat.newChatDefaultName') as string
  const conversationIntroduction = currConversationInfo?.introduction || ''

  const handleConversationSwitch = () => {
    if (!inited) {
      return
    }

    // 获取实时的会话ID和新会话状态
    const realConversationId = getCurrConversationId()
    const realIsNewConversation = realConversationId === '-1'
    console.log('切换会话，当前会话ID:', realConversationId, '是否新会话:', realIsNewConversation)

    // 如果已经从localStorage恢复了聊天列表，则不再执行会话切换逻辑
    if (getRestoredFromLocalStorage()) {
      console.log('已经从localStorage恢复了聊天列表，不再执行会话切换逻辑')
      return
    }

    // update inputs of current conversation
    let notSyncToStateIntroduction = ''
    let notSyncToStateInputs: Record<string, any> | undefined | null = {}
    if (!realIsNewConversation) {
      const item = conversationList.find(item => item.id === realConversationId)
      notSyncToStateInputs = item?.inputs || {}
      setCurrInputs(notSyncToStateInputs as any)
      notSyncToStateIntroduction = item?.introduction || ''
      setExistConversationInfo({
        name: item?.name || '',
        introduction: notSyncToStateIntroduction,
      })

      // 只有在没有从localStorage恢复聊天列表的情况下，才从服务器获取历史记录
      if (!isResponding && !getRestoredFromLocalStorage()) {
        console.log('从服务器获取历史记录，会话ID:', realConversationId)
        fetchChatList(realConversationId).then((res: any) => {
          const { data } = res
          const newChatList: ChatItem[] = generateNewChatListWithOpenStatement(notSyncToStateIntroduction, notSyncToStateInputs)

          data.forEach((item: any) => {
            newChatList.push({
              id: `question-${item.id}`,
              content: item.query,
              isAnswer: false,
              message_files: item.message_files?.filter((file: any) => file.belongs_to === 'user') || [],

            })
            newChatList.push({
              id: item.id,
              content: item.answer,
              agent_thoughts: addFileInfos(item.agent_thoughts ? sortAgentSorts(item.agent_thoughts) : item.agent_thoughts, item.message_files),
              feedback: item.feedback,
              isAnswer: true,
              message_files: item.message_files?.filter((file: any) => file.belongs_to === 'assistant') || [],
            })
          })
          console.log('从服务器获取历史记录成功，设置聊天列表，项数:', newChatList.length)
          setChatList(newChatList)
          // 确保聊天已开始，这样在刷新页面后能正确显示聊天内容
          setChatStarted()
        }).catch(err => {
          console.error('加载历史记录失败:', err)
        })
      }
    }
    else {
      notSyncToStateInputs = newConversationInputs
      setCurrInputs(notSyncToStateInputs)

      if (realIsNewConversation && isChatStarted) {
        console.log('新会话且聊天已开始，创建新的聊天列表')
        setChatList(generateNewChatListWithOpenStatement())
      }
    }
  }
  // 只在currConversationId变化时触发会话切换，不再监听inited状态
  // 这样可以避免在页面刷新后重复触发会话切换
  // 创建一个标记，记录是否是页面加载后的第一次执行
  const isFirstRun = useRef(true)

  useEffect(() => {
    // 如果是页面加载后的第一次执行，则跳过
    // 因为页面加载时已经尝试从localStorage恢复聊天列表了
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }

    if (inited) { // 只在inited为true时才触发
      // 先尝试从localStorage恢复聊天列表
      const conversationId = getCurrConversationId()
      console.log('会话ID变化，当前会话ID:', conversationId)

      // 如果已经从localStorage恢复了聊天列表，则不再执行会话切换逻辑
      if (getRestoredFromLocalStorage()) {
        console.log('已经从localStorage恢复了聊天列表，不再执行会话切换逻辑')
        return
      }

      // 尝试从localStorage恢复聊天列表
      const restored = restoreChatListFromLocalStorage(conversationId)
      console.log('尝试从localStorage恢复聊天列表结果:', restored ? '成功' : '失败')

      // 如果没有从localStorage恢复成功，则执行正常的会话切换逻辑
      if (!restored) {
        console.log('没有从localStorage恢复成功，执行正常的会话切换逻辑')
        handleConversationSwitch()
      }
    }
  }, [currConversationId])

  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [pendingResetId, setPendingResetId] = useState<string | null>(null)

  const handleConversationIdChange = (id: string) => {
    if (id === '-1') {
      setPendingResetId(id)
      setShowResetConfirm(true)
      return
    }
    setConversationIdChangeBecauseOfNew(false)
    setCurrConversationId(id, APP_ID)
    hideSidebar()
  }

  const doResetConversation = () => {
    createNewChat()
    setConversationIdChangeBecauseOfNew(true)
    _setChatList([])
    setRestoredFromLocalStorage(false)
    const urlInputs = getInputsFromUrlParams()
    if (Object.keys(urlInputs).length > 0 && promptConfig?.prompt_variables) {
      const processedInputs: Record<string, any> = {}
      promptConfig.prompt_variables.forEach(variable => {
        if (urlInputs[variable.key]) {
          if (variable.type === 'number') {
            processedInputs[variable.key] = Number(urlInputs[variable.key])
          } else {
            processedInputs[variable.key] = urlInputs[variable.key]
          }
        }
      })
      if (Object.keys(processedInputs).length > 0) {
        setCurrInputs(processedInputs)
      }
    }
    const newChatList = generateNewChatListWithOpenStatement()
    _setChatList(newChatList)
    setChatStarted()
    setCurrConversationId('-1', APP_ID)
    hideSidebar()
    setShowResetConfirm(false)
    setPendingResetId(null)
  }

  /*
  * chat info. chat is under conversation.
  */
  // 使用useRef保存上一次的聊天列表，防止意外清空
  const prevChatListRef = useRef<ChatItem[]>([])
  const [chatList, _setChatList, getChatList] = useGetState<ChatItem[]>([])

  // 包裹setChatList函数，添加保护机制
  const setChatList = (newList: ChatItem[]) => {
    // 如果已经从localStorage恢复了聊天列表，且新列表为空或只有开场白，则不覆盖已恢复的聊天列表
    if (getRestoredFromLocalStorage() && (newList.length === 0 || newList.length === 1)) {
      console.log('已经从localStorage恢复了聊天列表，不覆盖')
      return
    }

    // 如果新列表为空，但上一次的列表不为空，则保留上一次的列表
    // 使用getCurrConversationId()获取实时的会话ID
    const realIsNewConversation = getCurrConversationId() === '-1'
    if (newList.length === 0 && prevChatListRef.current.length > 0 && !realIsNewConversation) {
      return
    }

    // 保存当前列表作为上一次的列表
    if (newList.length > 0) {
      prevChatListRef.current = [...newList]

      // 如果当前列表不是从localStorage恢复的，则保存到localStorage
      // 或者如果列表长度大于1（即不只是开场白），也保存到localStorage
      if (!getRestoredFromLocalStorage() || newList.length > 1) {
        try {
          const conversationId = getCurrConversationId()
          if (conversationId !== '-1') {
            localStorage.setItem(`chatList_${conversationId}`, JSON.stringify(newList))
            console.log('保存聊天列表到localStorage，会话ID:', conversationId, '项数:', newList.length)
          }
        } catch (e) {
          console.error('Failed to save chat list to localStorage:', e)
        }
      }
    }

    console.log('设置聊天列表，项数:', newList.length)
    _setChatList(newList)
  }

  // 在页面加载时恢复聊天列表
  const [restoredFromLocalStorage, setRestoredFromLocalStorage, getRestoredFromLocalStorage] = useGetState(false)

  // 从 localStorage 恢复聊天列表的函数
  const restoreChatListFromLocalStorage = (conversationId: string) => {
    try {
      if (conversationId !== '-1') {
        const savedChatList = localStorage.getItem(`chatList_${conversationId}`)
        if (savedChatList) {
          const parsedChatList = JSON.parse(savedChatList)
          if (parsedChatList && parsedChatList.length > 0) {
            _setChatList(parsedChatList) // 直接使用_setChatList避免循环
            setRestoredFromLocalStorage(true)
            // 设置为已开始聊天，确保聊天列表能正确显示
            setChatStarted()
            console.log('从 localStorage 恢复聊天列表成功，设置为已开始聊天')
            return true
          }
        }
      }
    } catch (e) {
      console.error('Failed to restore chat list from localStorage:', e)
    }
    setRestoredFromLocalStorage(false)
    return false
  }

  // 在页面加载时恢复聊天列表
  useEffect(() => {
    // 先从localStorage获取会话ID
    const storedConversationId = getConversationIdFromStorage(APP_ID)
    console.log('页面加载时从localStorage获取的会话ID:', storedConversationId)

    // 如果有有效的会话ID，先设置当前会话ID
    if (storedConversationId && storedConversationId !== '-1') {
      // 设置当前会话ID，但不再写入localStorage
      setCurrConversationId(storedConversationId, APP_ID, false)
      console.log('设置当前会话ID为存储的会话ID:', storedConversationId)

      // 然后从localStorage恢复聊天列表
      const restored = restoreChatListFromLocalStorage(storedConversationId)
      console.log('页面加载时恢复聊天列表结果:', restored ? '成功' : '失败')

      // 如果恢复成功，设置为已开始聊天
      if (restored) {
        setChatStarted()
        console.log('页面加载时恢复聊天列表成功，设置为已开始聊天')

        // 将当前会话添加到会话列表中，确保会话列表中有当前会话
        if (!conversationList.some(item => item.id === storedConversationId)) {
          console.log('将当前会话添加到会话列表中:', storedConversationId)
          setConversationList(produce(conversationList, (draft) => {
            draft.unshift({
              id: storedConversationId,
              name: t('app.chat.restoredConversation'),
              inputs: {},
              introduction: '',
            })
          }))
        }
      }
    } else {
      // 如果没有有效的会话ID，尝试使用当前会话ID
      const conversationId = getCurrConversationId()
      console.log('没有有效的存储会话ID，尝试使用当前会话ID:', conversationId)

      if (conversationId && conversationId !== '-1') {
        const restored = restoreChatListFromLocalStorage(conversationId)
        console.log('页面加载时恢复聊天列表结果:', restored ? '成功' : '失败')

        // 如果恢复成功，设置为已开始聊天
        if (restored) {
          setChatStarted()
          console.log('页面加载时恢复聊天列表成功，设置为已开始聊天')

          // 将当前会话添加到会话列表中，确保会话列表中有当前会话
          if (!conversationList.some(item => item.id === conversationId)) {
            console.log('将当前会话添加到会话列表中:', conversationId)
            setConversationList(produce(conversationList, (draft) => {
              draft.unshift({
                id: conversationId,
                name: t('app.chat.restoredConversation'),
                inputs: {},
                introduction: '',
              })
            }))
          }
        }
      }
    }
  }, []) // 空依赖数组表示只在页面加载时执行一次
  const chatListDomRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // scroll to bottom
    if (chatListDomRef.current)
      chatListDomRef.current.scrollTop = chatListDomRef.current.scrollHeight
  }, [chatList, currConversationId])


  // user can not edit inputs if user had send message
  const canEditInputs = !chatList.some(item => item.isAnswer === false) && isNewConversation
  const createNewChat = () => {
    // if new chat is already exist, do not create new chat
    if (conversationList.some(item => item.id === '-1'))
      return

    setConversationList(produce(conversationList, (draft) => {
      draft.unshift({
        id: '-1',
        name: t('app.chat.newChatDefaultName'),
        inputs: newConversationInputs,
        introduction: conversationIntroduction,
      })
    }))
  }

  // sometime introduction is not applied to state
  const generateNewChatListWithOpenStatement = (introduction?: string, inputs?: Record<string, any> | null) => {
    // 确保有开场白，如果没有传入则使用默认值
    // 使用appParams中的opening_statement作为默认值
    let calculatedIntroduction = introduction || conversationIntroduction || ''
    const calculatedPromptVariables = inputs || currInputs || null

    // 如果开场白为空，尝试使用window.openingStatement
    if (!calculatedIntroduction && window.openingStatement) {
      calculatedIntroduction = window.openingStatement
    }

    // 替换开场白中的变量
    if (calculatedIntroduction && calculatedPromptVariables)
      calculatedIntroduction = replaceVarWithValues(calculatedIntroduction, promptConfig?.prompt_variables || [], calculatedPromptVariables)

    // 获取开场问题，从全局变量中获取
    const openingQuestions = window.openingQuestions || []

    // 创建开场白对象
    const openStatement = {
      id: `${Date.now()}`,
      content: calculatedIntroduction,
      isAnswer: true,
      feedbackDisabled: true,
      isOpeningStatement: true, // 始终显示开场白，不使用isShowPrompt
      suggestedQuestions: openingQuestions, // 添加开场问题
    }

    // 始终返回开场白，即使内容为空
    return [openStatement]
  }

  // init
  useEffect(() => {
    if (!hasSetAppConfig) {
      setAppUnavailable(true)
      return
    }
    (async () => {
      try {
        const [conversationData, appParams] = await Promise.all([fetchConversations(), fetchAppParams()])
        // handle current conversation id
        const { data: conversations, error } = conversationData as { data: ConversationItem[]; error: string }
        if (error) {
          Toast.notify({ type: 'error', message: error })
          throw new Error(error)
          return
        }
        const _conversationId = getConversationIdFromStorage(APP_ID)
        const isNotNewConversation = conversations.some(item => item.id === _conversationId)

        // fetch new conversation info
        const { user_input_form, opening_statement: introduction, opening_questions, suggested_questions, file_upload, system_parameters }: any = appParams
        // 保存开场白和开场问题到window对象，以便在generateNewChatListWithOpenStatement中使用
        // chatFlow应用可能使用suggested_questions而不是opening_questions
        window.openingStatement = introduction || ''
        window.openingQuestions = opening_questions || suggested_questions || []
        setLocaleOnClient(APP_INFO.default_language, true)
        setNewConversationInfo({
          name: t('app.chat.newChatDefaultName'),
          introduction,
        })
        const prompt_variables = userInputsFormToPromptVariables(user_input_form)
        setPromptConfig({
          prompt_template: promptTemplate,
          prompt_variables,
        } as PromptConfig)
        setVisionConfig({
          ...file_upload?.image,
          image_file_size_limit: system_parameters?.system_parameters || 0,
        })
        setConversationList(conversations as ConversationItem[])

        // 直接加载历史记录，而不是通过设置inited触发handleConversationSwitch
        if (isNotNewConversation) {
          // 设置会话ID，并确保会话ID被保存到localStorage
          setCurrConversationId(_conversationId, APP_ID, true)
          // 重置conversationIdChangeBecauseOfNew状态
          setConversationIdChangeBecauseOfNew(false)

          // 找到当前会话项
          const item = conversations.find(item => item.id === _conversationId)
          const notSyncToStateInputs = item?.inputs || {}
          const notSyncToStateIntroduction = item?.introduction || ''

          // 设置会话信息
          setCurrInputs(notSyncToStateInputs as any)
          setExistConversationInfo({
            name: item?.name || '',
            introduction: notSyncToStateIntroduction,
          })

          // 尝试从localStorage恢复聊天列表
          const restored = restoreChatListFromLocalStorage(_conversationId)

          // 如果没有从localStorage恢复成功，则从服务器获取历史记录
          if (!restored) {
            console.log('No chat list in localStorage, fetching from server...')
            // 直接加载历史记录
            fetchChatList(_conversationId).then((res: any) => {
              const { data } = res

              // 创建新的聊天列表
              const newChatList: ChatItem[] = generateNewChatListWithOpenStatement(notSyncToStateIntroduction, notSyncToStateInputs)

              // 添加历史记录
              data.forEach((item: any) => {
                newChatList.push({
                  id: `question-${item.id}`,
                  content: item.query,
                  isAnswer: false,
                  message_files: item.message_files?.filter((file: any) => file.belongs_to === 'user') || [],
                })
                newChatList.push({
                  id: item.id,
                  content: item.answer,
                  agent_thoughts: addFileInfos(item.agent_thoughts ? sortAgentSorts(item.agent_thoughts) : item.agent_thoughts, item.message_files),
                  feedback: item.feedback,
                  isAnswer: true,
                  message_files: item.message_files?.filter((file: any) => file.belongs_to === 'assistant') || [],
                })
              })

              // 设置聊天列表
              setChatList(newChatList)
            }).catch(err => {
              console.error('加载历史记录失败:', err)
            })
          }

          // 设置inited状态
          setInited(true)
        } else {
          // 对于新会话，直接创建包含开场白和开场问题的聊天列表
          const newChatList = generateNewChatListWithOpenStatement(introduction, null)
          console.log('Creating new chat list for new conversation:', newChatList)
          if (newChatList.length > 0) {
            setChatList(newChatList)
          }
          setInited(true)
        }

        // 处理URL参数中的inputs
        const urlInputs = getInputsFromUrlParams()

        if (Object.keys(urlInputs).length > 0 && prompt_variables.length > 0) {
          // 将URL参数填充到输入框中
          const processedInputs: Record<string, any> = {}

          // 遍历所有prompt变量
          prompt_variables.forEach(variable => {
            // 检查URL参数中是否有对应的值
            if (urlInputs[variable.key]) {
              // 根据变量类型处理值
              if (variable.type === 'number') {
                // 对于数字类型，尝试转换为数字
                processedInputs[variable.key] = Number(urlInputs[variable.key])
              } else {
                // 对于其他类型，直接使用字符串值
                processedInputs[variable.key] = urlInputs[variable.key]
              }
            }
          })

          // 如果有有效的输入参数，则设置到currInputs中
          if (Object.keys(processedInputs).length > 0) {
            setCurrInputs(processedInputs)

            // 对于workflow应用，自动开始聊天
            // 检查是否所有必填字段都已填写
            const allRequiredFilled = prompt_variables
              .filter(v => v.required)
              .every(v => processedInputs[v.key] !== undefined && processedInputs[v.key] !== '')

            if (allRequiredFilled) {
              // 自动开始聊天
              setTimeout(() => {
                handleStartChat(processedInputs)
              }, 500) // 延迟一点时间确保UI已经渲染完成
            }
          }
        }
      }
      catch (e: any) {
        if (e.status === 404) {
          setAppUnavailable(true)
        }
        else {
          setIsUnknownReason(true)
          setAppUnavailable(true)
        }
      }
    })()
  }, [])

  const [isResponding, { setTrue: setRespondingTrue, setFalse: setRespondingFalse }] = useBoolean(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const { notify } = Toast
  const logError = (message: string) => {
    notify({ type: 'error', message })
  }

  const checkCanSend = () => {
    if (currConversationId !== '-1')
      return true

    if (!currInputs || !promptConfig?.prompt_variables)
      return true

    const inputLens = Object.values(currInputs).length
    const promptVariablesLens = promptConfig.prompt_variables.length

    const emptyInput = inputLens < promptVariablesLens || Object.values(currInputs).find(v => !v)
    if (emptyInput) {
      logError(t('app.errorMessage.valueOfVarRequired'))
      return false
    }
    return true
  }

  const [controlFocus, setControlFocus] = useState(0)
  const [openingSuggestedQuestions, setOpeningSuggestedQuestions] = useState<string[]>([])
  const [messageTaskId, setMessageTaskId] = useState('')
  const [hasStopResponded, setHasStopResponded, getHasStopResponded] = useGetState(false)
  const [isRespondingConIsCurrCon, setIsRespondingConCurrCon, getIsRespondingConIsCurrCon] = useGetState(true)
  const [userQuery, setUserQuery] = useState('')

  const updateCurrentQA = ({
    responseItem,
    questionId,
    placeholderAnswerId,
    questionItem,
  }: {
    responseItem: ChatItem
    questionId: string
    placeholderAnswerId: string
    questionItem: ChatItem
  }) => {
    // closesure new list is outdated.
    const newListWithAnswer = produce(
      getChatList().filter(item => item.id !== responseItem.id && item.id !== placeholderAnswerId),
      (draft) => {
        if (!draft.find(item => item.id === questionId))
          draft.push({ ...questionItem })

        draft.push({ ...responseItem })
      })
    setChatList(newListWithAnswer)
  }

  const transformToServerFile = (fileItem: any) => {
    return {
      type: 'image',
      transfer_method: fileItem.transferMethod,
      url: fileItem.url,
      upload_file_id: fileItem.id,
    }
  }

  const handleSend = useCallback(async (message: string, files?: VisionFile[]) => {
    if (isResponding) {
      notify({ type: 'info', message: t('app.errorMessage.waitForResponse') })
      return
    }
    const toServerInputs: Record<string, any> = {}
    if (currInputs) {
      Object.keys(currInputs).forEach((key) => {
        const value = currInputs[key]
        // 添加null检查避免错误
        if (value && value.supportFileType)
          toServerInputs[key] = transformToServerFile(value)
        else if (value && Array.isArray(value) && value[0]?.supportFileType)
          toServerInputs[key] = value.map((item: any) => transformToServerFile(item))
        else
          toServerInputs[key] = value
      })
    }

    // 获取当前会话ID
    const currentConversationId = getCurrConversationId()

    // 针对不同情况处理会话ID
    // 如果是非新会话且当前会话ID有效，则使用当前会话ID
    // 如果是新会话或对话已结束，则设置为null让服务器创建新会话
    const useExistingConversation = currentConversationId && currentConversationId !== '-1'

    const data: Record<string, any> = {
      inputs: toServerInputs,
      query: message,
      conversation_id: useExistingConversation ? currentConversationId : null,
    }

    console.log('发送消息，conversation_id设置为:', useExistingConversation ? currentConversationId : 'null (创建新会话)')

    if (visionConfig?.enabled && files && files?.length > 0) {
      data.files = files.map((item) => {
        if (item.transfer_method === TransferMethod.local_file) {
          return {
            ...item,
            url: '',
          }
        }
        return item
      })
    }

    // question
    const questionId = `question-${Date.now()}`
    const questionItem = {
      id: questionId,
      content: message,
      isAnswer: false,
      message_files: files,
    }

    const placeholderAnswerId = `answer-placeholder-${Date.now()}`
    const placeholderAnswerItem = {
      id: placeholderAnswerId,
      content: '',
      isAnswer: true,
    }

    const newList = [...getChatList(), questionItem, placeholderAnswerItem]
    setChatList(newList)

    let isAgentMode = false

    // answer
    const responseItem: ChatItem = {
      id: `${Date.now()}`,
      content: '',
      agent_thoughts: [],
      message_files: [],
      isAnswer: true,
    }
    let hasSetResponseId = false

    const prevTempNewConversationId = getCurrConversationId() || '-1'
    let tempNewConversationId = ''

    setRespondingTrue()
    sendChatMessage(data, {
      getAbortController: (abortController) => {
        setAbortController(abortController)
      },
      onData: (message: string, isFirstMessage: boolean, { conversationId: newConversationId, messageId, taskId }: any) => {
        if (!isAgentMode) {
          responseItem.content = responseItem.content + message
        }
        else {
          const lastThought = responseItem.agent_thoughts?.[responseItem.agent_thoughts?.length - 1]
          if (lastThought)
            lastThought.thought = lastThought.thought + message // need immer setAutoFreeze
        }
        if (messageId && !hasSetResponseId) {
          responseItem.id = messageId
          hasSetResponseId = true
        }

        if (isFirstMessage && newConversationId)
          tempNewConversationId = newConversationId

        setMessageTaskId(taskId)
        // has switched to other conversation
        if (prevTempNewConversationId !== getCurrConversationId()) {
          setIsRespondingConCurrCon(false)
          return
        }
        updateCurrentQA({
          responseItem,
          questionId,
          placeholderAnswerId,
          questionItem,
        })
      },
      async onCompleted(hasError?: boolean) {
        if (hasError)
          return

        if (getConversationIdChangeBecauseOfNew()) {
          const { data: allConversations }: any = await fetchConversations()
          const newItem: any = await generationConversationName(allConversations[0].id)

          const newAllConversations = produce(allConversations, (draft: any) => {
            draft[0].name = newItem.name
          })
          setConversationList(newAllConversations as any)
        }
        setConversationIdChangeBecauseOfNew(false)
        resetNewConversationInputs()
        // 不再调用setChatNotStarted()，以保留聊天状态
        // setChatNotStarted()

        // 先保存当前聊天列表到新的会话ID下
        try {
          if (tempNewConversationId && tempNewConversationId !== '-1') {
            const currentChatList = getChatList()
            if (currentChatList.length > 0) {
              localStorage.setItem(`chatList_${tempNewConversationId}`, JSON.stringify(currentChatList))
              console.log('聊天完成，保存聊天列表到新会话ID:', tempNewConversationId)

              // 重要：保存新的会话ID到localStorage，格式必须与getConversationIdFromStorage一致
              // 读取当前conversationIdInfo对象
              const storageKey = 'conversationIdInfo'
              const conversationIdInfo = localStorage.getItem(storageKey)
                ? JSON.parse(localStorage.getItem(storageKey) || '{}')
                : {}

              // 更新对象中的当前APP_ID对应的会话ID
              conversationIdInfo[APP_ID] = tempNewConversationId

              // 保存回localStorage
              localStorage.setItem(storageKey, JSON.stringify(conversationIdInfo))
              console.log('更新localStorage中的会话ID为:', tempNewConversationId)
            }
          }
        } catch (e) {
          console.error('保存聊天列表到新会话ID失败:', e)
        }

        // 然后设置新的会话ID
        setCurrConversationId(tempNewConversationId, APP_ID, true)

        // 确保聊天已开始，这样在刷新页面后能正确显示聊天内容
        setChatStarted()
        console.log('聊天完成，设置为已开始聊天')

        setRespondingFalse()
      },
      onFile(file) {
        const lastThought = responseItem.agent_thoughts?.[responseItem.agent_thoughts?.length - 1]
        if (lastThought)
          lastThought.message_files = [...(lastThought as any).message_files, { ...file }]

        updateCurrentQA({
          responseItem,
          questionId,
          placeholderAnswerId,
          questionItem,
        })
      },
      onThought(thought) {
        isAgentMode = true
        const response = responseItem as any
        if (thought.message_id && !hasSetResponseId) {
          response.id = thought.message_id
          hasSetResponseId = true
        }
        // responseItem.id = thought.message_id;
        if (response.agent_thoughts.length === 0) {
          response.agent_thoughts.push(thought)
        }
        else {
          const lastThought = response.agent_thoughts[response.agent_thoughts.length - 1]
          // thought changed but still the same thought, so update.
          if (lastThought.id === thought.id) {
            thought.thought = lastThought.thought
            thought.message_files = lastThought.message_files
            responseItem.agent_thoughts![response.agent_thoughts.length - 1] = thought
          }
          else {
            responseItem.agent_thoughts!.push(thought)
          }
        }
        // has switched to other conversation
        if (prevTempNewConversationId !== getCurrConversationId()) {
          setIsRespondingConCurrCon(false)
          return false
        }

        updateCurrentQA({
          responseItem,
          questionId,
          placeholderAnswerId,
          questionItem,
        })
      },
      onMessageEnd: (messageEnd) => {
        // 检查是否有suggested_questions字段
        if (messageEnd.metadata?.suggested_questions) {
          responseItem.suggestedQuestions = messageEnd.metadata.suggested_questions;
        }

        if (messageEnd.metadata?.annotation_reply) {
          responseItem.id = messageEnd.id
          responseItem.annotation = ({
            id: messageEnd.metadata.annotation_reply.id,
            authorName: messageEnd.metadata.annotation_reply.account.name,
          } as AnnotationType)
          const newListWithAnswer = produce(
            getChatList().filter(item => item.id !== responseItem.id && item.id !== placeholderAnswerId),
            (draft) => {
              if (!draft.find(item => item.id === questionId))
                draft.push({ ...questionItem })

              draft.push({
                ...responseItem,
              })
            })
          setChatList(newListWithAnswer)

          // 确保聊天已开始，这样在刷新页面后能正确显示聊天内容
          setChatStarted()
          console.log('消息结束，设置为已开始聊天')

          // 确保在消息结束时立即保存聊天列表
          try {
            const conversationId = getCurrConversationId()
            if (conversationId && conversationId !== '-1') {
              localStorage.setItem(`chatList_${conversationId}`, JSON.stringify(newListWithAnswer))
              console.log('消息结束时保存聊天列表到:', conversationId)
            }
          } catch (e) {
            console.error('消息结束时保存聊天列表失败:', e)
          }

          return
        }
        // not support show citation
        // responseItem.citation = messageEnd.retriever_resources
        const newListWithAnswer = produce(
          getChatList().filter(item => item.id !== responseItem.id && item.id !== placeholderAnswerId),
          (draft) => {
            if (!draft.find(item => item.id === questionId))
              draft.push({ ...questionItem })

            draft.push({ ...responseItem })
          })
        setChatList(newListWithAnswer)

        // 确保聊天已开始，这样在刷新页面后能正确显示聊天内容
        setChatStarted()
        console.log('消息结束，设置为已开始聊天')

        // 确保在消息结束时立即保存聊天列表
        try {
          const conversationId = getCurrConversationId()
          if (conversationId && conversationId !== '-1') {
            localStorage.setItem(`chatList_${conversationId}`, JSON.stringify(newListWithAnswer))
            console.log('消息结束时保存聊天列表到:', conversationId)
          }
        } catch (e) {
          console.error('消息结束时保存聊天列表失败:', e)
        }
      },
      onMessageReplace: (messageReplace) => {
        setChatList(produce(
          getChatList(),
          (draft) => {
            const current = draft.find(item => item.id === messageReplace.id)

            if (current)
              current.content = messageReplace.answer
          },
        ))
      },
      onError() {
        setRespondingFalse()
        // role back placeholder answer
        setChatList(produce(getChatList(), (draft) => {
          draft.splice(draft.findIndex(item => item.id === placeholderAnswerId), 1)
        }))
      },
      onWorkflowStarted: ({ workflow_run_id, task_id }) => {
        // taskIdRef.current = task_id
        responseItem.workflow_run_id = workflow_run_id
        responseItem.workflowProcess = {
          status: WorkflowRunningStatus.Running,
          tracing: [],
        }
        setChatList(produce(getChatList(), (draft) => {
          const currentIndex = draft.findIndex(item => item.id === responseItem.id)
          draft[currentIndex] = {
            ...draft[currentIndex],
            ...responseItem,
          }
        }))
      },
      onWorkflowFinished: ({ data }) => {
        responseItem.workflowProcess!.status = data.status as WorkflowRunningStatus
        setChatList(produce(getChatList(), (draft) => {
          const currentIndex = draft.findIndex(item => item.id === responseItem.id)
          draft[currentIndex] = {
            ...draft[currentIndex],
            ...responseItem,
          }
        }))
      },
      onNodeStarted: ({ data }) => {
        responseItem.workflowProcess!.tracing!.push(data as any)
        setChatList(produce(getChatList(), (draft) => {
          const currentIndex = draft.findIndex(item => item.id === responseItem.id)
          draft[currentIndex] = {
            ...draft[currentIndex],
            ...responseItem,
          }
        }))
      },
      onNodeFinished: ({ data }) => {
        const currentIndex = responseItem.workflowProcess!.tracing!.findIndex(item => item.node_id === data.node_id)
        responseItem.workflowProcess!.tracing[currentIndex] = data as any
        setChatList(produce(getChatList(), (draft) => {
          const currentIndex = draft.findIndex(item => item.id === responseItem.id)
          draft[currentIndex] = {
            ...draft[currentIndex],
            ...responseItem,
          }
        }))
      },
    })
  }, [isResponding, currInputs, isNewConversation, currConversationId, visionConfig, getChatList, setChatList, getConversationIdChangeBecauseOfNew, setConversationIdChangeBecauseOfNew, resetNewConversationInputs, setChatNotStarted, setCurrConversationId, setRespondingFalse, notify, t, restoreChatListFromLocalStorage, getRestoredFromLocalStorage])

  const handleFeedback = async (messageId: string, feedback: Feedbacktype) => {
    await updateFeedback({ url: `/messages/${messageId}/feedbacks`, body: { rating: feedback.rating } })
    const newChatList = chatList.map((item) => {
      if (item.id === messageId) {
        return {
          ...item,
          feedback,
        }
      }
      return item
    })
    setChatList(newChatList)
    notify({ type: 'success', message: t('common.api.success') })
  }

  // 监听开场问题点击事件
  useEffect(() => {
    const handleSendSuggestedQuestion = (event: any) => {
      const { question } = event.detail;
      if (question) {
        handleSend(question);
      }
    };

    window.addEventListener('sendSuggestedQuestion', handleSendSuggestedQuestion);

    return () => {
      window.removeEventListener('sendSuggestedQuestion', handleSendSuggestedQuestion);
    };
  }, [handleSend])

  const renderSidebar = () => {
    if (!APP_ID || !APP_INFO || !promptConfig)
      return null
    return (
      <Sidebar
        list={conversationList}
        onCurrentIdChange={handleConversationIdChange}
        currentId={currConversationId}
        copyRight={APP_INFO.copyright || APP_INFO.title}
      />
    )
  }

  if (appUnavailable)
    return <AppUnavailable isUnknownReason={isUnknownReason} errMessage={!hasSetAppConfig ? 'Please set APP_ID and API_KEY in config/index.tsx' : ''} />

  if (!APP_ID || !APP_INFO || !promptConfig)
    return <Loading type='app' />

  return (
    <div className='bg-gray-100'>
      <Header
        title={APP_INFO.title}
        isMobile={isMobile}
        onShowSideBar={showSidebar}
        onCreateNewChat={() => handleConversationIdChange('-1')}
      />
      <div className="flex rounded-t-2xl bg-[#f7f8f9] overflow-hidden max-w-full">
        {/* sidebar - 根据配置决定是否显示 */}
        {configIsShowSidebar && !isMobile && renderSidebar()}
        {configIsShowSidebar && isMobile && isShowSidebar && (
          <div className='fixed inset-0 z-50'
            style={{ backgroundColor: 'rgba(35, 56, 118, 0.2)' }}
            onClick={hideSidebar}
          >
            <div className='inline-block' onClick={e => e.stopPropagation()}>
              {renderSidebar()}
            </div>
          </div>
        )}
        {/* main */}
        <div className='flex-grow flex flex-col h-[calc(100vh_-_3rem)] overflow-y-auto'>
          <div className="shrink-0 mb-0">
            <ConfigSence
              conversationName={conversationName}
              hasSetInputs={hasSetInputs}
              isPublicVersion={isShowPrompt}
              siteInfo={APP_INFO}
              promptConfig={promptConfig}
              onStartChat={handleStartChat}
              canEditInputs={canEditInputs}
              savedInputs={currInputs as Record<string, any>}
              onInputsChange={setCurrInputs}
            ></ConfigSence>
          </div>

          {
            hasSetInputs && (
              <div className='relative grow h-[calc(100vh_-_5rem)] pc:w-[100%] max-w-full w-full pb-[45px] pr-0 pl-1 mx-0 mb-0 overflow-hidden'>
                <div className='h-full w-full overflow-y-auto overflow-x-hidden' ref={chatListDomRef}>
                  <Chat
                    chatList={chatList}
                    onSend={handleSend}
                    onFeedback={handleFeedback}
                    isResponding={isResponding}
                    checkCanSend={checkCanSend}
                    visionConfig={visionConfig}
                    // 对于workflow应用，隐藏输入框
                    isHideSendInput={window.location.pathname.includes('/workflow/')}
                  />
                </div>
              </div>)
          }
        </div>
      </div>
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg shadow-lg p-6 w-80">
            <div className="text-base text-gray-900 mb-4">重置将清空已生成的内容，是否继续？</div>
            <div className="flex justify-end gap-3">
              <button className="px-4 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200" onClick={() => { setShowResetConfirm(false); setPendingResetId(null); }}>{t('common.operation.cancel')}</button>
              <button className="px-4 py-1 rounded bg-primary-600 text-white hover:bg-primary-700" onClick={doResetConversation}>{t('common.operation.confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default React.memo(Main)
