# AGENTS.md

本文件是本项目的多代理协作约束、架构边界和交接协议。任何新对话里的 agent 在开始改动前，都应该先读完本文件，再读 `README.md` 和 `docs/development_log.md`。

## 1. 项目目标

这是一个面向大陆用户的“可播放目录型 AI 音乐工具”MVP 工程仓库。

当前阶段目标不是做完整业务，而是稳住一套可持续演进的 monorepo 基座：

- `apps/mobile`：React Native + Expo Prebuild 客户端骨架
- `apps/api`：NestJS + Prisma + Redis + BullMQ 服务端骨架
- `apps/admin`：Next.js 内部管理台骨架
- `packages/types`：共享领域类型
- `packages/api-contract`：共享 API 契约与 DTO
- `packages/config`：共享工程配置、env schema 与常量

## 2. 开工前必读

每个新 agent 在开始任何实现前，按这个顺序读：

1. `README.md`
2. `docs/prd v0.1.md`
3. `docs/2026-04-22-mainland-mvp-technical-route.md`
4. `docs/2026-04-22-mvp-engineering-breakdown.md`
5. `docs/development_log.md`
6. 本文件 `AGENTS.md`

如果这些文档和当前代码不一致，以代码和 `docs/development_log.md` 最近一次记录为准，并在完成工作后修正文档。

## 3. 架构健康红线

这些规则优先级很高，除非用户明确要求，否则不要打破：

- 不允许 `apps/*` 之间直接互相引用代码
- 跨端共享只走 `packages/*`
- `packages/types` 只放纯类型、领域枚举、轻量常量，不放运行时副作用
- `packages/api-contract` 只放 API 契约、schema、DTO，不放业务逻辑
- `packages/config` 只放工程配置、env schema、基础常量，不放业务代码
- 业务实现优先收敛在 `apps/api`，不要过早拆微服务
- 当前阶段不创建 `packages/ui`
- 当前阶段不实现 B 站 / 抖音适配器、WebView 播放容器、真实短信验证码、歌单业务细节
- 如果一个改动会让共享包开始承担业务逻辑，先停下来重审边界

## 4. 当前模块边界

### `apps/mobile`

职责：

- 导航骨架
- 页面壳
- 播放状态前端接口
- API client
- 本地状态与服务端状态管理

当前不做：

- 来源播放器实现
- WebView 容器实现
- 真实导入流程
- 真实歌单和播放队列逻辑

### `apps/api`

职责：

- `api/v1` 对外接口
- Auth 壳
- Health 接口
- Prisma / Redis / BullMQ 平台能力
- 后续所有业务模块的主承载层

当前模块目录已预留：

- `auth`
- `users`
- `contents`
- `imports`
- `playlists`
- `favorites`
- `history`
- `discovery`
- `source-accounts`
- `moderation`
- `admin`

当前不做：

- 真正的内容导入适配器
- 真正的任务消费逻辑
- 真正的运营 CRUD

### `apps/admin`

职责：

- 内部后台壳
- 登录壳
- 后续内容查看、验证记录、争议处理、推荐位配置入口

当前不做：

- 完整权限体系
- 真实后台业务表单

## 5. 角色分工建议

### 前端 Agent

主要负责：

- `apps/mobile`
- 必要时联动 `packages/types`、`packages/api-contract`

工作原则：

- 先改契约再改页面
- 播放器相关逻辑必须先用状态机接口占位，不要先写来源播放器细节
- 不要把导入、验证、歌单业务规则硬编码在页面里

### 后端 Agent

主要负责：

- `apps/api`
- 必要时联动 `packages/types`、`packages/api-contract`

工作原则：

- 先定义模块边界、DTO、schema，再写控制器和 service
- 新增业务能力时，优先复用现有模块目录，不要随意开新顶级模块
- Redis / Queue / Prisma 的平台层改动必须保持通用，不要混进业务语义

### 管理后台 Agent

主要负责：

- `apps/admin`
- 必要时联动 `packages/api-contract`

工作原则：

- 先搭运营信息架构，再补真实表格和表单
- 后台页面不要直接绕过 API 去读写数据库

### 平台 / 架构 Agent

主要负责：

- workspace
- `packages/config`
- CI、lint、typecheck、build、开发体验

工作原则：

- 优先保持 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` 可用
- 新依赖引入要解释必要性，避免为短期便利污染全仓

## 6. 接口和数据约定

这些是当前已锁定的跨端语义，不要随意改名：

- API 前缀：`/api/v1`
- 统一内容主键：`platform + platform_content_id`
- 账号控制权任务状态：
  `created | pending_user_action | pending_check | verified | rejected | expired | disputed`
- 播放状态：
  `idle | loading | ready | playing | paused | buffering | ended | error | blocked_by_autoplay`

如果必须调整这些语义，至少要同步更新：

- `packages/types`
- `packages/api-contract`
- `docs/2026-04-22-mainland-mvp-technical-route.md`
- `docs/development_log.md`

## 7. 环境与运行约束

- 根目录只放 workspace 级变量
- 应用级变量放各自 `.env.example`
- 本地基础设施通过 `infra/docker-compose.yml` 提供
- API 在未启动 Redis 时会出现 `ECONNREFUSED 127.0.0.1:6379` 日志，这是当前骨架阶段的已知现象
- `pnpm build` 当前可通过
- `apps/mobile` 现在支持 `pnpm --filter @ai-music-playlist/mobile web` 作为最小浏览器预览入口
- macOS 上可以直接双击根目录的 `preview-mobile-web.command` 启动 mobile web 预览
- macOS 上可以直接双击根目录的 `open-bilibili-debug.command` 启动 API + admin + B 站调试页
- `pnpm dev` 在受限沙箱里可能因为 watch / IPC 权限失败，这不等于项目本地不可用

## 8. 开发流程要求

每次改动尽量遵守这个顺序：

1. 读文档和最近开发日志
2. 明确只改自己负责的子系统
3. 若涉及跨端契约，先改 `packages/*`
4. 再改 `apps/*`
5. 跑至少一轮相关验证
6. 更新 `docs/development_log.md`

## 9. 完成某轮工作后必须更新的内容

每次完成一个有意义的工作单元后，更新 `docs/development_log.md`，至少记录：

- 日期
- 做了什么
- 影响哪些目录
- 跑了哪些验证命令
- 当前剩余问题
- 下一个最合理的动作

如果新增了重要工程约束、目录边界或协作规则，也要同步更新本文件。

## 10. 下一位 agent 的默认起手式

如果你是新进来的 agent，默认按这套方式开始：

1. 读 `README.md`
2. 读 `docs/development_log.md` 最近一节
3. 跑 `git status --short`
4. 明确当前工作是偏前端、后端、后台还是架构
5. 只在自己的边界内开工

如果用户给了跨端任务，优先拆成：

- 先共享契约
- 再 API
- 再客户端 / 后台

这样能最大程度保持架构健康和多代理协作稳定。
