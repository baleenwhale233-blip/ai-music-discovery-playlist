# 视频转音频听单产品 Alpha PRD + 信息架构落地稿

文件用途：给 Codex / coding agent 读取，用来把当前 Mobile Web Alpha 从“功能能跑”推进到“产品信息架构清楚、首页/我的/添加/播放器闭环能落地”。

当前仓库：baleenwhale233-blip/ai-music-discovery-playlist
产品对外描述建议：视频转音频听单工具 / 本地音频听单工具。
注意：仓库名里有 ai music，但产品文案和实现提示里不要过度强调“AI 音乐”，因为本质是“从视频来源整理目录、主动缓存为个人本地音频资产、连续收听”的工具。


============================================================
1. 产品定位
============================================================

这是一个 Mobile Web First 的视频转音频听单工具。

用户可以从 B 站等来源添加视频链接或列表链接，把解析出来的内容整理成听单目录。用户主动确认后，系统把条目缓存为当前用户自己的本地音频资产。缓存完成之后，用户可以像使用音乐播放器一样连续收听。

产品不是公开音乐平台，不做公开音频托管，不做复杂社区，不做评论、关注、推荐流。Alpha 阶段重点是把以下闭环做稳定：

登录
-> 浏览/管理听单目录
-> 创建听单
-> 从链接添加条目
-> 发布/保存听单
-> 主动缓存条目
-> 播放已缓存音频
-> 在全局播放器里管理播放队列


============================================================
2. Alpha 阶段目标
============================================================

Alpha 目标不是做完整音乐社区，而是验证：

用户是否愿意把分散的视频来源整理成个人听单，并主动缓存为可连续播放的本地音频资产。

P0 成功标准：

1. 用户可以用 Alpha 账号登录。
2. 用户可以看到一个简单、清楚的首页听单列表。
3. 用户可以从底部导航中间入口创建/添加听单。
4. 用户可以在“我的”里看到自己收藏的听单和自己创建的听单。
5. 用户可以区分“我创建的听单”和“别人/示例/公开目录的听单”。
6. 用户可以进入听单详情，看到封面、标题、简介、作者/用户名、条目列表。
7. 用户可以对未缓存条目发起缓存。
8. 用户可以播放已缓存条目。
9. 播放器固定出现在底部导航栏上方，点击可进入完整播放器。
10. 完整播放器支持播放/暂停、上一首/下一首、进度拖动、播放队列、列表循环、单曲循环、随机播放。


============================================================
3. 产品边界与原则
============================================================

3.1 目录优先，不伪装成公开音乐平台

听单首先是“来源目录”：标题、封面、作者、时长、来源链接、来源 ID、条目顺序。
音频播放只发生在用户主动缓存之后。
不同用户之间可以看到同一个听单目录，但缓存音频资产属于当前用户自己，不能公开复用或公开分发。

3.2 简单直接的首页，不做复杂 UGC 广场

首页就是普通听单列表。不要做复杂社区信息流。
一个听单卡片只需要：
- 封面组/封面拼贴
- 听单名
- 用户名
- 可选：条目数量、已缓存数量、更新时间

视觉可以参考用户给的右侧屏幕：大面积留白、简单卡片、封面组 + 名字 + 用户名，直接、干净、好看。

3.3 添加听单是主路径

底部导航中间入口是“添加”或“新建”。
它不应该只是一个页面，而是主操作入口：创建听单、编辑草稿、粘贴来源链接、解析候选、选择条目、保存/发布。

3.4 播放器是核心，不是附属功能

当前播放器样式不对劲，需要重做成接近 Spotify / Apple Music mini-player + full player 的结构。
播放器要与全局 App Shell 绑定：
- mini player 固定在底部导航栏上方
- full player 可以通过点击 mini player 打开
- full player 负责队列和播放模式管理

3.5 Alpha 登录先简单，后续再升级

Alpha 登录先使用：账号 + 密码 + 邀请码。
Alpha 过后再考虑邮箱登录、邮箱验证、找回密码等完整账号体系。

