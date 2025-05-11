import { type NextRequest } from 'next/server'
import { ChatClient } from 'dify-client'
import { v4 } from 'uuid'
import { API_KEY, API_URL, APP_ID } from '@/config'
import pako from 'pako'

const userPrefix = `user_${APP_ID}:`

/**
 * 将Base64编码的字符串转换为UTF-8字符串
 * 这个函数处理GZIP压缩后Base64编码的字符串
 */
function decodeBase64ToString(base64Str) {
  try {
    // 1. 进行Base64解码
    const binaryStr = Buffer.from(base64Str, 'base64').toString('binary');

    // 2. 将二进制字符串转换为字节数组
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // 3. 使用pako解压GZIP数据
    try {
      // 尝试解压GZIP数据
      const decompressedData = pako.inflate(bytes);

      // 4. 将解压后的数据转换为UTF-8字符串
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(decompressedData);
    } catch (e) {
      // 如果GZIP解压失败，返回原始字符串
      return base64Str;
    }
  } catch (e) {
    // 如果解码失败，返回原始字符串
    return base64Str;
  }
}

export const getInfo = (request: NextRequest) => {
  // 尝试从URL参数和请求头中获取sys.user_id
  const url = new URL(request.url)
  const sysUserIdFromUrl = url.searchParams.get('sys.user_id')
  const sysUserIdFromHeader = request.headers.get('x-sys-user-id')
  const sysUserId = sysUserIdFromHeader || sysUserIdFromUrl

  // 如果有sys.user_id，尝试解码
  let decodedUserId = sysUserId
  if (sysUserId) {
    try {
      // 尝试解码Base64和GZIP压缩的用户ID
      decodedUserId = decodeBase64ToString(sysUserId)
    } catch (e) {
      console.error('Failed to decode user ID:', e)
    }
  }

  const sessionId = request.cookies.get('session_id')?.value || v4()

  // 如果有解码后的用户ID，则使用它，否则使用原来的逻辑
  // 注意：如果有sys.user_id，则直接使用它，不添加前缀
  const user = decodedUserId || (userPrefix + sessionId)

  return {
    sessionId,
    user,
  }
}

export const setSession = (sessionId: string) => {
  return { 'Set-Cookie': `session_id=${sessionId}` }
}

export const client = new ChatClient(API_KEY, API_URL || undefined)
