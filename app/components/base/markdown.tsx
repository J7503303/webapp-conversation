import ReactMarkdown from 'react-markdown'
import 'katex/dist/katex.min.css'
import RemarkMath from 'remark-math'
import RemarkBreaks from 'remark-breaks'
import RehypeKatex from 'rehype-katex'
import RemarkGfm from 'remark-gfm'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { atelierHeathLight } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { replaceVarWithValues } from '@/utils/prompt'
import React, { useState, useCallback, useEffect } from 'react'
import copy from 'copy-to-clipboard'
import { Clipboard, ClipboardCheck } from '@/app/components/base/icons/line/files'
import Toast from '@/app/components/base/toast'
import Tooltip from '@/app/components/base/tooltip'
import { randomString } from '@/utils/string'
import { isOnlyParagraphCopyable } from '@/config'

// 思考内容组件
const ThinkingContent = ({ children }: { children: string }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="thinking-block">
      <details open={isOpen}>
        <summary
          className="thinking-summary"
          onClick={(e) => {
            e.preventDefault();
            setIsOpen(!isOpen);
          }}
        >
          思考过程...
        </summary>
        <div className="thinking-content">
          <ReactMarkdown
            remarkPlugins={[RemarkMath, RemarkGfm, RemarkBreaks]}
            rehypePlugins={[RehypeKatex]}
            skipHtml={false}
          >
            {children}
          </ReactMarkdown>
        </div>
      </details>
    </div>
  );
};

// 预处理内容，检测输出中的思考内容
function preprocessContent(content: string) {
  if (!content) return content;

  // 尝试找出思考内容的开始和结束标记
  const detailsStartRegex = /<details[^>]*>\s*<summary>\s*Thinking\.\.\.\s*<\/summary>/;
  const detailsEndRegex = /<\/details>/;

  // 如果包含开始标记但不包含结束标记，说明思考内容正在输出中
  if (detailsStartRegex.test(content) && !detailsEndRegex.test(content)) {
    // 提取开始标记之前的内容
    const parts = content.split(detailsStartRegex);
    if (parts.length >= 2) {
      const beforeThinking = parts[0];
      const thinkingContent = content.substring(beforeThinking.length);

      // 提取思考内容（移除HTML标签）
      const cleanThinkingContent = thinkingContent
        .replace(/<details[^>]*>\s*<summary>\s*Thinking\.\.\.\s*<\/summary>/g, '')
        .trim();

      // 标记为正在输出的思考内容
      return {
        beforeThinking,
        thinkingContent: cleanThinkingContent,
        isComplete: false
      };
    }
  }

  // 如果包含完整的思考内容（有开始和结束标记）
  if (detailsStartRegex.test(content) && detailsEndRegex.test(content)) {
    // 处理完整的思考内容块
    return content.replace(
      /<details[^>]*>\s*<summary>\s*Thinking\.\.\.\s*<\/summary>([\s\S]*?)<\/details>/g,
      (match, thinkingContent) => {
        // 用特殊标记替换整个思考内容块，以便后续处理
        return `<thinking-block>${thinkingContent.trim()}</thinking-block>`;
      }
    );
  }

  return content;
}

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
  isHeading?: boolean
}

