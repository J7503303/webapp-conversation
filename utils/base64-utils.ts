/**
 * Base64编码/解码工具函数
 */
import pako from 'pako';

/**
 * 将Base64编码的字符串转换为UTF-8字符串
 * 这个函数处理GZIP压缩后Base64编码的字符串
 * @param base64Str Base64编码的字符串
 * @returns 解码后的字符串
 */
export function decodeBase64ToString(base64Str: string): string {
  try {
    // 1. 进行Base64解码
    const binaryStr = atob(base64Str);

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
      // 如果GZIP解压失败，尝试直接将原始数据转换为UTF-8字符串
      try {
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(bytes);
      } catch (e2) {
        // 如果UTF-8解码失败，返回原始的二进制字符串
        return binaryStr;
      }
    }
  } catch (e) {
    // 如果解码失败，返回原始字符串
    return base64Str;
  }
}
