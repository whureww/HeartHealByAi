// 心理知识库：管理员维护的公共心理知识文档，向量化后供 AI 对话与出题检索引用
// 与用户记忆（user_memories）的区别：知识库是平台公共内容（人人可检索），
// 记忆是用户个人数据（仅本人可见）。两者互不影响，均以 MySQL LONGTEXT 存向量 JSON。
import { pool } from '../db/mysql';
import { embedTexts, embedText, cosineSimilarity, packVector, unpackVector, isRagEnabled } from './embedding';

let schemaReady: Promise<void> | null = null;

export function ensureKnowledgeSchema(): Promise<void> {
    if (!schemaReady) {
        schemaReady = (async () => {
            await pool.execute(`
                CREATE TABLE IF NOT EXISTS knowledge_articles (
                    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    article_id INT UNSIGNED NOT NULL COMMENT '文档标识（一篇文档切分为多个内容块，同篇共享）',
                    title VARCHAR(120) NOT NULL COMMENT '文档标题',
                    category VARCHAR(40) NOT NULL DEFAULT 'general' COMMENT '分类',
                    chunk_index INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '内容块序号',
                    chunk_text TEXT NOT NULL COMMENT '内容块文本',
                    embedding LONGTEXT NULL COMMENT '向量 JSON 数组',
                    enabled TINYINT NOT NULL DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    KEY idx_knowledge_article (article_id),
                    KEY idx_knowledge_enabled (enabled)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);
            await pool.execute(`
                CREATE TABLE IF NOT EXISTS knowledge_meta (
                    meta_key VARCHAR(40) PRIMARY KEY,
                    meta_value VARCHAR(200) NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);
        })().catch((e) => {
            schemaReady = null;
            throw e;
        });
    }
    return schemaReady;
}

// ========== 文档切分 ==========

/** 单块目标长度：过短召回噪声大，过长稀释相关性 */
const CHUNK_TARGET = 400;
const CHUNK_MAX = 500;

/** 按段落聚合切分为内容块：空行分段优先，单段超长按句边界再切 */
export function splitArticle(text: string): string[] {
    const src = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!src) return [];
    const paragraphs = src.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

    const pieces: string[] = [];
    for (const para of paragraphs) {
        if (para.length <= CHUNK_MAX) {
            pieces.push(para);
            continue;
        }
        // 超长段落按句切（中英文句末标点），再聚合
        const sentences = para.match(/[^。！？.!?]+[。！？.!?]?/g) || [para];
        let buf = '';
        for (const s of sentences) {
            if (buf && (buf + s).length > CHUNK_TARGET) {
                pieces.push(buf.trim());
                buf = s;
            } else {
                buf += s;
            }
        }
        if (buf.trim()) pieces.push(buf.trim());
    }

    // 相邻碎块聚合到目标长度
    const chunks: string[] = [];
    let acc = '';
    for (const p of pieces) {
        if (acc && (acc + '\n' + p).length > CHUNK_TARGET) {
            chunks.push(acc);
            acc = p;
        } else {
            acc = acc ? acc + '\n' + p : p;
        }
    }
    if (acc.trim()) chunks.push(acc);
    return chunks.filter((c) => c.length >= 10);
}

// ========== 增删查 ==========

/** 新增文档：切分 + 批量向量化入库，返回内容块数（向量服务不可用时仍入库，embedding 留空待补） */
export async function addKnowledgeArticle(title: string, category: string, content: string): Promise<number> {
    await ensureKnowledgeSchema();
    const chunks = splitArticle(content);
    if (chunks.length === 0) throw new Error('文档内容切分后为空');
    const [maxRows] = await pool.execute('SELECT COALESCE(MAX(article_id), 0) AS m FROM knowledge_articles');
    const articleId = Number((maxRows as any[])[0].m) + 1;

    let vecs: number[][] | null = null;
    if (isRagEnabled()) {
        vecs = await embedTexts(chunks).catch(() => null);
    }
    for (let i = 0; i < chunks.length; i++) {
        await pool.execute(
            'INSERT INTO knowledge_articles (article_id, title, category, chunk_index, chunk_text, embedding) VALUES (?, ?, ?, ?, ?, ?)',
            [articleId, title.slice(0, 120), category.slice(0, 40), i, chunks[i], vecs?.[i] ? packVector(vecs[i]) : null]
        );
    }
    return chunks.length;
}

