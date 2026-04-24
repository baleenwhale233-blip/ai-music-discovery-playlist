# MVP 工程拆解清单 v0.2

## 1. 目标

把当前仓库从“原生 App 骨架优先”调整成：

```text
Mobile Web First + Conversion Node + Local Audio Playlist
```

也就是说，工程主线不再是 WebView 播放容器，而是：

- 目录解析
- 候选筛选
- 本地音频缓存
- 听单/播放单
- 真实 `<audio>` 播放

## 2. 当前目录角色

```text
apps/
  web/     正式 Mobile Web 产品端
  admin/   后台壳 + debug / 实验页
  api/     主业务 API
  mobile/  后置保留
packages/
  types/
  api-contract/
  config/
infra/
docs/
```

## 3. 当前职责重定义

### `apps/admin`

当前保留：

- 后台壳
- 目录验证页
- 本地音频实验页
- 听单交互原型

### `apps/web`

当前承担正式产品端：

- Alpha 登录
- 导入 B 站链接
- 候选筛选
- 批量缓存
- 本地听单
- 真实 `<audio>` 播放器

### `apps/api`

当前是核心业务承载层：

- 来源解析
- 目录预览
- 本地音频缓存
- 音频文件 Range 响应
- 封面代理
- 收藏夹/播放列表候选生成

### `apps/mobile`

当前只保留：

- 未来原生壳可能性
- 未来播放器和账号体验的扩展空间

但**不是当前 MVP 主开发目标**。

## 4. 工程 Phase 拆解（更新）

### Phase 0：基础工程

- workspace
- turbo pipeline
- shared packages
- README / AGENTS / development_log
- 技术路线和产品文档同步

### Phase 1：B 站单条本地音频验证

- 单条链接解析
- 元信息预览
- 本地音频缓存接口
- 本地封面接口
- 原生 `<audio>` 播放
- Range 支持

### Phase 2：实验听单

- 多首缓存组成播放单
- 连续播放
- 播放单移除/清空
- 本地缓存清理

### Phase 3：目录导入

- 收藏夹/播放列表解析
- 候选列表
- 用户手动删除不相关内容
- 批量缓存
- 生成听单

### Phase 4：Web 产品化

- 新增 `apps/web` 正式产品端
- Mobile Web 首页
- 发现页
- 听单页
- 最近缓存
- 缓存失败与重试

### Phase 5：来源扩展与灰度

- YouTube 技术支持
- 区域/版本露出控制
- 实验来源开关

## 5. 当前模块优先级

### 高优先级

- `apps/api/src/modules/contents/*`
- `apps/web/*`
- `apps/admin/app/debug/local-audio/*`
- `apps/admin/app/debug/bilibili/*`
- `packages/api-contract`
- `packages/types`

### 中优先级

- `discovery`
- `playlists`
- `history`
- `favorites`

### 低优先级 / 后置

- `apps/mobile`
- `source-accounts`
- `moderation`
- `admin` 完整后台 CRUD

## 6. 建议新增的正式领域对象

后续应从实验状态升级为正式模型：

- `LocalAudioAsset`
- `ConversionTask`
- `Playlist`（听单语义）
- `PlaylistItem`
- `SourceCollectionPreview`

## 7. 基础设施优先级（更新）

### 现在必须有

- PostgreSQL
- API
- 前端 Web
- 本地缓存目录

### 现在可选

- Redis
- BullMQ

因为当前阶段很多实验功能可以先同步/串行完成。

### 后面再做

- 正式后台任务队列
- 转换节点分离
- 重试系统
- 分布式缓存协调

## 8. 转换节点策略

### 当前推荐

- 你的服务器或 Mac mini 作为转换节点

### 架构建议

```text
Web / API
-> 创建转换任务
-> Conversion Node 执行 yt-dlp + ffmpeg
-> 落地本地音频缓存
-> API 返回音频地址
```

### 后续演进

```text
Cloud API + Self-hosted Mac mini worker
```

## 9. 当前不应该继续投入的方向

- 来源 iframe 播放器增强
- WebView 容器能力
- 伪进度条 / 伪 pause-resume
- 原生 App 首发分发

## 10. 第一轮验收标准（更新）

- `pnpm install`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- B 站单条链接可解析
- 本地音频实验页可打开
- 本地音频接口支持 Range
- 实验播放单可连续播放
- 收藏夹/播放列表能解析候选目录

## 11. 下一阶段建议

下一轮工程目标建议是：

1. 把实验播放单从页面内存迁到正式听单数据模型
2. 把收藏夹/播放列表候选导入做成正式导入流程
3. 让 `apps/web` 承接正式 Mobile Web，`apps/admin` 保留后台和 debug
