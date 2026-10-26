// AI 智能测评：真实标准化量表模板库（种子数据 + 懒加载建表/播种）
// 数据来源：各量表公开发布的标准中文版（高校心理中心/编制方官网核实），
// 反向计分条目的分值已在选项中预翻转，运行期直接求和即可，与"分数越高越需关注"的测评语义一致
// （正向量表如 SES/WHO-5 保留原始计分方向，由 score_note 说明，供 AI 评分时参考）
import { pool } from '../db/mysql';

export interface ScaleOption {
    label: string;
    text: string;
    score: number;
}

export interface ScaleItem {
    number: number;
    content: string;
    options: ScaleOption[];
}

export interface ScaleTemplate {
    code: string;
    name: string;
    category: string;
    estimatedMinutes: number;
    intro: string;
    scoreNote: string;
    /** 标准化分级区间（来自公开常模分界），供专家套用模板创建问卷时直接使用 */
    resultLevels: Array<{ min: number; max: number; level: string; desc: string }>;
    items: ScaleItem[];
}

// 种子数据版本：量表条目/计分/分级修正后递增，服务启动后首次访问模板时自动整体刷新
const SEED_VERSION = 2;

// ===== 选项体系构造器（均为公开发布的标准计分方式） =====
const opts = (spec: Array<[string, string, number]>): ScaleOption[] =>
    spec.map(([label, text, score]) => ({ label, text, score }));

/** PHQ 系频度：0~3 */
const FREQ_PHQ = () => opts([['A', '完全没有', 0], ['B', '有几天', 1], ['C', '一半以上天数', 2], ['D', '几乎每天', 3]]);
/** DASS 系符合度：0~3 */
const FREQ_DASS = () => opts([['A', '不符合', 0], ['B', '部分符合', 1], ['C', '相当符合', 2], ['D', '非常符合', 3]]);
/** Zung 自评量表频度：1~4 与反向 4~1 */
const FREQ_ZUNG = () => opts([['A', '没有或很少时间', 1], ['B', '少部分时间', 2], ['C', '相当多时间', 3], ['D', '绝大部分或全部时间', 4]]);
const FREQ_ZUNG_REV = () => opts([['A', '没有或很少时间', 4], ['B', '少部分时间', 3], ['C', '相当多时间', 2], ['D', '绝大部分或全部时间', 1]]);
/** UCLA 频度：1~4 与反向 4~1 */
const FREQ_UCLA = () => opts([['A', '从未有此感觉', 1], ['B', '很少有此感觉', 2], ['C', '有时有此感觉', 3], ['D', '一直有此感觉', 4]]);
const FREQ_UCLA_REV = () => opts([['A', '从未有此感觉', 4], ['B', '很少有此感觉', 3], ['C', '有时有此感觉', 2], ['D', '一直有此感觉', 1]]);
/** PSS 频度：0~4 与反向 4~0 */
const FREQ_PSS = () => opts([['A', '从不', 0], ['B', '偶尔', 1], ['C', '有时', 2], ['D', '时常', 3], ['E', '总是', 4]]);
const FREQ_PSS_REV = () => opts([['A', '从不', 4], ['B', '偶尔', 3], ['C', '有时', 2], ['D', '时常', 1], ['E', '总是', 0]]);
/** K10 频度：1~5 */
const FREQ_K10 = () => opts([['A', '从不', 1], ['B', '很少', 2], ['C', '有时', 3], ['D', '经常', 4], ['E', '总是', 5]]);
/** GDS 二分：负向条目「是」计 1，正向条目「是」计 0 */
const YESNO_NEG = () => opts([['A', '是', 1], ['B', '否', 0]]);
const YESNO_POS = () => opts([['A', '是', 0], ['B', '否', 1]]);
/** ISI 严重程度 0~4（各条目锚点不同） */
const ISI_SEVERITY = () => opts([['A', '无', 0], ['B', '轻度', 1], ['C', '中度', 2], ['D', '重度', 3], ['E', '极重度', 4]]);
const ISI_SATISFY = () => opts([['A', '很满意', 0], ['B', '满意', 1], ['C', '一般', 2], ['D', '不满意', 3], ['E', '很不满意', 4]]);
const ISI_IMPACT = () => opts([['A', '完全没有', 0], ['B', '轻微', 1], ['C', '有些', 2], ['D', '较多', 3], ['E', '非常严重', 4]]);
/** WHO-5 频度 0~5（正向量表） */
const FREQ_WHO5 = () => opts([['A', '任何时间都没有', 0], ['B', '偶尔有', 1], ['C', '有时有', 2], ['D', '经常有', 3], ['E', '大部分时间有', 4], ['F', '所有时间都有', 5]]);
/** PHQ-15 困扰程度 0~2 */
const FREQ_PHQ15 = () => opts([['A', '没有这种困扰', 0], ['B', '轻微困扰', 1], ['C', '困扰很大', 2]]);
/** MBI-GS 工作频率 0~6 */
const FREQ_MBI = () => opts([['A', '从不', 0], ['B', '极少', 1], ['C', '偶尔', 2], ['D', '有时', 3], ['E', '经常', 4], ['F', '频繁', 5], ['G', '每天', 6]]);

