# 开发日志

本文件用于在切换对话、切换 agent、切换子任务时快速恢复上下文。  
每次完成一个阶段性工作后，都应该往下追加新记录，而不是覆盖历史。

---

## 2026-04-22 18:50 CST

### 本轮目标

把仓库从“概念文档目录”升级成可持续开发的 monorepo 基座，并补齐后续 agent 能直接接手的文档体系。

### 本轮完成

- 建立了 `pnpm + Turborepo` monorepo
- 建立了三端骨架：
  - `apps/mobile`
  - `apps/api`
  - `apps/admin`
- 建立了共享包：
  - `packages/types`
  - `packages/api-contract`
  - `packages/config`
- 补齐了两份正式文档：
  - `docs/2026-04-22-mainland-mvp-technical-route.md`
  - `docs/2026-04-22-mvp-engineering-breakdown.md`
- 更新了 `README.md`
- 新增了本文件 `docs/development_log.md`
- 新增了项目级协作文件 `AGENTS.md`

### 当前仓库结构

- `apps/mobile`：Expo Prebuild 客户端骨架，已接 React Navigation、TanStack Query、Zustand
- `apps/api`：NestJS 服务端骨架，已接 Prisma、Redis、BullMQ、Health、Auth 壳
- `apps/admin`：Next.js 内部后台骨架，已接首页壳和登录壳
- `packages/types`：统一领域类型和状态枚举
- `packages/api-contract`：统一 API contract 和 Zod schema
- `packages/config`：共享 tsconfig、eslint、prettier、env schema
- `infra/docker-compose.yml`：本地 Postgres / Redis 容器定义

### 当前已验证结果

以下命令已实际执行并通过：

- `pnpm install`
- `pnpm --filter @ai-music-playlist/api prisma:generate`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

额外验证结果：

- API 构建产物可启动
- 通过提权请求拿到了 `/api/v1/health`
- 返回示例：

```json
{"name":"@ai-music-playlist/api","version":"0.1.0","prefix":"api/v1","timestamp":"2026-04-22T10:47:41.042Z"}
```

### 当前已知事实

- `pnpm build` 当前可通过
- `apps/admin` 在首次 `next build` 时自动补写了 `tsconfig.json` 的兼容字段：
  - `noEmit: true`
  - `isolatedModules: true`
  - `jsx: preserve`
- `apps/api` 的启动路径当前是：
  - `node dist/apps/api/src/main.js`
- `apps/api` 启动时如果本机没有 Redis，会持续打印 `ECONNREFUSED 127.0.0.1:6379`
- 这属于当前基础设施未启动，不属于骨架代码错误

### 当前不要做的事

在没有明确用户要求前，先不要进入这些实现：

- B 站 / 抖音适配器
- WebView 播放容器
- 真实歌单业务
- 真实导入任务
- 短信验证码真实接入
- 后台真实运营 CRUD
- 过早创建 `packages/ui`

### 当前架构风险提醒

- 不要让 `apps/*` 之间直接互相引用
- 不要把业务逻辑塞进 `packages/types` 或 `packages/api-contract`
- 不要为了方便把移动端和后台各写一套重复的领域命名
- 如果后续做导入和播放，先统一 contract，再分别落到 API 和客户端

### 推荐的下一步优先级

推荐按这个顺序继续，而不是并行发散：

1. 先补 `apps/api` 的真实模块契约和 DTO 骨架
2. 再补 `apps/mobile` 的 API 接口层与空页面数据流
3. 然后进入 B 站单条导入链路
4. 再进入歌单和播放状态机

### 如果新 agent 接手

起手动作建议：

1. 读 `README.md`
2. 读 `AGENTS.md`
3. 读本文件最近一节
4. 跑 `git status --short`
5. 明确当前任务只属于哪一层：
   - mobile
   - api
   - admin
   - shared packages
   - infra / architecture

### 交接备注

- 这个仓库目前仍处于“骨架完成、业务未开工”的状态
- 后续每次完成一个阶段，都要继续往本文件追加，不要删掉已有历史

---

## 2026-04-22 19:05 CST

### 本轮目标

给 `apps/mobile` 增加一个不依赖 iOS / Android 原生环境的最小本机预览方式，让后续 agent 和开发者先用浏览器预览 RN 客户端壳。

### 本轮完成

- 为 `apps/mobile` 增加了 Expo Web 依赖：
  - `react-dom`
  - `react-native-web`
  - `@expo/metro-runtime`
- 为 `apps/mobile` 增加脚本：
  - `web`
  - `build:web`
- 为根 workspace 增加快捷脚本：
  - `pnpm dev:mobile:web`
- 更新了 `README.md`
- 更新了 `AGENTS.md`

### 新的最小预览方式

```bash
pnpm dev:mobile:web
```

