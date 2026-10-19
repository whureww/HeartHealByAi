// Auth extras + tests module copy (English)
// auth: Login/Register/Forget pages are fully covered by existing keys
export default {
  auth: {},
  tests: {
    // Test list (dashboard/TestList)
    center: 'Psychological Assessment Center',
    listSubtitle: 'Choose a professional assessment that suits you and understand your current state of mind',
    loading: 'Loading...',
    retry: 'Reload',
    refresh: 'Refresh',
    empty: 'No assessments available',
    aiTitle: 'AI Assessment',
    aiDesc: 'An AI-generated questionnaire tailored to you, with intelligent scoring and interpretation',
    tagVaries: 'Different every time',
    tagAiScore: 'AI scoring & interpretation',
    tagAiGen: 'AI generated',
    start: 'Start',
    questionsCount: '{n} questions',
    aboutMinutes: '~{n} min',
    viewHistory: 'View history',
    loadFailed: 'Failed to load',
    // Answering & submission (tests/DoTest, AiTest)
    back: 'Back',
    questionN: 'Question {n}',
    points: '{n} pts',
    prev: 'Previous',
    next: 'Next',
    submitting: 'Submitting...',
    submit: 'Submit',
    ok: 'OK',
    loadQuestionsFailed: 'Failed to load questions',
    unanswered: 'Question {n} unanswered',
    submitted: 'Assessment submitted',
    submitFailed: 'Submit failed',
    // History (tests/TestHistory)
    history: 'Assessment History',
    noHistory: 'No assessment records yet',
    goTest: 'Take an assessment',
    loadHistoryFailed: 'Failed to load history',
    // Result detail (tests/TestResultDetail)
    resultDetail: 'Result Details',
    completedAt: 'Completed at: {time}',
    notFound: 'Result not found',
    loadResultFailed: 'Failed to load result',
    // AI assessment (tests/AiTest)
    aiGenerating: 'AI is generating your personal questionnaire...',
    aiGeneratingSub: 'Generated in real time from common mental health dimensions, different every time',
    genFailed: 'Generation failed',
    reGen: 'Regenerate',
    aiAnalyzing: 'AI analyzing...',
    aiScoring: 'AI is analyzing your answers...',
    aiScoringSub: 'Evaluating all of your choices together, please wait',
    totalScore: 'Overall Score: {n}',
    aiGenFailed: 'AI generation failed, please try again later',
    aiSubmitted: 'AI assessment completed',
    aiScoreFailed: 'AI scoring failed',
    // Result modal (shared by DoTest / AiTest)
    doneTitle: 'Assessment Complete',
    score: 'Score: {n}'
  }
}
