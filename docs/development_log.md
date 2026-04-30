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
  - `stop-local-audio-experiment.command`
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

`stop-local-audio-experiment.command` 会根据 pid 文件停止刚才脚本启动的 API 和 admin 进程。

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

---

## 2026-04-23 16:55 CST

### 本轮目标

把当前真实产品路线正式落进数据库骨架，先完成模型层而不急着进入迁移和业务写入逻辑。

### 本轮完成

- 重写了 `apps/api/prisma/schema.prisma`
- 同步升级了 `packages/types/src/index.ts`
- 为新的数据库领域常量补了测试

### 当前数据库骨架包含的核心对象

- `User`
- `SourceAccount`
- `SourceContent`
- `SourceCollection`
- `SourceCollectionItem`
- `Playlist`
- `PlaylistItem`
- `Favorite`
- `PlayHistory`
- `ContentMeta`
- `LocalAudioAsset`
- `ConversionTask`
- `ClaimOrVerificationTask`

### 这次新增/强化的重点

- `SourcePlatform` 扩展为：
  - `BILIBILI`
  - `YOUTUBE`
  - `DOUYIN`
  - `TIKTOK`
- `SourceContent` 增加 `contentKind`
- 新增 `SourceCollection / SourceCollectionItem` 用于收藏夹、播放列表和候选目录
- `Playlist` 增加：
  - `kind`
  - `sourceType`
  - `sourceCollectionId`
  - `itemCount`
  - `cachedItemCount`
- `PlaylistItem` 增加：
  - `localAudioAssetId`
  - `titleSnapshot`
  - `coverUrlSnapshot`
  - `durationSecSnapshot`
- 新增 `LocalAudioAsset`
- 新增 `ConversionTask`
- `PlayHistory` 现在可关联 `localAudioAsset`

### 当前边界

- 这轮只完成数据库 schema 和共享类型骨架
- 还没有生成正式 migration
- 还没有把实验页改成读写这些正式表
- `Playlist` 目前仍是“听单语义的正式骨架”，不是完整业务层

### 本轮实际验证结果

以下命令已实际执行并通过：

- `pnpm --filter @ai-music-playlist/types test src/index.test.ts`
- `pnpm typecheck`
- `pnpm --filter @ai-music-playlist/api prisma:generate`

---

## 2026-04-23 18:55 CST

### 本轮目标

把当前实验播放单从“页面内存状态”接进正式数据库骨架，先打通最小闭环：

- 缓存一首歌时落库
- 能从数据库读取实验听单
- 能删除单个条目
- 能清空听单

### 本轮完成

- 扩展了 `packages/api-contract`：
  - `ExperimentalPlaylist`
  - `ExperimentalPlaylistItem`
  - `ExperimentalPlaylistResponse`
- 新增了 `buildExperimentalPlaylistResponse` helper 和测试
- `cacheBilibiliAudio(...)` 现在会在缓存成功后写入：
  - `SourceContent`
  - `LocalAudioAsset`
  - `ConversionTask`
  - `PlaylistItem`
- 现在会自动保证存在一个实验用户和一个默认实验听单：
  - `本地音频实验用户`
  - `实验本地听单`
- 新增读取实验听单接口：
  - `GET /api/v1/contents/experimental/local-audio/playlist`
- 新增删除单个听单条目接口：
  - `DELETE /api/v1/contents/experimental/local-audio/playlist/items/:playlistItemId`
- 新增清空实验听单接口：
  - `DELETE /api/v1/contents/experimental/local-audio/playlist`
- `apps/admin/app/debug/local-audio/page.tsx` 不再只依赖页面内存，而会：
  - 初始读取实验听单
  - 加入单曲后刷新听单
  - 批量缓存后刷新听单
  - 删除条目时刷新听单
  - 清空听单时请求后端删除缓存并同步状态

### 当前边界

- 这仍然是实验听单，不是正式用户级歌单系统
- 听单仍然只有一组默认实验听单，不支持多听单切换
- 收藏夹解析候选列表当前仍然不持久化到 `SourceCollection` 表
- 真正的持久化当前先落在：
  - `SourceContent`
  - `LocalAudioAsset`
  - `Playlist`
  - `PlaylistItem`
  - `ConversionTask`

### 本轮实际验证结果

以下命令已实际执行并通过：

- `pnpm --filter @ai-music-playlist/api-contract test src/index.test.ts`
- `pnpm --filter @ai-music-playlist/api test src/modules/contents/experimental-playlist.test.ts`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`

---

## 2026-04-23 19:46 CST

### 本轮目标

收口协作文档，减少新对话里的 agent 因为起手顺序冲突、主路线叙事不一致和交接点不清而陷入重复确认。

### 本轮完成

- 重写了 `README.md` 开头和开发入口说明：
  - 把主叙事统一为 `Mobile Web First -> 本地音频缓存 -> 真播放器 -> 听单`
  - 明确 `/debug/local-audio` 是当前最接近真实产品价值的实验页
  - 明确 `/debug/bilibili` 只是来源验证页
  - 明确 `apps/mobile` 是后置保留，不是当前主前端
- 收口了 `AGENTS.md` 的恢复顺序：
  - 统一为 `AGENTS -> README -> PRD -> IA -> 技术路线 -> 工程拆解 -> development_log 最近一节 -> git status --short`
  - 删除了原来“本文件先读”和“本文件最后读”并存造成的自相矛盾
- 在 `AGENTS.md` 中补充了交接要求：
  - 如果当前代码已经领先于 `docs/development_log.md`，本轮结束前必须补日志
  - 如果 `git status --short` 显示已有 WIP，默认把它视为有效上下文，而不是围绕同一个路线问题循环追问

### 影响目录

- `README.md`
- `AGENTS.md`
- `docs/development_log.md`

### 本轮实际验证结果

以下命令已实际执行并通过：

- `git diff --check -- README.md AGENTS.md docs/development_log.md`
- `rg -n "当前真实路线|第 2 节|git status --short|/debug/local-audio|/debug/bilibili" README.md AGENTS.md docs/development_log.md`

### 当前剩余问题

- 当前 worktree 里仍然有一批尚未提交的 API / admin / shared package 改动，新的开发日志只补了“协作文档已收口”，还没有替这些业务改动额外生成独立交接说明
- `README.md` 和 `AGENTS.md` 已经统一，但如果后续继续调整真实路线，仍然需要同步更新技术路线文档和开发日志最近一节

### 下一个最合理的动作

- 在下一轮业务改动结束后，补一条面向实际功能进度的 `docs/development_log.md` 记录，把当前 worktree 里的进行中状态也完整落盘

---

## 2026-04-23 20:45 CST

### 本轮目标

修复本地音频缓存链路里 B 站 412 问题，让实验页重新能够把 B 站内容落到本地音频缓存。

### 本轮完成

- 定位到失败根因不在链接解析，而在 `yt-dlp` 请求：
  - `https://api.bilibili.com/x/player/wbi/playurl`
  - 返回 `HTTP 412 Precondition Failed`
- 实测确认：
  - 关代理后仍然 412
  - 当前环境下浏览器 cookies 无法稳定解密，不适合作为主修复路径
- 改为绕开 `yt-dlp` 的 B 站取流链路：
  - 通过 `m.bilibili.com/video/...` 页面里的 `window.__INITIAL_STATE__`
  - 提取 `video.playUrlInfo[0].url`
  - 再交给 `ffmpeg` 直接抽取本地 `m4a`
- 为新的缓存链路补了纯函数测试：
  - 移动页播放 URL 解析
  - `ffmpeg` 参数构建
- 更新了协作文档和 README：
  - 当前本地音频实验不再把 `yt-dlp` 作为必需依赖
  - 实验依赖说明收口为 `ffmpeg`

### 影响目录

- `apps/api/src/modules/contents/contents.service.ts`
- `apps/api/src/modules/contents/local-audio-cache.ts`
- `apps/api/src/modules/contents/local-audio-cache.test.ts`
- `README.md`
- `AGENTS.md`
- `docs/development_log.md`

### 本轮实际验证结果

以下验证已实际执行并通过：

