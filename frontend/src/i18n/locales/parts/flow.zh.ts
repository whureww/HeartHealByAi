// 认证补充 + 测评模块中文文案
// auth：Login/Register/Forget 三页现有 key 已全覆盖，暂无新增文案
export default {
  auth: {},
  tests: {
    // 测评列表（dashboard/TestList）
    center: '心理测评中心',
    listSubtitle: '选择适合您的专业心理测评，了解当下心理状态',
    loading: '加载中...',
    retry: '重新加载',
    refresh: '刷新',
    empty: '暂无可用的测评',
    aiTitle: 'AI 智能测评',
    aiDesc: '由 AI 实时生成专属问卷，并根据你的回答智能评分与解读',
    tagVaries: '每次内容不同',
    tagAiScore: 'AI 评分解读',
    tagAiGen: '智能生成',
    start: '开始测评',
    questionsCount: '{n}题',
    aboutMinutes: '约{n}分钟',
    viewHistory: '查看测评历史',
    loadFailed: '获取失败',
    // 作答与提交（tests/DoTest、AiTest）
    back: '返回',
    questionN: '第{n}题',
    points: '{n}分',
    prev: '上一题',
    next: '下一题',
    submitting: '提交中...',
    submit: '提交',
    ok: '确定',
    loadQuestionsFailed: '获取题目失败',
    unanswered: '第{n}题未作答',
    submitted: '测评提交成功',
    submitFailed: '提交失败',
    // 测评历史（tests/TestHistory）
    history: '测评历史',
    noHistory: '暂无测评记录',
    goTest: '去测评',
    loadHistoryFailed: '获取历史记录失败',
    // 结果详情（tests/TestResultDetail）
    resultDetail: '测评结果详情',
    completedAt: '完成时间：{time}',
    notFound: '结果不存在',
    loadResultFailed: '获取结果失败',
    // AI 测评（tests/AiTest）
    aiGenerating: 'AI 正在为你生成专属问卷...',
    aiGeneratingSub: '根据常见心理健康维度实时生成，每次内容都不同',
    genFailed: '生成失败',
    reGen: '重新生成',
    aiAnalyzing: 'AI 分析中...',
    aiScoring: 'AI 正在分析你的回答...',
    aiScoringSub: '结合每一题的选择综合评估，请稍候',
    totalScore: '综合评分：{n}',
    aiGenFailed: 'AI 生成失败，请稍后重试',
    aiSubmitted: 'AI 测评完成',
    aiScoreFailed: 'AI 评分失败',
    // 结果弹窗（DoTest / AiTest 共用）
    doneTitle: '测评完成',
    score: '得分：{n}'
  }
}
