# 大陆版 MVP 技术路线文档

## 1. 技术路线结论

- 推荐客户端：`React Native + Expo Prebuild + Expo Dev Client`
- 推荐后端：`NestJS + TypeScript`
- 推荐数据库：`PostgreSQL`
- 推荐缓存与队列：`Redis + BullMQ`
- 推荐后台：`Next.js` 内部管理台
- MVP 选择原因：双端起步快、后端模块化清晰、数据关系强、导入和验证任务可异步化
- 当前不做：音频托管、下载、抽离、评论区、重社区、版权裁决、创作者收益结算、复杂推荐算法

## 2. 总体系统架构

- 客户端 App 层：页面、歌单、收藏、最近播放、导入入口、账号绑定入口、播放控制 UI
- 播放容器层：统一 WebView 播放容器，承接来源页面与桥接事件
- 源适配器层：B 站 / 抖音链接解析、来源 ID 标准化、元信息拉取、导入预览数据组织
- 后端 API 层：认证、导入、歌单、收藏、发现、账号绑定、后台运营接口
- 数据层：PostgreSQL 存业务数据，Redis 存任务队列、去重锁、短期验证态
- 后台层：内容查看、标签编辑、精选歌单配置、争议处理、屏蔽与下架

## 3. 客户端技术方案

- Expo 策略：先走 `Expo Prebuild`，保留后续更深原生控制空间
- 导航：`React Navigation`，底部 Tab + Native Stack
- 本地状态：`Zustand`
- 服务端状态：`TanStack Query`
- 播放状态机：单独领域模块管理，不放在页面组件里
- WebView 策略：所有来源播放统一走“我方播放壳页 + 来源页面”
- MVP 不承诺：锁屏播放、完整后台播放、系统媒体控件
- 前端负责：交互、队列 UI、导入预览、歌单管理、播放控制
- 后端负责：链接解析、批量导入、去重、来源抓取、验证任务、自动关联

## 4. 服务端技术方案

- 框架：`NestJS`
- API 组织：`/api/v1`
- 模块建议：`auth`、`users`、`contents`、`imports`、`playlists`、`favorites`、`history`、`discovery`、`source-accounts`、`moderation`、`admin`
- 队列：批量导入、元信息刷新、验证过期、自动关联都走异步
- Redis：用于 BullMQ、限流、去重锁、短期验证任务
- 日志与观测：结构化日志 + Sentry / OpenTelemetry 后续接入

## 5. 数据模型设计

### User

- 主键：`id`
- 关键字段：`phone_or_email`、`nickname`、`avatar_url`、`status`
- 唯一键：`phone_or_email`
- 作用：平台用户主体

### SourceAccount

- 主键：`id`
- 关键字段：`platform`、`platform_account_id`、`platform_unique_handle`、`verification_status`
- 唯一键：`platform + platform_account_id`
- 作用：来源账号及其绑定状态

### SourceContent

- 主键：`id`
- 关键字段：`platform`、`platform_content_id`、`canonical_url`、`title`、`cover_url`、`source_account_id`
- 唯一键：`platform + platform_content_id`
- 作用：统一内容主表

### Playlist / PlaylistItem

- Playlist 字段：`user_id`、`name`、`cover_url`、`visibility`、`is_editorial`
- PlaylistItem 字段：`playlist_id`、`content_id`、`position`
- 作用：歌单与条目顺序

### Favorite / PlayHistory

- Favorite 唯一键：`user_id + content_id`
- PlayHistory 字段：`played_at`、`completion_ratio`、`end_reason`
- 作用：收藏关系、最近播放与行为分析

### ContentMeta

- 字段：`style_tags[]`、`mood_tags[]`、`content_type`、`model_name`、`short_note`
- 作用：轻量结构化 AI 信息

### ClaimOrVerificationTask

- 字段：`platform`、`verification_code`、`verification_method`、`status`、`expires_at`
- 状态：`created | pending_user_action | pending_check | verified | rejected | expired | disputed`
- 作用：来源账号控制权验证任务

