/* 主入口：node docs/diagrams/gen.js  一次性生成全部工程图到 docs/images/ */
const L = require('./lib');
const S = require('./figures-structure');
const FA = require('./figures-flow-a');
const FB = require('./figures-flow-b');

const figures = {
  // 结构图
  architecture: S.architecture,
  'frontend-structure': S.frontendStructure,
  'backend-structure': S.backendStructure,
  'database-er': S.databaseER,
  // 流程 / 时序 / CI-CD
  'auth-flow': FA.authFlow,
  'ai-chat-sequence': FA.aiChatSequence,
  'appointment-flow': FA.appointmentFlow,
  'test-flow': FB.testFlow,
  'moderation-flow': FB.moderationFlow,
  'cicd-flow': FB.cicdFlow,
};

for (const [name, fn] of Object.entries(figures)) {
  L.save(name, fn());
}
console.log('done,', Object.keys(figures).length, 'figures');