- `yt-dlp -v ...` 复现 412，确认失败点在 `x/player/wbi/playurl`
- 从 `m.bilibili.com` 页面提取 `playUrlInfo[0].url`
- `ffmpeg` 基于该播放 URL 成功抽取 `3s` 本地 `m4a` 样本到 `/tmp/bili-sample.m4a`

### 当前剩余问题

- 当前修复路径依赖移动页 `__INITIAL_STATE__` 结构，后续如果 B 站移动页结构再改，仍需要重新适配
- 当前没有把封面额外落本地文件，`coverRelativePath` 仍可能为空
- 如果本地没有 PostgreSQL，实验页现在会回退到纯本地缓存播放单，但收藏夹预览仍然依赖数据库

### 下一个最合理的动作

- 跑一轮 `contents` 相关测试、`typecheck`、`lint`、`build`，确认新缓存链路在仓库内通过，再用实验页做一次人工验证

---

## 2026-04-23 23:20 CST

### 本轮目标

修复“单条缓存和播放都报 Internal server error”的本地实验可用性问题，并把无数据库环境下的体验补到可用。

### 本轮完成

- 定位出当前本地 500 的真实原因不是单一问题，而是两层叠加：
  - `yt-dlp` 的 B 站 `wbi/playurl` 412
  - 本地未启动 PostgreSQL，导致 Prisma 首次写播放单就抛错
- 保留上一轮的移动页取流方案，同时新增无数据库 fallback：
  - 缓存成功后把最小元数据写入 `.local-audio-cache/<cacheKey>/metadata.json`
  - `GET /experimental/local-audio/playlist` 在 Prisma 不可用时从本地缓存目录生成播放单
  - 移除单条和清空播放单在 Prisma 不可用时退回到纯本地缓存删除
- 修复了 `open-local-audio-experiment.command` 的启动探针文案：
  - 从旧的 `Experimental Local Audio v1`
  - 更新为当前页面实际文案 `Experimental Local Playlist v1`
- 为全局 HTTP 异常过滤器补了 error log，避免后续只返回 `Internal server error` 却没有服务端栈

### 影响目录

- `apps/api/src/config/env.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/modules/contents/local-audio-cache.ts`
- `apps/api/src/modules/contents/local-audio-cache.test.ts`
- `apps/api/src/modules/contents/contents.service.ts`
- `apps/api/src/common/filters/http-exception.filter.ts`
- `open-local-audio-experiment.command`
- `docs/development_log.md`

### 本轮实际验证结果

以下验证已实际执行并通过：

- `pnpm --filter @ai-music-playlist/api test src/modules/contents/local-audio-cache.test.ts`
- `pnpm --filter @ai-music-playlist/api typecheck`
- `pnpm --filter @ai-music-playlist/api build`
- 非沙箱进程内调用 `cacheBilibiliAudio(...)` 成功返回本地缓存响应
- 非沙箱进程内调用 `getExperimentalPlaylist()` 在无 PostgreSQL 环境下成功返回本地缓存播放单

### 当前剩余问题

- 收藏夹预览链路当前仍然依赖 Prisma / PostgreSQL，本轮没有把它改成无数据库 fallback
- 启动脚本会清理 3000/4000 端口，但如果有异常残留进程，仍可能需要先运行一次停止脚本

### 下一个最合理的动作

- 重启本地实验服务到最新构建后，再从页面验证：
  - 单条 B 站链接缓存
  - 播放单初始化读取
  - audio 播放

---

## 2026-04-23 23:35 CST

### 本轮目标

给本地实验补一个比现有 shell 脚本更稳的启动形式，减少 `EADDRINUSE` 和 `next build/start` 带来的误判。

### 本轮完成

- 新增了 VS Code 本地调试配置：
  - `.vscode/launch.json`
  - `.vscode/tasks.json`
- 提供了一个 compound 启动入口：
  - `Local Audio Experiment (Dev)`
- compound 启动会先执行：
  - `./stop-local-audio-experiment.command`
- 然后分别启动：
  - `pnpm --filter @ai-music-playlist/api dev`
  - `pnpm --filter @ai-music-playlist/admin dev`
- 更新了 `README.md`，明确推荐：
  - 本地实验优先使用 `API dev + admin dev`
  - 尽量绕开当前不稳定的 `admin build + start` 路径

### 影响目录

- `.vscode/launch.json`
- `.vscode/tasks.json`
- `README.md`
- `docs/development_log.md`

### 本轮实际验证结果

以下检查已实际执行并通过：

- `zsh -n open-local-audio-experiment.command`
- `pnpm --filter @ai-music-playlist/api lint`
- `pnpm --filter @ai-music-playlist/api build`

### 当前剩余问题

- `apps/admin` 的 `next build` / `next start` 在这台机器上仍有 `.next` 产物相关不稳定问题
- shell 脚本仍然适合作为“一键启动”入口，但目前不适合作为最稳的日常开发入口

### 下一个最合理的动作

- 以 VS Code compound 或双终端 dev 模式为主继续验证 `/debug/local-audio`

---

## 2026-04-24 11:45 CST

### 本轮目标

停止在现有 `apps/api + apps/admin` 调试链路里继续逐点救火，按产品文档和新技术路线新增一个仓库内隔离的 clean-room 本地音频实验入口，先验证核心产品链路。

### 本轮完成

- 新增 `experiments/local-audio-clean-room`：
  - 使用一个纯 Node HTTP 进程同时提供页面和 API
  - 默认端口 `3010`
  - 不依赖 Nest、Next、Prisma、Redis、tsx watch 或 `.next` 缓存
- 新增 clean-room API：
  - `GET /`
  - `GET /health`
  - `POST /api/cache`
  - `POST /api/favorite-preview`
  - `GET /api/playlist`
  - `DELETE /api/playlist`
  - `DELETE /api/playlist/:cacheKey`
  - `GET /api/audio/:cacheKey`
- 新增本地文件缓存约定：
  - `.local-audio-clean-room-cache/<cacheKey>/audio.m4a`
  - `.local-audio-clean-room-cache/<cacheKey>/metadata.json`
- 保留已验证的 B 站取流路线：
  - 视频元信息走 `x/web-interface/view`
  - 播放直链走移动页 `window.__INITIAL_STATE__`
  - 音频转换走 `ffmpeg`
- 新增根目录脚本：
  - `pnpm dev:local-audio-clean`
  - `pnpm test:local-audio-clean`
- 新增 Node 运行时约束：
  - `.nvmrc`
  - `.node-version`
  - 默认锁到 Node 22 LTS
- 更新 `README.md` 和 `AGENTS.md`：
  - 明确 clean-room 是当前验证核心链路的更稳入口
  - 明确不要把 Node 25.3.0 作为日常验证环境

### 影响目录

- `experiments/local-audio-clean-room`
- `package.json`
- `.gitignore`
- `.nvmrc`
- `.node-version`
- `README.md`
- `AGENTS.md`
- `docs/development_log.md`

### 本轮实际验证结果

以下验证已实际执行：

- `node --test experiments/local-audio-clean-room/core.test.mjs`
- `pnpm test:local-audio-clean`
- `pnpm dev:local-audio-clean`
- `curl -sS http://127.0.0.1:3010/health`
- `curl -sS http://127.0.0.1:3010/`
- `curl -sS http://127.0.0.1:3010/api/playlist`
- `curl -sS -i -H 'Range: bytes=2-5' http://127.0.0.1:3010/api/audio/BVsmoke`
- `node --check experiments/local-audio-clean-room/core.mjs`
- `node --check experiments/local-audio-clean-room/server.mjs`
- `git diff --check`

验证结果：

- 单元测试和 HTTP smoke test 均通过
- 当前机器仍在 Node 25.3.0 下执行，因此 `pnpm` 会按新增 `engines` 约束提示 Node 版本警告；测试本身通过
- `GET /health` 返回 200
- `GET /` 返回 clean-room 页面
- 空缓存时 `GET /api/playlist` 返回空听单
- 临时缓存音频的 Range 请求返回 `206 Partial Content` 和正确 `Content-Range`

### 当前剩余问题

- 本轮没有把 clean-room 实现回迁到正式 `apps/api + apps/admin`
- 本轮没有做真实 B 站单条链接的端到端缓存，因为当前执行环境仍是 Node 25.3.0；日常手工验证建议先切到 Node 22 LTS
- 收藏夹候选删除只在页面内存中生效，符合 clean-room 实验边界，不是正式导入系统

