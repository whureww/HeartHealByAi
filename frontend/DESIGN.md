---
name: 心愈 XinYu
description: 深夜台灯下的心理健康桌面应用 —— 暖琥珀唯一强调，晨间暖纸与深夜靛墨双主题
colors:
  paper: "#f3eee5"
  paper-raised: "#fbf8f2"
  paper-sidebar: "#ece4d6"
  card: "#fdfbf6"
  input: "#f6f1e8"
  ink: "#332e27"
  ink-soft: "#6c6357"
  ink-muted: "#9a8f80"
  amber: "#a96a2c"
  amber-deep: "#8a5421"
  amber-soft: "rgba(196, 138, 66, 0.14)"
  glow: "rgba(242, 185, 92, 0.22)"
  on-accent: "#fffdf8"
  night: "#14151c"
  night-raised: "#191a23"
  night-sidebar: "#12131a"
  night-card: "#1c1e28"
  night-input: "#20222d"
  night-ink: "#ede6da"
  night-ink-soft: "#b5ac9e"
  night-ink-muted: "#6e6659"
  night-amber: "#e4a44c"
  night-amber-strong: "#f2b95c"
  night-on-accent: "#22180a"
  success: "#5e7a4e"
  danger: "#b4543e"
  warning: "#b07c2e"
  info: "#5b6e8c"
  bubble-ai: "#f6efe2"
  bubble-user: "#f3e0c3"
typography:
  ui:
    fontFamily: "'Segoe UI', 'Microsoft YaHei UI', 'PingFang SC', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "'Segoe UI', 'Microsoft YaHei UI', 'PingFang SC', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.5
rounded:
  card: "16px"
  bubble: "14px"
  ctl: "10px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "14px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.ctl}"
    padding: "8px 22px"
  button-primary-hover:
    backgroundColor: "{colors.amber-deep}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.ctl}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "24px"
  chat-bubble-ai:
    backgroundColor: "{colors.bubble-ai}"
    textColor: "{colors.ink}"
    rounded: "14px 14px 14px 4px"
    padding: "10px 14px"
  chat-bubble-user:
    backgroundColor: "{colors.bubble-user}"
    textColor: "{colors.ink}"
    rounded: "14px 14px 4px 14px"
    padding: "10px 14px"
---

# Design System: 心愈 XinYu

## Overview

**Creative North Star: "深夜台灯"**

整个界面是一盏台灯照亮的暗处：暖琥珀光是屏幕上唯一的光源色，纸与墨承担其余一切。亮色主题是"晨间暖纸"——被天光洗过的米色纸面；暗色主题是"深夜靛墨"——靛蓝黑夜里被灯芯照亮的卡片。两者不是简单反色，而是同一盏灯在一天中两个时刻的样子。视觉上刻意拒绝心理健康产品的两个行业默认：临床白墙的冰冷感，与直白的"月亮蓝"夜色。

这是桌面应用，不是网页：信息密度、控件质感、自绘标题栏（38px 高）都向原生看齐。界面永远退后，对话气泡、量表、报告是主角；品牌只出现在精确的细节里——月牙托心的标识、台灯光晕的氛围层、暖色温的阴影。

**Key Characteristics:**
- 暖琥珀（亮 #A96A2C / 暗 #E4A44C）是全局唯一强调色
- 双主题同等公民：对比度、光晕、阴影色温在两套主题下各自成立
- 弥散光晕 + 暗角作氛围层（`--lamp-layer` / `--lamp-floor` / `--lamp-vignette`），永不高饱和
- 全部图标为 1.5px 圆头细线内联 SVG（AppIcon 组件），零 emoji
- 系统级中文 UI 字体栈 + `tabular-nums` 数字

## Colors

一句话：被灯光染暖的纸墨色系，琥珀光点到为止。

