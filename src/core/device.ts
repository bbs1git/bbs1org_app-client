/** 设备标识。服务端只用它做「同一账号最多几台设备在线」的区分，不参与鉴权。 */

const DEVICE_MAX = 80
const PLATFORM_MAX = 20

export function deviceInfo(): { device: string; platform: string } {
  let brand = ''
  let model = ''
  let platform = ''
  try {
    const info = uni.getSystemInfoSync() as {
      brand?: string
      model?: string
      platform?: string
      uniPlatform?: string
    }
    brand = String(info.brand || '')
    model = String(info.model || '')
    // 小程序端的 platform 常常是 'devtools'，用 uniPlatform 更贴近真实运行端。
    platform = String(info.uniPlatform || info.platform || '')
  } catch {
    // 取不到就留空，服务端两个字段都允许为空
  }

  const device = (brand + ' ' + model).trim()
  return {
    device: device.slice(0, DEVICE_MAX),
    // 服务端要求 platform 只含 a-z0-9_-，别把 'iOS 17' 这种东西发过去。
    platform: platform.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, PLATFORM_MAX),
  }
}