### 下一个最合理的动作

- 使用 Node 22 LTS 运行 `pnpm dev:local-audio-clean`
- 打开 `http://127.0.0.1:3010`
- 用真实 B 站单条链接和收藏夹链接完成一次人工端到端验证
- 如果 clean-room 链路稳定，再把对应实现回迁到正式 `apps/api + apps/admin`

---

## 2026-04-24 12:10 CST

### 本轮目标

把本地验证路径进一步收口成“一个命令出诊断结果，一个页面做人工验证”，避免继续在多个终端和多个服务之间来回切换。

### 本轮完成

- 安装并切换 Homebrew 全局 Node 到 `node@22`
  - 当前 `node -v` 为 `v22.22.2`
  - 当前 `pnpm -v` 为 `9.15.0`
- 修复了安装 `node@22` 后全局 `node` 仍指向 Node 25 导致的 `libsimdjson.29.dylib` 动态库错误：
  - `brew unlink node`
  - `brew link --overwrite --force node@22`
- 新增 `pnpm verify:local-audio-clean` 作为最快排查命令：
  - 打印 Node 版本和二进制路径
  - 跑 clean-room 单元测试
  - 临时启动 `127.0.0.1:3010`
  - 验证 `/health`
  - 验证页面内容
  - 验证空听单
  - 验证音频 Range `206 Partial Content`
  - 自动关闭 smoke 服务
- 保留 `pnpm dev:local-audio-clean` 作为人工验证入口。

### 影响目录

- `experiments/local-audio-clean-room/verify.mjs`
- `package.json`
- `README.md`
- `docs/development_log.md`

### 本轮实际验证结果

以下命令已实际执行并通过：

- `node -v`
- `which node`
- `pnpm -v`
- `pnpm verify:local-audio-clean`

验证结果：

- `node -v` 返回 `v22.22.2`
- `which node` 返回 `/opt/homebrew/bin/node`
- `pnpm verify:local-audio-clean` 通过全部 7 个测试，并完成 `health/page/empty playlist/audio range 206` smoke 验证

### 当前剩余问题

- 真实 B 站单条缓存和收藏夹候选仍需要用户在页面里做一次人工端到端验证
- `apps/api + apps/admin` 的旧实验链路仍保留为 WIP，本轮只收口 clean-room 验证路径

### 下一个最合理的动作

- 日常排查先跑 `pnpm verify:local-audio-clean`
- 人工验证再跑 `pnpm dev:local-audio-clean`
- 打开 `http://127.0.0.1:3010`
- 只在 clean-room 稳定后，再考虑把实现回迁到正式 Next/Nest 工作区

---

## 2026-04-24 12:35 CST

### 本轮目标

修复 clean-room 实验中两个真实验收问题：缓存后的 B 站封面不显示，以及视频页内 `custom_collection` / 合集链接不能解析候选。

### 本轮完成

- 为 clean-room 增加同源封面代理：
  - 听单里的封面 URL 现在返回 `/api/cover/:cacheKey`
  - `metadata.json` 仍保留原始 B 站封面地址
  - `/api/cover/:cacheKey` 用 B 站 referer 和桌面 UA 拉取图片，避免浏览器直接加载外链封面失败
- 扩展候选预览能力：
  - 原 `POST /api/favorite-preview` 继续兼容收藏夹 / 播放列表链接
  - 新增支持视频页内 `window.__INITIAL_STATE__.videoData.ugc_season`
  - 支持 `space.bilibili.com/.../channel/collectiondetail?sid=...` 形式的合集链接
  - 如果视频页内嵌合集数据不完整，会回退到 B 站合集分页 API 拉取候选
- 调整 clean-room 页面文案：
  - 从“收藏夹候选”改为“合集 / 收藏夹候选”
  - 解析候选时不再从前端固定限制 30 条，由后端默认最多取 500 条
  - 状态栏显示已取候选数和总数
- 修复 `pnpm verify:local-audio-clean`：
  - smoke server 改为随机临时端口
  - 避免和人工验证用的固定 `3010` 端口冲突

### 影响目录

- `experiments/local-audio-clean-room/core.mjs`
- `experiments/local-audio-clean-room/server.mjs`
- `experiments/local-audio-clean-room/core.test.mjs`
- `experiments/local-audio-clean-room/server.test.mjs`
- `experiments/local-audio-clean-room/verify.mjs`
- `docs/development_log.md`

### 本轮实际验证结果

以下命令已实际执行并通过：

- `pnpm test:local-audio-clean`
- `pnpm verify:local-audio-clean`
- `git diff --check`

另外使用用户给出的真实 B 站链接做了只读解析验证：

- 链接：`https://www.bilibili.com/video/BV1NFq2B8EVS/`（已脱敏分享查询参数）
- 解析结果：合集标题 `不存在的电台`
- `mediaId`: `6609608`
- `mid`: `1091`
- `totalCount`: `123`
- `itemCount`: `123`
- 当前视频 `BV1NFq2B8EVS` 出现在候选第 62 条

### 当前剩余问题

- 候选列表里的封面目前仍使用 B 站图片外链，缓存进入听单后的封面已走同源代理；如果候选封面也被浏览器拦截，下一步可增加受限域名的候选封面代理。
- clean-room 仍是隔离实验，不是正式 `apps/api + apps/admin` 回迁实现。
- 大合集批量缓存仍是串行执行，适合验证，不适合长期生产体验；正式化时需要任务队列、并发限制和失败重试。

### 下一个最合理的动作

- 运行 `pnpm dev:local-audio-clean`
- 打开 `http://127.0.0.1:3010`
- 用上述视频页合集链接验证候选解析
- 先删除不想缓存的候选，再少量缓存几首验证封面、音频 Range 和连续播放

---

## 2026-04-24 12:55 CST

### 本轮目标

修复 clean-room 页面中“合集候选能解析但封面仍不显示”的问题。

### 根因

- 上一轮只给“已缓存进入听单的封面”增加了 `/api/cover/:cacheKey` 同源代理。
- 合集 / 收藏夹候选列表仍然返回 B 站图片外链，浏览器侧可能继续被防盗链、跨域策略或图片域名策略影响。
- 本地验证确认已缓存听单封面代理可用；问题主要落在候选列表封面链路。

### 本轮完成

- 新增候选封面同源代理：
  - `GET /api/cover-proxy?url=...`
  - 仅允许代理 `hdslb.com` / `biliimg.com` 域名，避免变成任意 URL 转发器
  - 拉取图片时携带 B 站 referer 和桌面 UA
- 所有候选 preview 的 `coverUrl` 改为 `/api/cover-proxy?url=...`：
  - 收藏夹候选
  - 视频页 `ugc_season` 合集候选
  - `collectiondetail?sid=...` 分页合集候选
- 保留已缓存听单封面代理 `/api/cover/:cacheKey` 不变。

### 影响目录

- `experiments/local-audio-clean-room/core.mjs`
- `experiments/local-audio-clean-room/server.mjs`
- `experiments/local-audio-clean-room/core.test.mjs`
- `experiments/local-audio-clean-room/server.test.mjs`
- `docs/development_log.md`

### 本轮实际验证结果

以下命令已实际执行并通过：

- `pnpm test:local-audio-clean`
- `pnpm verify:local-audio-clean`

另外做了真实 B 站链接和真实图片代理验证：

- 用户给出的合集链接仍可解析为 `不存在的电台`，`totalCount=123`，`itemCount=123`
- 候选封面现在返回 `/api/cover-proxy?url=...`
- 临时本地服务请求真实 B 站封面代理返回 `200 image/jpeg`

### 当前剩余问题

- 如果浏览器里仍看不到封面，优先确认是否已经重启 `pnpm dev:local-audio-clean`，因为运行中的 Node 服务不会自动热更新。
- 大合集批量缓存仍然是验证用串行缓存，后续正式化需要队列、失败重试和并发限制。

### 下一个最合理的动作

- 停掉当前 `pnpm dev:local-audio-clean`
- 重新运行 `pnpm dev:local-audio-clean`
- 刷新 `http://127.0.0.1:3010`
- 重新解析合集，确认候选列表和听单封面都能显示

---

## 2026-04-24 13:20 CST