用于本机浏览器打开 React Native 客户端壳，而不要求先安装：

- Xcode
- Android Studio
- CocoaPods
- JDK

### 本轮验证计划

需要至少验证这些命令：

- `pnpm install`
- `pnpm --filter @ai-music-playlist/mobile build:web`
- `pnpm typecheck`

如果当前对话的运行环境不适合长期占用本地端口，则优先用 `build:web` 证明 web 预览链路可构建。

### 本轮实际验证结果

以下命令已实际执行并通过：

- `pnpm install`
- `pnpm --filter @ai-music-playlist/mobile build:web`
- `pnpm typecheck`

额外验证事实：

- `apps/mobile/dist-web/index.html` 已生成
- Web bundle 已成功导出到 `apps/mobile/dist-web`

---

## 2026-04-22 19:20 CST

### 本轮目标

提供一个不需要反复手敲 CLI 命令的可执行脚本，让本机可以双击启动 mobile web 预览。

### 本轮完成

- 新增了根目录脚本：
  - `preview-mobile-web.command`
- 更新了 `README.md`
- 更新了 `AGENTS.md`

### 脚本行为

脚本会自动：

- 进入项目目录
- 检查 `pnpm`
- 在 `node_modules` 不存在时执行 `pnpm install`
- 启动 Expo Web 预览，固定端口 `8081`
- 尝试自动打开浏览器
- 支持 `--check` 做环境自检而不启动服务

### 本轮验证计划

至少验证：

- 脚本语法正确
- 脚本可执行

---

## 2026-04-22 21:40 CST

### 本轮目标

增加一个最小功能测试页，让本机可以直接验证“贴入 B 站链接 -> 解析 -> 外链播放器播放”这条链路，而不等待正式前端页面设计。

### 本轮完成

- 在 `apps/api` 新增了最小 B 站解析接口：
  - `POST /api/v1/contents/debug/parse-bilibili`
- 在 `apps/api` 的 `contents` 模块中新增：
  - 链接解析器
  - 元信息拉取 service
  - controller
- 在 `apps/admin` 新增调试页：
  - `/debug/bilibili`
- 调试页支持：
  - 粘贴 B 站链接
  - 解析标题 / 封面 / BVID / CID / 时长
  - 加载外链播放器
  - 播放 / 暂停按钮
  - 一键清空链接与本地缓存
- 在后台首页增加了调试页入口

### 当前实现边界

- 这是调试页，不是正式产品页面
- 播放依赖 B 站外链播放器
- 暂停按钮优先通过 `postMessage` 控制外链播放器
- 如果外链播放器未响应该指令，仍可通过播放器自身控件操作
- 当前缓存只做浏览器本地 `localStorage`

### 本轮验证计划

至少验证：

- `apps/api` 的解析器测试
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`

### 本轮实际验证结果

以下命令已实际执行并通过：

- `pnpm --filter @ai-music-playlist/api test src/modules/contents/bilibili-link.parser.test.ts`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`

额外真实验证：

- API 启动后已注册路由：
  - `POST /api/v1/contents/debug/parse-bilibili`
- 已实际请求本地解析接口并拿到返回数据：

```json
{
  "sourceUrl": "https://www.bilibili.com/video/BV1B7411m7LV?p=1",
  "normalizedUrl": "https://www.bilibili.com/video/BV1B7411m7LV?p=1",
  "bvid": "BV1B7411m7LV",
  "cid": 168325345,
  "page": 1,
  "title": "四月番毒奶安利！四月看这八部动画就够了！！",
  "embedUrl": "https://player.bilibili.com/player.html?bvid=BV1B7411m7LV&cid=168325345&p=1&autoplay=0&danmaku=0&poster=1"
}
```

### 当前已知事实

- 调试页路径是：
  - `/debug/bilibili`
- 这是后台里的临时验证页，不是正式产品页
- 当前清缓存只清浏览器本地 `localStorage`
- 当前播放 / 暂停依赖 B 站外链播放器能力，若外链播放器不响应该控制消息，仍可使用播放器内控件

---

## 2026-04-22 21:50 CST

### 本轮目标

消除“只是启动 API 做调试页验证也必须先起 Redis”这个不合理依赖，让最小调试链路默认可用。

### 根因

- `QueueService` 在服务启动时就提前创建了 BullMQ 队列
- BullMQ 队列一创建就会尝试连接 `REDIS_URL`
- 因此即使当前没有真正使用导入任务或验证任务，API 启动时也会因为 Redis 未启动而报 `ECONNREFUSED 127.0.0.1:6379`

### 本轮完成

- 为 `QueueService` 增加了惰性初始化测试
- 将 `QueueService` 改成按需创建队列
- 现在只有真正调用 `getQueue(...)` 时才会尝试连接 Redis

### 预期效果