/** 删除整篇文档（按文档标识） */
export async function deleteKnowledgeArticle(articleId: number): Promise<void> {
    await ensureKnowledgeSchema();
    await pool.execute('DELETE FROM knowledge_articles WHERE article_id = ?', [articleId]);
}

/** 文档列表（按文档分组） */
export async function listKnowledgeArticles(): Promise<any[]> {
    await ensureKnowledgeSchema();
    const [rows] = await pool.execute(
        `SELECT article_id, MAX(title) AS title, MAX(category) AS category,
                COUNT(*) AS chunks, SUM(CHAR_LENGTH(chunk_text)) AS chars, MAX(created_at) AS created_at
         FROM knowledge_articles GROUP BY article_id ORDER BY article_id DESC`
    );
    return rows as any[];
}

// ========== 检索 ==========

const K_MIN_SIMILARITY = 0.4;

/** 以查询文本检索知识库，返回最相关的知识片段（标题 + 内容块）。失败返回空数组（fail-open）。 */
export async function retrieveKnowledge(query: string, topK = 3): Promise<{ title: string; text: string }[]> {
    try {
        const q = String(query || '').trim();
        if (!isRagEnabled() || q.length < 2) return [];
        await ensureKnowledgeSchema();
        const qvec = await embedText(q);
        if (!qvec) return [];
        const [rows] = await pool.execute(
            'SELECT title, chunk_text, embedding FROM knowledge_articles WHERE enabled = 1 AND embedding IS NOT NULL'
        );
        return (rows as any[])
            .map((r) => ({ title: r.title as string, text: r.chunk_text as string, sim: cosineSimilarity(qvec, unpackVector(r.embedding) || []) }))
            .filter((r) => r.sim >= K_MIN_SIMILARITY)
            .sort((a, b) => b.sim - a.sim)
            .slice(0, topK)
            .map((r) => ({ title: r.title, text: r.text }));
    } catch (e: any) {
        console.error('[knowledge] 知识库检索失败（不影响主链路）:', e.message);
        return [];
    }
}

// ========== 内置种子文档（首次初始化时播种，管理员可删可补） ==========