### 本轮目标

为 clean-room 合集候选区增加批量筛选操作，让大合集先解析候选，再由用户决定缓存哪些条目。

### 本轮完成

- 合集 / 收藏夹候选区新增批量操作：
  - 全选
  - 反选
  - 清空选择
  - 删除已选
  - 缓存已选
- 每条候选新增 checkbox。
- 解析合集后默认不选中任何候选，避免几百首合集被误点全量缓存。
- 候选区新增选择计数：
  - `已选 X / 候选 Y`
- `删除已选` 只影响当前候选列表，不删除本地音频缓存。
- `缓存已选` 只串行缓存已选条目；缓存成功后从候选列表移除，并刷新听单。

### 影响目录

- `experiments/local-audio-clean-room/server.mjs`
- `experiments/local-audio-clean-room/server.test.mjs`
- `docs/development_log.md`

### 本轮实际验证结果

以下命令已实际执行并通过：

- `pnpm test:local-audio-clean`
- `pnpm verify:local-audio-clean`

验证结果：

- clean-room 单元测试从 10 个增加到 11 个，全部通过。
- 新增页面契约测试覆盖批量候选操作按钮和候选 checkbox 渲染。
- smoke test 继续通过 `/health`、页面、空听单和音频 Range `206`。

### 当前部署判断

- 闲置电脑可以作为第一版转换节点，但不建议直接暴露公网端口。
- 更稳的第一版是“云服务器做公网入口 / HTTPS / 反代或任务入口，闲置电脑只主动连出去拿任务并上传结果”。
- 如果直接用海外服务器承载服务，只要访问没有被明显阻断，也可以跑 50 人左右测试；但要接受大陆用户延迟、B 站链路稳定性和音频流量成本的不确定性。

### 下一个最合理的动作

- 重启 `pnpm dev:local-audio-clean`
- 用 123 首左右的真实合集验证多选、删除已选、缓存已选
- 下一轮如果要准备 50 人测试，优先设计“入口服务 + 转换 worker + 任务队列 + 存储上限”的最小部署形态

---

## 2026-04-24 14:25 CST

### 本轮目标

排查 B 站新分享链接 `https://www.bilibili.com/list/ml3960775205?...&bvid=...` 在 clean-room 中返回“请求错误”的问题，并明确当前应支持的链接形态。

### 根因

- `list/ml3960775205` 本身可以被现有正则解析成 `mediaId=3960775205`。
- B 站旧收藏夹 API `x/v3/fav/resource/list` 对这个 ID 可用。
- 但 clean-room 之前默认用 `ps=50` 拉列表；该 list 形态在 `ps=50` 时返回 `code=-400, message=请求错误`。
- 使用较小 page size，例如 `ps=20`，可以正常返回候选。

### 本轮完成

- 收藏夹 / 歌单预览改为保守分页拉取：
  - 每页 `ps=20`
  - 根据 `has_more` 继续翻页
  - 默认上限仍由 clean-room preview limit 控制
- 新增回归测试：
  - 覆盖 `https://www.bilibili.com/list/ml...?...&bvid=...`
  - 确认不会再使用 `ps=50`
  - 确认候选封面仍走 `/api/cover-proxy`

### 当前确认支持的 B 站输入形态

- 单条视频：
  - `https://www.bilibili.com/video/BV...`
  - `https://m.bilibili.com/video/BV...`
  - 复制文本中只要包含 `BV...` 也可解析为单条
- 视频页内合集：
  - `https://www.bilibili.com/video/BV...?spm_id_from=...custom_collection...`
  - 通过桌面页 `window.__INITIAL_STATE__.videoData.ugc_season` 解析
- UP 主合集页：
  - `https://space.bilibili.com/<mid>/channel/collectiondetail?sid=<seasonId>`
  - 通过 `x/polymer/web-space/seasons_archives_list` 分页解析
- 收藏夹 / 歌单：
  - `https://www.bilibili.com/list/ml<mediaId>`
  - `https://www.bilibili.com/medialist/detail/ml<mediaId>`
  - `https://www.bilibili.com/list/ml<mediaId>?oid=...&bvid=...`
  - `media_id=<id>`
  - `mlid=<id>`
  - `favlist?fid=<id>` 仍兼容，但实际能否拿到内容取决于 B 站返回的 media/fid 权限和列表状态

### 本轮实际验证结果

以下命令已实际执行并通过：

- `pnpm test:local-audio-clean`
- `pnpm verify:local-audio-clean`

真实链接验证：

- `https://www.bilibili.com/list/ml3960775205?spm_id_from=333.1387.0.0&oid=115755324543781&bvid=BV1NFq2B8EVS`
- API 返回 `200`
- 标题：`歌单？`
- `totalCount=16`
- 页面显示：`已选 0 / 候选 16`
- 状态栏显示：`已解析候选：歌单？ / 16 条`

### 当前剩余问题

- B 站分享入口会变化，后续应持续把失败链接沉淀成测试用例。
- `favlist?fid=...` 可能是账号空间里的收藏夹 ID，不一定总能对应可公开读取的 media 内容；失败时需要在 UI 上给更明确提示。

### 下一个最合理的动作

- 用户继续丢真实失败链接，优先补解析格式和回归测试。
- 若准备多人测试，下一步应设计并实现转换任务状态、失败提示和并发限制。

---

## 2026-04-24 19:15 CST

### 本轮目标

把 clean-room 已验证的本地音频链路正式化为 Web First 产品工程骨架，并为后续 React Native 复用稳定 `/api/v1` 契约做准备。

### 本轮完成

- 新增正式用户端 `apps/web`：
  - `/login`：alpha 邀请码 + 占位验证码登录
  - `/`：导入 B 站单条、合集、收藏夹或 `/list/ml...` 链接，筛选候选并批量缓存
  - `/playlist`：本地听单与真实 `<audio>` 播放器
- 保留 `apps/admin` 为后台/debug/实验入口，不再作为正式用户端主线。
- 保留 `experiments/local-audio-clean-room` 为参考实现和回归样本，不让它继续长成正式产品。
- 在 `packages/api-contract` 新增正式导入、缓存、本地听单契约：
  - `importPreview*`
  - `importCache*`
  - `localAudioPlaylist*`
  - `sourceContentCache*`
- 在 `apps/api` 新增 alpha 登录和正式端点：
  - `POST /api/v1/auth/verify-code`
  - `POST /api/v1/imports/preview`
  - `PATCH /api/v1/imports/:collectionId/items`
  - `POST /api/v1/imports/:collectionId/cache`
  - `POST /api/v1/contents/:sourceContentId/cache`
  - `GET /api/v1/playlists/local-audio`
  - `DELETE /api/v1/playlists/local-audio/items/:playlistItemId`
  - `DELETE /api/v1/playlists/local-audio`
  - `GET /api/v1/local-audio/:cacheKey/audio`
  - `GET /api/v1/local-audio/:cacheKey/cover`
- 正式 API 默认按 alpha 用户隔离：
  - 登录后签发 HMAC bearer token
  - 导入、缓存、听单、删除均使用 token 中的 `userId`
  - 音频与封面 media URL 支持 `access_token` query，方便原生 `<audio>` / `<img>` 请求鉴权
- B 站正式导入预览复用 clean-room 已验证策略：
  - 单条视频走 `x/web-interface/view`
  - 收藏夹 / `/list/ml...` 走 `x/v3/fav/resource/list`
  - 收藏夹分页固定 `ps=20`
  - `collectiondetail?sid=...` 走 season archives
  - 自定义合集视频页优先解析 `window.__INITIAL_STATE__`

### 影响目录

- `apps/web`
- `apps/api/src/modules/auth`
- `apps/api/src/modules/contents`
- `apps/api/src/modules/imports`
- `apps/api/src/modules/playlists`
- `packages/api-contract`
- `README.md`
- `AGENTS.md`
- `docs/2026-04-22-mainland-mvp-technical-route.md`
- `docs/2026-04-22-mvp-engineering-breakdown.md`

### 本轮已执行验证

