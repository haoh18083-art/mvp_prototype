# 销售指挥官原型 · V0.2 功能点交互页

## 范围

本目录只保留 `newPRD/PRD/V0.2/功能点/` 对应的 22 个 V0.2 功能页，并新增 V0.2 登录入口。旧批次的登录实现、人员账号、审批、分组、客户池、产品管理和客保业务页面已从原型目录移除，避免把历史交互误认为本版本需求。

22 个功能页入口：

| 模块 | 页面 |
| --- | --- |
| 客户与销售 | 客户跟进空间、客户空间（次级页）、录音管理、今日该跟、晚间日报 |
| 洞察与触达 | 经营洞察、经营洞察编排、数据洞察、方案推送跟进、消息中心 |
| 方案与助手 | 方案人员工作台、方案推送、反馈看板、方案协同台（兼容入口）、销售助手 |
| 目标与平台运营 | 销售目标与进度、平台数据、运营配置、AI 能力运营、产品知识库、会话审阅 |

页面使用 `js/features/`、`css/features.css` 与独立存储键 `sc-v02-feature-pages-v1`。保存后可刷新、跨页及跨角色查看联动；所有提交都是本地演示，不调用生产服务、真实 CRM、消息渠道或模型。

## 打开方式

直接打开 [登录入口](index.html)，在「演示身份」中选择角色后登录。如需逐页评审，可打开 [功能原型导航](prototype.html)。

| 演示角色 | 登录后默认面板 |
| --- | --- |
| 超级管理员 | 运营配置 |
| 销售运营 | 经营洞察 |
| 销售 | 客户跟进空间 |
| 解决方案人员 | 方案人员工作台 |

登录页的凭据和会话只用于本地交互演示，不是生产鉴权。为便于评审，功能页直达链接仍然可用。

运行静态预览（在本目录执行，复用仓库前端 Docker 镜像）：

```sh
docker run --rm --name qt2-v02-preview -p 127.0.0.1:4173:4173 \
  --mount "type=bind,source=$PWD,target=/prototype,readonly" \
  --workdir /prototype --entrypoint node qt2-dify-webui-dev:local tools/serve-v02.cjs
```

浏览器打开 `http://localhost:4173/`。原型没有构建环节；录音不提供上传入口、不做真实转写，助手不调用真实模型，配置不写入生产服务。移动端原型在 `http://localhost:4173/mobile-ios-sales-assistant/`，与网页端读写同一份演示数据。

## 目录结构

```text
原型/
├── index.html              V0.2 登录入口
├── prototype.html          22 个功能页的评审导航
├── css/                    公共样式与 V0.2 功能样式
├── js/
│   ├── data.js             演示数据
│   ├── menu.js             V0.2 角色菜单
│   ├── components.js       公共控件
│   ├── login.js            登录校验与角色分流
│   ├── layout.js           页面框架
│   └── features/           V0.2 功能页状态与交互
├── pages/                  22 个 V0.2 功能页（含方案工作台、推送和反馈次级页）
├── tests/                  V0.2 功能与导航回归测试
└── 验收/                   功能页映射和验收记录
```

每个页面是独立 HTML 文件，主框架由 `js/layout.js` 注入。V0.2 功能页统一加载 `js/features/*.js`，不要按单页删除其中的功能模块；如需拆包，应先同步调整页面加载和测试。

## 验收

功能页映射见 [V0.2-功能页迁入说明](验收/V0.2-功能页迁入说明.md)。推荐在现有 `qt2-v02-prototype` 容器中运行：

```sh
docker exec qt2-v02-prototype \
  node --test tests/features.cjs tests/login.cjs tests/page-navigation.cjs tests/mobile.cjs tests/mobile-chat.cjs

docker exec qt2-v02-prototype sh -lc \
  'find js tools tests -type f \( -name "*.js" -o -name "*.cjs" \) -print0 | xargs -0 -n1 node --check'
```

测试使用虚构数据和 `jsdom`，不修改生产数据。`tests/features.cjs` 覆盖 22 个功能页的渲染、页签、权限和主要交互；`tests/login.cjs` 覆盖登录校验、会话和四角色分流；`tests/page-navigation.cjs` 覆盖导航、退出、当前操作条、本地链接与静态资源；`tests/mobile.cjs` 覆盖 R09 销售移动端的四入口、客户搜索、六 Tab、写入、离线草稿与并发处理；`tests/mobile-chat.cjs` 覆盖本人助手对话页的流式回答、工单展开与失败重试、签核双路径、停止生成、深浅色切换、编辑重发与分支对话。

## 2026-10-12 毛利模块更新

- [销售月度毛利](pages/sales-goals.html?role=SLS&as=U-1004)：先看本人月度总额，再展开客户及原始产品类型。
- [运营月度毛利](pages/sales-goals.html?role=MGR&as=U-1002)：按销售、客户池和月份筛选，客户下先拆销售绑定再看产品。
- [毛利目标维护](pages/sales-goals.html?role=MGR&as=U-1002&tab=manage)：只录入毛利目标，支持调整原因及历史；超管只读。
- [客户空间历史毛利](pages/followup-workbench.html?role=SLS&as=U-1004&space=WS-201&tab=profit)：与概览当月卡片分开切月，固定该空间客户与销售绑定。
- [方案承接范围评审入口](pages/sales-goals.html?role=SOL&as=U-1010)：按当前承接客户池去重看客户全量，正式导航位置仍待评审。

毛利使用应收减对应成本；成本未结算取预估成本、已结算取结算成本；收入只按收入结算时间判断状态。预计合计包含已结算与待结算预计，缺失金额待核对，明确零正常计算。毛利按记账月份，流水总数按收入结算月份。移动端概览、历史毛利和今日经营共用同一计算结果。

本轮仍为虚构演示数据，未接入 DataHub 正式同步。旧本地财务样例首次加载时升级，原始财务快照保留在本地；其他模块内容及毛利目标调整保留。验收详情和截图见 [毛利模块验收记录](验收/20261012-毛利模块验收.md)。