### Primary
- **灯芯琥珀 Amber** (#A96A2C，暗色 #E4A44C)：唯一强调色。主按钮、激活态、焦点环、在线标记、品牌标识。它的稀缺性就是它的力量——任何一屏占比 ≤10%。
- **灯芯琥珀·深** (#8A5421，暗色 #F2B95C)：琥珀的 hover/按下态，亮色向深走，暗色向亮走（暗夜里更亮 = 更近灯光）。

### Secondary
- **语义四色**（Success #5E7A4E / Danger #B4543E / Warning #B07C2E / Info #5B6E8C；暗色各提亮一档）：仅用于状态反馈，不做装饰。全部是低饱和的"墨水色"，不是糖果色。

### Neutral
- **暖纸 Paper** (#F3EEE5 / 侧栏 #ECE4D6)：亮色主题的地面。
- **卡片白 Card** (#FDFBF6)：亮色主题的浮起面，比纸更亮半度。
- **墨 Ink** (#332E27 / 次 #6C6357 / 弱 #9A8F80)：三级文字阶。所有灰都带暖棕底色，禁用中性灰。
- **深夜靛墨 Night** (#14151C / 卡片 #1C1E28 / 侧栏 #12131A)：暗色主题的地面与浮起面，靛蓝基底的近黑。
- **夜墨 Ink**（暗色 #EDE6DA / 次 #B5AC9E / 弱 #6E6659）：暗色三级文字阶，暖米色而非冷白。
- **边框**（亮 rgba(51,46,39,0.1) / 暗 rgba(237,230,218,0.09)）：永远接近隐形的细线。

### Named Rules
**「一盏灯」Rule.** 暖琥珀是唯一强调色，永不出现第二个彩色 accent。语义四色只在状态语义出现，不许参与品牌表达。

**「墨带暖底」Rule.** 一切中性色（文字、边框、阴影）都带暖棕或暖米底色，禁用纯黑、纯白与冷灰——纸和墨在灯光下没有一个是冷的。

## Typography

**UI Font:** 'Segoe UI' → 'Microsoft YaHei UI' → 'PingFang SC' → system-ui（系统栈，无外部字体加载）
**Character:** 系统字体是刻意选择：桌面原生感、零加载成本、中文渲染由系统调优。个性全部交给字号阶、字重与 tabular-nums 数字。

### Hierarchy
- **标题**（600，17–20px，1.4）：卡片/页面标题，`<h2>`/`<h3>`。
- **小标题**（600，15px，1.5）：分组标题、空态主句。
- **正文**（400，14px，1.6）：对话气泡、说明文字、列表。
- **标签/辅助**（400，13px，1.5）：按钮小字、侧栏菜单、元信息。
- **弱化说明**（400，12.5px，1.7）：空态副文案、提示语。

### Named Rules
**「数字对齐」Rule.** 一切统计数字（测评分数、咨询次数）使用 `tabular-nums`，数字列永不跳动。

## Layout

桌面固定窗口形态（1024×700 起，1280×820 常规），不做移动端适配。空间模型：

- **自绘标题栏 38px**：全窗口顶部，bg-sidebar 底 + 细边框；所有视口高度以 `calc(100vh - 38px)` 起算。
- **左侧导航 224px**：侧栏（bg-sidebar）含品牌区、菜单、底部用户条；主内容区占余宽。
- **内容卡片 max-width 900px**：卡片永远不满铺，居中或贴左，留出呼吸。
- **密度**：卡片内边距 24px，控件间距 8/14px 两档，行高 1.6——中密度桌面节奏，不追求信息轰炸。
- **滚动**：8px 细滚动条（thumb = border-strong，hover = ink-muted），track 透明。

## Elevation & Depth

深度 = 光。三层氛围（`::before` 一次性合成）：顶部台灯光晕（`--lamp-layer`，1200px 弥散径向渐变）、地面反光（`--lamp-floor`）、四角暗角（`--lamp-vignette`）。卡片阴影永远是暖色温的软阴影，带 y 偏移、无 x 偏移。

### Shadow Vocabulary
- **shadow-sm**（`0 1px 2px rgba(84,58,22,0.05), 0 1px 3px rgba(84,58,22,0.07)`；暗色 `rgba(24,14,2,…)`）：卡片静息态。
- **shadow-md**（`0 2px 4px …, 0 8px 20px rgba(84,58,22,0.09)`）：下拉、悬浮控件。
- **shadow-lg**（`0 4px 8px rgba(84,58,22,0.05), 0 18px 44px rgba(84,58,22,0.14)`；暗色 `0 20px 48px rgba(26,15,2,0.68)`）：登录卡、模态。
- **glow**（`0 0 28px rgba(242,185,92,0.22)`，暗色 0.12）：品牌标识、空态月牙的光晕，只给"灯"本身。

### Named Rules
**「暖影」Rule.** 阴影永远带暖色温：亮色用棕黑 rgba(84,58,22,*)，暗色用深褐 rgba(26,15,2,*)。禁用中性纯黑阴影——灯下的影子不是冷的。

## Shapes

圆润但克制：卡片 16px 圆角是系统里最大的圆，控件 10px，头像/标记用胶囊 999px。对话气泡 14px，并带 4px 的"来源角"（AI 气泡左下 4px，用户气泡右下 4px）——气泡的尖锐一角指向说话者。边框语言：1px 近隐形细线（border-color），需要强调时用 border-strong。图标线条 1.5px 圆头，与圆角语言同族。

## Components

### Buttons
- **Shape:** 10px 圆角，内联 SVG 图标 + 文案组合（gap 6px）。
- **Primary:** 琥珀底 + on-accent 文字（padding 8px 22px），hover 加深一档（amber-deep），0.2s ease-out。
- **Ghost:** 透明底 + ink-soft 文字 + 1px border（padding 8px 16px），hover 背景浮起。
- **Disabled:** opacity 0.55 + not-allowed，不做灰色重绘。
- **Focus:** 全局 `:focus-visible` = 2px 琥珀 outline + 2px offset。

### Cards / Containers
- **Corner Style:** 16px。
- **Background:** card-bg（亮 #FDFBF6 / 暗 #1C1E28）。
- **Shadow Strategy:** shadow-sm 静息；shadow-lg 只给登录卡与模态。
- **Border:** 1px border-color 细线。
- **Internal Padding:** 24px。

### Inputs / Fields
- **Style:** input-bg 底、1px border-color、10px 圆角、padding 10–12px。
- **Focus:** 边框转琥珀 + `--accent-soft` 外发光；浮动标签（placeholder=" " 技法）上浮缩小。
- **Error:** shake 动画一次 + 标签转 danger 红，3s 后自动复位——错误是提醒，不是审判。

### Navigation
- **侧栏**：bg-sidebar 底，菜单项 = 图标 + 文字（17px 图标），静息 ink-soft，hover 微浮起，激活 = `--accent-soft` 底 + 琥珀文字 + 左侧无指示条（用底色说话）。
- **标题栏**：38px，左起品牌月牙 mark + 应用名，右端三个 46px 矩形 caption 按钮（最小化/最大化/关闭），关闭悬停转 danger 红底。

### 对话气泡（Signature Component）
- **AI:** msg-ai-bg 底，圆角 `14px 14px 14px 4px`，左下尖角指向 AI；max-width 68%；流式输出时带 glow 呼吸。
- **用户:** msg-user-bg 底（暖琥珀染），圆角 `14px 14px 4px 14px`，右下尖角指向用户。
- **空态:** 月牙图标 glow + 温和文案（"报告会在台灯下等你"）——空状态是陪伴，不是报错。

## Do's and Don'ts

### Do:
- **Do** 图标一律用 AppIcon 内联 SVG（1.5px 圆头细线，20px 视窗），新增图标先查 LIB 再补绘。
- **Do** 双主题同步验证：任何新界面在亮暗两套主题下截图对比度都成立才算完成。
- **Do** 激活态用 `--accent-soft` 底色 + 琥珀文字表达，阴影只表达高程不表达状态。
- **Do** 数字统计用 tabular-nums；时间、分数、次数排版对齐。
- **Do** 空态文案温和、去污名化，配月牙/灯的 glow 意象。

### Don't:
- **Don't** 使用 emoji 作任何界面图标（品牌承诺，PRODUCT.md 已锁）。
- **Don't** 引入第二个彩色强调色；"月亮蓝"是明确的视觉反参考。
- **Don't** 使用纯黑/冷灰文字、边框或阴影；一切中性色带暖底。
- **Don't** 让卡片铺满视口或内容顶到边（卡片 max-width 900px、内边距 24px）。
- **Don't** 高饱和渐变、玻璃拟态、霓虹发光——灯光是弥散的，不是 LED 的。

<!-- 不收进系统规则：聊天气泡的 float 实现与各视图 calc(100vh - 38px) 的硬编码，
属实现层遗留，后续应统一为布局变量；它们是缺陷记录，不是设计规范。 -->