- `pnpm install`
- `pnpm --filter @ai-music-playlist/api-contract test`
- `pnpm --filter @ai-music-playlist/api-contract typecheck`
- `pnpm --filter @ai-music-playlist/api test -- src/modules/auth/alpha-auth.test.ts src/modules/contents/bilibili-import-preview.test.ts src/modules/contents/local-audio-playlist.test.ts src/modules/contents/bilibili-link.parser.test.ts`
- `pnpm --filter @ai-music-playlist/api typecheck`
- `pnpm --filter @ai-music-playlist/web typecheck`
- `pnpm --filter @ai-music-playlist/web test`
- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm --filter @ai-music-playlist/api-contract build`
- `pnpm --filter @ai-music-playlist/types build`
- `pnpm --filter @ai-music-playlist/config build`
- `pnpm --filter @ai-music-playlist/api build`
- `pnpm --filter @ai-music-playlist/web build`
- `pnpm --filter @ai-music-playlist/admin build`
- `pnpm test:local-audio-clean`
- `pnpm verify:local-audio-clean`

补充说明：

- 全量 `pnpm build` 中 API / Web / Admin / packages 已完成构建，mobile 的 Expo export 阶段长时间无输出；手动终止卡住的父进程后该全量命令最终以失败状态结束。
- 因为 `apps/mobile` 当前是后置 React Native 壳，本轮以 Web First 相关包的独立 build 结果作为正式化验收依据。
- `pnpm test` 通过，但 BullMQ 队列测试在无 Redis 沙箱环境下仍会打印 `EPERM 127.0.0.1:6379` stderr；测试本身通过。

### 当前剩余问题

- 正式链路还没有跑真实浏览器端到端 smoke；下一步应启动 `pnpm dev:api` + `pnpm dev:web`，用真实 B 站链接走登录、预览、少量缓存、播放。
- 批量缓存当前仍是同步串行执行，适合 alpha 排查，不适合长期生产；50 用户测试前应加队列、并发限制和失败重试。
- Alpha 登录仍是占位验证码和邀请码，不接真实短信服务。
- 当前音频文件仍落本机文件系统；如果部署到云端或 Mac mini worker，需要继续明确存储路径、备份和容量限制。
- 后置 `apps/mobile` 的 Expo export 需要单独排查为什么全量 `pnpm build` 结束慢/父进程不退出。

### 下一个最合理的动作

- 启动 API 和 Web：
  - `pnpm dev:api`
  - `pnpm dev:web`
- 打开 `http://127.0.0.1:3020`
- 使用 `alpha-50 / 246810` 登录
- 用真实单条和 `/list/ml...` 链接各缓存 1-2 首，验证播放器、封面和 Range 播放

---

## 2026-04-24 20:35 CST

### 本轮目标

排查正式 Web 端 `http://127.0.0.1:3020/` 访问被拒绝，以及 API 健康检查继续返回 500 的问题。

### 本轮完成

- 通过提权启动本地开发服务，确认 sandbox 内直接启动会被本机 socket / pipe 权限限制拦截：
  - `pnpm dev:api`
  - `pnpm dev:web`
- 确认 Web 端 `3020` 已可返回正式登录落地页。
- 修复 Nest controller/service 构造函数依赖在 dev runtime 下变成 `undefined` 的问题：
  - 给 `HealthController`、`ContentsController`、`ImportsController`、`PlaylistsController`、`LocalAudioController`、`AuthController` 显式增加 `@Inject(...)`
  - 给 `AuthService`、`ContentsService` 注入 `PrismaService` 时显式增加 `@Inject(PrismaService)`
- 重新请求 `GET /api/v1/health`，确认不再返回 500。
- 通过 in-app browser 重新加载 `http://127.0.0.1:3020/`，确认页面显示 `先登录，再整理你的本地听单。`

### 影响目录

- `apps/api/src/modules/health`
- `apps/api/src/modules/auth`
- `apps/api/src/modules/contents`
- `apps/api/src/modules/imports`
- `apps/api/src/modules/playlists`
- `docs/development_log.md`

### 本轮已执行验证

- `curl -sS http://127.0.0.1:4000/api/v1/health`
- `curl -sS http://127.0.0.1:3020/`
- `pnpm --filter @ai-music-playlist/api typecheck`
- in-app browser reload `http://127.0.0.1:3020/`

### 当前剩余问题

- 还没有继续走 Alpha 登录后的真实端到端导入、缓存、播放验收。
- 如果后续登录或导入失败，优先检查本地 PostgreSQL / Prisma 连接状态，而不是再回到端口或 Next 缓存方向。

### 下一个最合理的动作

- 在浏览器中进入 `/login`，用 `alpha-50 / 246810` 登录。
- 登录后用真实单条和 `/list/ml...` 链接各跑一轮预览、缓存、播放。

---

## 2026-04-25 00:20 CST

### 本轮目标

整理当前 Web First 正式化与 clean-room 实验改动，提交并推送到 GitHub。

### 本轮完成

- 提交前检查当前分支 `codex/web-first-formalization` 的完整变更范围。
- 确认仓库 git 提交邮箱为 `baleen.whale233@gmail.com`。
- 脱敏开发日志中带 `vd_source` 的 B 站分享查询参数，避免把个人分享参数推送到 GitHub。
- 确认工作区没有明显误带密钥、GitHub token、OpenAI key 或本地缓存音频文件。

### 本轮已执行验证

- `git diff --check`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:local-audio-clean`
- `pnpm verify:local-audio-clean`

### 当前剩余问题

- `gh auth status` 显示 GitHub CLI token 失效；本轮先尝试使用 git remote 的 HTTPS 凭据推送。
- `pnpm test` 仍会在无 Redis 权限的 sandbox 中打印 `EPERM 127.0.0.1:6379` stderr，但测试任务本身通过。

### 下一个最合理的动作

- 推送当前分支到 GitHub。
- 推送后继续规划 Alpha 账号体系：邮箱密码 + 邀请码优先，不急于接邮件验证码服务。

---

## 2026-04-25 00:40 CST

### 本轮目标

处理合并到 `main` 前的两个阻塞点：补 Prisma migration，并避免媒体 URL query 里的 `access_token` 被写进 API 日志。

### 本轮完成

- 新增 Prisma migration：
  - `apps/api/prisma/migrations/20260425003000_web_first_local_audio/migration.sql`
  - 从 `origin/main` 的 schema 到当前 Web First / Local Audio schema
  - 手动把 Prisma 自动 diff 中会删列的部分改成保守迁移：
    - `PlaybackStatus` 通过 `ALTER TYPE ... RENAME TO PlaybackAvailability` 保留旧值
    - `playlist_items.content_id` 通过 `RENAME COLUMN` 迁到 `source_content_id`，避免丢已有 playlist item 关联
- 调整 `.gitignore`，不再忽略正式 Prisma migrations。
- 新增 `redactSensitiveUrl()`，对日志和错误响应里的 `access_token` query 做脱敏。
- `RequestLoggingInterceptor` 和 `HttpExceptionFilter` 都改用脱敏 URL。
- 新增 `redact-sensitive-url.test.ts` 覆盖相对 URL、绝对 URL、重复 `access_token` 参数。

### 影响目录

- `.gitignore`
- `apps/api/prisma/migrations`
- `apps/api/src/common/http`
- `apps/api/src/common/interceptors`
- `apps/api/src/common/filters`
- `docs/development_log.md`

### 本轮已执行验证

- `pnpm --filter @ai-music-playlist/api test -- src/common/http/redact-sensitive-url.test.ts`
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_music_playlist pnpm --filter @ai-music-playlist/api exec prisma validate --schema prisma/schema.prisma`
- `git diff --check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:local-audio-clean`
- `pnpm verify:local-audio-clean`

### 当前剩余问题

- `pnpm test` 在无 Redis 权限的 sandbox 下仍会打印 `EPERM 127.0.0.1:6379` stderr，但测试任务通过。
- 全量 `pnpm build` 的 mobile Expo export 父进程卡住问题仍未在本轮处理。

### 下一个最合理的动作

- 把本轮修复提交并推送到 `codex/web-first-formalization`。
- 再次判断该分支是否可以合入 `main`。

---

## 2026-04-25 13:25 CST

### 本轮目标

做一轮代码层面收口，保持正式 Mobile Web Alpha 主链路不重写、不改产品行为，同时补齐 Range/path 安全、生产配置、debug/experimental 隔离和 SourceCollection 用户作用域。

