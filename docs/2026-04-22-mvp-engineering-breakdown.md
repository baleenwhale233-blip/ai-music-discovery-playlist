# MVP 工程拆解清单

## 1. 目标

把当前仓库升级成可持续开发的 `pnpm + Turborepo` monorepo 基座，先建立工程边界、共享类型、环境变量与启动脚手架，不进入业务实现。

## 2. Monorepo 目录结构

```text
apps/
  mobile/
  api/
  admin/
packages/
  types/
  api-contract/
  config/
infra/
docs/
```

## 3. 各目录职责

- `apps/mobile`：React Native 客户端骨架，包含导航、Provider、状态层、API client 占位
- `apps/api`：NestJS 服务端骨架，包含全局前缀、健康检查、auth 壳、Prisma / Redis / BullMQ 模块
- `apps/admin`：Next.js 内部后台骨架，包含登录壳、布局壳和内容占位页
- `packages/types`：统一领域类型与状态枚举
- `packages/api-contract`：共享 DTO、请求响应 schema、模块前缀常量
- `packages/config`：共享 tsconfig、eslint、prettier、env schema 与工程常量
- `infra`：本地开发依赖，如 Postgres / Redis 的 docker compose

## 4. Phase 拆解

### Phase 0：工程准备

- 建立 workspace 与 turbo pipeline
- 建立根 README、`.env.example`、`.gitignore`
- 建立共享配置包与共享类型包
- 输出技术路线文档与工程拆解文档

### Phase 1：三端骨架

- `mobile` 建立 Expo App、React Navigation、Query 与 Zustand Provider
- `api` 建立 Nest 应用入口、全局前缀、健康检查、auth 壳、Prisma / Redis / Queue 模块
- `admin` 建立 Next App Router、登录壳、首页壳

### Phase 2：工程规范与最小验证

- 统一 `lint / typecheck / test / build / dev`
- Prisma schema 初版入仓
- 共享类型在三端可被引用
- `.env.example`、docker compose、开发说明到位

## 5. 模块先建空壳的范围

建议本轮先建空壳：

- `auth`
- `health`
- `contents`
- `imports`
- `playlists`
- `favorites`
- `history`
- `discovery`
- `source-accounts`
- `moderation`
- `admin`
- `users`

这些模块先只做目录和边界，不做业务逻辑。

## 6. 本轮不创建或不实现

- `packages/ui`
- B 站 / 抖音适配器实现
- WebView 播放容器实现
- 歌单、收藏、最近播放业务接口实现
- 短信验证码真实接入
- 运营配置真实 CRUD

## 7. 数据与基础设施最小顺序

1. 先有 Prisma schema
2. 再有 Redis / Queue 基础模块
3. 再接业务模块
4. 最后再接适配器与批量导入任务

## 8. 环境变量分层

- 根目录：仅 workspace 级变量
- `apps/api/.env.example`：数据库、Redis、端口、JWT、短信服务预留
- `apps/mobile/.env.example`：API base URL、Sentry DSN 预留
- `apps/admin/.env.example`：后台 base URL、内部登录预留

## 9. CI 最小建议

- 安装依赖
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- 后续再补 `pnpm build`

## 10. 第一轮验收标准

- 工作区可安装
- `pnpm dev` 可拉起三端开发进程
- `apps/api` 返回 `/api/v1/health`
- `apps/mobile` 进入空白首页
- `apps/admin` 进入后台首页
- Prisma schema 可生成 client
- Redis / BullMQ 连接配置可初始化
- 共享类型可被三端引用
