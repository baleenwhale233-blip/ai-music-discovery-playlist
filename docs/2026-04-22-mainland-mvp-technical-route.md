# 大陆版 MVP 技术路线文档 v0.2

## 1. 技术路线结论

- 推荐前端主形态：`Mobile Web First`
- 桌面端：兼容 Web
- 原生 App：后置，不作为当前 MVP 主战场
- 推荐后端：`NestJS + TypeScript`
- 推荐数据库：`PostgreSQL`
- 推荐缓存与队列：`Redis + BullMQ`
- 推荐后台与实验前端：`Next.js`
- MVP 为什么这么选：
  - 需求验证阶段应优先降低分发和审核门槛
  - 真正的播放器能力来自 `<audio>` / media element，而不是来源 iframe
  - 转换成本和复杂度先放在服务器或自有 Mac mini 转换节点
- 当前不做：
  - 公开音频托管
  - 音频公开分享
  - 评论区 / 重社区
  - 版权裁决
  - 原生 App 完整播放器体系

## 2. 总体系统架构

### 分层

- 前端 Web 层：目录、听单、候选筛选、播放器 UI、实验来源开关
- 源适配层：B 站 / YouTube / 实验来源链接解析与目录预览
- 转换调度层：创建转换任务、查询缓存状态、清理缓存
- 转换节点层：你的服务器或个人 Mac mini，负责 `yt-dlp + ffmpeg`
- 后端 API 层：认证、目录、导入、听单、来源能力、后台接口
- 数据层：PostgreSQL 存目录、听单、元信息；Redis 只用于任务和缓存协调
- 后台层：内容查看、精选目录配置、来源开关、争议处理

### 职责说明

- 前端 Web 层：只负责交互，不直接做音频转换
- 源适配层：统一不同来源的链接、ID、元信息和目录预览格式
- 转换调度层：决定什么时候由服务器/Mac mini 执行本地缓存转换
- 转换节点层：负责重计算和本地缓存目录，不暴露为公开播放器
- 后端 API 层：向前端提供稳定业务接口
- 数据层：记录目录、听单、缓存状态，不做公开媒体托管

## 3. 前端技术方案

- 主形态：`Next.js / Mobile Web First`
- 为什么不是原生 App 优先：
  - 需求还在验证期
  - 不需要先承担 TestFlight / APK / 审核复杂度
  - 目录 + 听单 + 本地缓存逻辑更适合先在 Web 快速迭代
- 页面能力优先级：
  - 目录发现
  - 候选筛选
  - 本地听单
  - 真正的 `<audio>` 播放器
- 不再把 WebView / iframe 作为主路线
- `apps/admin` 当前承担：
  - 后台壳
  - 实验验证页
  - 后续可演进为正式 Web 产品原型

## 4. 后端技术方案

- 框架：`NestJS`
- API 前缀：`/api/v1`
- 模块建议：
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
- 实验接口已成立：
  - B 站解析
  - B 站收藏夹/播放列表目录预览
  - 本地音频缓存
  - 本地音频 Range 播放
  - 本地封面代理

## 5. 转换节点策略

### 当前推荐

- 由你的服务器或个人 Mac mini 执行 `yt-dlp + ffmpeg`
- 前端和 API 不直接承担音频转换

### 两种可行模式

1. 云端 API + 自有 Mac mini 转换节点
2. 小规模云端转换 + 严格限流

### 不建议当前阶段做

- 用户手机本地转换
- 浏览器纯 wasm 转换
- 公开音频托管站

## 6. 数据模型方向

### SourceContent

- 仍然保留为统一来源内容目录表
- 记录来源平台、平台内容 ID、标题、封面、作者、时长

### Playlist / PlaylistItem

- 新语义更接近“听单”
- 目录项和已缓存项要区分

### LocalAudioAsset（建议新增）

- `id`
- `user_id`
- `source_content_id`
- `cache_key`
- `file_path`
- `cover_path`
- `status`
- `duration_seconds`
- `created_at`
- `deleted_at`

### ConversionTask（建议新增）

- `id`
- `user_id`
- `source_content_id`
- `task_type`
- `status`
- `error_message`
- `runner`
- `created_at`
- `completed_at`

## 7. 来源适配策略

### B 站

- P0 默认公开来源
- 支持单条链接
- 支持收藏夹/播放列表解析为候选目录
- 当前支持的目录链接形态：
  - `favlist?fid=...`
  - `media_id=...`
  - `mlid=...`
  - `/lists/...`
  - `/medialist/detail/ml...`
  - `/list/ml...`

### YouTube

- 技术层支持，产品层按地区/版本露出
- 大陆版默认隐藏
- 国际版/海外版可公开
- 不进入大陆版首页

### 其他来源

- TikTok：实验来源
- 抖音：高风险实验来源
- 小红书：暂不纳入 MVP

## 8. 播放系统设计

### 当前成立的播放路线

- 真实 `<audio>` / media element
- 本地音频缓存文件
- 支持：
  - 播放
  - 暂停
  - 继续
  - 拖动进度条
  - 连续播放

### 为什么不再把 iframe 作为主路线

- 无法可靠拿到 pause/resume
- 无法可靠拿到 currentTime/duration
- 无法保证音乐播放器体验

### 本地音频接口要求

- 支持 `Range`
- 支持 `206 Partial Content`
- 支持 `Content-Range`
- 支持 `Accept-Ranges: bytes`

## 9. 导入与目录预览系统

### 单条导入

```text
粘贴链接
-> 解析元信息
-> 用户确认保存
-> 加入听单
```

### 收藏夹/播放列表导入

```text
粘贴目录链接
-> 解析候选列表
-> 用户删除不相关内容
-> 批量缓存
-> 生成听单
```

### 学习播放单

- 路径与音乐听单相同
- 不作为首页主叙事

## 10. 后台与运营

- 首页精选目录配置
- 目录标签编辑
- 来源开关与实验开关
- 争议处理
- 账号验证记录

## 11. 风险与边界

- 最大风险已从“iframe 能不能播”转为：
  - 平台条款风险
  - 转换成本
  - 转换节点稳定性
  - 本地缓存管理
- 当前最小化策略：
  - 用户主动触发
  - 不公开分享音频
  - 广场只做目录
  - 大陆版不默认露出高风险来源

## 12. 当前工程方向

- `apps/admin`：当前承担后台壳 + 实验 Web 页
- `apps/api`：承担解析、目录预览、本地缓存、音频/封面接口
- `apps/mobile`：保留但后置

## 13. MVP 开发顺序（更新后）

- Phase 0：基础工程、文档、后台与实验页骨架
- Phase 1：B 站单条链接 -> 本地音频 -> 真播放器
- Phase 2：B 站收藏夹/播放列表 -> 候选筛选 -> 听单
- Phase 3：目录广场与精选目录
- Phase 4：YouTube 隐藏来源/国际版能力
- Phase 5：账号绑定与后台强化

## 14. 结论

当前技术路线不再是：

```text
React Native + 来源播放器容器
```

而是：

```text
Mobile Web First + Source Adapter + Conversion Node + Local Audio Playlist
```

只有这条路能真正验证产品核心价值。
