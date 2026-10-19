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
    loading: 'Loading...'
  }
}
