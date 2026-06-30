import request from './request'

// 获取测评列表
export const getTestList = () => {
  return request.get('/users/tests') 
}

// 获取测评题目
export const getTestQuestions = (testId: number) => {
  return request.get(`/tests/questions/${testId}`)
}

// 提交测评结果
export const submitTest = (data: { test_id: number; answers: { question_id: number; score: number }[] }) => {
  return request.post('/tests/submit', data)
}

// 获取测评历史
export const getTestHistory = () => {
  return request.get('/tests/history')
}

// 获取单次结果详情
export const getTestResult = (resultId: number) => {
  return request.get(`/tests/result/${resultId}`)
}
