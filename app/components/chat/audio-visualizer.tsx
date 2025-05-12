/**
 * 音频可视化组件 - 显示声音波形图
 * @author Ganjiayi
 */
'use client'
import { useEffect, useRef } from 'react'

interface AudioVisualizerProps {
    isRecording: boolean
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isRecording }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const animationRef = useRef<number>(0)
    const analyserRef = useRef<AnalyserNode | null>(null)
    const dataArrayRef = useRef<Uint8Array | null>(null)

    // 初始化音频分析器
    useEffect(() => {
        let audioContext: AudioContext | null = null
        let mediaStream: MediaStream | null = null
        let source: MediaStreamAudioSourceNode | null = null

        const setupAudioAnalyser = async () => {
            if (!isRecording) return

            try {
                // 获取麦克风权限
                mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })

                // 创建音频上下文
                audioContext = new AudioContext()
                source = audioContext.createMediaStreamSource(mediaStream)

                // 创建分析器
                const analyser = audioContext.createAnalyser()
                analyser.fftSize = 256
                source.connect(analyser)

                analyserRef.current = analyser

                // 创建数据数组
                const bufferLength = analyser.frequencyBinCount
                const dataArray = new Uint8Array(bufferLength)
                dataArrayRef.current = dataArray

                // 开始绘制
                draw()
            } catch (error) {
                console.error('获取麦克风数据失败:', error)
            }
        }

        if (isRecording) {
            setupAudioAnalyser()
        }

        return () => {
            // 清理资源
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current)
            }

            if (mediaStream) {
                mediaStream.getTracks().forEach(track => track.stop())
            }

            if (audioContext) {
                audioContext.close()
            }

            analyserRef.current = null
            dataArrayRef.current = null
        }
    }, [isRecording])

    // 绘制波形
    const draw = () => {
        if (!canvasRef.current || !analyserRef.current || !dataArrayRef.current) return

        const canvas = canvasRef.current
        const analyser = analyserRef.current
        const dataArray = dataArrayRef.current

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const width = canvas.width
        const height = canvas.height

        // 清除画布
        ctx.clearRect(0, 0, width, height)

        if (!isRecording) {
            return
        }

        // 获取当前音频数据
        analyser.getByteTimeDomainData(dataArray)

        // 设置线条样式
        ctx.lineWidth = 2
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)'

        // 开始绘制
        ctx.beginPath()

        const sliceWidth = width / dataArray.length
        let x = 0

        for (let i = 0; i < dataArray.length; i++) {
            // 将 0-255 的值映射到 0-height
            const v = dataArray[i] / 255.0
            const y = v * height

            if (i === 0) {
                ctx.moveTo(x, y)
            } else {
                ctx.lineTo(x, y)
            }

            x += sliceWidth
        }

        ctx.lineTo(width, height / 2)
        ctx.stroke()

        // 持续更新
        animationRef.current = requestAnimationFrame(draw)
    }

    // 如果没有录音，则不显示波形图
    if (!isRecording) {
        return null
    }

    return (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ overflow: 'hidden' }}>
            <canvas
                ref={canvasRef}
                className="w-3/4 h-5 rounded bg-transparent"
                width={300}
                height={20}
            />
        </div>
    )
}

export default AudioVisualizer 