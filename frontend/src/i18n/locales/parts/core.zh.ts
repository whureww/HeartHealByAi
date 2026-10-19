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
    // 服务端消息映射（serverMsg.ts 精确匹配后透传翻译）
    server: {
      sessionLocked: '对话已锁定，请先解除锁定再删除',
      sessionNotFound: '对话不存在',
      sessionInvalid: '会话标识不合法',
      sessionDeleted: '会话已删除',
      modelInvalid: '模型名不合法（限字母数字._-/，80 字符内）',
      modelInvalidShort: '模型名不合法',
      baseUrlInvalid: '网关地址不合法（需 http/https 开头）',
      keyLenInvalid: 'API Key 长度需在 8-200 字符之间',
      pairRequired: '网关地址与 API Key 需同时填写（留空则使用服务端模型网关）',
      gatewayMissing: '服务端模型网关未配置，请自带网关地址与 API Key',
      modelNameTaken: '新模型名已存在，请换一个名字',
      modelNotFound: '该模型配置不存在',
      keyDecryptFailed: '密钥解密失败，请编辑重新保存该模型配置',
      noGatewayAndConfig: '该模型未带网关配置，且服务端模型网关未配置',
      modelSwitched: '已切换模型',
      modelReset: '已恢复默认模型',
      modelUpdated: '模型已更新',
      modelDeleted: '模型已删除',
      loggedInElsewhere: '您的账号已在其他设备登录',
      apptSuccess: '预约成功',
      apptCancelled: '预约已取消',
      reportSubmitted: '举报已提交，管理员会尽快核实处理',
      dataCleared: '所有数据已清空',
      profileUpdated: '个人信息更新成功',
      avatarUpdated: '头像修改成功',
      registered: '注册成功',
      passwordReset: '密码重置成功，请使用新密码重新登录'
    },
    loading: '加载中...'
  }
}
