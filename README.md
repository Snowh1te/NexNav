# NexNav

#### 介绍
NexNav 是一个基于 Cloudflare Workers 的单文件、无服务器（Serverless）网址导航系统。它集成了网址管理、分类管理、智能元数据抓取、代码片段管理以及响应式 UI 设计。

## ✨ 主要特性

*   **⚡ Serverless 架构**: 基于 Cloudflare Workers，无需购买服务器，部署简单，速度极快。
*   **📂 智能分类管理**: 
    *   独立的分类管理面板，支持添加、重命名、删除。
    *   **排序功能**: 支持对分类进行上下移动排序，前端将严格按照后台设定的顺序展示。
*   **🪄 智能填充**: 输入 URL 自动抓取网站标题、描述和图标（Favicon）。
*   **🎨 现代化 UI**: 
    *   响应式设计，适配移动端。
    *   **深色模式**: 支持一键切换亮/暗色主题。
    *   **吸附式布局**: Header、搜索栏、分类筛选条均支持吸附顶部，操作更便捷。
*   **⭐ 精选收藏**: 支持将常用网站设为"精选"，首页默认展示精选站点，支持快速筛选。
*   **💾 数据安全**: 
    *   **全量备份**: 支持将所有数据（站点、分类）导出为 JSON 文件。
    *   **一键恢复**: 支持从备份文件恢复数据。
    *   **数据清空**: 提供重置功能（需二次确认及密码验证）。
*   **🛠️ 强大的后台**:
    *   密码保护的管理员登录。
    *   可视化增删改查（CRUD）。
    *   直观的仪表盘统计（站点总数、分组数量）。
    *   按分组管理站点，操作更直观。

## 🛠️ 技术栈

*   **后端**: Cloudflare Workers
*   **数据库**: Cloudflare KV
*   **前端**: 原生 HTML5 / CSS3 / JavaScript (ES6+)
*   **图标库**: FontAwesome 6.4.0 (CDN)
*   **字体**: Google Fonts (JetBrains Mono, Plus Jakarta Sans)

## 🚀 部署教程

### 前置条件

