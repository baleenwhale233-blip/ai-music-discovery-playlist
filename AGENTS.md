# AGENTS.md

本文件是本项目的多代理协作约束、架构边界和交接协议。任何新对话里的 agent 在开始改动前，都应该先通读本文件一次，然后严格按第 2 节的恢复顺序继续，不要在 `AGENTS.md`、`README.md` 和 `docs/development_log.md` 之间来回重复确认同一个问题。

## 1. 项目目标

这是一个面向大陆用户的 AI 音乐目录与本地听单工具。

**当前真实路线：**

```text
Mobile Web First
-> 目录链接
-> 用户主动本地音频缓存
-> 真实播放器播放
-> 形成听单
```

请不要再把它默认理解成：

- React Native 优先产品
- iframe/WebView 播放器产品
- 来源播放器容器产品

## 2. 开工前必读

每个新 agent 在开始任何实现前，按这个顺序恢复上下文：

1. 本文件 `AGENTS.md`
2. `README.md`
3. `docs/prd v0.1.md`
4. `docs/basic_ia.md`
5. `docs/2026-04-22-mainland-mvp-technical-route.md`
6. `docs/2026-04-22-mvp-engineering-breakdown.md`
7. `docs/development_log.md` 最近一节
8. `git status --short`

如果文档和当前代码不一致，以代码和 `docs/development_log.md` 最近一次记录为准；如果当前 worktree 明显比开发日志更往前，就把 `git status --short` 视为额外交接信息，并在完成工作后补写日志。

## 3. 当前路线判断

### 主路线

- `apps/admin` 当前承担 Web 原型 / 实验前端
- `apps/api` 承担来源解析、本地音频缓存、目录预览、播放器数据接口
- `apps/mobile` 保留，但后置

### 已经被验证为不成立的旧路线

- B 站 iframe 外链播放器不能可靠承担音乐播放器核心能力
- WebView/iframe 不能作为当前产品主路线

`/debug/bilibili` 仍然保留，但它只是**来源验证页**，不是主产品路线。

`/debug/local-audio` 才是当前**最接近产品真实价值**的实验页。

## 4. 架构健康红线

这些规则优先级很高，除非用户明确要求，否则不要打破：

- 不允许 `apps/*` 之间直接互相引用代码
- 跨端共享只走 `packages/*`
- `packages/types` 只放纯类型、领域枚举、轻量常量，不放运行时副作用
- `packages/api-contract` 只放 API 契约、schema、DTO，不放业务逻辑
- `packages/config` 只放工程配置、env schema、基础常量，不放业务代码
- 业务实现优先收敛在 `apps/api`
- 当前阶段不创建 `packages/ui`
- 当前阶段不把“实验页”误当作正式产品完成版
- 如果一个改动会让共享包开始承担业务逻辑，先停下来重审边界

## 5. 当前模块边界

### `apps/admin`

当前职责：

- Mobile Web 原型
- 实验页
- 后台壳

当前重要页面：

- `/debug/bilibili`
- `/debug/local-audio`

后续方向：

- 从实验前端演进为正式 Mobile Web 产品前端

### `apps/api`

当前职责：

- `api/v1` 对外接口
- 目录解析
- 收藏夹/播放列表候选预览
- 本地音频缓存
- 音频 Range 响应
- 封面代理
- 来源能力与实验能力

当前重要模块：

- `contents`
- `health`
- `auth`

### `apps/mobile`

当前职责：

- 保留未来原生壳和原生播放器扩展空间

当前不做：

- 不作为当前 MVP 主开发目标
- 不再默认承担“主前端”角色

## 6. 角色分工建议

### 前端 Agent

主要负责：

- `apps/admin`
- 必要时联动 `packages/types`、`packages/api-contract`

工作原则：

- 先改契约再改页面
- 优先围绕 Mobile Web、目录、听单、真实 `<audio>` 播放器
- 不要再把 iframe 播放器包装成正式播放器体验