账号体系必须存在，因为：
- 个人创建的听单需要归属 ownerUserId
- 收藏听单需要归属 userId
- 本地缓存资产需要归属 userId
- 同一个公开听单对不同用户的缓存状态不同


============================================================
4. 用户与权限模型
============================================================

4.1 用户类型

未登录用户：
- 默认跳转 /login
- 不进入主产品路径

Alpha 用户：
- 通过账号、密码、邀请码登录
- 可以创建听单
- 可以收藏听单
- 可以缓存条目
- 可以播放自己的已缓存资产
- 可以管理自己创建的听单

未来用户：
- 可迁移到邮箱登录
- 可补充头像、昵称等资料

4.2 权限规则

听单有 ownerUserId。

当前用户是 owner 时：
- 可以编辑标题、简介、封面
- 可以添加条目
- 可以删除条目
- 可以调整排序
- 可以发布/取消发布，或至少管理可见状态
- 可以删除听单，P1 可做

当前用户不是 owner 时：
- 可以查看公开/示例听单目录
- 可以收藏/取消收藏
- 可以基于目录缓存自己的本地音频资产
- 不可以修改听单目录

缓存资产永远属于当前用户：
- userId + sourceContentId 或 playlistItemId 绑定
- 别人的听单目录可以被我缓存，但生成的是我的个人缓存资产
- 不做跨用户音频文件公开共享


============================================================
5. 核心对象模型
============================================================

这里是产品层对象，不要求完全一比一对应数据库，但实现时应尽量与现有 Prisma / packages/types / api-contract 对齐。

5.1 User

字段建议：
- id
- username
- displayName
- passwordHash
- inviteCodeUsed
- status: ACTIVE / DISABLED
- createdAt
- updatedAt

5.2 Playlist

字段建议：
- id
- ownerUserId
- ownerDisplayName
- title
- description
- coverUrl
- coverItems: 用于封面组/拼贴的前 1-4 个条目封面
- visibility: PRIVATE / PUBLISHED
- sourceTypeSummary: BILIBILI / MIXED / MANUAL
- itemCount
- cachedCountForCurrentUser: 注意这是当前用户视角，不是全局字段
- favoritedByCurrentUser: boolean
- createdAt
- updatedAt

说明：
- 首页可以展示 PUBLISHED 或系统示例听单。
- “我的创建”展示 ownerUserId === currentUser.id 的听单，包括草稿和已发布。
- “我的收藏”展示当前用户收藏的听单。

5.3 PlaylistItem

字段建议：
- id
- playlistId
- title
- sourcePlatform: BILIBILI / YOUTUBE_EXPERIMENT / OTHER
- sourceUrl
- sourceContentId
- sourceAuthorName
- coverUrl
- durationSeconds
- orderIndex
- cacheStatusForCurrentUser: NOT_CACHED / QUEUED / CONVERTING / CACHED / FAILED
- localAudioAssetIdForCurrentUser
- createdAt
- updatedAt

5.4 Favorite

字段建议：
- id
- userId
- playlistId
- createdAt

5.5 LocalAudioAsset

沿用现有方向：
- 属于当前用户
- 表示个人本地音频资产元数据
- 缓存完成后才可播放
- 音频接口支持 Range，便于拖动进度

5.6 ConversionTask

沿用现有方向：
- 缓存是任务化的
- 请求缓存后立即返回 task / asset 标识和 queued 状态
- 前端轮询任务状态
- 成功后更新条目缓存状态
- 失败后展示失败并允许重试，重试 UI 可 P1

5.7 PlayerState / PlayQueue

播放器状态可以先做前端状态 + localStorage 持久化，后续再考虑服务端同步。

字段建议：
- queueId
- sourcePlaylistId
- items: cached playable items only
- currentIndex
- currentItemId
- isPlaying
- currentTime
- duration
- volume
- playMode: SEQUENTIAL / REPEAT_LIST / REPEAT_ONE / SHUFFLE
- shuffleOrder: item id array
- updatedAt

注意：queue 里只放当前用户已缓存且可播放的条目。
未缓存条目不应该进入可播放队列，可以在听单详情里提示“先缓存”。


