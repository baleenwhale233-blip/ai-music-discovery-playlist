# AI Music Discovery & Playlist

大陆版 MVP 工作区，目标是把“可播放目录型 AI 音乐工具”从概念文档推进到可持续开发的 monorepo 基座。

## 当前工程目标

- `apps/mobile`：React Native + Expo Prebuild 客户端骨架
- `apps/api`：NestJS + Prisma + Redis + BullMQ 服务端骨架
- `apps/admin`：Next.js 内部管理台骨架
- `packages/types`：共享领域类型
- `packages/api-contract`：共享 API 契约与 DTO
- `packages/config`：共享工程配置、env schema 与常量

## 文档入口

- 产品 PRD：[docs/prd v0.1.md](</Users/yang/Documents/New project/ai-music-discovery-playlist/docs/prd v0.1.md>)
- 技术路线：[docs/2026-04-22-mainland-mvp-technical-route.md](</Users/yang/Documents/New project/ai-music-discovery-playlist/docs/2026-04-22-mainland-mvp-technical-route.md>)
- 工程拆解：[docs/2026-04-22-mvp-engineering-breakdown.md](</Users/yang/Documents/New project/ai-music-discovery-playlist/docs/2026-04-22-mvp-engineering-breakdown.md>)
- 开发日志：[docs/development_log.md](</Users/yang/Documents/New project/ai-music-discovery-playlist/docs/development_log.md>)
- 多代理协作约束：[AGENTS.md](/Users/yang/Documents/New project/ai-music-discovery-playlist/AGENTS.md)

## 本地开发

1. 安装 `pnpm`
2. 复制环境变量模板
3. 安装依赖：`pnpm install`
4. 启动工作区：`pnpm dev`

### 最小本机预览

如果你暂时不想装 iOS / Android 原生环境，可以直接用浏览器预览 React Native 客户端壳：

```bash
pnpm dev:mobile:web
```

然后在浏览器打开 Expo 输出的本地地址。

如果你不想每次自己敲命令，在 macOS 上可以直接双击这个脚本：

- [preview-mobile-web.command](</Users/yang/Documents/New project/ai-music-discovery-playlist/preview-mobile-web.command>)

它会：

- 自动进入项目目录
- 检查 `pnpm`
- 如果缺少依赖则执行 `pnpm install`
- 启动 mobile web 预览
- 尝试自动打开浏览器到 `http://localhost:8081`

如果你只想先检查脚本环境，不启动预览，也可以运行：

```bash
./preview-mobile-web.command --check
```

如果只想先看后台壳，也可以运行：

```bash
pnpm dev:admin
```

### 一键启动 B 站调试页

如果你不想自己分别启动 API 和后台，在 macOS 上可以直接双击：

- [open-bilibili-debug.command](</Users/yang/Documents/New project/ai-music-discovery-playlist/open-bilibili-debug.command>)

它会自动：

- 清理占用 `3000/4000` 端口的旧进程
- 构建 shared packages、API 和 admin
- 启动 API
- 启动 admin
- 打开 `http://127.0.0.1:3000/debug/bilibili`

停止服务可以双击：

- [stop-bilibili-debug.command](</Users/yang/Documents/New project/ai-music-discovery-playlist/stop-bilibili-debug.command>)

### 一键启动本地音频实验页

如果要验证“B 站链接 -> 本地音频缓存 -> 原生 audio 播放器”，可以双击：

- [open-local-audio-experiment.command](</Users/yang/Documents/New project/ai-music-discovery-playlist/open-local-audio-experiment.command>)

这个实验页需要本机安装：

```bash
brew install yt-dlp ffmpeg
```

页面地址是：

- `http://127.0.0.1:3000/debug/local-audio`

如果你只想先做环境检查，不真正启动服务：

```bash
./open-bilibili-debug.command --check
```

## 常用命令

- `pnpm dev`
- `pnpm dev:mobile:web`
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

## 约束

- 当前阶段只搭工程骨架，不进入 B 站 / 抖音适配器、播放容器与歌单业务实现
- 根目录只放 workspace 级配置，应用环境变量放各自目录
- 暂不创建 `packages/ui`
- `apps/mobile` 现在支持浏览器预览，作为最小本机 UI 验证入口