### 本轮完成

- 建立基线：
  - `node -v` 为 `v22.22.2`
  - `node_modules` 已存在，因此跳过 `pnpm install`
  - 初始 `pnpm lint`、`pnpm typecheck`、`pnpm test` 均通过
  - `pnpm test` 仍打印既有 Redis sandbox `EPERM 127.0.0.1:6379` stderr，但测试任务成功
- Range 与路径安全：
  - `parseHttpRange()` 区分未带 Range 与非法 Range
  - 支持 `bytes=0-99`、`bytes=100-`、`bytes=-500`
  - 超出文件大小的 end 会截断到文件末尾
  - 非法 Range 返回 `kind: "invalid"`，controller 返回 `416` 并设置 `Content-Range: bytes */{totalSize}`
  - cache path 判断改为 `path.resolve + path.relative`，不再依赖 `startsWith`
  - `getLocalAudioCachePaths()` 拒绝 traversal 输入，保留 safe cache key 约束
- `ContentsService` 小步收口：
  - 新增 `local-audio-conversion.service.ts`
  - 抽出 ffmpeg 可用性检查、B 站 mobile playable URL 解析和 ffmpeg 子进程执行
  - controller 调用和现有 public method 行为保持兼容
- 生产配置加固：
  - `NODE_ENV=production` 时禁止默认 `JWT_SECRET=change-me`
  - `NODE_ENV=production` 时禁止默认 `ALPHA_LOGIN_CODE=246810`
  - `NODE_ENV=production` 时禁止默认 `ALPHA_INVITE_CODE=alpha-50`
  - 生产环境必须配置 `CORS_ALLOWED_ORIGINS`
  - 开发环境未配置 CORS 白名单时仍保持本地宽松
  - 更新 `apps/api/.env.example`
- debug / experimental 隔离：
  - 新增 `ENABLE_DEBUG_ROUTES`、`ENABLE_EXPERIMENTAL_ROUTES`
  - 本地开发默认开启，生产默认关闭
  - `/contents/debug/*` 和 `/contents/experimental/*` handler 层统一检查开关
  - 正式导入候选封面不再返回 `/api/v1/contents/debug/cover`
  - `apps/web` 的 `buildMediaUrl()` 支持外部图片 URL 原样返回，不给外部 URL 拼 alpha token
- SourceCollection 用户作用域：
  - Prisma schema 将 `SourceCollection` 唯一键从 `[platform, platformCollectionId]` 改为 `[userId, platform, platformCollectionId]`
  - 新增 migration：`20260425133000_source_collection_user_scope`
  - 正式路径和 experimental 路径统一使用 raw platform collection id，不再用 `${userId}:${mediaId}` workaround
  - 重新生成 Prisma Client
- media token 风险：
  - 保留现有 alpha query token 兼容 `<audio>` / `<img>`
  - 已确认日志脱敏逻辑仍在 `RequestLoggingInterceptor` / `HttpExceptionFilter`
  - 在前后端媒体 URL 入口处增加 TODO，下一轮改短期签名 URL

### 本轮没做

- 没有把缓存/转码改成 BullMQ 队列化：当前同步串行缓存对 alpha 排查仍更直接，下一轮再做 worker 化。
- 没有重写 `apps/web` 页面或改 UI 文案：现有 `page.tsx` 和 `playlist/page.tsx` 还在可读范围内，本轮优先收安全和后端边界。
- 没有实现短期签名媒体 URL：会影响 `<audio>` / `<img>` 鉴权链路，本轮只隔离 TODO 和确认日志脱敏。
- 没有改动 `apps/admin`、`apps/mobile`、`experiments/local-audio-clean-room` 的正式产品实现边界。

### 影响目录

- `apps/api`
- `apps/web`
- `packages/api-contract`
- `packages/config`
- `docs/development_log.md`

### 本轮已执行验证

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm --filter @ai-music-playlist/api test -- src/modules/contents/local-audio-cache.test.ts`
- `pnpm --filter @ai-music-playlist/api test -- src/config/env.test.ts src/modules/contents/bilibili-import-preview.test.ts src/modules/contents/bilibili-cover.test.ts`
- `pnpm --filter @ai-music-playlist/web test -- lib/api.test.ts`
- `pnpm --filter @ai-music-playlist/api-contract test`
- `pnpm --filter @ai-music-playlist/api typecheck`
- `pnpm --filter @ai-music-playlist/api exec prisma generate --schema prisma/schema.prisma`
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_music_playlist pnpm --filter @ai-music-playlist/api exec prisma validate --schema prisma/schema.prisma`
- `git diff --check`

补充说明：

- `pnpm --filter @ai-music-playlist/api exec prisma validate --schema prisma/schema.prisma` 如果不带 `DATABASE_URL` 会因为 Prisma CLI 读取不到 env 失败；带本地示例 `DATABASE_URL` 后 schema validate 通过。
- `pnpm test` 仍有既有 Redis sandbox `EPERM 6379` stderr，测试任务本身通过。

### 当前剩余问题

- 正式 Web Alpha 主链路仍建议再跑真实浏览器 smoke：登录、导入、筛选、缓存、播放、封面、Range。
- 媒体 URL 仍使用 alpha access token query 兼容原生媒体元素，下一轮应改为短期签名 URL。
- 缓存/转码仍是同步串行执行，50 用户 alpha 前应队列化并增加限流、重试、失败状态观察。
- SourceCollection unique 已改成用户私有语义；如果已有本地库里存在 `${userId}:${mediaId}` 旧 workaround 数据，后续可能产生一次新 collection 记录，不影响用户隔离。

### 下一个最合理的动作

- 启动 `pnpm dev:api` + `pnpm dev:web`，用 `alpha-50 / 246810` 做真实浏览器 smoke。
- 下一轮优先做短期签名 media URL：
  - token 绑定 `userId`、`cacheKey`、`resourceType`、`expiresAt`
  - 有效期 5-15 分钟
  - 保持 `<audio>` / `<img>` 可直接请求
- 再下一步把 `cacheImportItemsForUser()` / `cacheBilibiliAudioForUser()` 的同步执行点抽成 ConversionTask worker 接口，再接 BullMQ。

---

## 2026-04-25 14:06 CST

### 本轮目标

排查本地 Web `3020` 可访问后，Alpha 登录点击返回 `Internal server error` 的问题。

### 本轮完成

- 确认 `3020` 上一度存在旧 Next dev 进程卡死：端口监听但请求 20 秒无响应。
- 用 `3021` 启动对照 Web dev server，确认页面代码可正常返回 `200 OK`。
- 释放旧 `3020` 进程后重新启动 `pnpm dev:web`，确认 `http://127.0.0.1:3020/` 返回 `200 OK`。
- 启动 `pnpm dev:api`，确认 `http://127.0.0.1:4000/api/v1/health` 正常。
- 复现登录接口：
  - `POST /api/v1/auth/verify-code`
  - 原始结果为 `500 Internal Server Error`
- 查明根因：
  - 本机 `localhost:5432` 没有 Postgres 监听
  - 当前环境没有 `docker`、`postgres`、`psql` 命令
  - `AuthService.verifyCode()` 在 `prisma.user.upsert()` 时遇到数据库不可达
- 修复登录错误边界：
  - 邀请码/验证码错误返回 `401`
  - 数据库不可达返回 `503`
  - 前端不再只看到泛化 `Internal server error`

### 影响目录

- `apps/api/src/modules/auth`
- `docs/development_log.md`

### 本轮已执行验证

- `curl --max-time 10 -i -sS -X POST http://127.0.0.1:4000/api/v1/auth/verify-code ...`
- `curl --max-time 5 -sS http://127.0.0.1:4000/api/v1/health`
- `curl --max-time 10 -I http://127.0.0.1:3020/`
- `pnpm --filter @ai-music-playlist/api test -- src/modules/auth/auth.service.test.ts src/modules/auth/alpha-auth.test.ts`
- `pnpm --filter @ai-music-playlist/api typecheck`

### 当前剩余问题

- 登录仍然需要本地 Postgres 真的启动并迁移完成；当前机器没有 Docker/Postgres 可执行文件，所以只能把错误变清楚，不能凭空完成数据库启动。
- 如果使用 Docker，下一步应先安装/启动 Docker，再运行 `infra/docker-compose.yml` 里的 Postgres/Redis。