function CopyableParagraph({ children, content, isHeading = false }: CopyableParagraphProps) {
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

  // 检查children是否包含标题元素
  const containsHeading = React.Children.toArray(children).some(
    child => React.isValidElement(child) &&
      (child.type === 'h1' || child.type === 'h2' || child.type === 'h3' ||
        child.type === 'h4' || child.type === 'h5' || child.type === 'h6')
  )

  return (
    <div className="relative group">
      {/* 如果包含标题元素，直接渲染children，否则用p标签包裹 */}
      {containsHeading ? children : <p>{children}</p>}
      {/* 根据配置和元素类型决定是否显示复制图标 */}
      {(!isHeading || !isOnlyParagraphCopyable) && (
        <div
          className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{
            position: 'absolute',
            right: '-2px',  // 将图标定位在段落右侧的外部
            bottom: '2px',  // 修改为底部定位
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
              className="w-7 h-7 flex items-center justify-center cursor-pointer bg-gray-50 rounded-md shadow-md border border-gray-200 hover:bg-gray-100"
              onClick={handleCopy}
            >
              {!isCopied ? (
                <Clipboard
                  className="w-4 h-4 text-gray-600 hover:text-gray-800"
                />
              ) : (
                <ClipboardCheck className="w-4 h-4 text-green-500" />
              )}
            </div>
          </Tooltip>
        </div>
      )}
    </div>
  )
}

export function Markdown(props: { content: string }) {
  // 预处理内容，检测思考内容
  const processedContent = preprocessContent(props.content || '');

  // 如果思考内容正在输出中（未完成）
  if (processedContent && typeof processedContent !== 'string') {
    // 显示已完成的部分和正在输出的思考内容（放入折叠元素）
    return (
      <div className="markdown-body text-sm !px-0 !leading-relaxed !overflow-visible" style={{ overflow: 'visible' }}>
        {/* 渲染思考内容前的普通文本 */}
        {processedContent.beforeThinking && (
          <ReactMarkdown
            remarkPlugins={[RemarkMath, RemarkGfm, RemarkBreaks]}
            rehypePlugins={[RehypeKatex]}
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
                      className="!px-2 !overflow-visible"
                      wrapLines={true}
                      wrapLongLines={true}
                      customStyle={{
                        overflow: 'visible',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: 'none'
                      }}
                    />
                  )
                  : (
                    <code {...props} className={className} style={{ overflow: 'visible' }}>
                      {children}
                    </code>
                  )
              },
              p({ node, children, ...props }) {
                let textContent = '';
                try {
                  const extractTextContent = (nodes: any): string => {
                    if (!nodes) return '';
                    if (typeof nodes === 'string') return nodes;
                    if (Array.isArray(nodes)) {
                      return nodes.map(extractTextContent).join('');
                    }
                    if (nodes.props && nodes.props.children) {
                      return extractTextContent(nodes.props.children);
                    }
                    return '';
                  };
                  textContent = extractTextContent(children);
                } catch (e) {
                  textContent = children ? children.toString() : '';
                }

                return (
                  <CopyableParagraph content={textContent}>
                    {children}
                  </CopyableParagraph>
                );
              },
              h1: ({ node, children, ...props }) => {
                const textContent = children ? children.toString() : '';
                return (
                  <CopyableParagraph content={textContent} isHeading={true}>
                    <h1 {...props}>{children}</h1>
                  </CopyableParagraph>
                );
              },
              h2: ({ node, children, ...props }) => {
                const textContent = children ? children.toString() : '';
                return (
                  <CopyableParagraph content={textContent} isHeading={true}>
                    <h2 {...props}>{children}</h2>
                  </CopyableParagraph>
                );
              },
              h3: ({ node, children, ...props }) => {
                const textContent = children ? children.toString() : '';
                return (
                  <CopyableParagraph content={textContent} isHeading={true}>
                    <h3 {...props}>{children}</h3>
                  </CopyableParagraph>
                );
              },
              pre({ node, children }) {
                return <pre style={{ overflow: 'visible', whiteSpace: 'pre-wrap' }}>{children}</pre>;
              }
            }}
          >
            {preprocessJinjaTemplates(processedContent.beforeThinking)}
          </ReactMarkdown>
        )}

        {/* 渲染正在输出的思考内容（放入折叠元素） */}
        <ThinkingContent>
          {processedContent.thinkingContent}
        </ThinkingContent>
      </div>
    );
  }

  // 如果有完整的思考内容块（已替换为自定义标记）
  if (processedContent && typeof processedContent === 'string' && processedContent.includes('<thinking-block>')) {
    // 拆分内容，区分普通文本和思考内容
    const parts = processedContent.split(/<thinking-block>|<\/thinking-block>/);
    const result = [];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;

      // 偶数索引是普通文本，奇数索引是思考内容
      if (i % 2 === 0) {
        // 普通文本部分
        result.push(
          <ReactMarkdown
            key={`text-${i}`}
            remarkPlugins={[RemarkMath, RemarkGfm, RemarkBreaks]}
            rehypePlugins={[RehypeKatex]}
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
                      className="!px-2 !overflow-visible"
                      wrapLines={true}
                      wrapLongLines={true}
                      customStyle={{
                        overflow: 'visible',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: 'none'
                      }}
                    />
                  )
                  : (
                    <code {...props} className={className} style={{ overflow: 'visible' }}>
                      {children}
                    </code>
                  )
              },
              p({ node, children, ...props }) {
                let textContent = '';
                try {
                  const extractTextContent = (nodes: any): string => {
                    if (!nodes) return '';
                    if (typeof nodes === 'string') return nodes;
                    if (Array.isArray(nodes)) {
                      return nodes.map(extractTextContent).join('');
                    }
                    if (nodes.props && nodes.props.children) {
                      return extractTextContent(nodes.props.children);
                    }
                    return '';
                  };
                  textContent = extractTextContent(children);
                } catch (e) {
                  textContent = children ? children.toString() : '';
                }

                return (
                  <CopyableParagraph content={textContent}>
                    {children}
                  </CopyableParagraph>
                );
              },
              h1: ({ node, children, ...props }) => {
                const textContent = children ? children.toString() : '';
                return (
                  <CopyableParagraph content={textContent} isHeading={true}>
                    <h1 {...props}>{children}</h1>
                  </CopyableParagraph>
                );
              },
              h2: ({ node, children, ...props }) => {
                const textContent = children ? children.toString() : '';
                return (
                  <CopyableParagraph content={textContent} isHeading={true}>
                    <h2 {...props}>{children}</h2>
                  </CopyableParagraph>
                );
              },
              h3: ({ node, children, ...props }) => {
                const textContent = children ? children.toString() : '';
                return (
                  <CopyableParagraph content={textContent} isHeading={true}>
                    <h3 {...props}>{children}</h3>
                  </CopyableParagraph>
                );
              },
              pre({ node, children }) {
                return <pre style={{ overflow: 'visible', whiteSpace: 'pre-wrap' }}>{children}</pre>;
              }
            }}
          >
            {preprocessJinjaTemplates(part)}
          </ReactMarkdown>
        );
      } else {
        // 思考内容部分
        result.push(
          <ThinkingContent key={`thinking-${i}`}>
            {part}
          </ThinkingContent>
        );
      }
    }

    return <div className="markdown-body text-sm !px-0 !leading-relaxed !overflow-visible" style={{ overflow: 'visible' }}>{result}</div>;
  }

  // 如果没有思考内容，使用原始的ReactMarkdown渲染
  return (
    <div className="markdown-body text-sm !px-0 !leading-relaxed !overflow-visible" style={{ overflow: 'visible' }}>
      <ReactMarkdown
        remarkPlugins={[RemarkMath, RemarkGfm, RemarkBreaks]}
        rehypePlugins={[RehypeKatex]}
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
                  className="!px-2 !overflow-visible"
                  wrapLines={true}
                  wrapLongLines={true}
                  customStyle={{
                    overflow: 'visible',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: 'none'
                  }}
                />
              )
              : (
                <code {...props} className={className} style={{ overflow: 'visible' }}>
                  {children}
                </code>
              )
          },
          p({ node, children, ...props }) {
            let textContent = '';
            try {
              const extractTextContent = (nodes: any): string => {
                if (!nodes) return '';
                if (typeof nodes === 'string') return nodes;
                if (Array.isArray(nodes)) {
                  return nodes.map(extractTextContent).join('');
                }
                if (nodes.props && nodes.props.children) {
                  return extractTextContent(nodes.props.children);
                }
                return '';
              };
              textContent = extractTextContent(children);
            } catch (e) {
              textContent = children ? children.toString() : '';
            }

            return (
              <CopyableParagraph content={textContent}>
                {children}
              </CopyableParagraph>
            );
          },
          h1: ({ node, children, ...props }) => {
            const textContent = children ? children.toString() : '';
            return (
              <CopyableParagraph content={textContent} isHeading={true}>
                <h1 {...props}>{children}</h1>
              </CopyableParagraph>
            );
          },
          h2: ({ node, children, ...props }) => {
            const textContent = children ? children.toString() : '';
            return (
              <CopyableParagraph content={textContent} isHeading={true}>
                <h2 {...props}>{children}</h2>
              </CopyableParagraph>
            );
          },
          h3: ({ node, children, ...props }) => {
            const textContent = children ? children.toString() : '';
            return (
              <CopyableParagraph content={textContent} isHeading={true}>
                <h3 {...props}>{children}</h3>
              </CopyableParagraph>
            );
          },
          pre({ node, children }) {
            return <pre style={{ overflow: 'visible', whiteSpace: 'pre-wrap' }}>{children}</pre>;
          }
        }}
      >
        {preprocessJinjaTemplates(props.content || '')}
      </ReactMarkdown>
    </div>
  );
}
