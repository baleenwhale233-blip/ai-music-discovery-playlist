# AI Music Discovery & Playlist

大陆版 MVP 工作区，当前真实目标是把“目录 -> 用户主动本地缓存 -> 真播放器 -> 听单”这条链路打磨成可持续演进的 Mobile Web First 产品原型。

## 当前真实路线

```text
Mobile Web First
-> 目录链接
-> 用户主动本地音频缓存
-> 真实播放器播放
-> 形成听单
```

当前不要再默认理解成：

- React Native 优先产品
- iframe/WebView 播放器产品
- 来源播放器容器产品

## 当前仓库角色

- `apps/web`：正式 Mobile Web 产品端，承载 alpha 登录、导入候选、批量缓存和本地听单播放器
- `apps/admin`：后台壳与实验/debug 前端，承载 `/debug/local-audio` 和 `/debug/bilibili`
- `apps/api`：当前主业务核心，负责来源解析、本地音频缓存、Range 播放、听单数据接口
- `apps/mobile`：保留未来原生壳扩展空间，但后置
- `packages/types`：共享领域类型、枚举、轻量常量
- `packages/api-contract`：共享 API 契约与 DTO
- `packages/config`：共享工程配置、env schema 与基础常量

## 文档入口

如果你是新进入项目的 agent，先读 [AGENTS.md](/Users/yang/Documents/New project/ai-music-discovery-playlist/AGENTS.md)，再按其中约定的恢复顺序继续读文档和检查当前 worktree。

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

建议使用 Node 22 LTS。本仓库已经提供 `.nvmrc` 和 `.node-version`；不要把 Node 25.3.0 作为日常验证环境，因为当前 Next / Nest / tsx 开发链路在过新的 Node 上更容易出现缓存、监听和热更新异常。

### Alpha 环境检查

正式 Mobile Web Alpha 的本地环境以 CLI 为准，VS Code 只是可选快捷入口。启动 API/Web 前，先跑：

```bash
pnpm preflight:alpha
```

它会检查：

- Node 22
- pnpm 与依赖安装状态
- `3020` Web 端口和 `4000` API 端口是否空闲或健康响应
- `5432` PostgreSQL 是否可达
- Prisma migration 状态
- `ffmpeg` / `yt-dlp`
- Redis 可达性（当前 Alpha smoke 只警告，不作为硬阻塞）

如果使用本机 PostgreSQL（推荐 Homebrew PostgreSQL 16），先安装并启动：

```bash
brew install postgresql@16
brew services start postgresql@16
```

然后运行：

```bash
pnpm setup:alpha-db
```

这个脚本会优先使用 `apps/api/.env` 里的 `DATABASE_URL`；如果本地还没有该文件，会从 `apps/api/.env.example` 生成开发用 `.env`，创建 `ai_music_playlist` 数据库，并执行 Prisma migration / generate。它不要求 Docker；Docker 只是不想装本机 PostgreSQL 时的替代方案。

### 当前最接近真实产品价值的实验页

如果当前目标是先验证核心产品链路，优先使用隔离的 clean-room 实验入口：

```bash
pnpm dev:local-audio-clean
```

然后打开：

- `http://127.0.0.1:3010`

这个入口只启动一个 Node 进程，同时提供页面和 API，不依赖 Nest、Next、Prisma、Redis、`.next` 缓存或双端口联调。它的本地缓存目录是：

- `.local-audio-clean-room-cache`

对应测试命令：

```bash
pnpm test:local-audio-clean
```

最快排查命令：

```bash
pnpm verify:local-audio-clean
```

它会一次性完成：

- 确认当前 Node 版本
- 跑 clean-room 单元测试
- 临时启动 `3010` smoke 服务
- 验证 `/health`、页面、空听单和音频 Range `206`
- 自动关闭 smoke 服务

下面的 `/debug/local-audio` 仍然保留为原工作区实验页，但如果你只是要判断“B 站链接 -> 本地音频缓存 -> audio 播放 -> 听单”是否成立，clean-room 入口更稳。

### 正式 Mobile Web Alpha