const K_SEED_VERSION = '2';
const SEED_ARTICLES: Array<{ title: string; category: string; content: string }> = [
    {
        title: '情绪调节的实用方法',
        category: 'emotion',
        content: '情绪调节是心理健康的核心能力之一。当强烈情绪来袭时，可以先尝试「命名情绪」：把当下的感受用词语说出来（如"我现在感到委屈"），研究表明这一简单动作本身就能降低情绪强度。\n\n「STOP 技术」四步法：停下来（Stop）、深呼吸（Take a breath）、观察身体与想法（Observe）、带着觉察继续行动（Proceed）。它适合在情绪即将失控时快速使用。\n\n书写表达也是有效的情绪出口：每天用几分钟把烦心事写下来，能让情绪从"在心里打转"变成"被看见、被整理"。坚持一至两周，多数人会感到情绪波动变得平缓。\n\n需要注意：情绪没有好坏之分，压抑和否认反而会放大情绪。允许自己难过、愤怒，再选择合适的方式表达，是更健康的路径。'
    },
    {
        title: '正念呼吸与放松练习',
        category: 'emotion',
        content: '正念呼吸是最容易上手的放松练习：找一个安静的地方坐下，闭上眼睛，把注意力放在呼吸上，感受气流进出鼻腔的感觉。走神是正常的，发现走神后温和地把注意力带回呼吸即可，每次练习五到十分钟。\n\n「4-7-8 呼吸法」有助于快速平静：吸气 4 秒，屏息 7 秒，缓慢呼气 8 秒，重复 4 轮。呼气延长能激活副交感神经，让心跳放缓、身体放松。\n\n渐进式肌肉放松适合睡前进行：从脚趾到额头，逐组肌肉先紧绷 5 秒再彻底放松 10 秒，感受紧张与松弛的对比，帮助身体释放累积的压力。\n\n正念练习贵在规律而非时长，每天固定时间练习几分钟，比偶尔一次长时间练习更有效。'
    },
    {
        title: '改善睡眠的卫生习惯',
        category: 'sleep',
        content: '睡眠卫生是一组帮助改善睡眠的日常习惯。规律作息是第一条：每天同一时间上床和起床，包括周末，帮助身体建立稳定的生物钟。\n\n卧室只留给睡眠：睡前一小时远离手机、电脑等发光屏幕，蓝光会抑制褪黑素分泌；把床只用于睡觉，不在床上工作、刷视频，让大脑建立"上床=睡觉"的条件反射。\n\n下午三点后避免咖啡、浓茶等含咖啡因饮品；晚餐不宜过饱；睡前可以用温水泡脚、听轻音乐或做舒缓的拉伸帮助入睡。\n\n躺下 20 分钟仍睡不着时，不要在床上翻来覆去硬撑，起身到昏暗的环境里做点单调安静的事，有困意再回床。若失眠持续超过一个月并影响白天状态，建议寻求专业帮助。'
    },
    {
        title: '识别心理危机信号与求助途径',
        category: 'crisis',
        content: '了解危机信号有助于及早发现自己或身边人需要帮助：持续两周以上的情绪低落、兴趣丧失；睡眠食欲的显著改变；强烈的无望感、无价值感；社交明显退缩；提到"活着没意思"甚至有自伤想法。出现这些信号时请认真对待。\n\n自我照顾的底线：保持基本的吃饭、睡觉和与信任的人的联系。危机时刻，陪伴与倾诉本身就是保护因素。\n\n求助是勇敢而非软弱的表现。可求助的渠道包括：学校心理咨询中心、正规医院的心理科或精神科、拨打全国心理援助热线 12356（或北京心理危机研究与干预中心热线 010-82951332）。\n\n如果身边人出现危机信号：认真倾听、不评判、不轻易说"想开点"；直接询问对方是否有伤害自己的念头不会"提醒"对方，反而能打开求助的通道；陪伴对方联系专业帮助。紧急情况下请立即陪同就医或拨打急救电话。'
    },
    {
        title: '应对压力与预防倦怠',
        category: 'stress',
        content: '压力并非全然有害，适度的压力能提升表现；真正伤害身心的是长期得不到缓冲的慢性压力。识别压力信号是第一步：易怒、注意力下降、肌肉紧张、频繁头痛或肠胃不适，都可能是身体在提醒你负荷过重。\n\n任务管理上，把大目标拆成可完成的小步骤，用「写下-排序-逐个完成」代替在脑中反复盘旋；每天留出哪怕 20 分钟完全属于自己的时间，做与工作和学习无关的事。\n\n运动是被反复验证的减压方式：每周 3 次、每次 30 分钟的有氧运动（快走、慢跑、游泳）能显著降低压力激素水平。\n\n预防倦怠要留意三个信号：情绪耗竭（感到被掏空）、去人格化（对人冷漠敷衍）、成就感下降。当它们同时出现并持续数周，建议调整负荷并考虑寻求心理咨询的支持。'
    },
    {
        title: '人际沟通中的边界与表达',
        category: 'relationship',
        content: '健康的人际关系需要清晰的边界。边界不是冷漠，而是让对方知道你的底线与需要，这反而能让关系更长久。感到被冒犯却不说，委屈会累积成怨恨；温和而清晰地表达，是维护关系的必要技能。\n\n「我信息」表达法可以降低对抗性：把「你总是打断我」换成「当我说话被打断时，我会感到不被尊重」。描述事实 + 表达感受 + 提出期望，比指责更容易被听进去。\n\n学会拒绝同样重要：拒绝不合理的请求时，可以肯定关系、说明难处、给出替代方案，例如「我很想帮你，但这周我实在排不开，下周可以吗」。不必为拒绝过度愧疚。\n\n在亲密关系中，冲突不可避免，关键是修复：争吵后主动复盘「刚才我们都在气头上，我想重新谈谈」，比冷战等待更能修复信任。'
    },
    {
        title: '理解与缓解焦虑',
        category: 'stress',
        content: '焦虑是身体面对不确定时的正常反应，它的本意是保护我们。适度的焦虑让人提前准备、规避风险；但当焦虑长期偏高、无明显威胁也持续紧张时，就需要主动照顾自己。\n\n焦虑的身体信号包括心跳加快、呼吸变浅、肌肉紧绷、肠胃不适、坐立不安。理解「这是身体的警报系统在加班」，而不是「我出了问题」，能减少对焦虑本身的恐惧。\n\n应对急性焦虑，「落地技术」很实用：说出眼前看到的 5 样东西、听到的 4 种声音、能触摸的 3 样物品，把注意力从担忧拉回当下；也可以握住一杯温水，专注于温度与触感。\n\n长期缓解靠规律生活：稳定睡眠、每周运动、减少咖啡因，都能降低焦虑基线。把担忧「预约化」——每天留 15 分钟专门处理担忧，其他时间提醒自己「到预约时间再想」，能显著减少担忧侵占生活。\n\n若焦虑持续数周且明显影响学习、工作或睡眠，建议寻求学校心理中心或专业机构的支持。'
    },
    {
        title: '情绪低落时的自我照顾',
        category: 'emotion',
        content: '情绪低落时，人常常会本能地自我责备：「我怎么这么没用」「别人都好好的」。请记住：低落是心理在告诉你「此刻需要休息与照顾」，它不是软弱的证据。\n\n低落期的自我照顾可以从最小的行动开始：起床拉开窗帘、喝一杯温水、洗一个热水澡、到楼下走五分钟。不要小看这些「小事」——行动本身就会带来微小的掌控感，而掌控感是走出低落的第一块砖。\n\n降低对自己的要求是合理的策略：状态不好时把任务拆到最小单元，完成一件就肯定自己一次。对比「我应该振作」，「我今天做到了什么」是更有力的提问。\n\n保持与人的最低限度连接也很重要：给信任的朋友发条消息、和家人吃顿饭。低落会让人想封闭自己，而孤立往往让情绪进一步下沉。\n\n需要留意的边界：如果低落持续两周以上、对曾经喜欢的事完全提不起兴趣、睡眠食欲明显改变，或出现伤害自己的念头，请尽快寻求专业帮助——这就像感冒久了要看医生一样自然。'
    },
    {
        title: '面对考试与学业压力',
        category: 'stress',
        content: '学业压力是学生阶段最普遍的困扰。压力与成绩呈「倒 U 形」关系：完全没有压力会松懈，压力过大反而发挥失常，适度紧张才是最佳状态。目标不是消灭压力，而是把它调到可用的区间。\n\n备考期的常见误区是「用熬夜换时长」。牺牲睡眠的记忆巩固效率远低于规律复习：睡眠中大脑会把短期记忆转成长期记忆，熬夜复习往往得不偿失。番茄工作法（25 分钟专注 + 5 分钟休息）比长时间硬撑更有效。\n\n考前的紧张心慌可以这样做：提前熟悉考场流程减少不确定性；把「考不好就完了」改写成「这次考试检验的是这一阶段的掌握程度」；进考场前做几轮 4-7-8 呼吸平复心率。\n\n成绩之外的视角：一次考试衡量的是特定时间的特定表现，不定义你的价值，也不决定你的人生。把注意力从「结果会怎样」放回「当下这一页我能复习好」，焦虑会随之下降。\n\n如果学业压力已经引发持续的失眠、心慌或回避上学，请及时联系学校心理咨询中心或专业机构。'
    },
    {
        title: '理解拖延并开始行动',
        category: 'general',
        content: '拖延往往不是懒惰，而是一种情绪调节策略：任务让人感到无聊、困难、害怕失败或追求完美，大脑便用「先做点别的」来逃避这些不适。理解这一点，就能把矛头从「责备自己」转向「处理情绪」。\n\n对付拖延的核心是「降低启动门槛」：把任务缩到小到不可能失败——只写一个开头句、只做第一道题、只整理五分钟。心理学研究发现，行动先于动力：往往是先开始做了，动力才慢慢出现，而不是等有动力了再开始。\n\n「五分钟法则」很好用：告诉自己只做五分钟，五分钟后可以随时停。实际开始后，继续下去通常比想象中容易，因为最难的从来是启动而非坚持。\n\n环境设计比意志力可靠：把手机放到另一个房间、提前打开需要的学习资料、和同伴约定互相打卡。减少「开始」所需的步骤，拖延的空间就变小。\n\n对完美主义者额外提醒：先完成，再完善。一份完成度 80% 的作业，远胜于停在构思阶段的 100% 设想。'
    },
    {
        title: '社交紧张与人际适应',
        category: 'relationship',
        content: '在陌生场合心跳加速、担心说错话、聚会后反复回想自己的表现——社交紧张是非常普遍的体验，绝大多数人都经历过，它不代表「性格有缺陷」。\n\n一个重要的认知校准：人们对自己在他人眼中的关注度远高于实际（心理学称为「聚光灯效应」）。你以为人人都在注意你的小失误，实际上他人对自己的关注和你一样多。\n\n改善社交紧张可以从小步练习开始：先向店员道谢、和同学简单寒暄、在小组里说一句话。每次小互动都是一次「安全证据」的积累，慢慢让大脑更新「社交=危险」的旧判断。\n\n倾听是社交里最被低估的技能：不需要妙语连珠，认真听、适时回应「后来呢」「那确实不容易」，就能让对方感到被重视，关系自然升温。\n\n独处偏好与社交能力是两回事：内向者同样可以拥有高质量的友谊，不必强迫自己成为人群焦点。找到让自己舒适的社交节奏与人群，比模仿外向者更重要。'
    },
    {
        title: '与家人相处：理解、边界与沟通',
        category: 'relationship',
        content: '家庭是最深的羁绊，也常常是最容易受伤的地方。与家人的矛盾，很多时候源于双方用不同的方式表达关心——父母用叮嘱表达爱，子女用沉默保护关系，结果彼此都觉得不被理解。\n\n理解不等于认同：可以尝试理解父母的担忧来自他们成长的时代与环境，同时保留自己的判断。「我知道你们是为我好」和「但我希望自己做这个决定」可以同时成立。\n\n与家人设立边界需要温和而坚定：例如「这件事我已经想清楚了，希望你们尊重我的选择」「我不太想聊这个话题，我们说点别的」。边界被反复温和地声明，才会被慢慢接受。\n\n沟通时机很重要：情绪激动时说的话往往最伤人。感觉火气上来时先暂停（「我们都冷静十分钟再谈」），比当场争出对错更能保护关系。\n\n如果家庭关系带来的困扰很深、影响到了情绪与生活，和学校心理老师或专业咨询师聊一聊会很有帮助——处理家庭议题并不需要「背叛」家庭，而是为了更好地与彼此相处。'
    },
    {
        title: '面对失去与哀伤',
        category: 'emotion',
        content: '失去——无论是亲人离世、宠物离开、关系结束，还是一段重要时光的告别——都会带来哀伤。哀伤不是需要「尽快走出来」的故障，而是爱过之后的自然过程。\n\n哀伤没有标准时间表，也没有「正确的样子」：有人流泪，有人麻木，有人忙碌如常却在深夜崩溃。允许自己以自己的节奏经历它，不与任何人比较。\n\n与失去的对象保持健康的连接有助于疗愈：写一封没有寄出的信、整理一段回忆、在特别的日子做一件纪念小事。纪念不是「放不下」，而是把关系安放进生命里。\n\n哀伤期的身体照顾常被忽略：规律吃饭睡觉、避免用酒精麻痹、维持基本的日常节奏，能给情绪一个可以停靠的容器。\n\n需要求助的信号：长时间完全无法 functioning（无法正常生活）、持续的强烈自责、或出现伤害自己的念头。哀伤咨询师和心理咨询都能提供专业的陪伴。失去会改变我们，但带着记忆继续生活，本身就是爱的延续。'
    },
    {
        title: '自我接纳与自我关怀',
        category: 'emotion',
        content: '很多人习惯用苛刻的标准要求自己：考试差一点就否定全部努力、犯一个小错就反复自责。长期自我批评不会让人变好，反而会消耗改变所需的能量。\n\n自我关怀（self-compassion）的核心是：像对待好朋友那样对待自己。想象你的朋友考试失利来找你倾诉，你会说「你真没用」吗？大概率不会——你会说「这次没考好确实难受，你已经很努力了」。把这样的话也说给自己听。\n\n「都会经历」的视角能减少孤独感：犯錯、失败、感到不足是所有人共同的人生体验，而不是只发生在你身上的独特缺陷。提醒自己「此刻的艰难，许多人也正在经历」，羞耻感会明显减轻。\n\n练习正念自我关怀的小方法：把手放在心口，感受掌心的温度，对自己说「这很难受，愿我善待自己」。听起来简单，但身体的安抚信号能真实地平静神经系统。\n\n自我接纳不等于放弃进步：恰恰是被接纳的人，才有安全感去尝试、去犯错、去成长。先接纳现在的自己，再慢慢成为想成为的人。'
    },
    {
        title: '手机与社交媒体的健康使用',
        category: 'general',
        content: '频繁刷手机停不下来，不是意志力差，而是产品设计的必然：短视频与信息流的每次刷新都可能带来新鲜刺激，这种「不确定的奖励」恰恰是最容易让人上瘾的机制。\n\n过度使用的代价不只是时间：睡前刷手机延迟入睡、碎片信息削弱深度专注、社交平台的「精选生活」容易让人产生「别人都过得比我好」的错觉，进而拉低自我评价。\n\n几个立即可用的节制策略：给社交 App 设置每日时长上限；睡前一小时把手机放在卧室外充电；把最耗时 App 的图标移出首屏；用「想刷手机时先深呼吸十秒」制造一个暂停，很多冲动会自己消退。\n\n「替代」比「戒断」更容易成功：预留出刷手机的时间去做一件具体的事——散步、拼图、给朋友打电话——大脑需要新的奖励来源，而不只是被剥夺旧的。\n\n如果发现自己用刷手机来逃避现实压力，那值得处理的是压力本身；当社交媒体让你持续感到焦虑、自卑或情绪低落时，减少使用往往能带来肉眼可见的情绪改善。'
    },
    {
        title: '情绪急救：当下让自己稳定下来',
        category: 'emotion',
        content: '当情绪汹涌到难以承受时——想大哭、想大喊、胸口发闷、脑子一片混乱——首要任务不是分析原因，而是先让自己稳定下来。以下方法可以在几分钟内起效。\n\n降低唤醒度：用冷水轻拍脸颊或手腕（低温能激活让身体平静的神经反射）；延长呼气——吸 4 秒、呼 8 秒，重复几轮，呼气是身体的天然「刹车」。\n\n回到当下：双脚踩实地面感受支撑；环顾四周说出五种颜色的物品；抱紧一个抱枕或把脸埋进毛巾里，用触觉把自己「锚」在现在。\n\n给情绪一个出口：找一个不影响他人的方式释放——到空旷处喊一喊、撕废纸、快速做二十个深蹲、跟着音乐用力舞动。情绪是能量，让它流动比压着更安全。\n\n事后照顾同样重要：稳定下来后喝点温水、吃点东西、找个安全的地方休息，并给信任的人发条消息「我现在有点难过，想跟你说说话」。\n\n请记住：强烈的情绪会到达顶点然后回落，通常不超过 20 到 90 分钟。撑过峰值，海面就会开始平复。如果反复出现难以承受的情绪风暴或出现伤害自己的念头，请及时联系专业帮助或心理援助热线。'
    }
];

/** 种子播种：meta 表记录版本，版本升级或首次初始化时整体播种（表内已有种子文档则跳过） */
export async function ensureKnowledgeSeeds(): Promise<void> {
    try {
        await ensureKnowledgeSchema();
        const [rows] = await pool.execute('SELECT meta_value FROM knowledge_meta WHERE meta_key = ?', ['knowledge_seed_version']);
        if ((rows as any[]).length > 0) return;
        for (const a of SEED_ARTICLES) {
            await addKnowledgeArticle(a.title, a.category, a.content);
        }
        await pool.execute('INSERT INTO knowledge_meta (meta_key, meta_value) VALUES (?, ?)', ['knowledge_seed_version', K_SEED_VERSION]);
        console.log(`[knowledge] 知识库种子已播种：${SEED_ARTICLES.length} 篇内置文档`);
    } catch (e: any) {
        console.error('[knowledge] 知识库种子播种失败:', e.message);
    }
}