============================================================
6. 信息架构总览
============================================================

建议采用三 Tab 主结构：

底部导航：
1. 首页
2. 添加
3. 我的

播放器 mini bar 固定在底部导航上方。

路由建议：

/login
/
/playlists                         首页：听单列表
/playlists/new                     添加/创建听单主流程
/playlists/new/add                 从来源链接添加候选条目
/playlists/:playlistId             听单详情
/playlists/:playlistId/manage      管理听单：复用创建/添加相关页面能力
/player                            完整播放器，可作为 overlay 或 route
/me                                我的：收藏、创建、缓存、账号

根路径 /：
- 未登录 -> /login
- 已登录 -> /playlists


============================================================
7. App Shell 与全局布局
============================================================

所有登录后的页面都使用同一个 App Shell：

顶部区域：
- 页面标题
- 可选次级操作，例如管理、设置、取消

主体内容：
- 当前页面内容
- 底部需要留出 mini player + bottom nav 的安全距离

Mini Player：
- 当存在可播放队列或最近播放条目时显示
- 固定在 bottom nav 上方
- 点击主体区域进入 full player
- 播放/暂停按钮可以直接操作

Bottom Nav：
- 首页
- 添加
- 我的

层级顺序：
content
-> mini player
-> bottom nav

注意：mini player 不要压住页面内容。页面底部 padding 要根据播放器是否存在动态增加。


============================================================
8. 页面 PRD
============================================================

8.1 /login 登录页

目标：让 Alpha 用户以最低成本进入产品。

表单字段：
- 账号 username
- 密码 password
- 邀请码 inviteCode

行为：
- 输入完整后可点击登录
- 登录成功保存 token/session
- 跳转 /playlists
- 登录失败展示明确错误
- token 失效时清理本地登录态并返回 /login

视觉：
- 单屏居中或偏下
- 不需要复杂品牌叙事
- 可以有一句简短说明：“把视频整理成可以连续收听的个人听单。”

P0 验收：
- 账号密码邀请码正确可登录
- 错误态可读
- 登录后刷新仍能保持状态
- 退出登录后无法访问主页面


8.2 /playlists 首页听单列表

目标：用户一进来就知道这里是“听单目录”，而不是复杂社区。

内容结构：
- 顶部标题：听单
- 可选副标题：把视频整理成可以连续收听的音频目录
- 听单列表
- 空状态：还没有听单，引导点击底部“添加”

听单卡片：
- 封面组/封面拼贴：1-4 张来源封面组成
- 听单标题
- 用户名 / ownerDisplayName
- 可选：条目数、当前用户已缓存数

卡片点击：
- 进入 /playlists/:playlistId

右上角可选操作：
- 搜索 P1
- 筛选 P1

首页数据范围：
- P0 可以展示：公开示例听单 + 当前用户发布的听单 + 当前用户收藏的听单
- 不做复杂推荐流
- 不做评论、点赞、关注

P0 验收：
- 有听单时显示卡片列表
- 无听单时显示空状态
- 卡片点击可进入详情
- 卡片上能区分标题和用户名
- 封面组尺寸统一、视觉干净


8.3 /playlists/new 添加/创建听单

目标：这是底部导航中间主入口。用户可以从这里创建听单并添加来源内容。

页面状态：
A. 无草稿：新建听单表单
B. 有草稿：草稿编辑页
C. 已添加条目：展示条目列表并允许发布

字段：
- 听单标题 title
- 简介 description
- 封面 cover，可自动取前几条条目封面组成封面组

核心操作：
- 添加来源链接 -> /playlists/new/add
- 保存草稿
- 发布听单
- 删除条目
- 调整顺序，P0 可以先用简单上移/下移或拖拽；没有就 P1

发布规则：
- title 必填
- 至少 1 个条目
- 发布后生成 Playlist
- 跳转 /playlists/:playlistId

P0 验收：
- 可以创建草稿
- 可以添加条目
- 可以发布听单
- 发布后首页/我的创建中能看到