- 只跑 B 站调试页、健康检查、普通 API 骨架时，不再要求本机先启动 Redis
- 后续真正进入导入任务、验证任务实现时，再要求 Redis 可用

---

## 2026-04-22 22:05 CST

### 本轮目标

提供一个可以直接双击执行的一键脚本，自动启动 B 站调试页所需的 API 和 admin 服务，避免手动输入多条命令。

### 本轮完成

- 新增了：
  - `open-bilibili-debug.command`
  - `stop-bilibili-debug.command`
- 更新了 `README.md`
- 更新了 `AGENTS.md`

### 启动脚本行为

`open-bilibili-debug.command` 会自动：

- 检查 `pnpm`
- 必要时安装依赖
- 清理 `3000` 和 `4000` 端口上的旧进程
- 构建 shared packages、API 和 admin
- 后台启动 API
- 后台启动 admin
- 自动打开 `/debug/bilibili`

### 停止脚本行为

`stop-bilibili-debug.command` 会根据 pid 文件停止刚才脚本启动的 API 和 admin 进程。

---

## 2026-04-22 22:45 CST

### 本轮目标

把 `/debug/bilibili` 从“视频外链验证页”收成“音频优先调试页”，弱化视频画面，增强听歌工具感。

### 本轮完成

- 新增了 admin 侧纯函数：
  - `apps/admin/app/debug/bilibili/audio-priority.ts`
- 新增了对应测试：
  - `apps/admin/app/debug/bilibili/audio-priority.test.ts`
- 更新了 `/debug/bilibili` 页面交互：
  - 默认进入音频优先模式
  - 默认隐藏视频画面
  - 封面和信息卡变成主视觉
  - 播放器退到次要区域
  - 暂停按钮改成“暂停尝试”
  - 新增“停止并收起播放器”
  - 新增“显示/隐藏视频画面”切换

### 当前实现边界

- 底层仍然是 B 站外链视频播放器，不是真正的纯音频内核
- 因此“暂停尝试”仍然不能等同于音乐 App 的稳定暂停/续播
- 当前改动的重点是弱化视频心智，而不是假装已经具备完整音频播放能力

### 本轮实际验证结果

以下命令已实际执行并通过：

- `pnpm --filter @ai-music-playlist/admin test app/debug/bilibili/audio-priority.test.ts`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`

---

## 2026-04-22 23:05 CST

### 本轮目标

补上调试页更接近“播放器默认功能”的体验：进度条、暂停后继续播放的语义，以及更稳定的封面展示。

### 本轮完成

- 新增了 admin 侧进度辅助函数与测试：
  - `apps/admin/app/debug/bilibili/audio-playback.ts`
  - `apps/admin/app/debug/bilibili/audio-playback.test.ts`
- 新增了 API 侧封面 URL 规范化辅助函数与测试：
  - `apps/api/src/modules/contents/bilibili-cover.ts`
  - `apps/api/src/modules/contents/bilibili-cover.test.ts`
- `/debug/bilibili` 页面现在支持：
  - 估算进度条
  - 已播放时间 / 总时长
  - pause 后尽量 resume，而不是每次都重建播放器
  - 封面走 API 代理兜底，减轻 B 站图片直链不稳定的问题
- API 新增封面代理接口：
  - `GET /api/v1/contents/debug/cover?url=...`

### 当前实现边界

- 进度条是“音频优先调试进度”，基于页面内状态估算，不是直接读取 B 站播放器内部 currentTime
- 现在的 pause / resume 已经避免了原先“每次播放都重建 iframe”的问题
- 但底层依旧是 B 站外链播放器，所以暂停后能否完全按音乐 App 一样续播，仍取决于外链播放器对 `postMessage(play:true/false)` 的实际支持

### 本轮实际验证结果

以下命令已实际执行并通过：

- `pnpm --filter @ai-music-playlist/admin test app/debug/bilibili/audio-playback.test.ts app/debug/bilibili/audio-priority.test.ts`
- `pnpm --filter @ai-music-playlist/api test src/modules/contents/bilibili-cover.test.ts src/modules/contents/bilibili-link.parser.test.ts`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`

---

## 2026-04-22 23:55 CST

### 本轮目标

开始验证“B 站链接 -> 本地音频文件 -> 原生播放器播放”的新技术路线，和 iframe 外链播放器路线隔离。

### 本轮完成

- API 新增实验接口：
  - `POST /api/v1/contents/experimental/local-audio`
  - `GET /api/v1/contents/experimental/local-audio/:cacheKey/audio`
  - `GET /api/v1/contents/experimental/local-audio/:cacheKey/cover`
  - `DELETE /api/v1/contents/experimental/local-audio/:cacheKey`
- 新增本地音频缓存 helper：
  - `apps/api/src/modules/contents/local-audio-cache.ts`
  - `apps/api/src/modules/contents/local-audio-cache.test.ts`
