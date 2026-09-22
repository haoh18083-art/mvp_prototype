# 销售移动端 · iOS 原型（R09）

本目录承载 [R09 移动端基础与空间读写](../../需求闭环/09-移动端基础与空间读写需求文档.md) 的交互原型。视觉骨架从 GitHub 仓库 `haoh18083-art/prototype` 的 `Sales_assistant_app` 分支导入，业务能力按 R09 / M05-1 重建。

## 来源

- 视觉骨架仓库：<https://github.com/haoh18083-art/prototype>
- 分支：`Sales_assistant_app`
- 导入提交：`6240b722c18526ea346382b59809b11affe60364`
- 导入时间：2026-09-20；按 R09 重建时间：2026-09-21；设计统一（图标 / 列表 / Tab / 文字阶梯）：2026-09-21

## 入口

- [移动端入口](index.html)
- [四入口主页面](pages/mobile-ios.html)
- [本人助手对话页](pages/mobile-ios-chat.html)

从 V0.2 静态预览服务访问时：

```text
http://localhost:4173/mobile-ios-sales-assistant/
```

## 两端同源

移动端直接加载网页端的 `../js/data.js` 与 `../js/features/store.js`，**不做分端存储**：

- 业务状态与网页端共用 `localStorage` 键 `sc-v02-feature-pages-v1`，手机上写的跟进在网页端刷新即可见；
- 权限、空间内容、概览、变化、行为记录、录音归位全部调用桌面同一套 `F.*` 函数，移动端不另写一份判定；
- 只有「设备本地」的东西单独存放在 `sc-v02-mobile-local-v1`：离线开关、离线缓存过的空间、未提交草稿。

演示身份默认销售付赞（U-1004），可用 `?as=U-1005` 切换到其他销售账号。

## 覆盖的闭环过程

| 过程 | 落点 |
| --- | --- |
| §4.1 四入口、本人助手入口、客户搜索 | 底栏四入口常驻；「今日」由欢迎区的「进入聊天助手」承接本人助手，客户 / 相关 / 我的由右下角悬浮入口承接，空间内改由空间助手承接；客户入口只搜本人有权空间 |
| §4.2 空间详情与五 Tab | 顶部状态角标跨 Tab 常驻；默认落地概览；折叠区每次进入重新收起；深链跳客户 Tab 并高亮；冻结只读 |
| §4.3 跟进与周复盘写入 | 跟进记录必须关联商机；周复盘含进展 / 下一步 / 阻塞；提交后进入 R04 异步更新并同批产出行为记录 |
| §4.4 方案接收、离线与并发 | 收件箱未读优先、每条只有一个动作；首次打开方案即已读；离线只读缓存 + 本机草稿；并发先提交为准 |
| R10 录音状态口径（两端同源） | 转写由得到笔记完成，同步成功即带智能总结与原文；本系统不设转写阶段，录音区不显示任何转写标记，归位后只表达客户信息更新情况（更新中 / 已完成 / 更新未完成）；「今日该跟」的判断依据只给出处与时间。共享模型已收口：`waiting_transcript` 不再是有效归位状态，旧快照里的该值加载时迁移为 `updating`（依据 M05-2 §边界与 §4.3） |
| R10 §4.2 录音归位（空间侧） | 跟进 → 录音右上角一个安静的小按钮「归位录音」（`.rec-place`，28px 高、浅灰底 + 灰字，全站不用蓝底白字）：抽屉只列**未处理**的本人录音（尚无有效归位，与录音管理「未处理」同一口径），已归位的去录音管理侧再挂；**每行右侧两个小按钮**——「查看详情」用同一套 4/5 抽屉展示智能总结 / 原文转录（左上角是返回按钮，录音名紧跟其后），「归位到本空间」在仅一条商机时自动带出直接归位、多条时先选商机（系统不代选）。商机不在挑录音抽屉里选 |

## 设计规范（改样式先读）

- **token 唯一来源**：`css/base/tokens.css`。颜色、字号、字重、行高、间距、圆角、动效、图标 / 控件尺寸一律 `var(--*)`，源文件里不写死数值。
- **文字阶梯**（`css/base/type.css`）：任何可见文本都挂在带 `.t-*` 的元素上，不留裸文本、不写内联 style。

  | 类 | 用途 | 规格 |
  | --- | --- | --- |
  | `.t-display` | 页标题（顶栏） | 24 / 700 |
  | `.t-heading` | 区块标题、空间名、弹层标题 | 16 / 650 |
  | `.t-title` | 列表行标题、卡片标题 | 14 / 650 |
  | `.t-body` | 正文 | 14 / 400 / 1.65 |
  | `.t-meta` | 辅助信息 | 11 / muted |
  | `.t-warn` | 警示文字 | 12 / 500 / danger |
  | `.t-eyebrow` | mono 小标签（eyebrow、底栏文字、「判断依据」等） | mono 10 |
  | `.t-count` | mono 计数与时间 | mono 11 · tabular |
  | `.t-figure` | 本周经营数值 | mono 24（`.is-text` 时正文字体 20） |