8.4 /playlists/new/add 从链接添加

目标：把来源链接解析成候选条目，让用户选择加入草稿。

字段：
- sourceUrl 输入框

支持来源：
- P0：B 站单条视频、收藏夹、播放列表、合集类链接
- 其他来源只作为实验，不作为默认公开主路径

流程：
1. 用户粘贴链接
2. 点击解析
3. 系统展示候选条目
4. 用户选择条目
5. 加入当前听单草稿
6. 返回 /playlists/new 或 manage 页面

候选条目展示：
- 封面
- 标题
- 作者
- 时长
- 来源平台
- 选择 checkbox

错误状态：
- 链接为空
- 链接不支持
- 解析失败
- 候选为空
- 网络错误

P0 验收：
- B 站单条链接可解析
- B 站集合类链接可返回候选
- 可选择部分候选加入草稿
- 已加入条目不重复加入，或至少有重复提醒


8.5 /playlists/:playlistId 听单详情

目标：展示听单目录，并提供缓存、播放、收藏、管理入口。

头部信息：
- 封面 / 封面组
- 标题
- 简介
- 用户名 / ownerDisplayName
- 条目数量
- 当前用户已缓存数量

主要操作：
- 播放已缓存
- 缓存全部未缓存，或选择条目缓存
- 收藏/取消收藏
- 管理，只有 owner 可见

条目列表：
- 顺序号
- 封面缩略图
- 标题
- 作者/来源
- 时长
- 缓存状态：未缓存 / 排队中 / 转换中 / 已缓存 / 失败
- 单条操作：缓存、播放、更多

owner 视角：
- 显示“管理”按钮
- 可进入 /playlists/:playlistId/manage

非 owner 视角：
- 不显示管理
- 显示收藏按钮
- 可以缓存自己的音频资产

P0 验收：
- 能正确展示听单元信息
- owner 和非 owner 的操作有区别
- 已缓存条目可以播放
- 未缓存条目不能直接播放，但可发起缓存
- 播放后底部出现 mini player


8.6 /playlists/:playlistId/manage 听单管理

目标：复用创建和添加流程，用于管理已有听单。

功能：
- 编辑标题
- 编辑简介
- 添加来源链接
- 删除条目
- 调整条目顺序
- 保存修改

复用：
- 添加链接能力复用 /playlists/new/add 的组件或逻辑
- 条目列表组件尽量与 /playlists/new 复用

权限：
- 只有 owner 能访问
- 非 owner 访问时返回详情页或显示无权限

P0 验收：
- owner 可以修改基本信息并保存
- owner 可以添加新条目
- owner 可以删除条目
- 修改后详情页同步更新


8.7 /me 我的

目标：用户管理自己的内容和账号。

结构建议：
- 顶部：用户名 / Alpha 用户标识
- Tabs 或分区：收藏的听单 / 创建的听单 / 本地缓存 / 账号

收藏的听单：
- 当前用户收藏的 Playlist
- 卡片样式与首页一致

创建的听单：
- ownerUserId === currentUser.id
- 区分草稿和已发布
- 点击进入详情或管理

本地缓存：
- 最近缓存的条目或听单
- 可 P0 简化，只展示最近缓存条目
- 清理缓存能力 P1 或调试入口

账号：
- 退出登录
- 未来邮箱登录/账号设置入口，P1

P0 验收：
- 能看到自己收藏的听单
- 能看到自己创建的听单
- 能退出登录
- 空状态清楚


8.8 /player 完整播放器

目标：让已缓存音频具备真正播放器体验。

进入方式：
- 点击底部 mini player
- 在听单详情点击“播放已缓存”
- 点击单个已缓存条目的播放按钮

页面结构：
- 当前播放封面
- 当前播放标题
- 作者/来源
- 所属听单
- 进度条
- 当前时间 / 总时长
- 播放/暂停
- 上一首 / 下一首
- 播放模式按钮：顺序、列表循环、单曲循环、随机
- 播放队列

