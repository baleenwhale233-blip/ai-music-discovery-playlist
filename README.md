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

- `apps/admin`：当前主 Web 原型与实验前端，承载 `/debug/local-audio` 和 `/debug/bilibili`
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

### 当前最接近真实产品价值的实验页

如果要验证“B 站链接 -> 本地音频缓存 -> 原生 audio 播放器 -> 实验听单”，可以双击：

- [open-local-audio-experiment.command](</Users/yang/Documents/New project/ai-music-discovery-playlist/open-local-audio-experiment.command>)

这个实验页需要本机安装：

```bash
brew install yt-dlp ffmpeg
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

## 常用命令

- `pnpm dev`
- `pnpm dev:mobile:web`
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

## 约束

- 当前阶段已经进入实验业务闭环，不再只是“纯骨架”
- 当前主线是 `apps/admin + apps/api`，不要默认把 `apps/mobile` 当作主前端
- `/debug/local-audio` 是当前最接近真实产品价值的实验页
- `/debug/bilibili` 只是来源验证页，不要把它包装成正式播放器体验
- 不把实验页误当作正式产品完成版
- 根目录只放 workspace 级配置，应用环境变量放各自目录
- 暂不创建 `packages/ui`
- `apps/mobile` 现在支持浏览器预览，但属于后置保留入口
