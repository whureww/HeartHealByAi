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

// AI 智能测评：生成个性化问卷
export const generateAiTest = () => {
  return request.post('/tests/ai/questions')
}

// AI 智能测评：提交回答，由 AI 评分（paper_id 引用服务端留存的问卷内容）
export const submitAiTest = (data: {
  paper_id?: number
  questions?: any[]
  answers: { label: string; text: string; score: number }[]
}) => {
  return request.post('/tests/ai/submit', data)
}
