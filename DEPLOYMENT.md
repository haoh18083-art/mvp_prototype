# GitHub 版本管理与公网发布

- GitHub 仓库：https://github.com/haoh18083-art/mvp_prototype
- 公网原型：https://haoh18083-art.github.io/mvp_prototype/
- 发布记录：https://github.com/haoh18083-art/mvp_prototype/actions
- 主分支：`main`

## 更新原型

在当前原型目录中修改文件后，提交并推送：

```sh
git status
git add index.html prototype.html css js pages
git commit -m "更新原型页面"
git push origin main
```

如果修改了说明文件或发布配置，也将对应文件加入本次提交。可通过 Git 客户端完成相同操作。

每次推送到 `main`，GitHub Actions 都会自动发布。等待最新发布记录显示成功后，刷新公网链接即可查看新版本。本地保存文件或仅提交而未推送，不会更新网站。在 GitHub 网页直接编辑文件并提交到 `main` 也会触发发布。

发布前会检查 JavaScript 语法。网站打包登录入口 `index.html`、评审导航 `prototype.html`、`css/`、`js/`、`pages/` 和移动端 `mobile-ios-sales-assistant/`，测试、工具脚本（`tools/`）和说明文件留在仓库中。线上 `version.json` 记录当前部署的提交编号与中文版本名，可用于核对线上版本。

## 手动重新发布

进入仓库的 Actions，选择 **Deploy prototype to GitHub Pages**，点击 **Run workflow**，选择 `main`。仓库 Settings → Pages → Source 应设为 **GitHub Actions**。

## 版本回退

先用 `git log --oneline` 查看提交记录。使用 `git revert <需要撤销的提交编号>` 生成撤销提交，再推送到 `main`，即可自动发布回退后的版本并保留历史记录。

## 交互与数据边界

GitHub Pages 托管静态网页，现有 JavaScript 交互正常运行。演示状态保存在访问者自己的浏览器存储中，不会同步给其他访问者，也不会写回 GitHub。页面代码自动发布与多人共享业务数据是两种不同能力；当前发布提供前者。

本仓库仅管理原型目录，上级 PRD 和页面设计资料仍在本地，因此 README 中指向上级目录的文档链接仅在原始工作区可用。
