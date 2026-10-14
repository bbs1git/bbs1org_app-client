import { uploadFile } from '@/core/http'
import type { UploadResult } from '@/core/http'

/**
 * 上传走核心请求层，这里只是给它一个「接口模块」的位置，
 * 免得页面直接从 core/http 引东西。
 */
export { uploadFile }
export type { UploadResult }