### 下一个最合理的动作

- 准备本地数据库：
  - Docker 路线：`docker compose -f infra/docker-compose.yml up -d postgres redis`
  - 或安装本机 PostgreSQL 16，并创建 `ai_music_playlist`
- 然后运行 Prisma migration，再重新走 Alpha 登录。

---

## 2026-04-25 14:58 CST

### 本轮目标

降低 Alpha Web 本地测试的环境类 bug 率，优先把环境前置检查、数据库准备和 smoke 验证收敛为 CLI-first 的固定入口；VS Code 只保留为同一套脚本的快捷入口。

### 本轮完成

- 新增 Alpha 环境脚本：
  - `pnpm preflight:alpha`
  - `pnpm setup:alpha-db`
  - `pnpm verify:alpha-web`
- `preflight:alpha` 检查：
  - Node 22
  - pnpm 版本
  - `node_modules`
  - `ffmpeg` / `yt-dlp`
  - API `4000` 与 Web `3020` 端口是否空闲或健康响应
  - PostgreSQL `5432` 是否可达
  - Prisma migration 状态
  - Redis `6379` 可达性（当前只警告，不阻塞）
- `setup:alpha-db` 走本机 PostgreSQL / Homebrew 优先路线：
  - 如果缺 `psql`，直接提示 `brew install postgresql@16` 和 `brew services start postgresql@16`
  - 如果已有 `apps/api/.env`，尊重其中的 `DATABASE_URL`
  - 如果没有本地 env，会在可连接 PostgreSQL 后从 `.env.example` 生成开发用 `apps/api/.env`
  - 创建 `ai_music_playlist` 数据库并执行 Prisma migration / generate
- `verify:alpha-web` 在 API/Web 已启动后做 smoke：
  - API health
  - Web root
  - Alpha 登录接口，不打印 token
- VS Code 新增 `Alpha Web (Dev)` compound：
  - 先跑 `alpha:preflight-before-dev`
  - 要求 `3020/4000` 空闲，避免旧进程或已启动服务导致再次撞端口
  - 再启动同一套 `pnpm dev:api` 和 `pnpm dev:web`
- README 新增 Alpha 环境检查说明，明确 Docker 不是硬依赖，VS Code 不是测试环境标准路径。

### 影响目录

- `scripts`
- `.vscode`
- `README.md`
- `package.json`
- `docs/development_log.md`

### 本轮已执行验证

- `node --check scripts/lib/alpha-env.mjs`
- `node --check scripts/alpha-preflight.mjs`
- `node --check scripts/alpha-db-setup.mjs`
- `node --check scripts/alpha-web-verify.mjs`
- `pnpm exec prettier --check package.json .vscode/tasks.json .vscode/launch.json README.md scripts/*.mjs scripts/lib/*.mjs`
- `pnpm preflight:alpha`
- `pnpm preflight:alpha -- --require-free-dev-ports`
- `pnpm setup:alpha-db`
- `pnpm verify:alpha-web`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `git diff --check`

### 当前验证结果

- `pnpm lint` 通过。
- `pnpm typecheck` 通过。
- `pnpm test` 通过；仍有既有 Redis sandbox `EPERM 6379` stderr，但测试任务成功。
- `pnpm preflight:alpha` 正确失败在本机缺 PostgreSQL：
  - `localhost:5432 is not reachable`
  - Redis 缺失只显示 warning
- `pnpm setup:alpha-db` 正确失败在本机缺 `psql`，并提示 Homebrew PostgreSQL 16 安装/启动命令。
- `pnpm verify:alpha-web` 正确失败在 API/Web 未启动和 PostgreSQL 未启动，输出下一步要开的服务。

### 当前剩余问题

- 当前机器还没有可用的本机 PostgreSQL / `psql`，所以不能完成真实 Alpha 登录 smoke。
- `pnpm test` 的 Redis `EPERM 6379` stderr 仍是既有噪音，后续可把队列测试进一步 mock/隔离。
- `setup:alpha-db` 当前只面向本机 PostgreSQL；Docker compose 仍保留为可选基础设施路线，但不是本轮默认路径。

### 下一个最合理的动作

- 安装并启动 Homebrew PostgreSQL 16：
  - `brew install postgresql@16`
  - `brew services start postgresql@16`
- 运行 `pnpm setup:alpha-db`。
- 启动 `pnpm dev:api` 和 `pnpm dev:web`。
- 运行 `pnpm verify:alpha-web`，再做真实浏览器登录/导入/缓存/播放 smoke。

---

## 2026-04-25 22:50 CST

### 本轮目标

继续完成 Alpha 本地数据库环境准备：安装本机 PostgreSQL 16，初始化 `ai_music_playlist`，并让 `pnpm preflight:alpha` 在真实本机环境通过。

### 本轮完成

- 通过 Homebrew 安装 `postgresql@16`。
- 启动 `postgresql@16` 后台服务：
  - `brew services start postgresql@16`
- 运行 `pnpm setup:alpha-db` 时发现一个迁移链问题：
  - 现有 `20260425003000_web_first_local_audio` migration 是从旧 schema 升级到 Web First schema 的迁移。
  - 全新空库缺少旧 schema 里的 `PlaybackStatus` enum，因此 fresh DB 会失败在 `type "PlaybackStatus" does not exist`。
- 新增 initial migration：
  - `apps/api/prisma/migrations/20260424000000_initial_schema/migration.sql`
  - 用于空库先创建旧基础 schema，再按既有迁移升级到当前 schema。
- 删除一个空的重复 migration 目录：
  - `apps/api/prisma/migrations/20260425003000_web_first_local_audio 2`
  - 该目录没有 `migration.sql`，但 Prisma 会把它计入 migration 列表。
- 重置刚创建但 migration 失败的空本地库，重新运行 `pnpm setup:alpha-db` 成功。
- 生成本地开发 env：
  - `apps/api/.env`
  - `DATABASE_URL=postgresql://yang@localhost:5432/ai_music_playlist`

### 影响目录

- `apps/api/prisma/migrations`
- `docs/development_log.md`

### 本轮已执行验证

- `brew install postgresql@16`
- `brew services start postgresql@16`
- `pnpm setup:alpha-db`
- `pnpm preflight:alpha`

### 当前验证结果

- `pnpm setup:alpha-db` 通过：
  - 创建 `ai_music_playlist`
  - `prisma migrate deploy` 成功
  - `prisma generate` 成功
- 普通 sandbox 内跑 `pnpm preflight:alpha` 仍会因为 sandbox 不能探测本机 `localhost:5432` 而失败。
- 使用真实本机权限跑 `pnpm preflight:alpha` 已通过：
  - PostgreSQL `localhost:5432` reachable
  - Prisma migrations up to date
  - Redis 仍是 optional warning

### 当前剩余问题

- API/Web 服务尚未启动，因此还没跑 `pnpm verify:alpha-web`。
- Redis 当前没有启动；对 Alpha Web 登录/导入 smoke 不是硬阻塞，但 `pnpm test` 里队列相关 stderr 仍会有既有噪音。

### 下一个最合理的动作

- 启动 `pnpm dev:api` 和 `pnpm dev:web`。
- 使用真实本机权限运行 `pnpm verify:alpha-web`。
- 浏览器打开 `http://127.0.0.1:3020`，用 `alpha-50 / 246810` 做登录 smoke。

---

## 2026-04-25 22:59 CST

### 本轮目标

排查 `pnpm verify:alpha-web` 只有 Redis optional warning，但浏览器登录后跳转到 404 的问题。

### 本轮完成

- 确认 Redis warning 不是根因：
  - `Redis port - localhost:6379 is not reachable` 当前只是 Alpha smoke optional warning。
- 复现 Web 路由异常：
  - `GET /` 返回 Next 404。
  - `GET /login` 返回 Next 404。
  - 旧状态下 `GET /playlist` 一度仍返回 200，说明问题不是 API 登录失败。
- 重启 Web dev server 后错误变为更明确的 500：
  - `Cannot find module apps/web/.next/server/app/page.js`
  - `Cannot find module apps/web/.next/server/app/login/page.js`
  - `Cannot find module apps/web/.next/server/app/playlist/page.js`
