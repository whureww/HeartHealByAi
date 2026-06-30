import { invoke } from '@tauri-apps/api/core'

export interface Test {
  id: number
  code: string
  name: string
  description: string
  category: string
  total_questions: number
  estimated_minutes: number
  scoring_method: string
}

export interface QuestionOption {
  score: number
  text: string
}

export interface TestQuestion {
  id: number
  question_number: number
  content: string
  dimension: string | null
  reverse_scoring: boolean
  options: QuestionOption[]
}

export interface TestResult {
  id: number
  test_code: string
  test_name: string
  total_score: number
  result_level: string
  result_desc: string
  completed_at: string
}

export interface SubmitAnswer {
  question_id: number
  option_index: number
  score: number
}

export const getTests = (): Promise<Test[]> => 
  invoke('get_tests')

export const getTestQuestions = (testId: number): Promise<TestQuestion[]> => 
  invoke('get_test_questions', { testId })

export const submitTestResult = (testId: number, testCode: string, answers: SubmitAnswer[]): Promise<TestResult> => 
  invoke('submit_test_result', { 
    userId: 1,
    req: { testId, testCode, answers } 
  })

export const getUserTestResults = (): Promise<TestResult[]> => 
  invoke('get_user_test_results', { userId: 1 })
