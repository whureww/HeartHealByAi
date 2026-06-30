export const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export const isValidPassword = (password: string): boolean => {
  return password.length >= 6
}
