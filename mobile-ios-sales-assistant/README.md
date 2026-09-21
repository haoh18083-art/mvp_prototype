# 销售移动端 · iOS 原型（R09）

本目录承载 [R09 移动端基础与空间读写](../../需求闭环/09-移动端基础与空间读写需求文档.md) 的交互原型。视觉骨架从 GitHub 仓库 `haoh18083-art/prototype` 的 `Sales_assistant_app` 分支导入，业务能力按 R09 / M05-1 重建。

## 来源

- 视觉骨架仓库：<https://github.com/haoh18083-art/prototype>
- 分支：`Sales_assistant_app`
- 导入提交：`6240b722c18526ea346382b59809b11affe60364`
- 导入时间：2026-09-20；按 R09 重建时间：2026-09-21

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

## 文件组织

- `pages/mobile-ios.html`：应用外壳（顶栏 / 视图容器 / 悬浮入口 / 四入口底栏 / 弹层 / 轻提示）；悬浮入口在「今日」与空间详情自动收起。
- `pages/mobile-ios-chat.html`：本人助手对话页（销售工作 Agent 设计：条目式对话、可折叠执行计划卡、过程产物/回执卡、敏感操作先确认再执行、来源脚注；流式/停止/重新生成/编辑重发/长按菜单/分支对话；视觉 token 与主 UI 同源）。自包含单文件，可独立打开；与外壳的契约（`sales-chat-close` postMessage、`data-od-id` 钩子）保持不变。
- `js/app.js`：页面实际加载的合并脚本。**改动请先改 `js/components/`，再按同样顺序拼回**：
  `store-bridge → welcome → views-main → views-space → assistant → app-shell`。
- `js/components/store-bridge.js`：桌面模型桥接、设备本地状态（离线 / 缓存 / 草稿）。
- `js/components/welcome.js`：欢迎区打字机、眨眼图标的可视区域观察（导入时的原有动效，逐字保留）。
- `js/components/views-main.js`：今日（欢迎区 / 本周经营 / 今天该跟 / 收件箱）/ 客户 / 相关 / 我的四个主入口。
- `js/components/views-space.js`：客户空间五个 Tab 与写入表单。
- `js/components/assistant.js`：本人助手覆盖层动画。
- `js/components/app-shell.js`：路由、底栏、弹层、事件绑定。
- `css/shared.css`：页面实际加载的合并样式；源文件在 `css/base|layout|components|platforms/`，`css/components/app-views.css` 是 R09 新增部分。

## 回归

```bash
node tests/mobile.cjs   # 在 原型/ 目录下执行
```