播放模式：
- SEQUENTIAL：顺序播放，到最后停止
- REPEAT_LIST：列表循环，到最后回到第一首
- REPEAT_ONE：单曲循环
- SHUFFLE：随机播放，使用 shuffleOrder，不要每次 next 都完全随机导致重复混乱

队列管理：
- 展示当前队列
- 高亮当前播放条目
- 点击队列条目可切换播放
- 从队列移除条目，P1；P0 可以先展示不可编辑队列
- 清空队列，P1
- 重新排序，P1

播放器状态：
- empty：没有可播放条目
- loading/buffering：加载中
- playing：播放中
- paused：暂停
- error：当前条目播放失败，可跳下一首
- ended：根据播放模式决定停止或下一首

底层规则：
- 只播放当前用户已缓存资产
- 使用真实 media element
- 音频接口需要支持 Range
- 进度拖动要可靠
- 切歌时要更新 mini player 和 full player
- 刷新页面后可以恢复最近队列和当前条目，P0 可恢复到 paused 状态

P0 验收：
- 可以从听单详情播放所有已缓存条目
- 可以播放/暂停
- 可以上一首/下一首
- 可以拖动进度
- 可以切换列表循环、单曲循环、随机播放
- 播放结束后行为符合当前模式
- mini player 与 full player 状态同步


============================================================
9. Mini Player 规格
============================================================

位置：
- 固定在 bottom nav 上方
- 全站登录后页面可见
- 没有队列时隐藏

显示内容：
- 当前条目封面
- 当前条目标题
- 所属听单或作者
- 播放/暂停按钮
- 可选极细进度条

交互：
- 点击主体区域进入 /player 或打开 full-player overlay
- 点击播放按钮直接播放/暂停，不跳转
- 播放错误时显示错误提示或小红点/状态文案

视觉：
- 类似 Spotify mini player，但不照抄
- 简洁、紧凑、圆角、和页面底部导航协调
- 不要像调试播放器或 HTML 原生控件

实现建议：
- 建立 PlayerProvider / usePlayerStore
- 全局只存在一个 audio element 或统一播放控制实例
- mini player、full player、playlist detail 都使用同一个 player store


============================================================
10. 核心流程
============================================================

10.1 登录流程

/login
-> 输入账号、密码、邀请码
-> 成功后保存 session
-> /playlists

10.2 创建听单流程

/playlists
-> 点击底部中间“添加”
-> /playlists/new
-> 填写标题/简介
-> /playlists/new/add
-> 粘贴 B 站链接
-> 解析候选
-> 选择条目
-> 返回 /playlists/new
-> 发布
-> /playlists/:playlistId

10.3 管理已有听单流程

/playlists/:playlistId
-> owner 点击“管理”
-> /playlists/:playlistId/manage
-> 修改标题/简介/条目
-> 添加来源链接
-> 保存
-> 返回 /playlists/:playlistId

10.4 收藏听单流程

/playlists/:playlistId
-> 非 owner 或 owner 均可点击收藏，owner 是否允许收藏自己可不做重点
-> /me 收藏的听单出现该听单
-> 再次点击取消收藏

10.5 缓存与播放流程

/playlists/:playlistId
-> 选择条目或点击缓存全部
-> 创建 cache task
-> 条目进入 QUEUED / CONVERTING
-> 轮询任务状态
-> 成功后条目变 CACHED
-> 点击播放已缓存
-> 创建 player queue
-> mini player 出现
-> full player 可管理队列和播放模式


============================================================
11. API / 数据落地建议
============================================================

当前已存在 API-backed request layer、import preview、local audio cache、local audio playlist 等能力。下一步重点是把 playlist CRUD 和前端页面状态从 localStorage 原型迁移到持久 API。

建议新增或补齐：

Auth:
- POST /api/v1/auth/alpha-login
- GET /api/v1/auth/me
- POST /api/v1/auth/logout，可选

Playlists:
- GET /api/v1/playlists
  - 查询首页听单列表
  - 支持 mine/favorited/published filter
- POST /api/v1/playlists
  - 创建听单/草稿
- GET /api/v1/playlists/:playlistId
  - 获取听单详情，返回 currentUser 视角字段