### 后端 Agent

主要负责：

- `apps/api`
- 必要时联动 `packages/types`、`packages/api-contract`

工作原则：

- 先定义模块边界、DTO、schema，再写 controller 和 service
- 优先支持：
  - 单条解析
  - 收藏夹/播放列表预览
  - 本地音频缓存
  - Range 音频播放
  - 缓存清理
- Redis / Queue / Prisma 的平台层改动必须保持通用，不要混进业务语义

### 平台 / 架构 Agent

主要负责：

- workspace
- `packages/config`
- CI、lint、typecheck、build、转换节点方案

工作原则：

- 优先保持 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` 可用
- 新依赖引入要解释必要性
- 当前转换节点可以是你的服务器或 Mac mini

## 7. 接口和数据约定

这些是当前已锁定的跨端语义，不要随意改名：

- API 前缀：`/api/v1`
- 统一内容主键：`platform + platform_content_id`
- 账号控制权任务状态：
  `created | pending_user_action | pending_check | verified | rejected | expired | disputed`
- 目录项语义：
  - 未缓存
  - 缓存中
  - 已缓存
  - 缓存失败

如果必须调整这些语义，至少同步更新：

- `packages/types`
- `packages/api-contract`
- `docs/2026-04-22-mainland-mvp-technical-route.md`
- `docs/development_log.md`

## 8. 环境与运行约束

- 根目录只放 workspace 级变量
- 应用级变量放各自 `.env.example`
- 本地基础设施通过 `infra/docker-compose.yml` 提供
- 当前阶段 Redis 不是所有实验功能的硬依赖
- `pnpm build` 当前可通过
- `open-bilibili-debug.command`：启动来源验证页
- `open-local-audio-experiment.command`：启动本地音频实验页
- `stop-local-audio-experiment.command`：停止本地音频实验相关服务

### 关于转换

- 当前本地音频实验依赖：
  - `yt-dlp`
  - `ffmpeg`
- 允许由你的服务器或 Mac mini 先承担转换
- 不要求一开始做大规模云转码

## 9. 开发流程要求

每次改动尽量遵守这个顺序：

1. 读文档和最近开发日志
2. 明确当前任务是否属于：
   - 目录解析
   - 听单
   - 本地缓存
   - Mobile Web 页面
   - 转换节点
3. 若涉及跨端契约，先改 `packages/*`
4. 再改 `apps/*`
5. 跑至少一轮相关验证
6. 更新 `docs/development_log.md`

## 10. 完成某轮工作后必须更新的内容

每次完成一个有意义的工作单元后，更新 `docs/development_log.md`，至少记录：

- 日期
- 做了什么
- 影响哪些目录
- 跑了哪些验证命令
- 当前剩余问题
- 下一个最合理的动作

如果新增了重要工程约束、目录边界或协作规则，也要同步更新本文件。
如果当前代码已经明显走到 `docs/development_log.md` 最近一节之后，必须补一条新的交接记录，不要把下一位 agent 留在“代码领先文档”的状态里。

## 11. 下一位 agent 的默认起手式

如果你是新进来的 agent，默认按这套方式开始：

1. 严格按第 2 节顺序恢复上下文
2. 先用一句话确认当前真实路线仍然是：
   `目录 -> 用户主动本地缓存 -> 听单 -> 真播放器`
3. 如果 `git status --short` 显示已有进行中的改动，把它们视为当前有效 WIP；除非与用户目标直接冲突，否则不要反复追问同一个路线问题
4. 再判断当前任务是不是应该落在：
   - `apps/admin`
   - `apps/api`
   - `packages/*`
5. 只有在用户明确要求时，才把重心放到 `apps/mobile`

## 12. 当前最重要的真实方向

如果后续出现方向分歧，请以这条为准：

```text
真正值得继续投入的是：
目录 -> 用户主动本地缓存 -> 听单 -> 真播放器
```

不是：

```text
继续增强来源 iframe 播放器
```