- 确认根因：
  - `apps/web/.next` dev 缓存/编译产物损坏。
  - `app-paths-manifest.json` 指向 app routes，但 `.next/server/app/*/page.js` 缺失。
- 处理方式：
  - 停止占用 `3020` 的旧 Next dev 进程。
  - 删除忽略目录 `apps/web/.next`。
  - 重新启动 `pnpm dev:web`。
- 重新验证：
  - `GET /` 返回 200。
  - `GET /login` 返回 200。
  - `GET /playlist` 返回 200。
  - `pnpm verify:alpha-web` 通过，Alpha login smoke 成功拿到 token。

### 影响目录

- `docs/development_log.md`
- 未改动正式产品代码。
- 删除并重建了 ignored dev cache：`apps/web/.next`

### 本轮已执行验证

- `curl http://127.0.0.1:3020/`
- `curl http://127.0.0.1:3020/login`
- `curl http://127.0.0.1:3020/playlist`
- `pnpm verify:alpha-web`

### 当前验证结果

- `pnpm verify:alpha-web` 通过：
  - API health 200
  - Web root 200
  - PostgreSQL reachable
  - Prisma migrations up to date
  - Alpha login smoke 成功
- Redis 仍是 optional warning，不影响当前 Alpha 登录 smoke。

### 当前剩余问题

- 当前 `pnpm dev:web` 由本轮重新启动，仍在 `3020` 跑着。
- 若之后再次出现 app route 404/500 且错误指向 `.next/server/app/*.js` 缺失，优先停 Web dev server 并删除 `apps/web/.next` 后重启。

### 下一个最合理的动作

- 浏览器刷新 `http://127.0.0.1:3020/login`。
- 用 `alpha-50 / 246810` 再走一次登录，确认跳回导入页。

---

## 2026-04-25 23:28 CST

### 本轮目标

修复播放器页原生 `<audio controls>` 进度条被挤没的问题。

### 本轮完成

- 确认根因：
  - `audio` 是 `.now-playing` grid 的第三个子元素。
  - `.now-playing` 只有两列，第三个元素自动落到第二行第一列，也就是封面列。
  - 原生 audio 控件宽度过窄时会折叠，只剩播放键、短进度和菜单。
- 修复：
  - 新增 `.now-playing audio { grid-column: 1 / -1; min-width: 0; }`
  - 让原生播放器横跨整张 player card，保留真实 media element 行为。

### 影响目录

- `apps/web/app/globals.css`
- `docs/development_log.md`

### 本轮已执行验证

- `curl http://127.0.0.1:3020/playlist`
- `pnpm --filter @ai-music-playlist/web lint`
- `pnpm --filter @ai-music-playlist/web typecheck`

### 当前验证结果

- `/playlist` 返回 200。
- Web lint 通过。
- Web typecheck 通过。

### 当前剩余问题

- 需要浏览器刷新播放器页确认原生控件实际视觉宽度恢复。

---

## 2026-04-30 13:02 CST

### 本轮目标

根据新的 Web 产品口述方向，补一份正式 Web 端整体信息架构文档，明确登录后听单广场、底部导航、添加听单分步流程，以及发布听单只发布目录元信息的边界。

### 本轮完成

- 新增 `docs/2026-04-30-web-information-architecture.md`。
- 文档明确登录后默认进入听单广场，广场展示公开听单目录元信息，不公开共享音频文件。
- 文档定义底部三入口：
  - `听单`
  - `添加听单`
  - `我的`
- 文档定义添加听单流程：
  - 草稿首页
  - 二级添加视频页
  - 链接解析后回到草稿列表
  - 删除 / 批量管理 / 排序
  - 标题和简介
  - 发布目录元信息
- 文档补充后续页面地图、接口方向和 MVP 分期。

### 影响目录

- `docs`

### 本轮已执行验证

- 文档级检查：对照 `AGENTS.md`、`README.md`、`docs/basic_ia.md` 的路线，确认新文档继续遵守“目录 -> 用户主动本地缓存 -> 听单 -> 真播放器”。
- 未跑代码测试；本轮只新增产品信息架构文档，不修改 API 或应用代码。

### 当前剩余问题

- `apps/web` 现有页面仍是旧的导入页和播放器页结构，尚未按新 IA 实现。
- 后续实现需要先补契约，再改 `apps/web` 页面和 `apps/api` 对应接口。

### 下一个最合理的动作

- 基于新 IA 拆下一轮实现计划：先做静态 Web 骨架和底部导航，再迁移现有导入能力到添加听单分步流程。

---

## 2026-04-30 13:42 CST

### 本轮目标

根据 Web 端新信息架构实现一版前端可用原型，并预留后续接真实后端草稿 / 发布 / 广场 API 的 repository 框架。

### 本轮完成

- 新增 Web 前端领域模型与 repository 接口：
  - `apps/web/lib/playlist-domain.ts`
  - `apps/web/lib/playlist-repository.ts`
  - `apps/web/lib/local-playlist-repository.ts`
  - `apps/web/lib/http-playlist-repository.ts`
  - `apps/web/lib/playlist-repository-factory.ts`
- 当前 repository 默认使用 localStorage 保存：
  - 当前草稿
  - 已发布听单目录元信息
  - 广场种子听单
- 预留 `NEXT_PUBLIC_PLAYLIST_DATA_SOURCE=http`，后续可替换为真实 HTTP repository。
- 新增 repository 单元测试，覆盖：
  - 创建 / 读取草稿
  - 解析结果追加到草稿
  - 去重
  - 批量删除
  - 上移 / 下移排序
  - 发布目录元信息
  - 读取广场与详情
  - 按 collection 分组缓存已发布听单条目
- 重做 `apps/web` 页面结构：
  - `/` 与 `/playlists`：听单广场
  - `/playlists/new`：添加听单草稿页
  - `/playlists/new/add`：二级添加视频页，复用现有 `previewImport`
  - `/playlists/[playlistId]`：听单详情页，可对真实解析条目发起缓存
  - `/me`：我的页面
  - `/playlist`：继续保留真实 `<audio>` 本地播放器页
- 新增共享 Web 组件：
  - 底部导航
  - 登录提示
  - 页面标题
  - 听单卡片
  - 听单条目行
- 更新全局样式为移动端产品壳，底部中央 `+` 作为添加听单主入口。
- 修复动态听单详情页 ID URL 编码问题，避免 `playlist:<uuid>` 进入详情页后找不到本地已发布听单。

### 影响目录

- `apps/web/app`
- `apps/web/lib`
- `docs`

### 本轮已执行验证

- `pnpm --filter @ai-music-playlist/web test`
- `pnpm --filter @ai-music-playlist/web lint`
- `pnpm --filter @ai-music-playlist/web typecheck`
- `pnpm --filter @ai-music-playlist/web build`
- 浏览器 smoke：
  - 打开 `http://127.0.0.1:3020/playlists`
  - 注入 alpha token 后确认听单广场显示
  - 注入本地草稿后从 `/playlists/new` 发布
  - 确认发布后的听单在详情页、`/me` 和广场可见
  - 打开 `/playlists/new/add` 确认二级添加视频页显示
  - 移动端 390x844 截图检查广场与底部导航布局

### 当前验证结果

- Web 单元测试通过：2 个测试文件，7 个测试通过。
- Web lint 通过。
- Web typecheck 通过。
- Web build 通过。
- 浏览器 smoke 覆盖了前端草稿、发布、广场、我的、二级添加页。

### 当前剩余问题

- 本轮不做 DB migration，不改真实后端 controller。
- 草稿、发布听单、广场列表和听单详情当前仍是 localStorage 原型数据。
- `/me` 与 `/playlist` 读取最近本地缓存仍依赖现有 API；若本地 API 未启动，浏览器会看到 `127.0.0.1:4000` 连接失败，但页面主流程仍可显示。
- `/playlists/new/add` 的真实链接解析仍需要 API 服务和来源网络可用；本轮浏览器 smoke 未跑真实 B 站解析。

### 下一个最合理的动作

- 下一轮补 `packages/api-contract` 里的正式草稿 / 发布 / 广场契约，再在 `apps/api` 增加对应 controller/service，最后把 Web repository 从 localStorage 切到 HTTP 实现。
