import ReactMarkdown from 'react-markdown'
import 'katex/dist/katex.min.css'
import RemarkMath from 'remark-math'
import RemarkBreaks from 'remark-breaks'
import RehypeKatex from 'rehype-katex'
import RemarkGfm from 'remark-gfm'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { atelierHeathLight } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { replaceVarWithValues } from '@/utils/prompt'
import { useState, useCallback } from 'react'
import copy from 'copy-to-clipboard'
import { Clipboard, ClipboardCheck } from '@/app/components/base/icons/line/files'
import Toast from '@/app/components/base/toast'
import Tooltip from '@/app/components/base/tooltip'
import { randomString } from '@/utils/string'

// 处理Jinja2模板语法，防止被Markdown解析器转义
function preprocessJinjaTemplates(content: string): string {
  if (!content) return ''

  // 将Jinja2模板语法替换为特殊标记
  // 使用HTML标签包裹模板变量，防止被Markdown解析器处理
  return content.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
    // 使用span标签包裹变量，并添加特殊类名
    return `<span class="jinja-template">${match}</span>`
  })
}

// 可复制的段落组件
interface CopyableParagraphProps {
  children: React.ReactNode
  content: string
}

function CopyableParagraph({ children, content }: CopyableParagraphProps) {
  const [isCopied, setIsCopied] = useState(false)
  const { notify } = Toast
  // 生成唯一的选择器ID
  const tooltipId = `copy-tooltip-${randomString(8)}`

  const handleCopy = useCallback(() => {
    // 如果内容为空，不执行复制
    if (!content.trim()) return

    copy(content)
    setIsCopied(true)
    notify({ type: 'success', message: '复制成功', duration: 2000 })

    // 2秒后重置复制状态
    setTimeout(() => {
      setIsCopied(false)
    }, 2000)
  }, [content, notify])

  return (
    <div className="relative group">
      <p>{children}</p>
      <div
        className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{
          position: 'absolute',
          right: '-2px',  // 将图标定位在段落右侧的外部
          top: '2px',
          zIndex: 10
        }}
      >
        <Tooltip
          selector={tooltipId}
          content={isCopied ? '已复制' : '复制段落内容'}
          position="right"
          className="!z-20" /* 增加z-index确保Tooltip在最上层 */
        >
          <div
            className="w-6 h-6 flex items-center justify-center cursor-pointer bg-white rounded-md shadow-sm"
            onClick={handleCopy}
          >
            {!isCopied ? (
              <Clipboard
                className="w-4 h-4 text-gray-500 hover:text-gray-700"
              />
            ) : (
              <ClipboardCheck className="w-4 h-4 text-green-500" />
            )}
          </div>
        </Tooltip>
      </div>
    </div>
  )
}

export function Markdown(props: { content: string }) {
  // 预处理内容，保护Jinja2模板语法
  const processedContent = preprocessJinjaTemplates(props.content || '')

  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[RemarkMath, RemarkGfm, RemarkBreaks]}
        rehypePlugins={[
          RehypeKatex,
        ]}
        // 允许渲染HTML标签，以支持Jinja2模板语法
        skipHtml={false}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            return (!inline && match)
              ? (
                <SyntaxHighlighter
                  {...props}
                  children={String(children).replace(/\n$/, '')}
                  style={atelierHeathLight}
                  language={match[1]}
                  showLineNumbers
                  PreTag="div"
                />
              )
              : (
                <code {...props} className={className}>
                  {children}
                </code>
              )
          },
          // 特殊处理段落，添加复制图标
          p({ node, children, ...props }) {
            // 获取段落的纯文本内容用于复制
            let textContent = ''
            try {
              // 递归提取所有文本节点
              const extractTextContent = (nodes: any) => {
                if (!nodes) return ''
                if (typeof nodes === 'string') return nodes
                if (Array.isArray(nodes)) {
                  return nodes.map(extractTextContent).join('')
                }
                if (nodes.props && nodes.props.children) {
                  return extractTextContent(nodes.props.children)
                }
                return ''
              }
              textContent = extractTextContent(children)
            } catch (e) {
              console.error('Failed to extract text content:', e)
              // 如果提取失败，尝试将子节点转换为字符串
              textContent = children ? children.toString() : ''
            }

            return (
              <CopyableParagraph content={textContent}>
                {children}
              </CopyableParagraph>
            )
          },
          // 特殊处理标题，添加复制图标
          h1: ({ node, children, ...props }) => {
            const textContent = children ? children.toString() : ''
            return (
              <CopyableParagraph content={textContent}>
                <h1 {...props}>{children}</h1>
              </CopyableParagraph>
            )
          },
          h2: ({ node, children, ...props }) => {
            const textContent = children ? children.toString() : ''
            return (
              <CopyableParagraph content={textContent}>
                <h2 {...props}>{children}</h2>
              </CopyableParagraph>
            )
          },
          h3: ({ node, children, ...props }) => {
            const textContent = children ? children.toString() : ''
            return (
              <CopyableParagraph content={textContent}>
                <h3 {...props}>{children}</h3>
              </CopyableParagraph>
            )
          },
        }}
        linkTarget={'_blank'}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
}
