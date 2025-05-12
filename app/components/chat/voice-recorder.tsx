/**
 * 语音录制组件，用于将语音转换为文字
 * @author Ganjiayi
 */
'use client'
import { useState, useRef, useEffect } from 'react'
import cn from 'classnames'
import { useTranslation } from 'react-i18next'
import Tooltip from '@/app/components/base/tooltip'
import s from './style.module.css'

// 为Web Speech API声明接口
interface SpeechRecognitionEvent {
    results: {
        [index: number]: {
            [index: number]: {
                transcript: string
            }
        }
    }
    resultIndex: number
}

interface SpeechRecognitionErrorEvent {
    error: string
    message: string
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean
    interimResults: boolean
    lang: string
    start(): void
    stop(): void
    abort(): void
    onerror: (event: SpeechRecognitionErrorEvent) => void
    onend: () => void
    onresult: (event: SpeechRecognitionEvent) => void
}

// 声明全局Window接口扩展
declare global {
    interface Window {
        SpeechRecognition?: new () => SpeechRecognition
        webkitSpeechRecognition?: new () => SpeechRecognition
    }
}

interface VoiceRecorderProps {
    onResult: (text: string) => void
    onRecordingStateChange?: (isRecording: boolean) => void
    disabled?: boolean
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
    onResult,
    onRecordingStateChange,
    disabled = false,
}) => {
    const { t } = useTranslation()
    const [isRecording, setIsRecording] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const recognitionRef = useRef<SpeechRecognition | null>(null)

    // 通知父组件录音状态变化
    useEffect(() => {
        onRecordingStateChange?.(isRecording)
    }, [isRecording, onRecordingStateChange])

    // 初始化语音识别
    useEffect(() => {
        // 检查浏览器是否支持语音识别API
        if (typeof window !== 'undefined') {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
            if (!SpeechRecognition) {
                setError('您的浏览器不支持语音识别功能')
                return
            }

            const recognition = new SpeechRecognition()
            recognition.lang = 'zh-CN' // 设置为中文识别
            recognition.continuous = false
            recognition.interimResults = false

            // 处理结果
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript
                onResult(transcript)
                setIsRecording(false)
            }

            // 处理错误
            recognition.onerror = (event) => {
                setError(`语音识别错误: ${event.error}`)
                setIsRecording(false)
            }

            // 处理录音结束
            recognition.onend = () => {
                setIsRecording(false)
            }

            recognitionRef.current = recognition
        }

        return () => {
            // 清理
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop()
                } catch (e) {
                    // 忽略可能的错误（如录音尚未开始）
                }
            }
        }
    }, [onResult])

    const toggleRecording = () => {
        if (disabled) return

        if (isRecording) {
            // 停止录音
            try {
                recognitionRef.current?.stop()
            } catch (e) {
                console.error('停止录音失败:', e)
            }
            setIsRecording(false)
        } else {
            // 开始录音
            setError(null)
            try {
                recognitionRef.current?.start()
                setIsRecording(true)
            } catch (e) {
                console.error('开始录音失败:', e)
                setError('无法开始录音，请确保已授予麦克风权限')
            }
        }
    }

    // 获取提示文本，直接提供中文
    const getTooltipContent = () => {
        if (error) return error
        return isRecording ? '录音中...' : '开始语音输入'
    }

    return (
        <div className="relative z-30">
            <Tooltip
                selector="voice-recorder-tip"
                content={getTooltipContent()}
                className="z-50"
            >
                <div
                    className={cn(
                        `${s.voiceRecorderBtn} w-8 h-8 cursor-pointer rounded-md`,
                        isRecording && s.recording,
                        disabled && 'opacity-50 cursor-not-allowed'
                    )}
                    onClick={toggleRecording}
                />
            </Tooltip>
        </div>
    )
}

export default VoiceRecorder 