- PATCH /api/v1/playlists/:playlistId
  - owner 修改标题/简介/可见性
- DELETE /api/v1/playlists/:playlistId
  - P1

Playlist Items:
- POST /api/v1/playlists/:playlistId/items
  - 添加条目
- PATCH /api/v1/playlists/:playlistId/items/reorder
  - 调整顺序，P1 可做
- DELETE /api/v1/playlists/:playlistId/items/:itemId
  - 删除条目

Favorites:
- POST /api/v1/playlists/:playlistId/favorite
- DELETE /api/v1/playlists/:playlistId/favorite
- GET /api/v1/me/favorites

Import:
- POST /api/v1/import/preview
  - 输入来源链接，返回候选条目
- POST /api/v1/playlists/:playlistId/import
  - 从候选导入到 playlist，或前端先选候选再逐条添加

Cache:
- POST /api/v1/local-audio/cache
  - 对 playlist item / source content 发起缓存
- GET /api/v1/local-audio/tasks/:taskId
  - 查询任务状态
- GET /api/v1/local-audio/playlists/:playlistId
  - 获取当前用户该听单下可播放的 cached queue
- GET /api/v1/local-audio/assets/:assetId/download
  - 播放/下载音频资产，支持 Range

Me:
- GET /api/v1/me
- GET /api/v1/me/playlists
- GET /api/v1/me/local-audio/recent


============================================================
12. 前端实现建议
============================================================

12.1 路由与页面

实现或整理：
- LoginPage
- PlaylistsHomePage
- CreatePlaylistPage
- AddFromLinkPage
- PlaylistDetailPage
- PlaylistManagePage
- MePage
- FullPlayerPage 或 FullPlayerOverlay

12.2 共享组件

建议抽组件：
- AppShell
- BottomNav
- MiniPlayer
- FullPlayer
- PlaylistCard
- PlaylistCoverMosaic
- PlaylistHeader
- PlaylistItemRow
- CacheStatusBadge
- AddSourceForm
- ImportCandidateList
- EmptyState
- ErrorState

12.3 状态管理

AuthState:
- currentUser
- token/session
- login/logout

PlaylistState:
- current playlist detail
- home playlists
- my playlists
- favorite playlists

DraftState:
- create/edit draft
- selected import candidates

PlayerState:
- queue
- current item
- audio element state
- play mode
- progress

CacheTaskState:
- task polling
- per-item status

12.4 本地存储策略

P0 可以保留：
- token/session
- 最近 player queue
- player mode
- draft 临时状态

应尽量迁移到 API：
- published playlists
- playlist items
- favorites
- user-owned relationships


============================================================
13. 视觉与交互方向
============================================================

整体：
- Mobile Web First
- 简单、干净、有一点设计感
- 不要 AI neon / cyberpunk
- 不要复杂社区 feed
- 不要过度卡片堆叠

首页听单卡：
- 封面组是主视觉
- 标题大于用户名
- 用户名低调
- 条目数/缓存数可以作为小 meta

底部导航：
- 三个入口足够
- 中间“添加”可以更突出，但不要变成大而突兀的悬浮按钮，除非整体视觉匹配

播放器：
- mini player 要像真正的音乐播放器
- full player 要把封面、进度、队列、播放模式做完整
- 不要直接暴露浏览器原生 audio controls 作为主 UI


============================================================
14. P0 / P1 切分
============================================================

P0 必须做：
- Alpha 登录：账号 + 密码 + 邀请码
- App Shell：底部三 Tab + mini player 预留
- 首页听单列表
- 添加/创建听单
- 从 B 站链接解析候选并加入听单
- 听单详情
- 我的：收藏的听单、创建的听单、退出登录
- owner / non-owner 权限区分
- 收藏/取消收藏
- 缓存条目
- 已缓存条目播放
- mini player
- full player
- 播放/暂停/上一首/下一首/进度拖动
- 列表循环 / 单曲循环 / 随机播放