正式用户端入口已经从后台/debug 壳里拆到：

- `apps/web`

本地验证建议开两个终端：

```bash
pnpm dev:api
```

```bash
pnpm dev:web
```

然后打开：

- `http://127.0.0.1:3020`

默认 alpha 登录参数见 `apps/api/.env.example`：

- `ALPHA_INVITE_CODE=alpha-50`
- `ALPHA_LOGIN_CODE=246810`

正式 Web 只接 `/api/v1` 稳定端点，不直接依赖 `experiments/local-audio-clean-room`。clean-room 继续作为“核心链路是否成立”的参考实现和回归样本。

如果两个服务都已经启动，可以用下面的 smoke 命令确认 API、Web 和 Alpha 登录都可用：

```bash
pnpm verify:alpha-web
```

如果你使用 VS Code，可以运行 `Run and Debug -> Alpha Web (Dev)`，它只是先检查 `3020/4000` 是否适合新开 dev session，再启动同一套 `pnpm dev:api` 和 `pnpm dev:web`。

如果要验证“B 站链接 -> 本地音频缓存 -> 原生 audio 播放器 -> 实验听单”，可以双击：

- [open-local-audio-experiment.command](</Users/yang/Documents/New project/ai-music-discovery-playlist/open-local-audio-experiment.command>)

这个实验页需要本机安装：

```bash
brew install ffmpeg
```

页面地址是：

- `http://127.0.0.1:3000/debug/local-audio`

如果你只想先做环境检查，不真正启动服务：

```bash
./open-local-audio-experiment.command --check
```

停止服务可以双击：

- [stop-local-audio-experiment.command](</Users/yang/Documents/New project/ai-music-discovery-playlist/stop-local-audio-experiment.command>)

### 来源验证页

如果你只想验证来源解析而不是当前主产品链路，在 macOS 上可以直接双击：

- [open-bilibili-debug.command](</Users/yang/Documents/New project/ai-music-discovery-playlist/open-bilibili-debug.command>)

它会自动：

- 清理占用 `3000/4000` 端口的旧进程
- 构建 shared packages、API 和 admin
- 启动 API
- 启动 admin
- 打开 `http://127.0.0.1:3000/debug/bilibili`

`/debug/bilibili` 是来源验证页，不是当前主产品路线。

### 后置保留：mobile 壳预览

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

### 更稳的本地实验方式

如果你只是想稳定验证 `/debug/local-audio`，比 `build + start` 脚本更稳的是直接跑开发模式：

终端 1：

```bash
pnpm --filter @ai-music-playlist/api dev
```

终端 2：

```bash
pnpm --filter @ai-music-playlist/admin dev
```

然后打开：

- `http://localhost:3000/debug/local-audio`

这个方式的优点是：

- 不依赖 `next build`
- 不容易被旧的 `.next` 产物污染
- 出错时直接在终端看到 API / Next 的真实日志

如果你用 VS Code，也可以直接运行：

- `Run and Debug -> Local Audio Experiment (Dev)`

对应配置文件在：

- [.vscode/launch.json](/Users/yang/Documents/New project/ai-music-discovery-playlist/.vscode/launch.json)
- [.vscode/tasks.json](/Users/yang/Documents/New project/ai-music-discovery-playlist/.vscode/tasks.json)

## 常用命令

- `pnpm dev`
- `pnpm dev:web`
- `pnpm dev:api`
- `pnpm dev:admin`
- `pnpm dev:mobile:web`
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

## 约束

- 当前阶段已经进入实验业务闭环，不再只是“纯骨架”
- 当前主线是 `apps/web + apps/api`，不要默认把 `apps/admin` 或 `apps/mobile` 当作正式用户端
- `/debug/local-audio` 是当前最接近真实产品价值的实验页
- `/debug/bilibili` 只是来源验证页，不要把它包装成正式播放器体验
- 不把实验页误当作正式产品完成版
- 根目录只放 workspace 级配置，应用环境变量放各自目录
- 暂不创建 `packages/ui`
- `apps/mobile` 现在支持浏览器预览，但属于后置保留入口