- **组件类唯一**：空态 `.empty-state`、说明 `.notice`（配 `.t-meta` 灰底 / `.t-warn` 红底）、状态角标 `.state-chip`、来源 `.source-chip`、内容卡 `.card`、按钮 `.btn`。
- **列表行**（`css/components/list.css`）：`.list > .list-row`，左右 16px、行高 ≥56px、行间 1px 发丝线、无卡片边框、无头像；行头 `.list-row-head > .list-main + [.list-aside] + .row-chevron`，可展开行用 `.list-row-detail`。客户列表、今天该跟、收件箱、各类记录（录音 / 草稿 / 跟进 / 行为 / 方案 / 归位 / 资料）全部套用。
- **今天该跟条目**（`css/components/follow-card.css`）：行头只放客户、状态种类、客户池、生效中的标记角标（星标 / 暂不跟进）与「一句话说明」（状态判断的结论）；「下一步」（动作建议）、「判断依据」、标记入口收进 `.list-row-detail` 展开区，两组各带 `.t-eyebrow` 小标题、组间距比组内大一段。收起只认行头（`[data-follow-toggle]`，同步 `aria-expanded`），行尾 chevron 进客户空间，展开区点依据不会把卡片收回去。
- **标记入口**（词表同 R13 §4.2）：展开区右下角 `.follow-marks` 两个小按钮——「星标 / 取消星标」一键开或关，「暂不跟进」走底部表单（原因必填、结束日选填、已有标记时带出原值并提供「取消暂不跟进」）。标记只写入次日输入，当天名单不变。
- **Tab**（`css/components/tabs.css`）：只有下划线 segmented 一种——`.seg-tabs > .seg-tabs-track > .seg-tab[.is-active]`，激活态 2px accent 指示条 + 650 字重，可横滚两端渐隐，激活项自动居中，计数 `.seg-count`（mono）。空间五 Tab、跟进子 Tab、收件箱共用，由 `segTabs()` 生成。
- **图标**（`js/components/icons.js`）：唯一注册表，`icon(name, className)` 输出 24×24 / currentColor / 1.8 描边 / round cap-join 的 SVG；尺寸由 `css/components/icon.css` 的 `.ic-xs/sm/lg/xl` 控制。底栏四入口、悬浮入口、返回、chevron、状态图标全部走注册表，页面里不再手写 SVG 或用 emoji。当前注册：`today customers related profile assistant arrow-right chevron-right chevron-down chevron-left check close star search refresh bell stop`。
- **文案**：界面只保留用户完成下一步所需的信息（空态一句话引导、冻结只读、离线草稿、推送未送达）；不写向评审解释系统逻辑的说明。
- **底部抽屉**（`css/components/app-views.css` 的 `.rec-sheet*`）：全站只有一套自底向上弹层外壳——占手机框高度 80%（4/5 屏），打开向上滑入 `rec-sheet-in`、关闭向下滑出 `rec-sheet-out`（加 `.is-closing`，动画结束或 360ms 兜底后移除节点）。标题区 `.rec-sheet-head`（标题 + 可选说明 + 关闭按钮）、内容区 `.rec-sheet-body` 是唯一滚动容器。录音内容 / 本次变化 / 空间更新 / 查看原文 / 各类表单（写跟进、暂不跟进、回复方案、归位录音）全部走它；表单内部类 `.sheet-form`、`.sheet-field`、`.sheet-pre` 与关闭按钮 `.sheet-close` 保留原名。后开的抽屉叠在上面（同 z-index，按 DOM 顺序），换页时 `render()` 收起所有抽屉与叠层。
- **顶栏**（`css/layout/mobile-shell.css` + `--topbar-h: 52px`）：只放一行页标题——「今日」是日期、客户 / 相关 / 我的 是入口名，不显示身份副标题（身份在「我的 → 账号信息」）；空间详情与「相关」的录音管理二级页用各自的页内顶栏，外壳顶栏隐藏。

## 路由转场（进入 / 返回客户空间）