## 6. B 站与抖音源适配策略

### B 站

- 单条导入：解析 `bvid / avid`，统一收口到 `bvid`
- 收藏夹导入：解析 `media_id`，分页拉取并生成导入预览
- 元信息：标题、封面、作者、时长、发布时间优先走公开接口或页面结构解析
- 播放容器：优先走“播放壳页 + B 站来源页”
- 失败回退：保留内容入库与歌单关系，允许回源站播放

### 抖音

- 单条导入：展开短链后提取 `item_id / video_id`
- 多链接批量：第一阶段只支持多条单链接提交
- 收藏夹策略：第一阶段不承诺稳定支持
- 适配器语义：外部差异收口为 `platform_content_id`
- 失败回退：允许标记“已收录但暂不可站内播放”

## 7. 播放系统设计

- 播放状态：`idle`、`loading`、`ready`、`playing`、`paused`、`buffering`、`ended`、`error`、`blocked_by_autoplay`
- 队列状态：`empty`、`prepared`、`active`、`advancing`、`finished`
- 播放模式：顺序、单曲循环、列表循环、随机播放
- 切歌机制：销毁上一条监听，进入下一条 `loading -> ready -> playing`
- 初始化失败：`重试 / 跳过 / 打开来源页`
- autoplay 失败：显式提示用户手势恢复，不假装正在播放

## 8. 导入系统设计

- 单条导入：链接解析 -> 标准化 -> 去重查询 -> 预览 -> 写入歌单
- 批量导入：提交任务 -> 异步抓取 -> 预览确认 -> 正式入库
- 预览必须保留：新增、已存在、失败项、不可播项
- 去重规则：主规则 `platform + platform_content_id`
- 错误处理：逐项失败，不做整批回滚

## 9. 账号绑定与来源验证机制

- 验证目标：验证来源账号控制权，不判定版权归属
- 验证方式：一次性验证码动态验证
- 流程：创建任务 -> 用户发布验证码 -> 系统检测 -> 人工兜底复核 -> 完成绑定
- 绑定成功后：自动关联已收录作品
- 争议处理：支持拆关联、隐藏、人工备注

## 10. 发现页与内容冷启动支持

- 首页推荐位：后台配置 `slot_key + target_type + target_id + sort_order`
- 编辑歌单：运营歌单直接复用 Playlist
- 风格分类：基于 `ContentMeta.style_tags / mood_tags / content_type`
- 榜单策略：热门收藏、最新收录用定时聚合
- MVP 建议：以手工运营为主，不上复杂推荐引擎

## 11. 管理后台需求

- 内容查看
- 标签编辑
- 精选歌单配置
- 账号验证记录查看
- 举报 / 争议处理
- 手工上下架 / 屏蔽

## 12. 安全、风控与边界

- 风险重点：来源播放稳定性、错误归属、误导展示、争议处理效率
- 审核最小化：少自由文本，多结构化字段
- 冒领处理：验证码动态验证 + 人工复核 + 可撤销关联
- 明确不做：版权裁决、下载器、音频转码分发、重社区审核

## 13. MVP 开发顺序

- Phase 0：准备工程、基础认证、环境、日志、后台壳
- Phase 1：B 站单条导入与收藏夹导入基础链路
- Phase 2：歌单与播放系统
- Phase 3：发现页、收藏、最近播放
- Phase 4：账号绑定
- Phase 5：抖音接入

## 14. 技术风险与后续演进

- 最大风险：第三方来源播放稳定性与 autoplay 成功率
- MVP 技术债：后台播放弱、导入适配规则可能堆积在主服务
- 可能演进：从 Expo Prebuild 向更深原生控制迁移
- 服务拆分时机：适配器与导入任务量上来后可独立成服务
- 扩来源策略：坚持 `SourceAdapter -> 标准化 SourceContent -> 统一导入与播放壳`