const items = (contents: Array<[string, () => ScaleOption[]]>): ScaleItem[] =>
    contents.map(([content, options], i) => ({ number: i + 1, content, options: options() }));

/** 分级区间构造器 */
const levels = (spec: Array<[number, number, string, string]>) =>
    spec.map(([min, max, level, desc]) => ({ min, max, level, desc }));

// ===== 量表模板数据 =====
export const SCALE_TEMPLATES: ScaleTemplate[] = [
    {
        code: 'PHQ-9',
        name: 'PHQ-9 抑郁自评量表',
        category: '抑郁',
        estimatedMinutes: 5,
        intro: '基于 DSM 抑郁症状诊断标准的 9 条目自评筛查工具，覆盖情绪低落、兴趣丧失、睡眠、食欲、精力、自我评价、专注力、精神运动性激越/迟滞与消极意念九个核心维度；按最近两周症状出现频度计分。',
        scoreNote: '总分 0~27，得分越高表示抑郁症状越明显，越需要关注（5/10/15/20 为轻中重度常用分界）。',
        resultLevels: levels([
            [0, 4, '正常', '目前未提示明显抑郁症状，请继续保持良好状态。'],
            [5, 9, '轻度', '存在轻度抑郁倾向，建议关注情绪变化，保持规律作息与社交。'],
            [10, 14, '中度', '存在中度抑郁倾向，建议寻求专业心理支持。'],
            [15, 19, '中重度', '存在中重度抑郁倾向，建议尽快预约心理咨询或就医评估。'],
            [20, 27, '重度', '存在重度抑郁倾向，强烈建议尽快寻求专业帮助。']
        ]),
        items: items([
            ['做事时提不起劲或没有兴趣', FREQ_PHQ],
            ['感到心情低落、沮丧或绝望', FREQ_PHQ],
            ['入睡困难、睡不安稳或睡眠过多', FREQ_PHQ],
            ['感觉疲倦或没有活力', FREQ_PHQ],
            ['食欲不振或吃得过多', FREQ_PHQ],
            ['觉得自己很糟，或觉得自己很失败，或让自己、家人失望', FREQ_PHQ],
            ['对事情难以集中注意力，例如读报或看电视时', FREQ_PHQ],
            ['动作或说话缓慢到引人注意，或恰好相反——烦躁、坐立不安', FREQ_PHQ],
            ['有不如死掉或用某种方式伤害自己的念头', FREQ_PHQ]
        ])
    },
    {
        code: 'GAD-7',
        name: 'GAD-7 广泛性焦虑障碍量表',
        category: '焦虑',
        estimatedMinutes: 4,
        intro: '7 条目广泛性焦虑筛查工具，覆盖紧张、无法控制的担忧、对多事的担忧、难以放松、坐立不安、易烦躁与莫名害怕等核心维度；按最近两周症状出现频度计分。',
        scoreNote: '总分 0~21，得分越高表示焦虑症状越明显，越需要关注（5/10/15 为轻中重度常用分界）。',
        resultLevels: levels([
            [0, 4, '正常', '目前未提示明显焦虑症状。'],
            [5, 9, '轻度', '存在轻度焦虑倾向，建议关注压力来源，适当放松。'],
            [10, 14, '中度', '存在中度焦虑倾向，建议寻求专业心理支持。'],
            [15, 21, '重度', '存在重度焦虑倾向，强烈建议尽快寻求专业帮助。']
        ]),
        items: items([
            ['感觉紧张、焦虑或急切', FREQ_PHQ],
            ['不能停止或控制担忧', FREQ_PHQ],
            ['对各种各样的事情担忧过多', FREQ_PHQ],
            ['很难放松下来', FREQ_PHQ],
            ['焦躁不安，以至于难以安静地坐着', FREQ_PHQ],
            ['变得容易烦恼或急躁', FREQ_PHQ],
            ['感到害怕，好像有什么可怕的事可能发生', FREQ_PHQ]
        ])
    },
    {
        code: 'DASS-21',
        name: 'DASS-21 抑郁-焦虑-压力自评量表',
        category: '情绪综合',
        estimatedMinutes: 10,
        intro: '21 条目情绪自评量表，抑郁（第 3、5、10、13、16、17、21 条）、焦虑（第 2、4、7、9、15、19、20 条）、压力（第 1、6、8、11、12、14、18 条）三个维度各 7 条；按最近一周的符合程度计分。',
        scoreNote: '三个维度各自汇总（各 0~21 分，总分乘 2 后与常规分界对照），任一维度得分越高表示该方面困扰越明显，越需要关注。',
        resultLevels: levels([
            [0, 20, '正常', '整体情绪困扰不明显。建议结合抑郁/焦虑/压力三个子维度（各 7 条）分别解读。'],
            [21, 36, '轻度', '存在轻度情绪困扰，建议结合子维度定位主要困扰来源并加以关注。'],
            [37, 49, '中度', '存在中度情绪困扰，建议寻求专业心理支持。'],
            [50, 63, '重度', '存在重度情绪困扰，强烈建议尽快寻求专业帮助。']
        ]),
        items: items([
            ['我感到很难让自己安静下来', FREQ_DASS],
            ['我感到口干舌燥', FREQ_DASS],
            ['我好像一点都感受不到愉快和开心', FREQ_DASS],
            ['我感到呼吸困难（例如没有运动时也呼吸急促、透不过气）', FREQ_DASS],
            ['我很难主动开始去做一件事', FREQ_DASS],
            ['我容易对事情作出过度的反应', FREQ_DASS],
            ['我感到手发抖（例如拿东西、写字的时候）', FREQ_DASS],
            ['我觉得自己消耗了很多神经能量', FREQ_DASS],
            ['我担心一些场合会让我慌乱出丑', FREQ_DASS],
            ['我觉得对未来不抱什么期待', FREQ_DASS],
            ['我感到烦躁不安', FREQ_DASS],
            ['我很难放松自己', FREQ_DASS],
            ['我感到情绪低落、沮丧', FREQ_DASS],
            ['我无法容忍任何妨碍我继续做事的东西', FREQ_DASS],
            ['我觉得自己快要恐慌了', FREQ_DASS],
            ['我对任何事情都提不起热情', FREQ_DASS],
            ['我觉得自己没有什么价值', FREQ_DASS],
            ['我觉得自己很容易生气或被冒犯', FREQ_DASS],
            ['没有体力活动时我也觉察到自己的心跳（例如心跳加快或漏跳一拍）', FREQ_DASS],
            ['我莫名其妙地感到害怕', FREQ_DASS],
            ['我觉得生活没有意义', FREQ_DASS]
        ])
    },
    {
        code: 'PSS-10',
        name: 'PSS-10 知觉压力量表',
        category: '压力',
        estimatedMinutes: 5,
        intro: 'Cohen 编制的 10 条目知觉压力量表，评估个体对不可控、不可预测与超负荷生活事件的感知程度及应对信心；按最近一个月的出现频度计分，第 4、5、7、8 条为反向计分（分值已翻转）。',
        scoreNote: '总分 0~40，得分越高表示感知到的压力越大，越需要关注。',
        resultLevels: levels([
            [0, 13, '正常', '压力知觉处于正常范围，应对状态良好。'],
            [14, 26, '中等', '压力知觉处于中等水平，建议关注压力来源并调整节奏。'],
            [27, 40, '偏高', '压力知觉明显偏高，建议主动减压并考虑寻求支持。']
        ]),
        items: items([
            ['因为发生了意料之外的事情而感到心烦意乱', FREQ_PSS],
            ['感觉无法控制生活中的重要事情', FREQ_PSS],
            ['感到紧张不安和有压力', FREQ_PSS],
            ['对处理个人问题的能力充满信心', FREQ_PSS_REV],
            ['感到事情都顺心如意', FREQ_PSS_REV],
            ['发现自己无法应付所有不得不做的事情', FREQ_PSS],
            ['能够控制生活中的恼人事情', FREQ_PSS_REV],
            ['感觉一切都在自己的掌握之中', FREQ_PSS_REV],
            ['因为发生了自己无法控制的事情而感到生气', FREQ_PSS],
            ['感到困难堆积如山，已经无法克服', FREQ_PSS]
        ])
    },
    {
        code: 'SAS',
        name: 'SAS 焦虑自评量表',
        category: '焦虑',
        estimatedMinutes: 10,
        intro: 'Zung 焦虑自评量表 20 条目，覆盖焦虑、害怕、惊恐、发疯感、不幸预感、手足颤抖、躯体疼痛、乏力、心悸、头昏、晕厥、呼吸困难、手足刺痛、胃痛消化不良、尿意频数、多汗、面部潮红、睡眠障碍、噩梦等症状维度；按最近一周出现频度计分，第 5、9、13、17、19 条为反向计分（分值已翻转）。',
        scoreNote: '总分越高表示焦虑自评症状越明显，越需要关注（粗分×1.25 为标准分，50 分为分界）。',
        resultLevels: levels([
            [20, 49, '正常', '焦虑自评症状在正常范围。'],
            [50, 59, '轻度', '存在轻度焦虑症状，建议关注并自我调节。'],
            [60, 69, '中度', '存在中度焦虑症状，建议寻求专业心理支持。'],
            [70, 80, '重度', '存在重度焦虑症状，强烈建议尽快寻求专业帮助。']
        ]),
        items: items([
            ['我觉得比平常容易紧张和着急', FREQ_ZUNG],
            ['我无缘无故地感到害怕', FREQ_ZUNG],
            ['我容易心里烦乱或觉得惊恐', FREQ_ZUNG],
            ['我觉得我可能将要发疯', FREQ_ZUNG],
            ['我觉得一切都很好，也不会发生什么不幸', FREQ_ZUNG_REV],
            ['我手脚发抖打颤', FREQ_ZUNG],
            ['我因为头痛、颈痛和背痛而苦恼', FREQ_ZUNG],
            ['我感觉容易衰弱和疲乏', FREQ_ZUNG],
            ['我觉得心平气和，并且容易安静坐着', FREQ_ZUNG_REV],
            ['我觉得心跳得很快', FREQ_ZUNG],
            ['我因为一阵阵头晕而苦恼', FREQ_ZUNG],
            ['我有晕倒发作，或觉得要晕倒似的', FREQ_ZUNG],
            ['我呼气吸气都感到很容易', FREQ_ZUNG_REV],
            ['我手脚麻木和刺痛', FREQ_ZUNG],
            ['我因为胃痛和消化不良而苦恼', FREQ_ZUNG],
            ['我常常要小便', FREQ_ZUNG],
            ['我的手常常是干燥温暖的', FREQ_ZUNG_REV],
            ['我脸红发热', FREQ_ZUNG],
            ['我容易入睡，并且一夜睡得很好', FREQ_ZUNG_REV],
            ['我做噩梦', FREQ_ZUNG]
        ])
    },
    {
        code: 'SDS',
        name: 'SDS 抑郁自评量表',
        category: '抑郁',
        estimatedMinutes: 10,
        intro: 'Zung 抑郁自评量表 20 条目，覆盖情绪低落、晨轻暮重、易哭、睡眠障碍、食欲减退、体重下降、便秘、心悸、易倦、思考困难、能力减退、不安、绝望、易激惹、决断困难、无用感、生活空虚感、无价值感、兴趣丧失等症状维度；按最近一周出现频度计分，第 2、5、6、11、12、14、16、17、18、20 条为反向计分（分值已翻转）。',
        scoreNote: '总分越高表示抑郁自评症状越明显，越需要关注（粗分×1.25 为标准分，53 分为分界）。',
        resultLevels: levels([
            [20, 52, '正常', '抑郁自评症状在正常范围。'],
            [53, 62, '轻度', '存在轻度抑郁症状，建议关注并自我调节。'],
            [63, 72, '中度', '存在中度抑郁症状，建议寻求专业心理支持。'],
            [73, 80, '重度', '存在重度抑郁症状，强烈建议尽快寻求专业帮助。']
        ]),
        items: items([
            ['我感到闷闷不乐，情绪低沉', FREQ_ZUNG],
            ['我觉得一天之中早晨最好', FREQ_ZUNG_REV],
            ['我一阵阵哭出来或觉得想哭', FREQ_ZUNG],
            ['我晚上睡眠不好', FREQ_ZUNG],
            ['我吃得跟平常一样多', FREQ_ZUNG_REV],
            ['我与异性亲密接触时和以往一样感到愉快', FREQ_ZUNG_REV],
            ['我发觉我的体重在下降', FREQ_ZUNG],
            ['我有便秘的苦恼', FREQ_ZUNG],
            ['我的心跳比平时快', FREQ_ZUNG],
            ['我无缘无故地感到疲乏', FREQ_ZUNG],
            ['我的头脑和平时一样清楚', FREQ_ZUNG_REV],
            ['我觉得经常做的事情并没有困难', FREQ_ZUNG_REV],
            ['我觉得不安而平静不下来', FREQ_ZUNG],
            ['我对将来抱有希望', FREQ_ZUNG_REV],
            ['我比平常容易生气激动', FREQ_ZUNG],
            ['我觉得做出决定是容易的', FREQ_ZUNG_REV],
            ['我觉得自己是个有用的人，有人需要我', FREQ_ZUNG_REV],
            ['我的生活过得很有意思', FREQ_ZUNG_REV],
            ['如果我死了，别人会生活得更好些', FREQ_ZUNG],
            ['平常感兴趣的事我仍然照样感兴趣', FREQ_ZUNG_REV]
        ])
    },
    {
        code: 'SES',
        name: 'SES 罗森伯格自尊量表',
        category: '自尊',
        estimatedMinutes: 4,
        intro: 'Rosenberg 编制的 10 条目自尊量表，评定个体整体自我价值感与自我接纳程度；按描述与自身的符合程度计分，第 3、5、8、9、10 条为反向条目（分值已按国内常用版本翻转）。',
        scoreNote: '总分越高表示自尊水平越高；总分偏低提示自我价值感不足、越需要关注。',
        resultLevels: levels([
            [10, 22, '偏低', '自尊水平偏低，容易自我否定，建议关注自我接纳与积极自我对话。'],
            [23, 29, '中等', '自尊水平中等，整体自我评价平稳。'],
            [30, 35, '良好', '自尊水平良好，能够较好地接纳与肯定自己。'],
            [36, 40, '很高', '自尊水平很高，自我价值感稳定。']
        ]),
        items: items([
            ['总的来说，我对自己是一个满意的人', () => opts([['A', '很不符合', 1], ['B', '不符合', 2], ['C', '符合', 3], ['D', '非常符合', 4]])],
            ['我觉得自己有许多优点', () => opts([['A', '很不符合', 1], ['B', '不符合', 2], ['C', '符合', 3], ['D', '非常符合', 4]])],
            ['我总认为自己是一个失败者', () => opts([['A', '很不符合', 4], ['B', '不符合', 3], ['C', '符合', 2], ['D', '非常符合', 1]])],
            ['我和大多数人一样能把事情做好', () => opts([['A', '很不符合', 1], ['B', '不符合', 2], ['C', '符合', 3], ['D', '非常符合', 4]])],
            ['我觉得自己没有什么值得自豪的地方', () => opts([['A', '很不符合', 4], ['B', '不符合', 3], ['C', '符合', 2], ['D', '非常符合', 1]])],
            ['有时我确实感到自己很没用', () => opts([['A', '很不符合', 4], ['B', '不符合', 3], ['C', '符合', 2], ['D', '非常符合', 1]])],
            ['我觉得自己是一个有价值的人，至少不比一般人差', () => opts([['A', '很不符合', 1], ['B', '不符合', 2], ['C', '符合', 3], ['D', '非常符合', 4]])],
            ['我希望能更看得起自己', () => opts([['A', '很不符合', 4], ['B', '不符合', 3], ['C', '符合', 2], ['D', '非常符合', 1]])],
            ['我常常觉得自己很无用', () => opts([['A', '很不符合', 4], ['B', '不符合', 3], ['C', '符合', 2], ['D', '非常符合', 1]])],
            ['我对自己持积极的态度', () => opts([['A', '很不符合', 1], ['B', '不符合', 2], ['C', '符合', 3], ['D', '非常符合', 4]])]
        ])
    },
    {
        code: 'UCLA-3',
        name: 'UCLA 孤独感量表（第三版）',
        category: '社交孤独',
        estimatedMinutes: 10,
        intro: 'Russell 等编制的孤独感量表第三版 20 条目，评价由对社会交往的渴望与实际水平差距而产生的孤独感；按最近一周出现该感觉的频度计分，第 1、5、6、9、10、15、16、19、20 条为反向条目（分值已翻转）。',
        scoreNote: '总分越高表示孤独感越强，越需要关注。',
        resultLevels: levels([
            [20, 30, '较低', '孤独感较低，社交联结状态良好。'],
            [31, 40, '中等', '孤独感处于中等水平，建议保持并拓展社交联系。'],
            [41, 55, '偏高', '孤独感偏高，建议主动增进与他人的联结，必要时寻求支持。'],
            [56, 80, '高', '孤独感明显偏高，建议寻求专业心理支持。']
        ]),
        items: items([
            ['你常感到与周围人的关系和谐吗', FREQ_UCLA_REV],
            ['你常感到缺少伙伴吗', FREQ_UCLA],
            ['你常感到没人可以信赖吗', FREQ_UCLA],
            ['你常感到寂寞吗', FREQ_UCLA],
            ['你常感到属于朋友们中的一员吗', FREQ_UCLA_REV],
            ['你常感到与周围的人有许多共同点吗', FREQ_UCLA_REV],
            ['你常感到与任何人都不亲密了吗', FREQ_UCLA],
            ['你常感到你的兴趣与想法与周围的人不一样吗', FREQ_UCLA],
            ['你常感到想要与人来往、结交朋友吗', FREQ_UCLA_REV],
            ['你常感到与人亲近吗', FREQ_UCLA_REV],
            ['你常感到被人冷落吗', FREQ_UCLA],
            ['你常感到你与别人来往毫无意义吗', FREQ_UCLA],
            ['你常感到没有人很了解你吗', FREQ_UCLA],
            ['你常感到与别人隔开了吗', FREQ_UCLA],
            ['你常感到当你愿意时就能找到伙伴吗', FREQ_UCLA_REV],
            ['你常感到有人真正了解你吗', FREQ_UCLA_REV],
            ['你常感到羞怯吗', FREQ_UCLA],
            ['你常感到人们围着你但并不关心你吗', FREQ_UCLA],
            ['你常感到有人愿意与你交谈吗', FREQ_UCLA_REV],
            ['你常感到有人值得你信赖吗', FREQ_UCLA_REV]
        ])
    },
    {
        code: 'ISI',
        name: 'ISI 失眠严重程度指数',
        category: '睡眠',
        estimatedMinutes: 4,
        intro: '7 条目失眠严重程度指数，评估最近两周入睡困难、睡眠维持困难、早醒的严重程度，对睡眠模式的满意度，以及睡眠问题对日间功能的影响、他人可察觉程度与苦恼程度；各条目按 0~4 分计。',
        scoreNote: '总分 0~28，得分越高表示失眠问题越严重，越需要关注（8/15/22 为轻中重度常用分界）。',
        resultLevels: levels([
            [0, 7, '正常', '目前无临床意义的失眠问题。'],
            [8, 14, '轻度', '存在轻度失眠，建议调整睡眠习惯与作息。'],
            [15, 21, '中度', '存在中度失眠，建议寻求专业评估与干预。'],
            [22, 28, '重度', '存在重度失眠，强烈建议尽快就医评估。']
        ]),
        items: items([
            ['入睡困难的严重程度（入睡所需时间）', ISI_SEVERITY],
            ['睡眠维持困难的严重程度（夜间醒来后难以再入睡）', ISI_SEVERITY],
            ['早醒的严重程度（比期望的时间早醒且无法再入睡）', ISI_SEVERITY],
            ['您对目前睡眠模式的满意程度', ISI_SATISFY],
            ['您认为睡眠问题在多大程度上影响了日间功能（如日间疲劳、注意力、记忆力、情绪、工作或生活能力）', ISI_IMPACT],
            ['您觉得别人在多大程度上能察觉到您因睡眠问题而生活质量受损', ISI_IMPACT],
            ['您对当前睡眠问题的担忧/苦恼程度', ISI_IMPACT]
        ])
    },
    {
        code: 'K10',
        name: 'K10 心理困扰量表',
        category: '总体心理困扰',
        estimatedMinutes: 5,
        intro: 'Kessler 编制的 10 条目非特异性心理困扰筛查量表，覆盖疲乏、紧张、坐立不安、绝望、沮丧、费力感、无价值感与莫名恐惧等维度；按最近一个月的出现频度计分。',
        scoreNote: '总分 10~50，得分越高表示心理困扰越明显，越需要关注。',
        resultLevels: levels([
            [10, 19, '较低', '心理困扰处于较低水平，整体状态平稳。'],
            [20, 24, '轻度', '存在轻度心理困扰，建议关注自身状态变化。'],
            [25, 29, '中度', '存在中度心理困扰，建议寻求专业心理支持。'],
            [30, 50, '重度', '存在重度心理困扰，强烈建议尽快寻求专业帮助。']
        ]),
        items: items([
            ['您是否经常感到疲惫而没有理由', FREQ_K10],
            ['您是否经常感到紧张不安', FREQ_K10],
            ['您是否经常感到非常紧张，以至于无法安定下来', FREQ_K10],
            ['您是否经常感到绝望', FREQ_K10],
            ['您是否经常感到坐立不安或烦躁', FREQ_K10],
            ['您是否经常感到非常沮丧，没有什么能使您高兴起来', FREQ_K10],
            ['您是否经常感到做任何事情都很费力', FREQ_K10],
            ['您是否经常感到自己一无是处', FREQ_K10],
            ['您是否经常无缘无故地感到害怕', FREQ_K10],
            ['您是否经常感到自己可能会失控或精神失常', FREQ_K10]
        ])
    },
    {
        code: 'GDS-15',
        name: 'GDS-15 老年抑郁量表',
        category: '抑郁筛查',
        estimatedMinutes: 4,
        intro: 'Brink & Yesage 编制的 15 条目抑郁筛查量表（成人通用），采用「是/否」二分作答，覆盖情绪满意度、活动兴趣、空虚感、厌烦、精神状态、担忧、快乐感、无助感、社交退缩、记忆、价值感、精力、希望感与比较评价等维度；第 1、5、7、11、13 条为正向条目（回答「否」计 1 分，分值已按此设置）。',
        scoreNote: '总分 0~15，得分越高表示抑郁倾向越明显，越需要关注（5/10 为轻中度常用分界）。',
        resultLevels: levels([
            [0, 4, '正常', '未提示明显抑郁倾向。'],
            [5, 8, '轻度', '存在轻度抑郁倾向，建议关注情绪变化。'],
            [9, 11, '中度', '存在中度抑郁倾向，建议寻求专业心理支持。'],
            [12, 15, '重度', '存在重度抑郁倾向，强烈建议尽快寻求专业帮助。']
        ]),
        items: items([
            ['您对您的生活基本上满意吗', YESNO_POS],
            ['您是否已经放弃了许多以往的活动和爱好', YESNO_NEG],
            ['您是否感到生活空虚', YESNO_NEG],
            ['您是否常常感到厌烦', YESNO_NEG],
            ['大部分时间您精神好吗', YESNO_POS],
            ['您是否害怕将有对您不利的事情发生', YESNO_NEG],
            ['大部分时间您感到快乐吗', YESNO_POS],
            ['您是否常有无助的感觉', YESNO_NEG],
            ['您是否宁愿待在家里，也不愿外出做新鲜事', YESNO_NEG],
            ['您是否觉得您的记忆力比大多数人差', YESNO_NEG],
            ['您是否认为现在活着很精彩', YESNO_POS],
            ['您是否觉得现在的您毫无价值', YESNO_NEG],
            ['您是否感到精力充沛', YESNO_POS],
            ['您是否觉得您的处境没有希望', YESNO_NEG],
            ['您是否认为大多数人的处境比您好', YESNO_NEG]
        ])
    },
    {
        code: 'PHQ-15',
        name: 'PHQ-15 躯体症状自评量表',
        category: '躯体化',
        estimatedMinutes: 5,
        intro: '15 条目躯体症状自评量表，覆盖头颈躯干疼痛（胃腹、背、肢体关节、头痛、胸痛）、自主神经与功能性症状（头晕、晕厥、心慌、气短）、胃肠道症状（便秘腹泻、恶心消化不良）及疲乏、睡眠、月经/性功能等维度；按最近一个月该问题带来的困扰程度计分。',
        scoreNote: '总分 0~30，得分越高表示躯体症状负担越重，越需要关注（5/10/15 为轻中重度常用分界）。',
        resultLevels: levels([
            [0, 4, '正常', '躯体症状负担处于正常范围。'],
            [5, 9, '轻度', '存在轻度躯体症状负担，建议留意身心联动状态。'],
            [10, 14, '中度', '存在中度躯体症状负担，建议寻求专业评估。'],
            [15, 30, '重度', '躯体症状负担较重，强烈建议尽快就医或寻求专业帮助。']
        ]),
        items: items([
            ['胃部或腹部疼痛', FREQ_PHQ15],
            ['背部疼痛', FREQ_PHQ15],
            ['手臂、腿部或关节疼痛（如膝盖、髋部）', FREQ_PHQ15],
            ['痛经或月经期间的其他问题（女性）', FREQ_PHQ15],
            ['头痛', FREQ_PHQ15],
            ['胸部疼痛', FREQ_PHQ15],
            ['头晕', FREQ_PHQ15],
            ['一阵阵的晕厥（昏倒）感', FREQ_PHQ15],
            ['感到心慌或心跳加快', FREQ_PHQ15],
            ['感到透不过气或气短', FREQ_PHQ15],
            ['性生活时疼痛或有问题', FREQ_PHQ15],
            ['便秘、腹泻或大便次数改变', FREQ_PHQ15],
            ['恶心、胀气或消化不良', FREQ_PHQ15],
            ['感到疲乏无力、精力不足', FREQ_PHQ15],
            ['睡眠不好或入睡困难', FREQ_PHQ15]
        ])
    },
    {
        code: 'WHO-5',
        name: 'WHO-5 幸福感指数',
        category: '幸福感',
        estimatedMinutes: 3,
        intro: '世界卫生组织 5 条目幸福感指数，正向评估最近两周的整体身心健康与幸福感状态，覆盖心情、平静、活力、日常兴趣与生活趣味五个维度；按出现该状态的时间频度计分。',
        scoreNote: '本量表为正向计分：总分越高表示幸福感越好；百分制换算（总分×4）低于 27 分提示幸福感差、需要关注。',
        resultLevels: levels([
            [0, 13, '较差', '幸福感偏低（百分制 < 55），提示身心状态需要关注与调适。'],
            [14, 18, '偏低', '幸福感略低，建议关注压力与休息，增加愉悦活动。'],
            [19, 25, '良好', '幸福感良好，整体身心状态积极。']
        ]),
        items: items([
            ['我觉得心情愉悦、精神爽利', FREQ_WHO5],
            ['我觉得平静、放松', FREQ_WHO5],
            ['我觉得充满活力、精力充沛', FREQ_WHO5],
            ['我觉得日常生活充满了有意思的事情', FREQ_WHO5],
            ['我觉得生活中有让我感兴趣的事情', FREQ_WHO5]
        ])
    },
    {
        code: 'MBI-GS',
        name: 'MBI-GS 职业倦怠量表（通用版）',
        category: '职业倦怠',
        estimatedMinutes: 8,
        intro: 'Maslach 职业倦怠量表通用版 16 条目，覆盖情绪耗竭（第 1~5 条）、消极怠慢（第 6~10 条）与职业效能（第 11~16 条）三个维度；按工作中出现该状态的频率计分，适用于在职/在校等有持续性任务负荷的人群。',
        scoreNote: '情绪耗竭与消极怠慢维度得分越高表示倦怠越明显、越需要关注；职业效能维度得分越高表示效能感越好（该维度得分偏低需关注）。',
        resultLevels: levels([
            [0, 31, '较低', '职业倦怠水平较低，工作状态整体良好。'],
            [32, 63, '中等', '职业倦怠处于中等水平，建议关注工作负荷与恢复平衡。'],
            [64, 96, '偏高', '职业倦怠明显偏高，建议调整工作节奏并考虑寻求支持。']
        ]),
        items: items([
            ['工作让我感觉情绪上疲惫不堪', FREQ_MBI],
            ['下班后我感到筋疲力尽', FREQ_MBI],
            ['早晨起床想到又要面对一天的工作时，我就感到很累', FREQ_MBI],
            ['整天忙于工作对我来说压力很大', FREQ_MBI],
            ['我的工作让我感觉快要崩溃了', FREQ_MBI],
            ['自从从事这份工作，我对工作的兴趣越来越低', FREQ_MBI],
            ['我对工作的热情不如从前', FREQ_MBI],
            ['我怀疑自己工作的意义', FREQ_MBI],
            ['我对自己所做的工作是否有贡献越来越不关心', FREQ_MBI],
            ['我对工作变得越来越消极冷淡', FREQ_MBI],
            ['我能有效地处理工作中的问题', FREQ_MBI],
            ['我觉得自己为本职工作作出了积极贡献', FREQ_MBI],
            ['我为自己的工作感到自豪', FREQ_MBI],
            ['我在工作中已经完成了许多有价值的事情', FREQ_MBI],
            ['我自信能有效地完成本职工作中的各项事务', FREQ_MBI],
            ['我觉得自己擅长于本职工作', FREQ_MBI]
        ])
    }
];