- 新增实验页面：
  - `apps/admin/app/debug/local-audio/page.tsx`
- 新增一键启动脚本：
  - `open-local-audio-experiment.command`
- 本地音频缓存目录：
  - `.local-audio-cache`

### 当前实现方式

- 后端调用本机 `yt-dlp + ffmpeg`
- 输出本地音频文件
- admin 页面使用浏览器原生 `<audio controls>`
- 真实播放、暂停、继续、进度条能力来自 media element，不再依赖 B 站 iframe

### 当前环境状态

- 代码和页面已经构建通过
- `brew install yt-dlp ffmpeg` 曾尝试执行，但 Homebrew 下载依赖时网络中断
- 因此真实转换前仍需要确保本机存在：
  - `yt-dlp`
  - `ffmpeg`

### 本轮实际验证结果

以下命令已实际执行并通过：

- `pnpm --filter @ai-music-playlist/api test src/modules/contents/local-audio-cache.test.ts src/modules/contents/bilibili-cover.test.ts src/modules/contents/bilibili-link.parser.test.ts`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`

---

## 2026-04-23 00:10 CST

### 本轮目标

修复本地音频实验页里 `<audio>` 可以播放和暂停，但拖动进度条不生效的问题。

### 根因

- 原本本地音频接口只返回普通 `200` 流式响应
- 浏览器 audio 控件要可靠 seek，需要服务端支持 HTTP Range 请求
- 没有 `206 Partial Content`、`Content-Range`、`Accept-Ranges` 和正确 `Content-Length` 时，浏览器经常不能拖动进度条

### 本轮完成

- 在 `local-audio-cache.ts` 新增 `parseHttpRange`
- 为 Range 解析补了测试
- `GET /api/v1/contents/experimental/local-audio/:cacheKey/audio` 现在支持：
  - `Range: bytes=...`
  - `206 Partial Content`
  - `Content-Range`
  - `Accept-Ranges: bytes`
  - `Content-Length`
- 无 Range 请求时仍返回完整音频文件

### 本轮实际验证结果

以下命令已实际执行并通过：

- `pnpm --filter @ai-music-playlist/api test src/modules/contents/local-audio-cache.test.ts`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`

---

## 2026-04-23 00:25 CST

### 本轮目标

验证“多首本地音频缓存组成一组实验播放单”的体验，并初步尝试把 B 站收藏夹解析成候选播放单。

### 本轮完成

- API 新增 B 站收藏夹预览接口：
  - `POST /api/v1/contents/experimental/bilibili-favorite-preview`
- B 站收藏夹解析支持：
  - `fid`
  - `media_id`
  - `mlid`
- `apps/admin/app/debug/local-audio/page.tsx` 重构为实验播放单页面
- 支持单条 B 站链接缓存后加入播放单
- 支持 B 站收藏夹解析为候选列表
- 支持删除候选里的非歌曲/非学习内容
- 支持将候选逐首缓存成本地音频并加入播放单
- 支持播放单连续播放，当前曲目结束后自动切下一首
- 支持从播放单移除条目
- 支持清空播放单和本地缓存

### 当前实现边界

- 这是实验播放单，不是正式歌单系统
- 播放单数据当前只存在页面内存，刷新后会丢失
- 收藏夹解析只取第一页，默认 `limit=30`
- 收藏夹里是否是歌曲/学习内容，当前完全由用户手动删除筛选
- 批量缓存是串行逐首执行，适合技术验证，不适合正式大量任务

### 本轮实际验证结果

以下命令已实际执行并通过：

- `pnpm --filter @ai-music-playlist/api test src/modules/contents/bilibili-link.parser.test.ts src/modules/contents/local-audio-cache.test.ts`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`

---

## 2026-04-23 00:50 CST

### 本轮目标

把技术路线、工程拆解和 AGENTS 文档统一到当前真实路线，避免后续 agent 继续按旧的 `React Native + iframe/WebView` 叙事开工。

### 本轮完成

- 重写技术路线文档：
  - `docs/2026-04-22-mainland-mvp-technical-route.md`
- 重写工程拆解文档：
  - `docs/2026-04-22-mvp-engineering-breakdown.md`
- 重写协作文档：
  - `AGENTS.md`

### 新的统一主叙事

```text
Mobile Web First
-> Source Adapter
-> 用户主动本地音频缓存
-> 真播放器
-> 听单
```

### 文档统一后的关键结论

- `apps/admin` 当前承担 Web 原型和实验页，不再只是后台壳
- `apps/api` 是当前主业务核心
- `apps/mobile` 保留但后置
- `/debug/bilibili` 是来源验证页，不再是主路线
- `/debug/local-audio` 是当前最接近产品真实价值的实验页