必备： [Cloudflare](https://dash.cloudflare.com/) 账号。
可选：一个托管在 [Cloudflare](https://dash.cloudflare.com/) 的域名

### 方式一：直接在 Cloudflare Dashboard 部署 (推荐新手)

1.  **创建 Worker**:
    *   登录 Cloudflare Dashboard。
    *   进入 `Workers & Pages` -> `Create application` -> `Create Worker`。
    *   命名为 `nexnav` (或你喜欢的名字)，点击 `Deploy`。

2.  **创建 KV Namespace**:
    *   在左侧菜单 `Workers & Pages` -> `KV`。
    *   点击 `Create a Namespace`，命名为 `NAVIGATION_SITES` (建议大写，方便识别)，点击 `Add`。

3.  **绑定 KV 到 Worker**:
    *   回到你刚才创建的 Worker (`nexnav`) 的设置页面 (`Settings`)。
    *   点击 `Variables` 选项卡。
    *   找到 `KV Namespace Bindings` 部分，点击 `Add binding`。
    *   **Variable name (变量名)**: 填写 `NAVIGATION_SITES` (**必须完全一致**，代码中读取的是这个变量名)。
    *   **KV Namespace**: 选择刚才创建的 `NAVIGATION_SITES` 空间。
    *   点击 `Save and deploy`。

4.  **设置管理员密码**:
    *   在同一个 `Variables` 页面，找到 `Environment Variables` 部分。
    *   点击 `Add variable`。
    *   **Variable name**: `ADMIN_PASSWORD`。
    *   **Value**: 设置你的后台登录密码。
    *   点击 `Save and deploy`。

5.  **自定义网站标题 (可选)**:
    *   在同一个 `Variables` 页面，`Environment Variables` 部分。
    *   点击 `Add variable`。
    *   **Variable name**: `SITE_TITLE`。
    *   **Value**: 设置你想要的网站名称（例如：`MyNav`）。
    *   点击 `Save and deploy`。

6.  **上传代码**:
    *   点击 Worker 页面顶部的 `Edit code` 按钮。
    *   将本项目提供的 `new_design.js` 文件内容完整复制，覆盖编辑器中的 `worker.js` 内容。
    *   点击右上角的 `Deploy` 保存并发布。

6.  **访问**:
    *   部署完成后，访问 Worker 的 URL (例如 `https://nexnav.你的子域名.workers.dev`)。
    *   点击右下角进入管理页面可进入后台管理。

7.  **配置 CNAME**:
    *   为 Worker 分配一个自定义域名 (如有已托管到Cloudflare的域名，可设置)。
    *   在 Cloudflare Dashboard 中，进入 `Pages` -> `Custom domains`。
    *   添加你的域名，Cloudflare 会提供一个 CNAME 记录。
    *   在你的域名注册商处添加该 CNAME 记录，指向 Cloudflare 的服务器。
    *   等待 DNS 传播，通常几分钟即可生效。

### 方式二：使用 Wrangler CLI 部署

1.  **初始化项目**:
    ```bash
    npm create cloudflare@latest nexnav
    # 选择 "Hello World" Worker
    cd nexnav
    ```

2.  **配置 `wrangler.toml`**:
    编辑 `wrangler.toml` 文件，添加 KV 绑定和变量配置：

    ```toml
    name = "nexnav"
    main = "src/index.js"
    compatibility_date = "2024-01-01"

    # 绑定 KV
    [[kv_namespaces]]
    binding = "NAVIGATION_SITES"
    id = "<你的_KV_NAMESPACE_ID>" # 需要先在 CF 后台创建 KV 并获取 ID，或者使用 wrangler kv:namespace create

    # 设置变量 (也可以在 Dashboard 设置，避免明文存储密码)
    [vars]
    ADMIN_PASSWORD = "your_secure_password"
    SITE_TITLE = "NexNav" # 可选，自定义网站名称
    ```

3.  **替换代码**:
    将 `new_design.js` 的内容复制到 `src/index.js`。

4.  **发布**:
    ```bash
    npx wrangler deploy
    ```

## ⚙️ 使用说明

*   **默认后台入口**: `https://你的域名/admin` 或点击页面底部的 "管理后台"。
*   **默认密码**: 通过环境变量 `ADMIN_PASSWORD` 设置修改
*   **添加网站**: 
    *   在后台，找到对应的分组卡片。
    *   点击卡片右上角的 "在此分组添加" 按钮。
    *   **智能填充**: 输入 URL 后点击魔术棒图标 🪄，系统会自动抓取信息。如果抓取失败，通常是因为目标网站有反爬虫策略，请手动填写。
*   **管理分组**:
    *   在后台仪表盘的 "分组数量" 卡片中，点击 "管理分组" 按钮。
    *   在弹出的窗口中，可以添加新分组，或者对现有分组进行重命名、排序（上移/下移）和删除。
*   **数据备份与恢复**:
    *   在后台仪表盘的 "总网站数" 卡片中。
    *   点击 **备份** 下载 JSON 文件。
    *   点击 **恢复** 上传 JSON 文件覆盖当前数据。
    *   点击 **清空** 删除所有数据（慎用）。

## 📂 数据结构 (KV)

系统在 KV 中使用以下 Key 存储数据：

*   `sites`: 存储所有网站信息的 JSON 数组。
*   `categories`: 存储分类列表及排序信息的 JSON 数组。
*   `snippets_index`: (预留功能) 代码片段索引。
*   `snippet:{id}`: (预留功能) 具体代码片段内容。

## 📄 开源协议

本项目采用 [MIT License](LICENSE) 开源。您可以免费使用、修改和分发，但请保留版权声明。

---

**© 2026 Snowh1te. All rights reserved.**
