// 服务层消息中文文案
export default {
  core: {
    dialog: {
      info: '提示',
      unknownError: '未知错误',
      confirm: '确认',
      success: '成功',
      error: '错误'
    },
    update: {
      desktopOnly: '仅桌面端支持检查更新'
    },
    tray: {
      appTitle: '心愈 · 心理系统',
      titlePreview: '{sender}：{text}',
      newMsgTitle: '【新消息{count}】{text}',
      defaultSender: '新消息',
      newMsgFrom: '{sender} 发来新消息'
    },
    store: {
      noFileSelected: '未选择文件',
      imageTooLarge: '图片大小不能超过10MB',
      avatarUpdateFailed: '头像更新失败',
      imageReadFailed: '图片读取失败',
      imageParseFailed: '图片解析失败',
      canvasUnavailable: '画布不可用'
    },
    api: {
      networkFailed: '网络请求失败',
      streamUnavailable: '无法读取响应流',
      badResponse: '服务器返回格式错误',
      requestFailed: '请求失败',
      sessionExpired: '登录已过期',
      tooManyRequests: '请求过于频繁，请稍后再试'
    },
    loading: '加载中...'
  }
}