- **方向**：客户（或今日 / 相关 / 我的）→ 客户空间是「推入」，新页从右侧滑入、旧页向左让位 30%；客户空间 → 返回入口是「弹出」，旧页向右退出、新页从左侧归位。主入口之间换页（底栏）与同一空间内换 Tab 不做横向转场，与 iOS 的 Tab 切换一致。
- **实现**：`.mobile-frame` 加 `is-entering-forward` / `is-entering-back`，旧页由同尺寸快照垫层 `.view-transition-layer` 承担 `is-leaving-*`。真实 DOM 始终同步切换，垫层只是视觉，动画结束（`animationend`）或 600ms 兜底计时器到点后整层移除。
- **不透明底色**：内容区本身透明，转场中的新页与垫层都必须带 `background: var(--surface)`，否则滑动时会透出旧页文字（`.mobile-shell.css` 有注释说明）。
- **降级**：`prefers-reduced-motion: reduce` 或无 `CSS.supports('animation', …)` 的环境（含 jsdom 回归）直接同步切换，不建垫层、不加转场类；`ios-base.css` 的 reduce 快照同时把转场时长压到 1ms。
- **时长与位移**：`--motion-slow`（280ms）+ `--ease-standard`，让位距离取 `--motion-view-offset`（30%），全部来自 `css/base/tokens.css`。
- **快照约定**：垫层复制顶栏与内容区并去掉 `data-topbar` / `data-view-root`，保证页面上始终只有一个当前视图钩子；滚动位置在插入后再对齐。

## 文件组织

- `pages/mobile-ios.html`：应用外壳（顶栏 / 视图容器 / 悬浮入口 / 四入口底栏 / 弹层 / 轻提示）。外壳上的图标由 `app-shell.js` 启动时从注册表注入。
- `pages/mobile-ios-chat.html`：本人助手对话页（销售工作 Agent 设计：条目式对话、可折叠执行计划卡、过程产物/回执卡、敏感操作先确认再执行、来源脚注；流式/停止/重新生成/编辑重发/长按菜单/分支对话）。自包含单文件，可独立打开；`:root` token 与 `tokens.css` 同名同值，fn-* 规则通过短别名引用；与外壳的契约（`sales-chat-close` postMessage、`data-od-id` 钩子）保持不变。
- `js/app.js`：页面实际加载的合并脚本。**改动请先改 `js/components/`，再按同样顺序拼回**：
  `store-bridge → welcome → icons → views-main → views-space → assistant → app-shell`。
- `js/components/store-bridge.js`：桌面模型桥接、设备本地状态（离线 / 缓存 / 草稿）。
- `js/components/welcome.js`：欢迎区打字机、眨眼图标的可视区域观察（导入时的原有动效，逐字保留）。
- `js/components/icons.js`：图标注册表 `icon()` 与列表行 chevron `rowChevron()`。
- `js/components/views-main.js`：今日（欢迎区 / 本周经营 / 今天该跟 / 收件箱）/ 客户 / 相关 / 我的四个主入口，以及「相关」的录音管理二级页（`#/related/recordings`：未处理 / 已处理、卡片、安静归位标记、智能总结 / 原文转录抽屉）；`sectionHead()`、`segTabs()`、`emptyState()` 公共片段。
- `js/components/views-space.js`：客户空间五个 Tab 与写入表单；`card()`、`recordRow()`、`kvList()` 公共片段。
- `js/components/assistant.js`：本人助手覆盖层动画。
- `js/components/app-shell.js`：路由、底栏、弹层、事件绑定、Tab 居中、路由转场（方向判定、旧页快照、收尾）。
- `css/shared.css`：页面实际加载的合并样式。**改动请先改源文件，再按下列顺序拼回**：

  ```text
  base/tokens → base/reset → base/type
  → layout/mobile-shell → layout/route → layout/breakpoints
  → components/icon → components/list → components/tabs → components/follow-card → components/inbox
  → components/fab → components/toast → components/assistant
  → platforms/ios-base → platforms/ios → components/app-views
  ```

  合并文件头部保留 `/* css/… */` 来源注释；旧版合并文件里没有源文件的 `web-shell / android-base / android` 段已删除（本目录只承载 iOS，`h1/h2/h3/p` 的外边距重置并入 `reset.css`）。

拼回命令（在本目录执行）：

```bash
{ echo '/* 页面实际加载的合并样式。请改对应源文件后再按同样顺序拼回这里。 */'; for f in base/tokens base/reset base/type layout/mobile-shell layout/route layout/breakpoints components/icon components/list components/tabs components/follow-card components/inbox components/fab components/toast components/assistant platforms/ios-base platforms/ios components/app-views; do echo "/* css/$f.css */"; cat "css/$f.css"; done; } > css/shared.css
{ echo '/* 页面实际加载的合并脚本。请改 js/components/ 后再按同样顺序拼回这里。 */'; for f in store-bridge welcome icons views-main views-space assistant app-shell; do echo "/* js/components/$f.js */"; cat "js/components/$f.js"; done; } > js/app.js
```

## 回归

```bash
node tests/mobile.cjs        # 在 原型/ 目录下执行
node tests/mobile-chat.cjs
```

`tests/mobile.cjs` 覆盖四入口、客户搜索、五 Tab、写入、离线草稿、并发，以及路由转场契约：推入 / 弹出的方向与垫层内容、动画结束后的收尾、主入口之间不转场，以及无动画能力环境下的同步切换。