P1 再做：
- 邮箱登录
- 找回密码
- 搜索
- 首页筛选
- 播放队列拖拽排序
- 批量缓存失败重试的更完整 UI
- 本地缓存空间管理
- 听单删除二次确认
- 更完整的封面编辑
- 更复杂的来源灰度开关
- 公开分享页

明确不做：
- 评论
- 关注
- 点赞流
- 复杂 UGC 广场
- 公开音频托管
- 公开分享用户缓存文件
- 绕过 DRM / 会员 / 付费 / 登录 / 地区限制


============================================================
15. 验收清单
============================================================

15.1 登录

- 未登录访问 / 自动进入 /login
- 正确账号密码邀请码可登录
- 登录成功进入 /playlists
- token 失效会回到 /login
- /me 可退出登录

15.2 首页

- 显示听单卡片列表
- 卡片包含封面组、标题、用户名
- 点击卡片进入详情
- 空状态引导添加

15.3 添加听单

- 底部中间入口进入 /playlists/new
- 可以创建听单草稿
- 可以粘贴 B 站链接解析候选
- 可以选择候选加入听单
- 可以发布听单
- 发布后进入详情

15.4 我的

- 显示我收藏的听单
- 显示我创建的听单
- 草稿和已发布有区分
- 可以退出登录

15.5 详情和管理

- 详情展示封面、标题、简介、用户名、条目列表
- owner 能看到管理入口
- 非 owner 看不到管理入口
- owner 能编辑标题/简介/条目
- 非 owner 可以收藏和缓存自己的资产

15.6 缓存

- 未缓存条目可发起缓存
- 缓存中展示状态
- 缓存成功后可播放
- 缓存失败展示失败状态

15.7 播放器

- 点击已缓存条目可播放
- 点击“播放已缓存”可建立队列
- mini player 出现在底部导航栏上方
- mini player 播放/暂停有效
- 点击 mini player 进入 full player
- full player 显示当前条目、封面、进度、队列
- 支持播放/暂停/上一首/下一首/进度拖动
- 支持列表循环、单曲循环、随机播放
- 播放模式切换后结束行为正确


============================================================
16. 给 Codex 的工作指令建议
============================================================

请先阅读：
- README.md
- docs/product.md
- docs/web-ia.md
- docs/current-state.md
- docs/decisions.md
- apps/web 当前页面和组件
- apps/api 当前 auth、source parsing、import preview、local-audio、playlist 相关代码
- packages/types
- packages/api-contract

然后按以下顺序落地：

1. 对齐 docs：把本文件的信息架构同步拆进 docs/product.md 和 docs/web-ia.md，保留长期决策在 docs/decisions.md，不写流水账。
2. 梳理 apps/web 的路由和 App Shell，形成 /login、/playlists、/playlists/new、/playlists/new/add、/playlists/:id、/playlists/:id/manage、/me、/player。
3. 实现或重构 BottomNav + MiniPlayer，保证播放器固定在底部导航上方。
4. 补齐账号和用户归属：currentUser、ownerUserId、favorite、current-user cache status。
5. 把 playlist draft/publish/detail 从 localStorage 原型逐步迁移到 API 持久化；如果一次迁移太大，先建立 repository abstraction，避免页面直接依赖 localStorage。
6. 重做首页听单卡片：封面组 + 听单名 + 用户名，保持简单直接。
7. 重做 /me：收藏的听单 + 创建的听单 + 退出登录。
8. 补齐 /playlists/:id/manage，复用创建和添加链接组件。
9. 重做 player store 和 full player，支持 queue、repeat list、repeat one、shuffle。
10. 完成后运行 pnpm lint、pnpm typecheck、pnpm test、pnpm build、pnpm verify:alpha-web。

重要实现原则：
- 不要把这个产品做成复杂音乐社区。
- 不要在产品文案里过度使用“AI music”。
- 不要用原生 audio controls 糊弄播放器 UI。
- 不要让 mini player 压住底部导航或页面内容。
- 不要把其他用户缓存文件当作公开资源复用。
- 不要绕过来源平台访问控制。
- 优先完成闭环，再做高级视觉和边缘功能。

