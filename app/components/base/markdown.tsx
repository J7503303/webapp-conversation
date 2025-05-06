import ReactMarkdown from 'react-markdown'
import 'katex/dist/katex.min.css'
import RemarkMath from 'remark-math'
import RemarkBreaks from 'remark-breaks'
import RehypeKatex from 'rehype-katex'
import RemarkGfm from 'remark-gfm'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { atelierHeathLight } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { replaceVarWithValues } from '@/utils/prompt'

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
          // 特殊处理段落，保留Jinja2模板语法
          p({ node, children, ...props }) {
            return (
              <p {...props}>
                {children}
              </p>
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