// ===== 懒加载建表 + 播种（幂等） =====
let ensured: Promise<void> | null = null;

export function ensureScaleTemplates(): Promise<void> {
    if (!ensured) {
        ensured = (async () => {
            await pool.execute(`
                CREATE TABLE IF NOT EXISTS ai_scale_templates (
                    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    code VARCHAR(50) NOT NULL UNIQUE COMMENT '量表编码，如 PHQ-9',
                    name VARCHAR(100) NOT NULL COMMENT '量表名称',
                    category VARCHAR(50) NOT NULL DEFAULT '' COMMENT '适用领域',
                    estimated_minutes INT NOT NULL DEFAULT 5,
                    intro TEXT NULL COMMENT '量表说明（测评维度/时间范围/计分方式）',
                    score_note VARCHAR(500) NOT NULL DEFAULT '' COMMENT '计分与解读说明（评分时喂给 AI）',
                    result_levels TEXT NULL COMMENT 'JSON: 标准化分级区间 [{min,max,level,desc}]',
                    items MEDIUMTEXT NOT NULL COMMENT 'JSON: 完整真实条目与选项（反向计分已翻转）',
                    seed_ver INT NOT NULL DEFAULT 0,
                    enabled TINYINT NOT NULL DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);
            // 存量库补列（早于 v2 建的表没有 result_levels）
            const [colRows] = await pool.execute(
                `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_scale_templates' AND COLUMN_NAME = 'result_levels'`
            );
            if (Number((colRows as any[])[0]?.c || 0) === 0) {
                await pool.execute("ALTER TABLE ai_scale_templates ADD COLUMN result_levels TEXT NULL COMMENT 'JSON: 标准化分级区间' AFTER score_note");
            }
            const [rows] = await pool.execute('SELECT MAX(seed_ver) AS v FROM ai_scale_templates');
            const current = Number((rows as any[])[0]?.v || 0);
            if (current !== SEED_VERSION) {
                for (const t of SCALE_TEMPLATES) {
                    await pool.execute(
                        `INSERT INTO ai_scale_templates
                         (code, name, category, estimated_minutes, intro, score_note, result_levels, items, seed_ver, enabled)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                         ON DUPLICATE KEY UPDATE
                         name = VALUES(name), category = VALUES(category), estimated_minutes = VALUES(estimated_minutes),
                         intro = VALUES(intro), score_note = VALUES(score_note), result_levels = VALUES(result_levels),
                         items = VALUES(items), seed_ver = VALUES(seed_ver)`,
                        [t.code, t.name, t.category, t.estimatedMinutes, t.intro, t.scoreNote, JSON.stringify(t.resultLevels), JSON.stringify(t.items), SEED_VERSION]
                    );
                }
                console.log(`[ai-scale-templates] 种子数据已同步：${SCALE_TEMPLATES.length} 份真实量表（v${SEED_VERSION}）`);
            }
        })().catch((e) => {
            ensured = null;
            throw e;
        });
    }
    return ensured;
}
