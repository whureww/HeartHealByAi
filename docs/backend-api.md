# 心愈心理健康平台 后端接口文档

> 文档基于 `backend/src` 源码整理（路由：`index.ts`、`routes/users.ts`、`routes/auth.ts`、`routes/tests.ts`、`routes/admin.ts`、`routes/expert.ts`、`routes/ai.ts`、`routes/moderation.ts`；中间件：`middleware/auth.ts`、`middleware/error.ts`）。
> 文档更新日期：2026-10-12

## 目录

1. [概述](#1-概述)
2. [通用说明](#2-通用说明)
3. [基础接口](#3-基础接口)
4. [认证与账号](#4-认证与账号)
5. [用户数据与记录](#5-用户数据与记录)
6. [心理测评](#6-心理测评)
7. [预约与咨询](#7-预约与咨询)
8. [AI 服务](#8-ai-服务)
9. [内容审核](#9-内容审核)
10. [管理后台](#10-管理后台)
11. [实时通信 Socket.IO](#11-实时通信-socketio)

---

## 1. 概述

### 1.1 基础信息

| 项目 | 说明 |
| --- | --- |
| 技术栈 | Express + TypeScript + MySQL + Redis + Socket.IO |
| 服务入口 | `backend/src/index.ts` |
| 监听端口 | `3001`（环境变量 `PORT` 可覆盖） |
| 本地基础地址 | `http://localhost:3001` |
| 云端基础地址 | `http://your-server-ip:3001` |
| 协议 | HTTP/1.1（REST）+ WebSocket（Socket.IO 实时通道） |
| 版本策略 | 无版本前缀，路由直接挂载在 `/api/...` 下 |
| 请求体格式 | `application/json`（请求体大小限制 5MB，用于支持 base64 头像上传） |

### 1.2 路由总览

| 前缀 | 挂载文件 | 说明 |
| --- | --- | --- |
| `/api/users` | `routes/users.ts` | 用户账号、资料、数据记录、预约、举报 |
| `/api/auth` | `routes/auth.ts` | 图形验证码、短信登录、OAuth 登录 |
| `/api/tests` | `routes/tests.ts` | 心理测评（常规量表 + AI 智能测评） |
| `/api/admin` | `routes/admin.ts` | 管理后台（仅管理员） |
| `/api/expert` | `routes/expert.ts` | 专家工作台（名片、预约、聊天） |
| `/api/ai` | `routes/ai.ts` | AI 对话与报告生成 |
| `/api/moderation` | `routes/moderation.ts` | 聊天内容预检 |
| `/health`、`/test-cors` | `index.ts` | 基础探活接口 |

### 1.3 统一响应格式

绝大多数接口返回如下 JSON 结构（见 `middleware/error.ts` 与各路由 `res.json()`）：

成功响应：

```json
{
  "success": true,
  "message": "可选的操作结果描述",
  "data": {}
}
```

- `success`：布尔值，标识业务是否成功。
- `message`：可选，操作结果的人类可读描述（并非所有成功响应都携带，以各接口示例为准）。
- `data`：可选，业务数据，可能是对象、数组或标量。

失败响应（由全局错误处理中间件 `errorHandler` 输出）：

```json
{
  "success": false,
  "message": "错误描述",
  "stack": "仅非 production 环境返回，生产环境该字段为 undefined（不序列化）"
}
```

> 例外：`/api/ai` 三个接口的校验失败/服务错误使用 `error` 字段而非 `message`（见第 8 章）；部分路由内部捕获异常时返回 `{ "error": "..." }`（如 `GET /api/admin/stats`、`GET /api/expert/stats` 的兜底分支）。

### 1.4 认证方式

采用 JWT Bearer Token：

```
Authorization: Bearer <token>
```

- Token 由登录/注册接口签发，签名算法 HS256，载荷为 `{ userId, onlyId }`，有效期 7 天。
- `onlyId` 为 32 位十六进制随机串（Redis 会话标识），用于单点登录：同一用户新登录会生成新 `onlyId`，旧 Token 在下次请求时返回 401（`SESSION_EXPIRED`）。
- 登出与刷新 Token 会将旧 Token 加入 Redis 黑名单，黑名单中的 Token 一律拒绝。
- 未携带、格式错误或无效的 Token 将返回 401（详见 2.2）。

### 1.5 角色说明

| role 值 | 角色 | 说明 |
| --- | --- | --- |
| 1 | 普通用户 | 注册默认角色，可测评、预约、咨询聊天 |
| 2 | 专家 | 拥有专家工作台权限（名片、预约管理），由管理员创建账号或修改角色获得 |
| 3 | 管理员 | 拥有管理后台全部权限，只能通过数据库手动提升（注册接口固定写入 role=1） |

---

## 2. 通用说明

### 2.1 错误码约定

业务错误通过 `BusinessError(message, statusCode)` 抛出，由全局中间件统一转换为 JSON 响应。常见 HTTP 状态码：

| 状态码 | 含义 | 典型场景 |
| --- | --- | --- |
| 200 | 成功 | 所有成功响应（未显式设置状态码，默认 200） |
| 400 | 参数或业务校验失败 | Zod 校验失败、字段缺失、状态不允许操作、消息被审核拦截 |
| 401 | 未认证 | 未登录、Token 无效/过期、Token 在黑名单、账号密码错误 |
| 403 | 无权限 | 角色不符（非管理员/非专家）、账号被封禁 |
| 404 | 资源不存在 | 数据不存在、路由未匹配（`Not found - <url>`） |
| 409 | 冲突 | 重复预约、邮箱已被注册（管理端新建用户） |
| 429 | 请求过于频繁 | 验证码发送限流（60 秒窗口） |
| 500 | 服务器内部错误 | 未捕获异常、测评记录初始化失败 |
| 502 | 上游服务异常 | AI 生成的问卷不完整 |
| 503 | 上游服务不可用 | AI 评分服务繁忙 |

Zod 校验失败时（`errorHandler` 中处理），状态码为 400，`message` 为各字段错误信息以 `", "` 连接，例如：

```json
{
  "success": false,
  "message": "请输入有效的邮箱地址, 密码至少6个字符",
  "stack": "..."
}
```

### 2.2 认证中间件的错误细分（401）

`middleware/auth.ts` 的 `authenticate` 中间件可能返回以下 401 响应：

| message | 场景 |
| --- | --- |
| `未登录` | 请求头缺少 `Authorization: Bearer` 前缀 |
| `登录已失效，请重新登录` | Token 已在黑名单（登出/刷新后旧 Token） |
| `您的账号已在其他设备登录`（附 `code: "SESSION_EXPIRED"`） | 单点登录被顶号：Token 有效但 `onlyId` 与 Redis 中当前映射不一致 |
| `用户不存在` | Token 有效但用户已从数据库删除 |
| `登录已过期` | JWT 校验失败（过期、签名错误等） |

`SESSION_EXPIRED` 响应示例：

```json
{
  "success": false,
  "message": "您的账号已在其他设备登录",
  "code": "SESSION_EXPIRED"
}
```

### 2.3 分页参数约定

目前仅管理后台用户列表接口支持分页（`GET /api/admin/users`）：

| 参数 | 位置 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- | --- |
| page | query | number | 否 | 1 | 页码，从 1 开始 |
| pageSize | query | number | 否 | 20 | 每页条数 |
| keyword | query | string | 否 | 空 | 模糊匹配用户名/邮箱/手机号 |

分页响应统一为 `{ list, total, page, pageSize }`。

其余列表接口（聊天记录、测评历史、预约列表、举报列表等）不分页，全量返回；举报列表上限 200 条。

### 2.4 通用业务枚举

| 枚举 | 取值 |
| --- | --- |
| 用户角色 role | 1=普通用户，2=专家，3=管理员 |
| 用户账号状态 status | 0=正常，1=禁言，2=封禁；`restricted_until` 为 NULL 表示永久，到期自动解除 |
| 预约状态 status | `pending` 待确认，`confirmed` 已确认，`rejected` 已拒绝，`cancelled` 已取消，`completed` 已完成 |
| 专家名片状态 status | 0=下架/未通过，1=上架，2=待审核 |
| 问卷状态 status | 0=未上架，1=已上架，2=已下架 |
| 举报状态 status | 0=待处理，1=已处理，2=已驳回 |
| 敏感词分类 category | `侮辱`、`色情`、`违禁`、`自伤`、`缩写`、`其他` |
| 处置时长 duration | `24h`、`72h`、`7d`；未传或其他值表示永久 |

### 2.5 限流与验证码

| 项目 | 规则 |
| --- | --- |
| 注册验证码发送 | 同一邮箱 60 秒内仅允许 1 次（超出返回 429）；验证码 6 位数字，10 分钟有效 |
| 找回密码验证码发送 | 同一邮箱 60 秒限流；验证码 6 位数字，10 分钟有效；邮箱未注册时也返回成功（不暴露注册状态） |
| 短信验证码发送 | 需先通过图形验证码校验；同一手机号 60 秒限流；验证码 6 位数字，5 分钟有效 |
| 图形验证码 | 4 位数字 SVG 图片，5 分钟有效，验证一次后立即失效 |
| 邮件开发模式 | 未配置 SMTP 环境变量时不真实发信，验证码打印到后端日志，接口 message 为 `验证码已生成（开发模式，见后端日志）` |

---

## 3. 基础接口

### 3.1 GET /health

服务健康检查。无需认证。

响应示例：

```json
{
  "name": "Server1",
  "time": "2026-10-12T08:00:00.000Z"
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| name | string | 服务名，固定为 `Server1` |
| time | string | 当前服务器时间（ISO 8601） |

### 3.2 GET /test-cors

CORS 连通性测试。无需认证。

响应示例：

```json
{
  "message": "CORS OK"
}
```

---

## 4. 认证与账号

本章覆盖 `/api/users` 中账号相关接口与 `/api/auth` 全部接口。

### 4.1 POST /api/users/register/send-code

发送注册验证码。无需认证。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| email | string | 是 | 有效邮箱地址 |

响应示例（正常发信）：

```json
{
  "success": true,
  "message": "验证码已发送至邮箱"
}
```

响应示例（该邮箱已有未过期验证码）：

```json
{
  "success": true,
  "message": "验证码已发送，请检查邮箱"
}
```

响应示例（开发模式，未配置 SMTP）：

```json
{
  "success": true,
  "message": "验证码已生成（开发模式，见后端日志）"
}
```

可能的错误：

| 状态码 | message | 说明 |
| --- | --- | --- |
| 400 | `邮箱已被注册` | 该邮箱已存在账号 |
| 400 | Zod 字段错误 | 邮箱格式不合法 |
| 429 | `请求过于频繁，请稍后再试` | 60 秒限流窗口内重复请求 |
| 500 | `邮件发送失败，请稍后重试` | SMTP 发信异常 |

### 4.2 POST /api/users/register

邮箱注册。无需认证。角色由服务端固定为 1（普通用户）。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| username | string | 是 | 用户名，至少 2 个字符 |
| email | string | 是 | 有效邮箱地址 |
| password | string | 是 | 密码，至少 6 个字符 |
| code | string | 是 | 6 位邮箱验证码 |
| phone | string | 否 | 手机号，需匹配 `^1[3-9]\d{9}$` |

响应示例：

```json
{
  "success": true,
  "message": "注册成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "onlyId": "a1b2c3d4e5f60718293a4b5c6d7e8f90",
    "userId": 12,
    "role": 1
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| data.token | string | JWT 访问令牌 |
| data.onlyId | string | 会话唯一标识（单点登录凭据） |
| data.userId | number | 新用户 ID |
| data.role | number | 角色，固定为 1 |

可能的错误：

| 状态码 | message |
| --- | --- |
| 400 | `验证码错误或已过期` / `邮箱已被注册` / `手机号已被注册` / `用户名已被使用` / Zod 字段错误 |

### 4.3 POST /api/users/login

邮箱密码登录。无需认证。封禁中的账号禁止登录（禁言不影响登录）。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| email | string | 是 | 有效邮箱地址 |
| password | string | 是 | 密码 |

响应示例：

```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "onlyId": "a1b2c3d4e5f60718293a4b5c6d7e8f90",
    "userId": 12,
    "role": 1,
    "user": {
      "id": 12,
      "username": "张三",
      "email": "zhangsan@example.com",
      "phone": "13800138000",
      "avatar": null,
      "role": 1
    }
  }
}
```

可能的错误：

| 状态码 | message | 说明 |
| --- | --- | --- |
| 401 | `邮箱或密码错误` | 账号不存在或密码错误（同一文案，不区分暴露） |
| 403 | 封禁提示语 | 账号处于封禁状态，文案形如 `您的账号已被管理员封禁（...），期间无法登录和使用` |

### 4.4 POST /api/users/master-login

管理员万能钥匙解锁。无需认证（以请求体中的管理员凭据鉴权）。用于锁屏场景：验证管理员身份后为被锁定的原账户重新签发 Token，使其无需原密码即可恢复会话。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| admin_email | string | 是 | 管理员邮箱（须为 role=3 账号） |
| admin_password | string | 是 | 管理员密码 |
| email | string | 是 | 需要解锁的目标账户邮箱 |

响应示例（结构与登录一致）：

```json
{
  "success": true,
  "message": "解锁成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "onlyId": "a1b2c3d4e5f60718293a4b5c6d7e8f90",
    "userId": 12,
    "role": 1,
    "user": {
      "id": 12,
      "username": "张三",
      "email": "zhangsan@example.com",
      "phone": null,
      "avatar": null,
      "role": 1
    }
  }
}
```

可能的错误：

| 状态码 | message | 说明 |
| --- | --- | --- |
| 400 | `参数不完整` | 任一必填字段缺失 |
| 401 | `管理员验证失败` | 管理员不存在、非 role=3 或密码错误 |
| 404 | `账户不存在` | 目标邮箱未注册 |

### 4.5 POST /api/users/logout

退出登录。需要认证。当前 Token 加入黑名单，Redis 会话映射删除，并断开该用户全部 Socket 连接、广播离线状态。

请求体：无。

响应示例：

```json
{
  "success": true,
  "message": "登出成功"
}
```

### 4.6 POST /api/users/refresh-token

刷新 Token。需要认证。旧 Token 加入黑名单，签发新 Token 与新 `onlyId`。

请求体：无。

响应示例：

```json
{
  "success": true,
  "message": "Token刷新成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "onlyId": "0f9e8d7c6b5a4321fedcba9876543210",
    "userId": 12,
    "role": 1
  }
}
```

可能的错误：

| 状态码 | message |
| --- | --- |
| 404 | `用户不存在` |

### 4.7 POST /api/users/forget-password/send-code

发送找回密码验证码。无需认证。邮箱未注册时同样返回成功（不暴露注册状态）。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| email | string | 是 | 有效邮箱地址 |

响应示例（邮箱已注册且正常发信）：

```json
{
  "success": true,
  "message": "验证码已发送至邮箱"
}
```

响应示例（邮箱未注册）：

```json
{
  "success": true,
  "message": "如果该邮箱已注册，验证码将发送至您的邮箱"
}
```

其余 message 取值同 4.1（已有验证码 / 开发模式）。可能的错误同 4.1（无 `邮箱已被注册`）。

### 4.8 POST /api/users/forget-password/reset

重置密码。无需认证。成功后该用户所有旧会话立即失效，需重新登录。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| email | string | 是 | 有效邮箱地址 |
| code | string | 是 | 6 位验证码 |
| newPassword | string | 是 | 新密码，至少 6 个字符 |

响应示例：

```json
{
  "success": true,
  "message": "密码重置成功，请使用新密码重新登录"
}
```

可能的错误：

| 状态码 | message |
| --- | --- |
| 400 | `验证码错误或已过期` / Zod 字段错误 |

### 4.9 PUT /api/users/profile

修改昵称与 base64 头像。需要认证。两个字段至少传一个。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| username | string | 否 | 新昵称，去除首尾空格后长度 2-20 个字符，不可与他人重复 |
| avatar | string | 否 | base64 图片，须以 `data:image/` 开头；传空字符串表示清除头像 |

响应示例：

```json
{
  "success": true,
  "message": "个人信息更新成功"
}
```

可能的错误：

| 状态码 | message |
| --- | --- |
| 400 | `昵称长度需在2-20个字符之间` / `该昵称已被使用` / `头像格式错误` / `没有要更新的字段` |

### 4.10 PUT /api/users/avatar

仅修改头像路径。需要认证。与 4.9 不同，此处存的是路径字符串（由前端上传后获得），不做 base64 校验。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| avatarPath | string | 是 | 头像路径，不能为空 |

响应示例：

```json
{
  "success": true,
  "message": "头像修改成功",
  "data": {
    "avatar": "/uploads/avatar/12.png"
  }
}
```

可能的错误：

| 状态码 | message |
| --- | --- |
| 400 | `头像路径不能为空` |

### 4.11 GET /api/users/me

获取当前登录用户信息（含头像）。需要认证。

响应示例：

```json
{
  "success": true,
  "data": {
    "id": 12,
    "username": "张三",
    "email": "zhangsan@example.com",
    "phone": "13800138000",
    "role": 1,
    "avatar": "data:image/png;base64,...",
    "created_at": "2026-01-01T00:00:00.000Z"
  }
}
```

可能的错误：

| 状态码 | message |
| --- | --- |
| 404 | `用户不存在` |

### 4.12 GET /api/users/info

获取当前用户信息（含头像路径）。需要认证。与 4.11 字段基本一致，头像通常为路径。

响应示例：

```json
{
  "success": true,
  "data": {
    "id": 12,
    "username": "张三",
    "email": "zhangsan@example.com",
    "phone": "13800138000",
    "avatar": "/uploads/avatar/12.png",
    "role": 1,
    "created_at": "2026-01-01T00:00:00.000Z"
  }
}
```

可能的错误：

| 状态码 | message |
| --- | --- |
| 404 | `用户不存在` |

### 4.13 GET /api/users/profile

获取当前用户完整信息（不含 created_at）。需要认证。

响应示例：

```json
{
  "success": true,
  "data": {
    "id": 12,
    "username": "张三",
    "email": "zhangsan@example.com",
    "phone": "13800138000",
    "avatar": "/uploads/avatar/12.png",
    "role": 1
  }
}
```

可能的错误：

| 状态码 | message |
| --- | --- |
| 404 | `用户不存在` |

### 4.14 GET /api/auth/captcha

获取图形验证码。无需认证。响应为 SVG 图片，验证码 ID 通过响应头下发。

响应：`Content-Type: image/svg+xml`，响应头 `X-Captcha-Id: captcha:<时间戳>:<随机数>`。

请求示例：

```
GET /api/auth/captcha
```

说明：验证码为 4 位数字，5 分钟有效；`captchaId` 与用户输入的 4 位 `captchaCode` 配合用于短信验证码发送接口的校验（4.15）。

### 4.15 POST /api/auth/sms-code

发送短信验证码。无需认证。需先通过图形验证码校验。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| phone | string | 是 | 手机号，匹配 `^1[3-9]\d{9}$` |
| captchaId | string | 是 | 图形验证码 ID（来自 4.14 响应头） |
| captchaCode | string | 是 | 图形验证码内容，4 位 |

响应示例：

```json
{
  "success": true,
  "message": "验证码已发送"
}
```

非 production 环境额外返回 `debugCode` 字段（生产环境不回传验证码）：

```json
{
  "success": true,
  "message": "验证码已发送",
  "debugCode": "123456"
}
```

可能的错误：

| 状态码 | message | 说明 |
| --- | --- | --- |
| 400 | `图形验证码错误或已过期` / Zod 字段错误 | |
| 429 | `发送过于频繁，请60秒后再试` | 同一手机号 60 秒限流 |

### 4.16 POST /api/auth/sms-login

短信验证码登录（未注册手机号自动注册，用户名为 `user_<手机号后四位>`）。无需认证。封禁账号禁止通过短信登录。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| phone | string | 是 | 手机号，匹配 `^1[3-9]\d{9}$` |
| code | string | 是 | 6 位短信验证码 |

响应示例：

```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "onlyId": "a1b2c3d4e5f60718293a4b5c6d7e8f90",
    "userId": 33,
    "role": 1,
    "username": "user_8000",
    "isNewUser": true
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| data.username | string | 用户名（新注册为 `user_<手机号后四位>`） |
| data.isNewUser | boolean | 本次登录是否为新注册 |

可能的错误：

| 状态码 | message |
| --- | --- |
| 400 | `验证码错误或已过期` / Zod 字段错误 |
| 403 | 封禁提示语（同 4.3） |

### 4.17 GET /api/auth/oauth/:provider

获取第三方 OAuth 授权跳转地址。无需认证。`provider` 仅支持 `wechat`（微信）与 `qq`。

路径参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| provider | string | `wechat` 或 `qq` |

响应示例：

```json
{
  "success": true,
  "data": {
    "authUrl": "https://open.weixin.qq.com/connect/qrconnect?appid=..."
  }
}
```

可能的错误：

| 状态码 | message |
| --- | --- |
| 400 | `不支持的登录方式` |

### 4.18 GET /api/auth/oauth/callback/:provider

OAuth 回调。无需认证（由第三方平台跳转触发）。使用授权码换取用户信息并登录/注册，最终 302 重定向至前端回调页。

路径参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| provider | string | `wechat` 或 `qq` |

Query 参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| code | string | 是 | 第三方平台授权码 |

响应：重定向至 `${FRONTEND_URL}/oauth/callback?token=<token>&onlyId=<onlyId>&isNewUser=<true|false>`。

可能的错误：

| 状态码 | message |
| --- | --- |
| 400 | `授权失败，未获取到授权码` |

---

## 5. 用户数据与记录

本章为 `/api/users` 中的数据类接口，全部需要认证。

### 5.1 GET /api/users/stats

获取当前用户统计数据（各业务记录条数）。需要认证。

响应示例：

```json
{
  "success": true,
  "data": {
    "chatCount": 12,
    "testCount": 3,
    "doctorCount": 2,
    "reportCount": 1
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| data.chatCount | number | AI 聊天记录条数（chat_records） |
| data.testCount | number | 测评完成次数（test_results） |
| data.doctorCount | number | 预约记录条数（appointment_records） |
| data.reportCount | number | 分析报告份数（analysis_reports） |

### 5.2 GET /api/users/chat-history

获取当前用户 AI 聊天记录（按时间正序）。需要认证。

响应示例：

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "content": "最近总是睡不好",
      "type": "user",
      "created_at": "2026-10-01T10:00:00.000Z"
    }
  ]
}
```

### 5.3 POST /api/users/chat

保存一条 AI 聊天记录。需要认证。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| content | string | 是 | 消息内容 |
| type | string | 是 | 消息类型（如 `user` / `ai`，由前端约定） |

响应示例：

```json
{
  "success": true,
  "data": {
    "id": 13
  }
}
```

### 5.4 GET /api/users/tests

获取已上架的心理测评列表（排除 AI 智能量表 `AI-GEN`）。需要认证。

响应示例：

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "SCL-90",
      "name": "症状自评量表",
      "description": "综合性心理健康自评量表",
      "category": "综合",
      "total_questions": 90,
      "estimated_minutes": 15,
      "scoring_method": "sum"
    }
  ]
}
```

### 5.5 GET /api/users/doctors

获取上架中的专家列表。需要认证。

响应示例：

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "李医生",
      "title": "国家二级心理咨询师",
      "specialty": "焦虑、抑郁方向",
      "intro": "从业十年……",
      "user_id": 5,
      "avatar": "/uploads/avatar/5.png"
    }
  ]
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| data[].user_id | number | 专家关联的系统用户 ID（用于聊天/在线状态） |
| data[].avatar | string/null | 专家账号头像（users 表），可能为 null |

### 5.6 POST /api/users/analysis-report

保存一份心理分析报告。需要认证。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| startDate | string | 是 | 报告起始日期 |
| endDate | string | 是 | 报告结束日期 |
| content | string | 是 | 报告内容（Markdown 文本，通常来自 8.3 接口） |

响应示例：

```json
{
  "success": true,
  "data": {
    "id": 7
  }
}
```

### 5.7 GET /api/users/analysis-reports

获取当前用户分析报告列表（按创建时间倒序）。需要认证。

响应示例：

```json
{
  "success": true,
  "data": [
    {
      "id": 7,
      "start_date": "2026-10-01",
      "end_date": "2026-10-07",
      "content": "## 心理状态分析报告……",
      "created_at": "2026-10-08T02:00:00.000Z"
    }
  ]
}
```

### 5.8 POST /api/users/clear-all

清空当前用户所有业务数据（AI 聊天记录、测评结果、分析报告、预约记录）。需要认证。不可恢复。

请求体：无。

响应示例：

```json
{
  "success": true,
  "message": "所有数据已清空"
}
```

---

## 6. 心理测评

本章为 `/api/tests` 接口，除特殊说明外均需要认证（任意角色）。

### 6.1 GET /api/tests/list

获取测评列表。需要认证。与 5.4 返回内容一致（已上架且排除 `AI-GEN`）。

响应示例：同 5.4。

### 6.2 GET /api/tests/questions/:testId

获取某个测评的详情与题目。需要认证。

路径参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| testId | number | 测评 ID（数字，非数字返回 400） |

响应示例：

```json
{
  "success": true,
  "data": {
    "test": {
      "id": 1,
      "code": "SCL-90",
      "name": "症状自评量表",
      "description": "综合性心理健康自评量表",
      "total_questions": 90,
      "estimated_minutes": 15,
      "scoring_method": "sum"
    },
    "questions": [
      {
        "id": 101,
        "question_number": 1,
        "content": "最近一周你是否感到紧张？",
        "dimension": "焦虑",
        "reverse_scoring": false,
        "options": [
          { "label": "A", "text": "没有", "score": 0 },
          { "label": "B", "text": "偶尔", "score": 1 },
          { "label": "C", "text": "经常", "score": 2 },
          { "label": "D", "text": "总是", "score": 3 }
        ]
      }
    ]
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| data.test | object | 测评基本信息 |
| data.questions[].reverse_scoring | boolean | 是否反向计分（数据库 1/0 转为布尔） |
| data.questions[].options | array | 选项数组（数据库 JSON 解析后原样返回，常规结构为 `{label, text, score}`，以建卷时写入的数据为准） |

可能的错误：

| 状态码 | message |
| --- | --- |
| 400 | `无效的测评ID` |
| 404 | `测评不存在` |

### 6.3 POST /api/tests/submit

提交常规量表答卷（服务端按 `result_levels` 或默认分数段定级）。需要认证。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| test_id | number | 是 | 测评 ID |
| answers | array | 是 | 作答明细数组，元素至少包含 `score`（数值）用于求和；整体原样序列化入库 |

响应示例：

```json
{
  "success": true,
  "data": {
    "id": 55,
    "test_code": "SCL-90",
    "test_name": "症状自评量表",
    "total_score": 128,
    "result_level": "中度",
    "result_desc": "您存在中度问题，建议寻求专业帮助。",
    "completed_at": "2026-10-12T08:30:00.000Z"
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| data.total_score | number | 各作答 `score` 求和 |
| data.result_level | string | 结果等级：量表配置了 `result_levels` 时按分数区间匹配；否则按默认规则（总分 <=39 正常，<=49 轻度，<=59 中度，>59 重度） |
| data.result_desc | string | 等级描述 |
| data.completed_at | string | 完成时间（ISO 8601） |

可能的错误：

| 状态码 | message |
| --- | --- |
| 400 | `参数不完整` |
| 404 | `测评不存在` |

### 6.4 GET /api/tests/history

获取当前用户测评历史（按完成时间倒序）。需要认证。

响应示例：

```json
{
  "success": true,
  "data": [
    {
      "id": 55,
      "code": "SCL-90",
      "name": "症状自评量表",
      "total_score": 128,
      "result_level": "中度",
      "result_desc": "您存在中度问题，建议寻求专业帮助。",
      "completed_at": "2026-10-12T08:30:00.000Z"
    }
  ]
}
```

### 6.5 GET /api/tests/result/:resultId

获取单次测评结果详情。需要认证。仅能查看本人的结果。

路径参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| resultId | number | 测评结果 ID（非数字返回 400） |

响应示例：

```json
{
  "success": true,
  "data": {
    "id": 55,
    "test_code": "SCL-90",
    "name": "症状自评量表",
    "answers": [
      { "question_id": 1, "selected_label": "C", "score": 2 }
    ],
    "total_score": 128,
    "result_level": "中度",
    "result_desc": "您存在中度问题，建议寻求专业帮助。",
    "completed_at": "2026-10-12T08:30:00.000Z"
  }
}
```

说明：`answers` 为入库作答明细 JSON 解析后的数组，元素结构取决于提交时的数据（AI 测评的结构见 6.7）。

可能的错误：

| 状态码 | message |
| --- | --- |
| 400 | `无效的结果ID` |
| 404 | `结果不存在` |

### 6.6 POST /api/tests/ai/questions

AI 智能测评：实时生成个性化问卷。需要认证。生成结果入库（ai_test_papers），题目数量少于 8 自动重试一次，超过 20 自动截取。

请求体：无。

响应示例：

```json
{
  "success": true,
  "data": {
    "paper_id": 9,
    "name": "AI 智能测评",
    "description": "由 AI 根据常见心理健康维度实时生成的个性化自评问卷",
    "questions": [
      {
        "number": 1,
        "content": "最近两周，你的睡眠情况如何？",
        "options": [
          { "label": "A", "text": "入睡很快，睡得踏实", "score": 0 },
          { "label": "B", "text": "偶尔翻身，总体还行", "score": 1 },
          { "label": "C", "text": "经常醒来，睡眠浅", "score": 2 },
          { "label": "D", "text": "几乎整夜难眠", "score": 3 }
        ]
      }
    ]
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| data.paper_id | number | 本次生成问卷的 ID，提交评分时回传（6.7） |
| data.questions[].number | number | 题号（从 1 开始） |
| data.questions[].options[].score | number | 选项得分，依次为 0/1/2/3 |

可能的错误：

| 状态码 | message | 说明 |
| --- | --- | --- |
| 502 | `AI 生成的问卷不完整，请重试` | 两次生成均未达到最低题量或结构不完整 |

### 6.7 POST /api/tests/ai/submit

AI 智能测评：提交答卷，由 AI 评分并保存。需要认证。评分依据优先取服务端留存的问卷内容（`paper_id`），保证与用户所见一致；不信任前端直接给出的分数（仅作参考）。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| paper_id | number | 推荐 | 6.6 返回的问卷 ID；缺失时回退使用请求体中的 `questions`（兼容旧客户端） |
| questions | array | 条件 | 旧客户端兼容字段：`paper_id` 缺失时作为评分依据 |
| answers | array | 是 | 与题目数量一致的作答数组，元素包含 `label`（所选选项标识）或 `text`（所选选项文本），可附 `score` 作参考 |

响应示例：

```json
{
  "success": true,
  "data": {
    "id": 56,
    "test_code": "AI-GEN",
    "test_name": "AI 智能测评",
    "total_score": 14,
    "result_level": "轻度",
    "result_desc": "整体状态平稳，但睡眠维度值得留意。",
    "analysis": "从你的作答来看……建议：1.…… 2.……",
    "completed_at": "2026-10-12T09:00:00.000Z"
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| data.total_score | number | 0-100 整数，越高越需要关注 |
| data.result_level | string | 正常 / 轻度 / 中度 / 重度（由 AI 判定） |
| data.result_desc | string | 一句话总体评价 |
| data.analysis | string | 200-350 字详细分析与建议 |
| data.result_desc 与 analysis 合并写入结果详情的 result_desc 字段 | - | 详情接口（6.5）返回的 `result_desc` 为两者拼接 |

可能的错误：

| 状态码 | message |
| --- | --- |
| 400 | `参数不完整` |
| 404 | `问卷不存在或已失效，请重新生成` |
| 500 | `测评记录初始化失败` |
| 503 | `AI 服务繁忙，请稍后重试` |

---

## 7. 预约与咨询

本章包含 `/api/users` 的预约与举报接口、`/api/expert` 全部接口。

### 7.1 POST /api/users/appointments

创建预约（用户侧）。需要认证。同一用户对同一专家已有进行中（待确认/已确认）预约时禁止重复创建。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| doctorId | number | 是 | 专家名片 ID（doctors 表 id，须为上架状态） |

响应示例：

```json
{
  "success": true,
  "message": "预约成功",
  "data": {
    "id": 20
  }
}
```

可能的错误：

| 状态码 | message |
| --- | --- |
| 404 | `专家不存在` |
| 409 | `您已有该专家的进行中预约，请勿重复预约` |

### 7.2 GET /api/users/appointments

获取我的预约列表（按创建时间倒序）。需要认证。

响应示例：

```json
{
  "success": true,
  "data": [
    {
      "id": 20,
      "user_id": 12,
      "doctor_id": 1,
      "status": "pending",
      "created_at": "2026-10-10T08:00:00.000Z",
      "doctor_name": "李医生",
      "doctor_title": "国家二级心理咨询师"
    }
  ]
}
```

说明：元素为预约记录全部字段（`ar.*`：id、user_id、doctor_id、status、created_at）附加 `doctor_name`、`doctor_title`。

### 7.3 PUT /api/users/appointments/:id/cancel

取消预约（用户侧）。需要认证。仅待确认（pending）/已确认（confirmed）状态可取消。取消成功后通过 Socket.IO 广播 `appointment-updated`（房间内）与 `appointment-list-updated`（全站，接收方按 `userId` 过滤），详见第 11 章。

路径参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| id | number | 预约 ID |

响应示例：

```json
{
  "success": true,
  "message": "预约已取消"
}
```

可能的错误：

| 状态码 | message |
| --- | --- |
| 400 | `当前状态不可取消` |
| 404 | `预约不存在或无权操作` |

### 7.4 POST /api/users/reports

举报聊天消息（用户或专家均可发起）。需要认证。举报人必须是该预约的参与方；被举报消息必须属于该预约且由对方发送（不能举报自己）；仅有效消息入库。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| appointment_id | number | 是 | 预约 ID |
| message_ids | number[] | 是 | 被举报消息 ID 数组（expert_chat 表 id） |
| reason | string | 是 | 举报理由（不能为空白） |
| detail | string | 否 | 补充说明，最长 500 字 |

响应示例：

```json
{
  "success": true,
  "message": "举报已提交，管理员会尽快核实处理",
  "data": {
    "id": 3,
    "count": 2
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| data.id | number | 举报记录 ID（chat_reports） |
| data.count | number | 实际入库的被举报消息数 |

可能的错误：

| 状态码 | message |
| --- | --- |
| 400 | `请先选择要举报的聊天消息` / `请选择举报理由` / `所选消息不存在或不可举报` |
| 403 | `无权举报该预约下的消息` |

### 7.5 GET /api/expert/my-card

获取我的专家名片。需要认证，且要求角色为专家（role=2），否则 403 `无权访问，需要专家权限`。

响应示例：

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "李医生",
    "title": "国家二级心理咨询师",
    "specialty": "焦虑、抑郁方向",
    "intro": "从业十年……",
    "status": 1
  }
}
```

说明：无名片记录时 `data` 为 `null`。`status`：0=下架，1=上架，2=待审核。

### 7.6 PUT /api/expert/my-card

保存专家名片并提交审核。需要专家权限。保存后状态置为 2（待审核），管理员通过（7.13）后才上架显示。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | 是 | 专家姓名，非空且不超过 50 字 |
| title | string | 否 | 头衔 |
| specialty | string | 否 | 擅长方向 |
| intro | string | 否 | 简介 |

响应示例：

```json
{
  "success": true,
  "message": "名片已提交审核，管理员通过后将显示在专家列表"
}
```

可能的错误：

| 状态码 | message |
| --- | --- |
| 400 | `专家姓名不能为空` / `姓名不能超过 50 字` |
| 403 | `无权访问，需要专家权限` |

### 7.7 GET /api/expert/appointments

获取专家的预约列表。需要专家权限。专家无名片记录时返回空数组。

响应示例：

```json
{
  "success": true,
  "data": [
    {
      "id": 20,
      "user_id": 12,
      "doctor_id": 1,
      "status": "confirmed",
      "created_at": "2026-10-10T08:00:00.000Z",
      "user_name": "张三",
      "user_email": "zhangsan@example.com",
      "user_phone": "13800138000"
    }
  ]
}
```

可能的错误：

| 状态码 | message |
| --- | --- |
| 403 | `无权访问，需要专家权限` |

### 7.8 GET /api/expert/stats

获取专家统计数据。需要专家权限。

响应示例：

```json
{
  "success": true,
  "data": {
    "pendingCount": 2,
    "completedCount": 10,
    "unfinishedCount": 1,
    "totalPatients": 8
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| pendingCount | number | 待处理预约数（status=pending） |
| completedCount | number | 已完成咨询数（status=completed） |
| unfinishedCount | number | 未完成咨询数（status=confirmed） |
| totalPatients | number | 累计服务用户数（去重） |

说明：无名片记录时各字段返回 0。内部异常兜底返回 500 `{ "error": "获取统计失败" }`（非统一包装格式）。

可能的错误：

| 状态码 | message |
| --- | --- |
| 403 | `无权访问，需要专家权限` |

### 7.9 GET /api/expert/appointments/:id

获取预约详情（含用户最近测评结果）。需要认证。权限按角色区分：普通用户（role=1）只能查看本人预约；专家（role=2）只能查看自己名下预约；管理员（role=3）不附加归属过滤。

响应示例：

```json
{
  "success": true,
  "data": {
    "appointment": {
      "id": 20,
      "user_id": 12,
      "doctor_id": 1,
      "status": "confirmed",
      "created_at": "2026-10-10T08:00:00.000Z",
      "user_name": "张三",
      "user_email": "zhangsan@example.com",
      "user_phone": "13800138000",
      "user_avatar": "/uploads/avatar/12.png",
      "doctor_avatar": "/uploads/avatar/5.png",
      "doctor_user_id": 5
    },
    "testResults": [
      {
        "id": 55,
        "user_id": 12,
        "test_id": 1,
        "test_code": "SCL-90",
        "answers": "[{\"question_id\":1,\"selected_label\":\"C\",\"score\":2}]",
        "total_score": 128,
        "result_level": "中度",
        "result_desc": "……",
        "completed_at": "2026-10-12T08:30:00.000Z",
        "test_name": "症状自评量表",
        "test_questions": "[{\"id\":101,\"content\":\"……\",\"options\":[{\"label\":\"A\",\"text\":\"没有\",\"score\":0}]}]"
      }
    ]
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| data.appointment | object | 预约记录全部字段 + 用户与专家的补充信息 |
| data.appointment.doctor_user_id | number/null | 专家关联的系统用户 ID（无名片时为 null） |
| data.testResults | array | 该用户最近 5 次测评结果（test_results 全部字段 + test_name） |
| data.testResults[].test_questions | string/null | 涉及量表的题目与选项文本（JSON 字符串），无题目时为 null |

可能的错误：

| 状态码 | message |
| --- | --- |
| 404 | `预约不存在` / `专家信息不存在`（role=2 且无名片） |

### 7.10 PUT /api/expert/appointments/:id/status

更新预约状态。需要专家权限。成功后通过 Socket.IO 广播 `appointment-updated` 与 `appointment-list-updated`（详见第 11 章）。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| status | string | 是 | 目标状态：`confirmed` 确认 / `rejected` 拒绝 / `cancelled` 取消 / `completed` 完成 |

响应示例：

```json
{
  "success": true,
  "message": "状态更新成功"
}
```

可能的错误：

| 状态码 | message |
| --- | --- |
| 400 | `无效的预约状态` |
| 403 | `无权访问，需要专家权限` |
| 404 | `专家信息不存在` |

### 7.11 GET /api/expert/chat/:appointmentId

获取某预约下的聊天记录（按时间正序）。需要认证。仅预约本人与对应专家可读取（服务端归属校验）。

路径参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| appointmentId | number | 预约 ID |

响应示例：

```json
{
  "success": true,
  "data": [
    {
      "id": 100,
      "sender_id": 12,
      "receiver_id": 5,
      "content": "老师您好，最近情绪不太稳定。",
      "appointment_id": 20,
      "is_read": 1,
      "created_at": "2026-10-11T10:00:00.000Z",
      "sender_name": "张三",
      "receiver_name": "李医生"
    }
  ]
}
```

可能的错误：

| 状态码 | message |
| --- | --- |
| 404 | `预约不存在或无权访问` |

### 7.12 POST /api/expert/chat

通过 HTTP 发送聊天消息（Socket.IO 之外的备用链路）。需要认证。接收方由服务端按预约关系推导；内容经词库 + AI 复核审核，违规内容拒绝入库。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| appointmentId | number | 是 | 预约 ID |
| content | string | 是 | 消息内容，不能为空白 |

响应示例：

```json
{
  "success": true,
  "message": "发送成功"
}
```

可能的错误：

| 状态码 | message |
| --- | --- |
| 400 | `参数不完整` / `消息包含违规内容（<命中词>），已被拦截` / `消息包含不文明或违规内容，已被拦截` / `预约对方信息缺失` |
| 404 | `预约不存在或无权发送` |

---

## 8. AI 服务

本章为 `/api/ai` 接口，均需要认证。注意：本模块的错误响应与其他模块略有差异（使用 `error` 字段，见各接口说明）。

### 8.1 POST /api/ai/chat

AI 心理咨询对话（非流式）。需要认证。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| messages | array | 是 | 对话消息数组，元素 `{ role, content }`（role 通常为 `user` / `assistant`），不能为空 |
| context | object | 否 | 用户背景数据（如测评摘要等），将拼接到系统提示词中 |

响应示例：

```json
{
  "success": true,
  "content": "听起来这段时间你辛苦了。愿意和我说说是什么让你睡不好吗？"
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| content | string | AI 回复文本；调用失败时返回固定兜底文案 `抱歉，我暂时无法回复，请稍后再试。` |

可能的错误（本接口使用 `error` 字段，非统一包装）：

| 状态码 | 响应体 |
| --- | --- |
| 400 | `{ "error": "messages 不能为空" }` |
| 500 | `{ "success": false, "error": "AI 服务暂时不可用: <原因>" }` |

### 8.2 POST /api/ai/chat-stream

AI 心理咨询对话（SSE 流式）。需要认证。请求体与 8.1 一致。

响应头：

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

SSE 事件流格式：

- 增量内容：`data: {"content":"<增量文本>"}`（多条）
- 正常结束：`data: [DONE]`
- 流中断：`data: {"error":"流式响应中断"}` 后关闭连接

响应示例（事件流原文）：

```text
data: {"content":"听起来"}

data: {"content":"这段时间你辛苦了。"}

data: [DONE]
```

参数校验失败（未进入流式阶段）返回：

| 状态码 | 响应体 |
| --- | --- |
| 400 | `{ "error": "messages 不能为空" }` |
| 500 | `{ "success": false, "error": "AI 服务暂时不可用: <原因>" }` |

流式过程中发生异常（响应头已发出）时，向流中写入 `data: {"error":"服务异常"}` 后结束。

### 8.3 POST /api/ai/summarize-report

生成周期性心理分析报告（Markdown 文本）。需要认证。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| startDate | string | 是 | 统计起始日期 |
| endDate | string | 是 | 统计结束日期 |
| chatHistory | array | 否 | 聊天记录数组，元素包含 `created_at`、`type`（`user` 视为用户发言，其余视为 AI）、`content`（每条截取前 100 字） |
| testResults | array | 否 | 测评结果数组，元素包含 `test_name`、`total_score`、`result_level`、`result_desc` |

响应示例：

```json
{
  "success": true,
  "report": "## 心理状态分析报告\n\n### 一、情绪趋势\n……"
}
```

可能的错误：

| 状态码 | 响应体 |
| --- | --- |
| 400 | `{ "error": "请提供完整的起止日期" }` |
| 500 | `{ "success": false, "error": "报告生成服务暂时不可用: <原因>" }` |

---

## 9. 内容审核

### 9.1 POST /api/moderation/precheck

聊天内容预检（仅词库秒级检查，不调用 AI）。需要认证。用于前端在发送前即时提示，完整审核（词库 + AI 上下文复核）在 Socket/HTTP 发送链路服务端强制执行。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| content | string | 是 | 待检查的聊天内容（非字符串按空串处理） |

响应示例（通过）：

```json
{
  "success": true,
  "data": {
    "ok": true,
    "hit": null
  }
}
```

响应示例（命中敏感词）：

```json
{
  "success": true,
  "data": {
    "ok": false,
    "hit": "侮辱"
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| data.ok | boolean | 是否通过词库检查 |
| data.hit | string/null | 命中的词库分类（侮辱/色情/违禁/自伤/缩写/其他），未命中为 null |

---

## 10. 管理后台

本章为 `/api/admin` 接口，全部需要认证且角色为管理员（role=3），否则返回 403 `仅管理员可执行此操作`。下文各接口不再重复标注。

### 10.1 GET /api/admin/users

分页获取用户列表。支持关键词模糊搜索（用户名/邮箱/手机号）。

Query 参数：

| 参数 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| page | number | 否 | 1 | 页码 |
| pageSize | number | 否 | 20 | 每页条数 |
| keyword | string | 否 | 空 | 模糊匹配关键词 |

响应示例：

```json
{
  "success": true,
  "data": {
    "list": [
      {
        "id": 12,
        "username": "张三",
        "email": "zhangsan@example.com",
        "phone": "13800138000",
        "role": 1,
        "avatar": null,
        "status": 0,
        "restricted_until": null,
        "created_at": "2026-01-01T00:00:00.000Z"
      }
    ],
    "total": 58,
    "page": 1,
    "pageSize": 20
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| data.list[].status | number | 账号状态：0=正常，1=禁言，2=封禁 |
| data.list[].restricted_until | string/null | 限制截止时间，null 表示永久或未受限 |

### 10.2 POST /api/admin/users

管理员新建用户（无需邮箱验证码）。role=2（专家）时自动创建名片记录（默认下架 status=0），由专家本人完善并提交审核。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| username | string | 是 | 用户名 |
| email | string | 是 | 邮箱（格式校验） |
| password | string | 是 | 密码，至少 6 位 |
| role | number | 否 | 角色 1/2/3，非法或缺省按 1 处理 |
| phone | string | 否 | 手机号 |

响应示例：

```json
{
  "success": true,
  "message": "用户创建成功"
}
```

role=2 时 message 为 `专家账号创建成功，名片待本人完善并提交审核后上架`。

可能的错误：

| 状态码 | message |
| --- | --- |
| 400 | `用户名、邮箱、密码不能为空` / `邮箱格式不正确` / `密码至少 6 位` |
| 409 | `该邮箱已被注册` |

### 10.3 PUT /api/admin/users/:id/role

修改用户角色。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| role | number | 是 | 1=普通用户，2=专家，3=管理员 |

响应示例：

```json
{
  "success": true,
  "message": "角色修改成功"
}
```

可能的错误：

| 状态码 | message |
| --- | --- |
| 400 | `无效的角色` |

### 10.4 DELETE /api/admin/users/:id

删除用户并连带清理其全部业务数据（预约、测评、AI 聊天记录、分析报告、专家聊天、OAuth 绑定、名片）。

响应示例：

```json
{
  "success": true,
  "message": "用户及其关联数据已删除"
}
```

可能的错误：

| 状态码 | message |
| --- | --- |
| 400 | `不能删除当前登录的账号` |
| 404 | `用户不存在` |

### 10.5 POST /api/admin/users/:id/unrestrict

解除账号限制（禁言/封禁立即恢复正常，目标在线时实时收到 `restriction-lifted` 通知）。

响应示例：

```json
{
  "success": true,
  "message": "已解除该账号的限制"
}
```

可能的错误：

| 状态码 | message |
| --- | --- |
| 404 | `用户不存在` |

### 10.6 GET /api/admin/stats

平台统计总览。

响应示例：

```json
{
  "success": true,
  "data": {
    "totalUsers": 58,
    "totalExperts": 6,
    "totalAppointments": 45,
    "totalTests": 210
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| totalUsers | number | 注册用户总数（含专家与管理员） |
| totalExperts | number | 上架中的专家名片数（doctors.status=1） |
| totalAppointments | number | 全部预约记录数 |
| totalTests | number | 全部测评完成次数 |

说明：内部异常兜底返回 500 `{ "error": "获取统计失败" }`（非统一包装格式）。

### 10.7 GET /api/admin/tests

获取问卷列表（全字段）。`status` 未传时返回全部。

Query 参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| status | number | 否 | 0=未上架，1=已上架，2=已下架 |

响应示例：

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "SCL-90",
      "name": "症状自评量表",
      "description": "综合性心理健康自评量表",
      "category": "综合",
      "total_questions": 90,
      "estimated_minutes": 15,
      "scoring_method": "sum",
      "result_levels": "[{\"min\":0,\"max\":39,\"level\":\"正常\",\"desc\":\"……\"}]",
      "status": 1,
      "created_at": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

### 10.8 POST /api/admin/tests

新建问卷（默认未上架 status=0），可同时写入题目。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| code | string | 是 | 量表编码 |
| name | string | 是 | 量表名称 |
| description | string | 否 | 描述 |
| category | string | 否 | 分类 |
| total_questions | number | 否 | 题目总数 |
| estimated_minutes | number | 否 | 预计用时（分钟） |
| scoring_method | string | 否 | 计分方式 |
| result_levels | array | 否 | 分数区间定级配置，元素 `{min, max, level, desc}`，序列化入库 |
| questions | array | 否 | 题目数组，元素 `{question_number, content, dimension, reverse_scoring, options}`，`reverse_scoring` 为布尔值 |

响应示例：

```json
{
  "success": true,
  "message": "问卷创建成功，默认未上架",
  "data": {
    "id": 4
  }
}
```

### 10.9 PUT /api/admin/tests/:id/status

设置问卷状态（上架/下架）。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| status | number | 是 | 0=未上架，1=已上架，2=已下架 |

响应示例：

```json
{
  "success": true,
  "message": "问卷已上架"
}
```

可能的错误：

| 状态码 | message |
| --- | --- |
| 400 | `无效的状态` |

### 10.10 DELETE /api/admin/tests/:id

删除问卷及其全部题目。

响应示例：

```json
{
  "success": true,
  "message": "问卷已删除"
}
```

### 10.11 GET /api/admin/appointments

获取平台全部预约（按创建时间倒序）。

响应示例：

```json
{
  "success": true,
  "data": [
    {
      "id": 20,
      "user_id": 12,
      "doctor_id": 1,
      "status": "pending",
      "created_at": "2026-10-10T08:00:00.000Z",
      "user_name": "张三",
      "user_email": "zhangsan@example.com",
      "doctor_name": "李医生",
      "doctor_title": "国家二级心理咨询师"
    }
  ]
}
```

### 10.12 POST /api/admin/appointments

管理员代建预约。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | number | 是 | 用户 ID |
| doctor_id | number | 是 | 专家名片 ID |
| status | string | 否 | `pending`/`confirmed`/`completed`/`cancelled`，非法或缺省按 `pending` |

响应示例：

```json
{
  "success": true,
  "message": "预约创建成功",
  "data": {
    "id": 21
  }
}
```

可能的错误：

| 状态码 | message |
| --- | --- |
| 400 | `请选择用户和专家` |
| 404 | `用户不存在` / `专家不存在` |

### 10.13 DELETE /api/admin/appointments/:id

删除预约记录。

响应示例：

```json
{
  "success": true,
  "message": "预约记录已删除"
}
```

可能的错误：

| 状态码 | message |
| --- | --- |
| 404 | `预约记录不存在` |

### 10.14 GET /api/admin/doctor-cards

获取全部专家名片（含各状态，按待审核优先、创建时间倒序排列）。

响应示例：

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "李医生",
      "title": "国家二级心理咨询师",
      "specialty": "焦虑、抑郁方向",
      "intro": "从业十年……",
      "status": 2,
      "created_at": "2026-09-01T00:00:00.000Z",
      "user_email": "li@example.com"
    }
  ]
}
```

### 10.15 PUT /api/admin/doctor-cards/:id/review

专家名片审核：通过（上架）或拒绝（下架）。操作后全站广播 `doctor-list-updated`（详见第 11 章）。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| action | string | 是 | `approve` 通过（status 置 1）/ `reject` 拒绝（status 置 0） |

响应示例：

```json
{
  "success": true,
  "message": "已通过，名片已上架专家列表"
}
```

action 为 `reject` 时 message 为 `已拒绝，名片保持下架状态`。

可能的错误：

| 状态码 | message |
| --- | --- |
| 400 | `无效的审核操作` |
| 404 | `名片不存在` |

### 10.16 GET /api/admin/sensitive-words

获取敏感词库（聊天审核词，按 ID 倒序）。

响应示例：

```json
{
  "success": true,
  "data": [
    {
      "id": 8,
      "word": "示例敏感词",
      "category": "侮辱",
      "is_short": 0,
      "created_at": "2026-10-01T00:00:00.000Z"
    }
  ]
}
```

### 10.17 POST /api/admin/sensitive-words

新增敏感词，添加后实时生效（无需重启）。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| word | string | 是 | 敏感词，非空且不超过 64 字 |
| category | string | 否 | 分类：`侮辱`/`色情`/`违禁`/`自伤`/`缩写`/`其他`，非法或缺省按 `其他` |
| is_short | boolean | 否 | 是否为缩写词，真值按 1 存储 |

响应示例：

```json
{
  "success": true,
  "message": "敏感词已添加并即时生效",
  "data": {
    "id": 9
  }
}
```

可能的错误：

| 状态码 | message |
| --- | --- |
| 400 | `敏感词不能为空且不超过 64 字` / `该敏感词已存在` |

### 10.18 DELETE /api/admin/sensitive-words/:id

删除敏感词，删除后实时生效。

响应示例：

```json
{
  "success": true,
  "message": "敏感词已删除并即时生效"
}
```

可能的错误：

| 状态码 | message |
| --- | --- |
| 404 | `敏感词不存在` |

### 10.19 GET /api/admin/reports

获取举报列表（最多 200 条，按创建时间倒序），附被举报消息内容与被举报账号当前状态。

Query 参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| status | string | 否 | `0`/`1`/`2`（待处理/已处理/已驳回），未传或非法时返回全部 |

响应示例：

```json
{
  "success": true,
  "data": [
    {
      "id": 3,
      "reporter_id": 12,
      "reported_id": 5,
      "appointment_id": 20,
      "message_ids": [100, 101],
      "reason": "辱骂攻击",
      "detail": "对方多次使用侮辱性语言",
      "status": 0,
      "handler_id": null,
      "handle_note": null,
      "handled_at": null,
      "created_at": "2026-10-11T12:00:00.000Z",
      "reporter_name": "张三",
      "reported_name": "李医生",
      "reported_status": 0,
      "reported_restricted_until": null,
      "messages": [
        { "id": 100, "content": "……", "created_at": "2026-10-11T10:00:00.000Z" },
        { "id": 101, "content": "……", "created_at": "2026-10-11T10:05:00.000Z" }
      ]
    }
  ]
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| message_ids | number[] | 数据库 JSON 字符串解析后的消息 ID 数组 |
| reported_status | number | 被举报账号当前状态：0=正常，1=禁言，2=封禁 |
| reported_restricted_until | string/null | 被举报账号限制截止时间 |
| messages | array | 被举报消息详情（id、content、created_at） |

### 10.20 POST /api/admin/reports/:id/handle

处置举报：禁言 / 封禁 / 驳回。禁言封禁实时生效：目标用户在线时收到 `account-restricted` 通知，封禁同时强制断开其全部连接。仅待处理（status=0）的举报可操作。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| action | string | 是 | `mute` 禁言 / `ban` 封禁 / `dismiss` 驳回 |
| duration | string | 否 | 处置时长：`24h` / `72h` / `7d`；未传或其他值表示永久 |
| note | string | 否 | 处理备注，最长 255 字；留空时使用默认文案 |

响应示例（禁言/封禁）：

```json
{
  "success": true,
  "message": "已禁言该账号（2026-10-13 12:00:00 自动解除）"
}
```

永久处置时 message 为 `已封禁该账号（永久生效）`；驳回时 message 为 `已驳回该举报`。

可能的错误：

| 状态码 | message |
| --- | --- |
| 400 | `无效的处置方式` / `该举报已处理，请勿重复操作` |
| 404 | `举报不存在` |

---

## 11. 实时通信 Socket.IO

服务端基于 Socket.IO（随 HTTP 服务监听 3001 端口），主要承载预约咨询聊天与状态同步。CORS 已放开（`origin: true`）。

### 11.1 连接与认证

1. 客户端建立 WebSocket 连接后，必须首先发送 `authenticate` 事件完成认证；服务端以 JWT 为准绑定身份，支持一个用户多连接（多窗口/多设备）。
2. 认证失败：服务端向该 socket 发送 `auth-error` 并强制断开。
3. 认证成功：该用户上线（若此前离线则全站广播 `user-status-change`），并向该 socket 下发当前在线用户快照 `online-users`。
4. 未认证的 socket 无法加入房间、发送消息（相关事件依赖认证时绑定的 userId，未认证时校验失败返回 `error`）。

### 11.2 客户端到服务端事件

| 事件名 | payload | 说明 |
| --- | --- | --- |
| `authenticate` | token 字符串或 `{ token: string }` | 认证并绑定 userId；失败触发 `auth-error` 并断开连接 |
| `query-user-status` | `userId: number` | 查询指定用户在线状态，服务端以 `user-status-change` 单播回应 |
| `user-logout` | `userId: number` | 用户主动登出：移除当前连接，若为最后一条连接则广播离线，并断开该 socket |
| `join-room` | `appointmentId: number` | 加入预约房间 `appointment-<id>`；需为预约参与方（本人或对应专家），否则单播 `error`；成功后向房间内其他人广播 `user-joined-room`，并向本人推送房间内其他在线用户的 `user-status-change` |
| `leave-room` | `appointmentId: number` | 离开预约房间，无响应事件 |
| `send-message` | `{ appointmentId: number, senderId: number, receiverId: number, content: string }` | 发送聊天消息。`senderId` 必须与认证身份一致；`receiverId` 由服务端按预约关系推导（客户端传值被忽略）。触发账号限制检查与内容审核（词库 + AI 上下文复核），通过后入库并广播 |
| `mark-read` | `{ appointmentId: number, userId: number }` | 将该预约下接收者为本人的消息置为已读；`userId` 以服务端认证身份为准（客户端传值被忽略）；归属校验失败静默忽略，无响应事件 |
| `disconnect` | - | Socket.IO 内置事件：断开连接；若为该用户最后一条连接则广播离线 |

### 11.3 服务端到客户端事件

| 事件名 | payload | 触发场景 |
| --- | --- | --- |
| `auth-error` | `{ message: "登录状态无效，请重新登录" }` | `authenticate` 携带的 token 无效 |
| `online-users` | `{ userIds: number[] }` | 认证成功后下发当前全站在线用户 ID 快照 |
| `user-status-change` | `{ userId: number, isOnline: boolean }` | 用户上线/离线变化（全站广播）；`query-user-status` 的单播回应；加入房间时对房间内在线用户的单播 |
| `error` | `{ message: string }` | 业务错误：`无权访问该预约` / `身份校验失败，请重新登录` / `无权在该预约下发言` / `预约对方信息缺失` / `发送消息失败` |
| `user-joined-room` | `{ appointmentId: number, userId: number }` | 有用户加入当前预约房间（房间内广播，不含本人） |
| `new-message` | MessagePayload（见 11.4） | 消息审核通过并入库后，向预约房间内所有用户广播 |
| `chat-notification` | `{ appointmentId, senderName, senderAvatar, content }` | 消息送达接收方（接收方在线时定向单播，用于会话列表提醒） |
| `message-blocked` | `{ appointmentId: number, content: string, reason: string }` | 发送的消息被审核拦截（仅发送方收到，内容不入库不广播）。reason 形如 `消息包含违规内容（侮辱），已被拦截` 或 `消息包含不文明或违规内容，已被拦截` |
| `account-restricted` | `{ type: "muted" \| "banned", until: string \| null, message: string }` | 发消息时账号处于禁言/封禁状态；或管理员处置举报（10.20）后实时通知目标用户。`until` 为 ISO 时间，null 表示永久 |
| `restriction-lifted` | `{ message: "您的账号限制已解除，恢复正常使用" }` | 管理员解除账号限制（10.5）后通知目标用户 |
| `force-logout` | `{ message: "账号已登出" }` | 用户调用 REST 登出接口（4.5）时，其全部在线连接收到此事件后被断开 |
| `appointment-updated` | `{ appointmentId: number, status: string, updaterId: number, updateTime: string }` | 预约状态变更：用户取消（7.3）或专家更新状态（7.10）；向预约房间 `appointment-<id>` 内广播 |
| `appointment-list-updated` | `{ userId: number, appointmentId: number, status: string, updaterId: number, updateTime: string }` | 预约状态变更时全站广播，接收方按 `userId`（预约归属用户）自行过滤刷新列表 |
| `doctor-list-updated` | `{ doctorId: number, status: number, updateTime: string }` | 管理员审核专家名片（10.15）后全站广播，客户端据此刷新专家列表 |

### 11.4 消息与限制的 payload 结构

`new-message` payload：

```json
{
  "id": 1728710400000,
  "sender_id": 12,
  "receiver_id": 5,
  "content": "老师您好，最近情绪不太稳定。",
  "appointment_id": 20,
  "sender_name": "张三",
  "sender_avatar": "/uploads/avatar/12.png",
  "created_at": "2026-10-12T08:00:00.000Z"
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | number | 临时消息 ID（`Date.now()`），持久化后的真实主键请通过 7.11 拉取 |
| sender_id / receiver_id | number | 发送方/接收方用户 ID（均为服务端推导） |
| sender_avatar | string/null | 发送方头像，可能为 null |
| created_at | string | 服务端生成时间（ISO 8601） |

`account-restricted` payload：

```json
{
  "type": "muted",
  "until": "2026-10-13T04:00:00.000Z",
  "message": "您的账号已被管理员禁言（2026-10-13 12:00:00 自动解除），期间无法发送消息"
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| type | string | `muted` 禁言 / `banned` 封禁 |
| until | string/null | 限制截止时间（ISO 8601），null 表示永久 |
| message | string | 面向用户的提示文案 |

`message-blocked` payload：

```json
{
  "appointmentId": 20,
  "content": "被拦截的原始消息内容",
  "reason": "消息包含违规内容（侮辱），已被拦截"
}
```

### 11.5 客户端接入示例（逻辑说明）

```text
1. io.connect("http://your-server-ip:3001")
2. socket.emit("authenticate", { token: "<JWT>" })
3. 监听 auth-error（处理重新登录）、online-users（初始化在线状态）、user-status-change（增量更新）
4. 进入会话页：socket.emit("join-room", appointmentId)
5. 发送消息：socket.emit("send-message", { appointmentId, senderId, receiverId, content })
6. 监听 new-message（渲染消息）、chat-notification（会话列表提醒）、message-blocked（发送失败提示）、account-restricted（禁言提示）
7. 收到新消息后：socket.emit("mark-read", { appointmentId, userId })
8. 离开会话页：socket.emit("leave-room", appointmentId)
```

---

## 附：接口清单速查

| 模块 | 接口 |
| --- | --- |
| 基础 | GET /health、GET /test-cors |
| 认证与账号 | POST /api/users/register/send-code、POST /api/users/register、POST /api/users/login、POST /api/users/master-login、POST /api/users/logout、POST /api/users/refresh-token、POST /api/users/forget-password/send-code、POST /api/users/forget-password/reset、PUT /api/users/profile、PUT /api/users/avatar、GET /api/users/me、GET /api/users/info、GET /api/users/profile、GET /api/auth/captcha、POST /api/auth/sms-code、POST /api/auth/sms-login、GET /api/auth/oauth/:provider、GET /api/auth/oauth/callback/:provider |
| 用户数据与记录 | GET /api/users/stats、GET /api/users/chat-history、POST /api/users/chat、GET /api/users/tests、GET /api/users/doctors、POST /api/users/analysis-report、GET /api/users/analysis-reports、POST /api/users/clear-all |
| 心理测评 | GET /api/tests/list、GET /api/tests/questions/:testId、POST /api/tests/submit、GET /api/tests/history、GET /api/tests/result/:resultId、POST /api/tests/ai/questions、POST /api/tests/ai/submit |
| 预约与咨询 | POST /api/users/appointments、GET /api/users/appointments、PUT /api/users/appointments/:id/cancel、POST /api/users/reports、GET /api/expert/my-card、PUT /api/expert/my-card、GET /api/expert/appointments、GET /api/expert/stats、GET /api/expert/appointments/:id、PUT /api/expert/appointments/:id/status、GET /api/expert/chat/:appointmentId、POST /api/expert/chat |
| AI 服务 | POST /api/ai/chat、POST /api/ai/chat-stream、POST /api/ai/summarize-report |
| 内容审核 | POST /api/moderation/precheck |
| 管理后台 | GET /api/admin/users、POST /api/admin/users、PUT /api/admin/users/:id/role、DELETE /api/admin/users/:id、POST /api/admin/users/:id/unrestrict、GET /api/admin/stats、GET /api/admin/tests、POST /api/admin/tests、PUT /api/admin/tests/:id/status、DELETE /api/admin/tests/:id、GET /api/admin/appointments、POST /api/admin/appointments、DELETE /api/admin/appointments/:id、GET /api/admin/doctor-cards、PUT /api/admin/doctor-cards/:id/review、GET /api/admin/sensitive-words、POST /api/admin/sensitive-words、DELETE /api/admin/sensitive-words/:id、GET /api/admin/reports、POST /api/admin/reports/:id/handle |
