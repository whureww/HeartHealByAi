// Service-layer messages (English)
export default {
  core: {
    dialog: {
      info: 'Notice',
      unknownError: 'Unknown error',
      confirm: 'Confirm',
      success: 'Success',
      error: 'Error'
    },
    update: {
      desktopOnly: 'Update check is only available in the desktop app'
    },
    tray: {
      appTitle: 'XinYu · Mental Health System',
      tooltip: 'XinYu · Mental Health',
      menuShow: 'Show XinYu',
      menuQuit: 'Quit XinYu',
      tip: 'XinYu · {sender}: {brief}',
      tipUnread: 'XinYu · [{count} unread] {sender}: {brief}',
      titlePreview: '{sender}: {text}',
      newMsgTitle: '[New message{count}] {text}',
      defaultSender: 'New message',
      newMsgFrom: 'New message from {sender}'
    },
    store: {
      noFileSelected: 'No file selected',
      imageTooLarge: 'Image cannot exceed 10MB',
      avatarUpdateFailed: 'Failed to update avatar',
      imageReadFailed: 'Failed to read image',
      imageParseFailed: 'Failed to parse image',
      canvasUnavailable: 'Canvas unavailable'
    },
    api: {
      networkFailed: 'Network request failed',
      streamUnavailable: 'Unable to read response stream',
      badResponse: 'Malformed server response',
      requestFailed: 'Request failed',
      sessionExpired: 'Session expired',
      tooManyRequests: 'Too many requests, please try again later'
    },
    // Server message mappings (matched exactly by serverMsg.ts, translated before display)
    server: {
      sessionLocked: 'This conversation is locked. Unlock it before deleting.',
      sessionNotFound: 'Conversation not found',
      sessionInvalid: 'Invalid session identifier',
      sessionDeleted: 'Conversation deleted',
      modelInvalid: 'Invalid model name (letters, digits, ._-/ only, max 80 characters)',
      modelInvalidShort: 'Invalid model name',
      baseUrlInvalid: 'Invalid gateway URL (must start with http/https)',
      keyLenInvalid: 'API Key must be between 8 and 200 characters',
      pairRequired: 'Gateway URL and API Key must be provided together (leave both empty to use the server gateway)',
      gatewayMissing: 'Server model gateway is not configured. Please provide your own gateway URL and API Key',
      modelNameTaken: 'The new model name already exists. Please choose another one',
      modelNotFound: 'Model configuration not found',
      keyDecryptFailed: 'Failed to decrypt the API key. Please edit and re-save this model configuration',
      noGatewayAndConfig: 'This model has no gateway configuration and the server gateway is not configured',
      modelSwitched: 'Model switched',
      modelReset: 'Reset to default model',
      modelUpdated: 'Model updated',
      modelDeleted: 'Model deleted',
      loggedInElsewhere: 'Your account has been logged in on another device',
      apptSuccess: 'Appointment booked',
      apptCancelled: 'Appointment cancelled',
      reportSubmitted: 'Report submitted. Administrators will review it soon',
      dataCleared: 'All data has been cleared',
      profileUpdated: 'Profile updated',
      avatarUpdated: 'Avatar updated',
      registered: 'Registration successful',
      passwordReset: 'Password reset. Please log in with your new password'
    },
    loading: 'Loading...'
  }
}
