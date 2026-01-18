// Cloudflare Worker - New Design
// 集成：网址导航 + 快捷跳转 + 自定义代码预览

export default {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      const path = url.pathname;
  
      // API 路由
      if (path.startsWith('/api/')) {
        return handleApi(request, env, path);
      }
  
      // 页面路由
      if (path === '/' || path === '/index.html') {
        return servePage(env, 'home');
      } else if (path === '/admin') {
        return servePage(env, 'admin');
      }
  
      // 静态资源 (内联处理，模拟文件服务)
      if (path === '/style.css') return serveCSS();
      if (path === '/script.js') return serveJS();
  
      return new Response('Not Found', { status: 404 });
    }
  };
  
  // --- API 处理 ---
  
  async function handleApi(request, env, path) {
    const method = request.method;
  
    // 1. 登录验证
    if (path === '/api/login' && method === 'POST') {
      return handleLogin(request, env);
    }
  
    // 2. 智能获取元数据
    if (path === '/api/fetch-metadata' && method === 'POST') {
      return handleFetchMetadata(request);
    }
  
    // 3. 站点管理 (CRUD)
    if (path.startsWith('/api/sites')) {
      const id = path.split('/').pop();
      if (method === 'GET') return getSites(env);
      if (method === 'POST') return createSite(request, env);
      if (method === 'PUT') return updateSite(request, env, id);
      if (method === 'DELETE') return deleteSite(env, id);
    }
  
    // 4. 代码片段管理 (CRUD)
      if (path.startsWith('/api/snippets')) {
        const id = path.split('/').pop();
        if (path === '/api/snippets') {
          if (method === 'GET') return getSnippetsList(env);
          if (method === 'POST') return createSnippet(request, env);
        } else {
          if (method === 'GET') return getSnippetDetail(env, id);
          if (method === 'PUT') return updateSnippet(request, env, id);
          if (method === 'DELETE') return deleteSnippet(env, id);
        }
      }
  
      // 5. 分组管理 (Categories)
      if (path.startsWith('/api/categories')) {
          if (method === 'GET') return getCategories(env);
          if (method === 'POST') return updateCategories(request, env); // Batch update/save
      }
  
      // 6. 数据管理 (Clear/Backup/Restore)
      if (path === '/api/reset' && method === 'POST') {
          return resetData(request, env);
      }
      if (path === '/api/export' && method === 'GET') {
          return exportData(env);
      }
      if (path === '/api/import' && method === 'POST') {
          return importData(request, env);
      }
  
    return new Response('Method not allowed', { status: 405 });
  }
  
  // --- 业务逻辑 ---
  
  async function handleLogin(request, env) {
    try {
      const { password } = await request.json();
      const adminPassword = env.ADMIN_PASSWORD || 'admin123';
      if (password === adminPassword) {
        return jsonResponse({ success: true, token: 'admin_token' });
      }
      return jsonResponse({ success: false, message: '密码错误' }, 401);
    } catch (e) {
      return jsonResponse({ success: false, message: '请求错误' }, 400);
    }
  }
  
  async function handleFetchMetadata(request) {
      // 复用之前的逻辑
      try {
          const { url } = await request.json();
          if (!url) return jsonResponse({ success: false, message: 'URL required' }, 400);
  
          const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Bot/1.0)' } });
          const html = await response.text();
          
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          const title = titleMatch ? titleMatch[1].trim() : '';
          
          const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
                            html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i);
          const description = descMatch ? descMatch[1].trim() : '';
  
          // 简化的图标获取
          let icon = '';
          const iconMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["'][^>]*>/i);
          if (iconMatch) {
              icon = iconMatch[1].trim();
              try {
                  if (!icon.startsWith('http')) {
                      const urlObj = new URL(url);
                      icon = new URL(icon, urlObj.href).href;
                  }
              } catch (e) {}
          } else {
              try {
                   const urlObj = new URL(url);
                   icon = urlObj.origin + '/favicon.ico';
              } catch(e) {}
          }
  
          return jsonResponse({ success: true, data: { title, description, icon } });
      } catch (e) {
          return jsonResponse({ success: false, message: e.message }, 500);
      }
  }
  
  // Sites CRUD
  async function getSites(env) {
    try {
      const sites = await env.NAVIGATION_SITES.get('sites', { type: 'json' });
      return jsonResponse({ success: true, sites: sites || [] });
    } catch (e) {
      // Return empty array on error instead of throwing, to prevent frontend crash
      return jsonResponse({ success: true, sites: [] }); 
    }
  }
  
  async function createSite(request, env) {
    const site = await request.json();
    const sites = await env.NAVIGATION_SITES.get('sites', { type: 'json' }) || [];
    
    // 简单的重复检查 (基于URL)
    if (sites.some(s => s.url === site.url)) {
        return jsonResponse({ success: false, message: '该网站已存在' }, 409);
    }
  
    const newSite = { ...site, id: Date.now().toString(), createdAt: new Date().toISOString() };
    sites.push(newSite);
    await env.NAVIGATION_SITES.put('sites', JSON.stringify(sites));
    return jsonResponse({ success: true, site: newSite });
  }
  
  async function updateSite(request, env, id) {
    const updates = await request.json();
    const sites = await env.NAVIGATION_SITES.get('sites', { type: 'json' }) || [];
    const index = sites.findIndex(s => s.id === id);
    if (index === -1) return jsonResponse({ success: false, message: 'Not found' }, 404);
    
    sites[index] = { ...sites[index], ...updates, updatedAt: new Date().toISOString() };
    await env.NAVIGATION_SITES.put('sites', JSON.stringify(sites));
    return jsonResponse({ success: true, site: sites[index] });
  }
  
  async function deleteSite(env, id) {
    const sites = await env.NAVIGATION_SITES.get('sites', { type: 'json' }) || [];
    const newSites = sites.filter(s => s.id !== id);
    await env.NAVIGATION_SITES.put('sites', JSON.stringify(newSites));
    return jsonResponse({ success: true });
  }
  
  // Snippets CRUD
  // Store snippet metadata in 'snippets_index' and content in 'snippet:{id}'
  async function getSnippetsList(env) {
    const list = await env.NAVIGATION_SITES.get('snippets_index', { type: 'json' }) || [];
    return jsonResponse({ success: true, snippets: list });
  }
  
  async function getSnippetDetail(env, id) {
      const content = await env.NAVIGATION_SITES.get(`snippet:${id}`);
      if (content === null) return jsonResponse({ success: false, message: 'Not found' }, 404);
      return jsonResponse({ success: true, content });
  }
  
  async function createSnippet(request, env) {
      const { title, description, code } = await request.json();
      const id = Date.now().toString();
      const list = await env.NAVIGATION_SITES.get('snippets_index', { type: 'json' }) || [];
      
      const newItem = { id, title, description, createdAt: new Date().toISOString() };
      list.push(newItem);
      
      await env.NAVIGATION_SITES.put('snippets_index', JSON.stringify(list));
      await env.NAVIGATION_SITES.put(`snippet:${id}`, code);
      
      return jsonResponse({ success: true, snippet: newItem });
  }
  
  async function updateSnippet(request, env, id) {
      const { title, description, code } = await request.json();
      const list = await env.NAVIGATION_SITES.get('snippets_index', { type: 'json' }) || [];
      const index = list.findIndex(s => s.id === id);
      
      if (index !== -1) {
          list[index] = { ...list[index], title, description, updatedAt: new Date().toISOString() };
          await env.NAVIGATION_SITES.put('snippets_index', JSON.stringify(list));
      }
      
      if (code !== undefined) {
          await env.NAVIGATION_SITES.put(`snippet:${id}`, code);
      }
      
      return jsonResponse({ success: true });
  }
  
  async function deleteSnippet(env, id) {
      const list = await env.NAVIGATION_SITES.get('snippets_index', { type: 'json' }) || [];
      const newList = list.filter(s => s.id !== id);
      await env.NAVIGATION_SITES.put('snippets_index', JSON.stringify(newList));
      await env.NAVIGATION_SITES.delete(`snippet:${id}`);
      return jsonResponse({ success: true });
  }
  
  // Categories Management
  async function getCategories(env) {
      const categories = await env.NAVIGATION_SITES.get('categories', { type: 'json' }) || [];
      return jsonResponse({ success: true, categories });
  }
  
  async function updateCategories(request, env) {
      const { categories } = await request.json(); // Expects array of strings
      await env.NAVIGATION_SITES.put('categories', JSON.stringify(categories));
      return jsonResponse({ success: true });
  }
  
  // Data Management
  async function resetData(request, env) {
      // Basic auth check
      const { password } = await request.json();
      const adminPassword = env.ADMIN_PASSWORD || 'admin123';
      if (password !== adminPassword) {
          return jsonResponse({ success: false, message: '密码错误' }, 401);
      }
      
      // Clear sites and categories
      await env.NAVIGATION_SITES.put('sites', '[]');
      await env.NAVIGATION_SITES.put('categories', '[]');
      // We don't clear snippets for now as requested "delete all site info"
      
      return jsonResponse({ success: true });
  }
  
  async function exportData(env) {
      const sites = await env.NAVIGATION_SITES.get('sites', { type: 'json' }) || [];
      const categories = await env.NAVIGATION_SITES.get('categories', { type: 'json' }) || [];
      
      const data = {
          version: 1,
          exportedAt: new Date().toISOString(),
          sites,
          categories
      };
      
      return jsonResponse({ success: true, data });
  }
  
  async function importData(request, env) {
      try {
          const { data } = await request.json();
          if (!data || !Array.isArray(data.sites)) {
              return jsonResponse({ success: false, message: 'Invalid data format' }, 400);
          }
          
          await env.NAVIGATION_SITES.put('sites', JSON.stringify(data.sites));
          if (Array.isArray(data.categories)) {
              await env.NAVIGATION_SITES.put('categories', JSON.stringify(data.categories));
          }
          
          return jsonResponse({ success: true });
      } catch(e) {
          return jsonResponse({ success: false, message: 'Import failed: ' + e.message }, 500);
      }
  }
  
  async function handleCodePreview(env, id) {
      const code = await env.NAVIGATION_SITES.get(`snippet:${id}`);
      if (!code) return new Response('Code not found', { status: 404 });
      return new Response(code, {
          headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
  }
  
  // Helper
  function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // --- 页面渲染 ---
  
  function servePage(env, page) {
    const siteTitle = env.SITE_TITLE || 'NexNav';
    const html = `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${siteTitle} - 智能导航</title>
      <link rel="stylesheet" href="/style.css">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  </head>
  <body data-page="${page}">
      <div class="app-container">
          <header class="top-bar">
              <div class="logo">
                  <i class="fas fa-cube"></i>
                  <span>${siteTitle}</span>
              </div>
              <div id="headerSearch" class="header-search" style="display:none; flex:1; max-width:400px; margin:0 20px;">
                  <div class="search-input-wrapper" style="max-width:100%">
                      <i class="fas fa-search search-icon" style="font-size:16px; left:15px"></i>
                      <input type="text" class="search-input" id="topSearch" placeholder="查找资源..." style="padding:10px 15px 10px 40px; font-size:14px; border-radius:20px;">
                  </div>
              </div>
              <div class="actions">
                  <button id="themeToggle" class="icon-btn" title="切换主题"><i class="fas fa-moon"></i></button>
                  <a href="https://github.com/Snowh1te/NexNav" target="_blank" class="icon-btn" title="GitHub"><i class="fab fa-github"></i></a>
                  <a href="https://gitee.com/snowh1te/NexNav" target="_blank" class="icon-btn" title="Gitee" style="color: #c71d23;"><i class="fab fa-git-alt"></i></a>
              </div>
          </header>
  
          <main class="main-content">
              <div id="contentArea" class="content-area">
                  <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
              </div>
          </main>
  
          <footer class="footer">
              <div class="footer-content">
                  <div class="status-indicator">
                    <span class="status-dot"></span>
                    <span>System Operational</span>
                  </div>
                  <div class="copyright">© 2026 ${siteTitle}. All rights reserved.</div>
                  <a href="/admin" class="admin-link"><i class="fas fa-cog"></i> 管理后台</a>
              </div>
          </footer>
      </div>
  
      <!-- 模态框容器 -->
      <div id="modalContainer"></div>
  
      <script src="/script.js"></script>
  </body>
  </html>
    `;
    return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
  }
  
  function serveCSS() {
    const css = `
  :root {
      --bg-body-rgb: 248, 249, 250;
      --bg-card-rgb: 255, 255, 255;
      --bg-card: #ffffff;
      --text-primary: #1e293b;
      --text-secondary: #64748b;
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --border: #e2e8f0;
      --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
      --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
      --font-main: 'Plus Jakarta Sans', sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
  }
  
  [data-theme="dark"] {
      --bg-body: #0f172a;
      --bg-body-rgb: 15, 23, 42;
      --bg-card: #1e293b;
      --bg-card-rgb: 30, 41, 59;
      --text-primary: #f8fafc;
      --text-secondary: #94a3b8;
      --primary: #818cf8;
      --primary-hover: #6366f1;
      --border: #334155;
  }
  
  * { box-sizing: border-box; margin: 0; padding: 0; }
  
  body {
      font-family: var(--font-main);
      background: var(--bg-body);
      color: var(--text-primary);
      min-height: 100vh;
  }
  
  .app-container {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px;
  }
  
  /* Header */
  .top-bar {
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(var(--bg-body-rgb), 0.95);
      background: var(--bg-body);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--border);
      margin-bottom: 20px;
  }
  
  .logo {
      font-size: 24px;
      font-weight: 700;
      color: var(--primary);
      display: flex;
      align-items: center;
      gap: 12px;
  }
  
  .actions {
      display: flex;
      gap: 12px;
  }
  
  .icon-btn {
      background: none;
      border: none;
      color: var(--text-secondary);
      font-size: 18px;
      cursor: pointer;
      padding: 8px;
      border-radius: 8px;
      transition: background 0.2s;
  }
  
  .icon-btn:hover {
      background: var(--border);
      color: var(--text-primary);
  }
  
  /* Main Content */
  .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
  }
  
  .content-area {
      padding-bottom: 40px;
  }
  
  /* Search Hero (Spotlight Style) */
  .search-hero {
      /* Removed sticky hero, now in header */
      display: none; 
  }
  
  .admin-dashboard-fixed {
      position: sticky;
      top: 80px; /* Below top-bar */
      z-index: 90;
      background: rgba(var(--bg-body-rgb), 0.95); /* Fix transparency issue */
      backdrop-filter: blur(8px);
      padding: 20px 0;
      border-bottom: 1px solid var(--border);
      margin-bottom: 20px;
  }
  
  .search-input-wrapper {
      position: relative;
      max-width: 600px;
      margin: 0 auto;
  }
  
  .search-input {
      width: 100%;
      padding: 20px 24px 20px 54px;
      font-size: 18px;
      border: 2px solid var(--border);
      border-radius: 30px;
      background: var(--bg-card);
      color: var(--text-primary);
      outline: none;
      box-shadow: var(--shadow-sm);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .search-input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
      transform: scale(1.01);
  }
  
  .search-icon {
      position: absolute;
      left: 20px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-secondary);
      font-size: 20px;
  }
  
  /* Cards Grid */
  .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); /* Reduce width slightly */
      gap: 24px;
  }
  
  .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      transition: transform 0.2s, box-shadow 0.2s;
      text-decoration: none;
      color: inherit;
      display: flex;
      flex-direction: column;
      height: 100%;
      align-items: center; /* Center Content */
      text-align: center;  /* Center Text */
      position: relative;
  }
  
  .card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow);
      border-color: var(--primary);
  }
  
  .card-icon {
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, var(--primary), #818cf8);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 24px;
      margin-bottom: 16px;
      box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.2);
  }
  
  .card-title {
      font-weight: 600;
      margin-bottom: 8px;
      font-size: 16px;
      width: 100%;
  }
  
  .card-desc {
      color: var(--text-secondary);
      font-size: 13px;
      line-height: 1.5;
      flex: 1;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      margin-bottom: 10px;
      width: 100%;
      position: relative;
  }
  
  /* Tooltip for Description - Overlay style */
  .card-tooltip {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(var(--bg-card-rgb, 255, 255, 255), 0.95);
      /* Fallback if rgb var not set */
      background: var(--bg-card);
      color: var(--text-primary);
      padding: 24px;
      border-radius: 16px;
      font-size: 14px;
      line-height: 1.6;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      overflow-y: auto;
      pointer-events: none; /* Allow clicking through if needed, but usually we want to see text */
      /* Actually if it covers the card, we might want it to be clickable as the link? */
      /* The parent .card is an <a> tag, so clicking the tooltip will trigger the link. */
  }
  
  .card:hover .card-tooltip {
      opacity: 1;
      pointer-events: auto;
  }
  
  .card-meta {
      margin-top: auto; /* Push to bottom */
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 12px;
      color: var(--text-secondary);
      gap: 8px;
      width: 100%;
  }
  
  /* Filters */
  .filters {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
      justify-content: center;
      flex-wrap: wrap;
      position: sticky;
      top: 80px; /* Below top-bar */
      z-index: 80;
      background: var(--bg-body);
      padding: 10px 0 20px 0; /* Add background padding to cover content behind */
      border-bottom: 1px solid transparent; /* Optional separator */
      transition: border-color 0.3s;
  }
  
  /* Add a state where filters get a border when stuck? JS IntersectionObserver needed for that. 
     For now just solid background. 
  */
  
  .filter-chip {
      padding: 8px 20px;
      border-radius: 20px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
  }
  
  .filter-chip.active, .filter-chip:hover {
      background: var(--primary);
      color: white;
      border-color: var(--primary);
  }
  
  /* Footer */
  .footer {
      border-top: 1px solid var(--border);
      padding: 20px 0;
      color: var(--text-secondary);
      font-size: 14px;
      background: var(--bg-body);
      /* Make footer sticky/fixed if content is short, or always visible? 
         User said "always show", so sticky to bottom of viewport if content is short,
         but usually "sticky footer" means it's pushed down.
         If user means "fixed at bottom overlay", that's different.
         "not scroll with page, always show" usually means position: fixed or sticky.
      */
      position: sticky;
      bottom: 0;
      z-index: 10;
      backdrop-filter: blur(8px); /* Optional nice touch */
      background: rgba(var(--bg-body-rgb), 0.9); /* Need RGB var for transparency or just use solid */
      background: var(--bg-body); /* Fallback */
  }
  
  .footer-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 20px;
  }
  
  .status-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--primary);
  }
  
  .status-dot {
      width: 8px;
      height: 8px;
      background: #22c55e;
      border-radius: 50%;
      box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);
  }
  
  .admin-link {
      color: var(--text-secondary);
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: color 0.2s;
  }
  
  .admin-link:hover {
      color: var(--primary);
  }
  
  /* Buttons & Modal (Reused) */
  .btn {
      padding: 10px 20px;
      border-radius: 8px;
      border: none;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
      font-family: var(--font-main);
  }
  .btn-primary { background: var(--primary); color: white; }
  .btn-primary:hover { background: var(--primary-hover); }
  .btn-secondary { background: var(--bg-card); border: 1px solid var(--border); color: var(--text-primary); }
  .btn-secondary:hover { border-color: var(--primary); }
  .btn-success { background: #10b981; color: white; }
  .btn-success:hover { background: #059669; }
  .btn-warning { background: #f59e0b; color: white; }
  .btn-warning:hover { background: #d97706; }
  .btn-danger { background: #ef4444; color: white; }
  .btn-danger:hover { background: #dc2626; }
  
  .modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(4px);
  }
  .modal-content {
      background: var(--bg-card);
      padding: 32px;
      border-radius: 24px;
      width: 90%;
      max-width: 500px;
      box-shadow: var(--shadow);
  }
  .form-group { margin-bottom: 20px; }
  .form-group label { display: block; margin-bottom: 8px; font-weight: 500; }
  .form-input {
      width: 100%; padding: 12px; border: 1px solid var(--border);
      border-radius: 8px; background: var(--bg-body); color: var(--text-primary); font-family: inherit;
  }
  .loading-spinner { display: flex; justify-content: center; align-items: center; height: 200px; font-size: 32px; color: var(--primary); }
  
  @media (max-width: 600px) {
      .footer-content {
          flex-direction: column;
          align-items: center;
          text-align: center;
      }
  }
    `;
    return new Response(css, { headers: { 'Content-Type': 'text/css' } });
  }
  
  function serveJS() {
    const js = `
  const App = {
      state: {
          page: document.body.dataset.page || 'home',
          sites: [],
          categories: [], // Stored categories
          currentCategory: 'all',
          adminToken: localStorage.getItem('admin_token')
      },
  
      init() {
          this.setupTheme();
          this.route();
          window.addEventListener('popstate', () => this.route());
          
          // Handle Admin Link click
          document.addEventListener('click', (e) => {
              if (e.target.closest('.admin-link')) {
                  e.preventDefault();
                  history.pushState(null, '', '/admin');
                  this.route('/admin');
              }
              if (e.target.closest('.logo')) {
                   e.preventDefault();
                   history.pushState(null, '', '/');
                   this.route('/');
              }
          });
      },
  
      setupTheme() {
          const theme = localStorage.getItem('theme') || 'light';
          document.documentElement.setAttribute('data-theme', theme);
          document.getElementById('themeToggle').addEventListener('click', () => {
              const current = document.documentElement.getAttribute('data-theme');
              const next = current === 'light' ? 'dark' : 'light';
              document.documentElement.setAttribute('data-theme', next);
              localStorage.setItem('theme', next);
          });
      },
  
      async route(path = window.location.pathname) {
          const contentDiv = document.getElementById('contentArea');
          contentDiv.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
          
          this.updateFooterState(path === '/admin' ? 'admin' : 'home');
  
          // Pre-fetch data
          await Promise.all([this.fetchSites(), this.fetchCategories()]);
  
          if (path === '/' || path === '/index.html') {
              await this.renderHome(contentDiv);
          } else if (path === '/admin') {
              await this.renderAdmin(contentDiv);
          }
      },
  
      async fetchSites() {
          if (this.state.sites.length > 0) return this.state.sites;
          try {
              const res = await fetch('/api/sites');
              if (!res.ok) throw new Error('API Error: ' + res.status);
              const data = await res.json();
              this.state.sites = data.sites || [];
              return this.state.sites;
          } catch (e) { 
              console.error('Fetch sites failed:', e); 
              return [];
          }
      },
  
      async fetchCategories() {
          try {
              const res = await fetch('/api/categories');
              if (!res.ok) return [];
              const data = await res.json();
              this.state.categories = data.categories || [];
              return this.state.categories;
          } catch(e) {
              console.error('Fetch categories failed:', e);
              return [];
          }
      },
  
      async renderHome(container) {
          // Show Header Search
          const headerSearch = document.getElementById('headerSearch');
          if(headerSearch) headerSearch.style.display = 'block';
  
          // Use the same sorting logic as Admin
          // 1. Get all categories present in sites
          const derived = new Set(this.state.sites.map(s => s.category || 'other'));
          
          // 2. Get stored categories order
          const stored = new Set(this.state.categories);
          
          // 3. Find categories that are in sites but not in stored list (unsorted ones)
          const missing = [...derived].filter(c => !stored.has(c)).sort();
          
          // 4. Combine: Stored order first, then unsorted alphabetically
          // Important: We should only show categories that actually have sites (or maybe we want to show empty ones too? Usually Home only shows what exists)
          // Let's filter the combined list to only include those present in 'derived'
          const allOrdered = [...this.state.categories, ...missing];
          const categories = allOrdered.filter(c => derived.has(c));
          
          // Default to 'featured' if there are featured sites and no category selected (initial load)
          if (this.state.currentCategory === 'all' && !this.state.initialLoaded) {
               const hasFeatured = this.state.sites.some(s => s.starred);
               if (hasFeatured) this.state.currentCategory = 'featured';
               this.state.initialLoaded = true;
          }
  
          const html = \`
              <div class="filters">
                  <button class="filter-chip \${this.state.currentCategory === 'all' ? 'active' : ''}" onclick="App.filterHome('all', this)">全部</button>
                  <button class="filter-chip \${this.state.currentCategory === 'featured' ? 'active' : ''}" onclick="App.filterHome('featured', this)"><i class="fas fa-star" style="margin-right:4px;color:#f59e0b"></i>精选</button>

                  \${categories.map(c => \`<button class="filter-chip \${this.state.currentCategory === c ? 'active' : ''}" onclick="App.filterHome('\${c}', this)">\${c}</button>\`).join('')}
              </div>
              <div class="grid" id="sitesGrid">
                  \${this.getSitesGridHTML(this.filterSitesData(this.state.currentCategory))}
              </div>
          \`;
          container.innerHTML = html;
  
          // Bind Search Event (Top Bar)
          const searchInput = document.getElementById('topSearch');
          // Clear previous listeners (simple way: replace node)
          const newSearchInput = searchInput.cloneNode(true);
          searchInput.parentNode.replaceChild(newSearchInput, searchInput);
          
          newSearchInput.addEventListener('input', (e) => {
               const term = e.target.value.toLowerCase();
               this.applyFilter(term, this.state.currentCategory);
          });
          
          // Restore search term if exists
          if (this.state.searchTerm) {
              newSearchInput.value = this.state.searchTerm;
          }
      },
  
      filterHome(category, btn) {
          document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.state.currentCategory = category;
          
          const searchInput = document.getElementById('topSearch');
          const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
          this.applyFilter(searchTerm, category);
      },
  
      filterSitesData(category) {
          let filtered = this.state.sites;
          if (category === 'featured') {
              filtered = filtered.filter(s => s.starred);
          } else if (category !== 'all') {
              filtered = filtered.filter(s => s.category === category);
          }
          return filtered;
      },
  
      applyFilter(term, category) {
          this.state.searchTerm = term; // Save search term state
          let filtered = this.filterSitesData(category);
          
          // Filter by Search Term
          if (term) {
              filtered = filtered.filter(s => 
                  s.name.toLowerCase().includes(term) || 
                  (s.description && s.description.toLowerCase().includes(term)) ||
                  s.url.toLowerCase().includes(term)
              );
          }
          
          document.getElementById('sitesGrid').innerHTML = this.getSitesGridHTML(filtered);
      },
  
      getSitesGridHTML(sites) {
          if (sites.length === 0) return '<div style="grid-column:1/-1;text-align:center;color:var(--text-secondary)">暂无数据</div>';
          return sites.map(site => {
              const iconHtml = (site.icon && (site.icon.startsWith('http') || site.icon.startsWith('data:')))
                  ? \`<img src="\${site.icon}" style="width:32px;height:32px;object-fit:contain">\`
                  : \`<i class="\${site.icon || 'fas fa-link'}"></i>\`;
              
              const tooltip = site.description ? \`<div class="card-tooltip">\${site.description}</div>\` : '';
                  
              return \`
              <a href="\${site.url}" target="_blank" class="card">
                  <div class="card-icon">\${iconHtml}</div>
                  <div class="card-title">\${site.name}</div>
                  <div class="card-desc">
                      \${site.description || '暂无描述'}
                  </div>
                  \${tooltip}
                  <div class="card-meta">
                      <span style="background:var(--bg-body);padding:2px 8px;border-radius:10px">\${site.category}</span>
                  </div>
              </a>
          \`;
          }).join('');
      },
  
      async renderAdmin(container) {
          // Hide Header Search
          const headerSearch = document.getElementById('headerSearch');
          if(headerSearch) headerSearch.style.display = 'none';
  
          if (!this.state.adminToken) {
              container.innerHTML = \`
                  <div style="max-width:400px;margin:100px auto;text-align:center">
                      <h3>管理员登录</h3>
                      <div class="form-group" style="margin-top:20px">
                          <input type="password" id="adminPwd" class="form-input" placeholder="密码">
                      </div>
                      <button class="btn btn-primary" onclick="App.login()">登录</button>
                      <button class="btn btn-secondary" onclick="history.back()" style="margin-left:10px">返回</button>
                  </div>
              \`;
              return;
          }
  
          await this.fetchSites();
          
          // Group sites by category
          const sites = this.state.sites;
          // Merge derived and stored categories
          const derived = new Set(sites.map(s => s.category));
          const stored = new Set(this.state.categories);
          const missing = [...derived].filter(c => !stored.has(c)).sort();
          // Use stored order + alphabetical missing categories
          const allCategories = [...this.state.categories, ...missing];
          
          // Calculate Stats
          const totalSites = sites.length;
          const totalCategories = allCategories.length;
  
          let html = \`
              <div class="admin-dashboard-fixed">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
                      <h3>仪表盘</h3>
                      <div>
                          <button class="btn btn-secondary" onclick="App.logout()">退出登录</button>
                      </div>
                  </div>
                  
                  <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: 40px;">
                      <div class="card" style="align-items:flex-start;text-align:left; position:relative">
                          <div style="font-size:14px;color:var(--text-secondary)">总网站数</div>
                          <div style="font-size:32px;font-weight:700;color:var(--primary);margin-bottom:10px">\${totalSites}</div>
                          <div style="display:flex;gap:8px;flex-wrap:wrap">
                              <button class="btn btn-success" style="font-size:12px;padding:4px 10px" onclick="App.backupData()" title="备份数据">
                                  <i class="fas fa-download"></i> 备份
                              </button>
                              <button class="btn btn-warning" style="font-size:12px;padding:4px 10px" onclick="App.restoreData()" title="恢复数据">
                                  <i class="fas fa-upload"></i> 恢复
                              </button>
                              <button class="btn btn-danger" style="font-size:12px;padding:4px 10px" onclick="App.clearData()" title="清空数据">
                                  <i class="fas fa-trash-alt"></i> 清空
                              </button>
                          </div>
                      </div>
                      <div class="card" style="align-items:flex-start;text-align:left; position:relative">
                          <div style="font-size:14px;color:var(--text-secondary)">分组数量</div>
                          <div style="display:flex;align-items:center;justify-content:space-between;width:100%">
                              <div style="font-size:32px;font-weight:700;color:var(--primary)">\${totalCategories}</div>
                              <button class="btn btn-secondary" style="font-size:12px;padding:4px 10px" onclick="App.showCategoryManager()">
                                  <i class="fas fa-cog"></i> 管理分组
                              </button>
                          </div>
                      </div>
                  </div>
  
                  <div style="display:flex;justify-content:space-between;align-items:center;">
                      <h3>内容管理</h3>
                  </div>
              </div>
              
              <div style="padding-bottom: 40px;">
          \`;
  
          // Render Categories and Sites
          allCategories.forEach(cat => {
              const catSites = sites.filter(s => s.category === cat);
              html += \`
                  <div style="margin-bottom: 30px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 20px;">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;border-bottom:1px solid var(--border);padding-bottom:10px">
                          <div style="font-weight:600;font-size:18px">
                              \${cat} <span style="font-size:14px;color:var(--text-secondary);font-weight:normal">(\${catSites.length})</span>
                          </div>
                          <button class="btn btn-secondary" style="padding:4px 12px;font-size:12px" onclick="App.showSiteModal(null, '\${cat}')">
                              <i class="fas fa-plus"></i> 在此分组添加
                          </button>
                      </div>
                      
                      <div style="display:grid;gap:10px">
                          \${catSites.map(site => \`
                              <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;border-radius:8px;background:var(--bg-body)">
                                  <div style="display:flex;align-items:center;gap:12px;overflow:hidden">
                                      <div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:#e0e7ff;border-radius:8px;color:var(--primary);flex-shrink:0">
                                          \${(site.icon && site.icon.startsWith('http')) ? \`<img src="\${site.icon}" style="width:20px;height:20px">\` : \`<i class="\${site.icon || 'fas fa-link'}"></i>\`}
                                      </div>
                                      <div style="overflow:hidden">
                                          <div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">\${site.name}</div>
                                          <div style="font-size:12px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">\${site.url}</div>
                                      </div>
                                  </div>
                                  <div style="display:flex;gap:8px;flex-shrink:0">
                                      <button class="icon-btn" onclick="App.toggleStar('\${site.id}')" title="\${site.starred ? '取消精选' : '设为精选'}">
                                          <i class="fas fa-star" style="color: \${site.starred ? '#f59e0b' : '#cbd5e1'}"></i>
                                      </button>
                                      <button class="icon-btn" onclick="App.showSiteModal('\${site.id}')"><i class="fas fa-edit"></i></button>
                                      <button class="icon-btn" onclick="App.deleteSite('\${site.id}')" style="color:#ef4444"><i class="fas fa-trash"></i></button>
                                  </div>
                              </div>
                          \`).join('')}
                          \${catSites.length === 0 ? '<div style="color:var(--text-secondary);font-size:12px;text-align:center;padding:10px">暂无网站 (空分组)</div>' : ''}
                      </div>
                  </div>
              \`;
          });
          
          html += '</div>';
          container.innerHTML = html;
      },
  
      async login() {
          const pwd = document.getElementById('adminPwd').value;
          const res = await fetch('/api/login', {
              method: 'POST',
              body: JSON.stringify({ password: pwd })
          });
          const data = await res.json();
          if (data.success) {
              this.state.adminToken = data.token;
              localStorage.setItem('admin_token', data.token);
              this.route();
          } else {
              alert('密码错误');
          }
      },
  
      logout() {
          this.state.adminToken = null;
          localStorage.removeItem('admin_token');
          this.route('/');
      },
  
      async showCategoryManager() {
          // Fetch latest categories
          await this.fetchCategories();
          // Merge with derived just in case
          const derived = new Set(this.state.sites.map(s => s.category));
          const stored = new Set(this.state.categories);
          const missing = [...derived].filter(c => !stored.has(c)).sort();
          const allCategories = [...this.state.categories, ...missing];
  
          const html = \`
              <div class="modal-overlay" onclick="if(event.target===this) document.getElementById('modalContainer').innerHTML=''">
                  <div class="modal-content">
                      <h3>管理分组</h3>
                      <div style="display:flex; gap:10px; margin-bottom:20px">
                          <input type="text" id="new_cat_name" class="form-input" placeholder="新分组名称">
                          <button class="btn btn-primary" onclick="App.addCategory()">添加</button>
                      </div>
                      <div style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px;">
                          \${allCategories.map((c, index) => \`
                              <div style="display:flex; justify-content:space-between; align-items:center; padding: 10px; border-bottom: 1px solid var(--border);">
                                  <span>\${c}</span>
                                  <div style="display:flex; gap:8px;">
                                      <button class="icon-btn" onclick="App.moveCategory(\${index}, -1)" title="上移" \${index === 0 ? 'disabled' : ''} style="\${index === 0 ? 'opacity:0.3' : ''}"><i class="fas fa-arrow-up"></i></button>
                                      <button class="icon-btn" onclick="App.moveCategory(\${index}, 1)" title="下移" \${index === allCategories.length - 1 ? 'disabled' : ''} style="\${index === allCategories.length - 1 ? 'opacity:0.3' : ''}"><i class="fas fa-arrow-down"></i></button>
                                      <button class="icon-btn" onclick="App.renameCategoryPrompt('\${c}')" title="重命名"><i class="fas fa-edit"></i></button>
                                      <button class="icon-btn" onclick="App.deleteCategoryPrompt('\${c}')" style="color:#ef4444" title="删除"><i class="fas fa-trash"></i></button>
                                  </div>
                              </div>
                          \`).join('')}
                      </div>
                      <div style="text-align:right; margin-top:20px">
                          <button class="btn btn-secondary" onclick="document.getElementById('modalContainer').innerHTML=''">关闭</button>
                      </div>
                  </div>
              </div>
          \`;
          document.getElementById('modalContainer').innerHTML = html;
      },
  
      async moveCategory(index, direction) {
          // Ensure we have the full list in state including derived ones if they were just added
          const derived = new Set(this.state.sites.map(s => s.category));
          const stored = new Set(this.state.categories);
          const missing = [...derived].filter(c => !stored.has(c)).sort();
          
          // If there are missing categories, add them to state first
          if (missing.length > 0) {
              this.state.categories = [...this.state.categories, ...missing];
          }
          
          const newIndex = index + direction;
          if (newIndex < 0 || newIndex >= this.state.categories.length) return;
          
          const item = this.state.categories[index];
          this.state.categories.splice(index, 1);
          this.state.categories.splice(newIndex, 0, item);
          
          await this.saveCategories();
          this.showCategoryManager();
          this.renderAdmin(document.getElementById('contentArea'));
      },
  
      async addCategory() {
          const input = document.getElementById('new_cat_name');
          const name = input.value.trim();
          if (!name) return;
          
          if (this.state.categories.includes(name)) {
              alert('分组已存在');
              return;
          }
          
          this.state.categories.push(name);
          await this.saveCategories();
          input.value = '';
          this.showCategoryManager(); // Refresh modal
          this.renderAdmin(document.getElementById('contentArea')); // Refresh background
      },
  
      async renameCategoryPrompt(oldName) {
          const newName = prompt('重命名分组:', oldName);
          if (!newName || newName === oldName) return;
          
          // Update stored categories
          const index = this.state.categories.indexOf(oldName);
          if (index !== -1) {
              this.state.categories[index] = newName;
          } else {
               // It was a derived-only category, add it to stored
               this.state.categories.push(newName);
          }
          
          // Update all sites
          this.state.sites.forEach(s => {
              if (s.category === oldName) {
                  s.category = newName;
                  // Trigger background update for each site? No, better batch or just optimistic.
                  // Since API is per-site, we need to loop update. This is slow but simple for now.
                  fetch(\`/api/sites/\${s.id}\`, {
                      method: 'PUT',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify({ category: newName })
                  });
              }
          });
  
          await this.saveCategories();
          this.showCategoryManager();
          this.renderAdmin(document.getElementById('contentArea'));
      },
  
      async deleteCategoryPrompt(name) {
          if (!confirm(\`确定删除分组 "\${name}"? 该分组下的网站将被移至 "uncategorized"。\`)) return;
          
          // Remove from stored
          this.state.categories = this.state.categories.filter(c => c !== name);
          
          // Update sites
          this.state.sites.forEach(s => {
              if (s.category === name) {
                  s.category = 'uncategorized';
                  fetch(\`/api/sites/\${s.id}\`, {
                      method: 'PUT',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify({ category: 'uncategorized' })
                  });
              }
          });
          
          await this.saveCategories();
          this.showCategoryManager();
          this.renderAdmin(document.getElementById('contentArea'));
      },
  
      async saveCategories() {
          try {
              await fetch('/api/categories', {
                  method: 'POST',
                  headers: {'Content-Type': 'application/json'},
                  body: JSON.stringify({ categories: this.state.categories })
              });
          } catch(e) {
              alert('保存分组失败');
          }
      },
  
      showSiteModal(id = null, category = null) {
          const site = id ? this.state.sites.find(s => s.id === id) : null;
          const defaultCategory = category || (site ? site.category : 'development');
          
          const derived = new Set(this.state.sites.map(s => s.category));
          const stored = new Set(this.state.categories);
          const missing = [...derived].filter(c => !stored.has(c)).sort();
          const allCategories = [...this.state.categories, ...missing];
  
          const modalHtml = \`
              <div class="modal-overlay" onclick="if(event.target===this) document.getElementById('modalContainer').innerHTML=''">
                  <div class="modal-content">
                      <h3>\${site ? '编辑网站' : '添加网站'}</h3>
                      <div class="form-group">
                          <label>URL</label>
                          <div style="display:flex;gap:10px">
                               <input type="text" id="m_url" class="form-input" value="\${site ? site.url : ''}" placeholder="https://example.com">
                               <button class="btn btn-secondary" onclick="App.smartFill()"><i class="fas fa-magic"></i></button>
                          </div>
                      </div>
                      <div class="form-group">
                          <label>名称</label>
                          <input type="text" id="m_name" class="form-input" value="\${site ? site.name : ''}">
                      </div>
                      <div class="form-group">
                          <label>分类</label>
                          <select id="m_category" class="form-input">
                              \${allCategories.map(c => \`<option value="\${c}" \${c === defaultCategory ? 'selected' : ''}>\${c}</option>\`).join('')}
                          </select>
                      </div>
                      <div class="form-group">
                          <label>图标 (URL 或 FontAwesome Class)</label>
                          <input type="text" id="m_icon" class="form-input" value="\${site ? site.icon : ''}">
                      </div>
                      <div class="form-group">
                          <label>描述</label>
                          <textarea id="m_desc" class="form-input" rows="3">\${site ? site.description : ''}</textarea>
                      </div>
                      <div style="text-align:right; display:flex; justify-content:flex-end; gap:10px">
                          <button class="btn btn-secondary" onclick="document.getElementById('modalContainer').innerHTML=''">取消</button>
                          <button class="btn btn-primary" onclick="App.submitSite('\${id || ''}')">保存</button>
                      </div>
                  </div>
              </div>
          \`;
          document.getElementById('modalContainer').innerHTML = modalHtml;
      },
  
      async smartFill() {
          const urlInput = document.getElementById('m_url');
          const url = urlInput.value;
          if (!url) {
              alert('请先输入URL');
              return;
          }
          
          const btn = event.currentTarget; // This might be lost in async if not captured, but event is global in some contexts or passed. better use explicit.
          // Actually event.currentTarget works in inline onclick handler in many browsers but safer to pass 'this' in HTML.
          // In the HTML it is onclick="App.smartFill()". event is available.
          
          const originalIcon = btn.innerHTML;
          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
          btn.disabled = true;
          
          try {
              // Fix: ensure URL has protocol
              let targetUrl = url.trim();
              if (!/^https?:\\/\\//i.test(targetUrl)) {
                  targetUrl = 'https://' + targetUrl;
                  urlInput.value = targetUrl;
              }
  
              const res = await fetch('/api/fetch-metadata', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ url: targetUrl })
              });
              const data = await res.json();
              if (data.success) {
                  if(data.data.title) document.getElementById('m_name').value = data.data.title;
                  if(data.data.description) document.getElementById('m_desc').value = data.data.description;
                  if(data.data.icon) document.getElementById('m_icon').value = data.data.icon; 
              } else {
                  alert('获取失败: ' + (data.message || 'Unknown error'));
              }
          } catch(e) { 
              console.error(e);
              alert('获取失败，请检查网络或URL'); 
          }
          finally { 
              btn.innerHTML = originalIcon; 
              btn.disabled = false;
          }
      },
  
      async submitSite(id) {
          const btn = event.target; // Capture button to prevent double click
          if (btn.disabled) return;
          
          const data = {
              name: document.getElementById('m_name').value,
              url: document.getElementById('m_url').value,
              category: document.getElementById('m_category').value,
              icon: document.getElementById('m_icon').value,
              description: document.getElementById('m_desc').value
          };
          
          if (!data.name || !data.url) {
              alert('名称和URL必填');
              return;
          }
  
          btn.disabled = true;
          const originalText = btn.innerText;
          btn.innerText = '保存中...';
          
          const method = id ? 'PUT' : 'POST';
          const url = id ? \`/api/sites/\${id}\` : '/api/sites';
          
          try {
              const res = await fetch(url, {
                  method,
                  headers: {'Content-Type': 'application/json'},
                  body: JSON.stringify(data)
              });
              
              const result = await res.json();
              if (result.success) {
                   document.getElementById('modalContainer').innerHTML = '';
                   this.state.sites = []; // force refresh
                   this.renderAdmin(document.getElementById('contentArea'));
              } else {
                  alert(result.message || '保存失败');
              }
          } catch (e) {
              alert('网络错误');
          } finally {
              btn.disabled = false;
              btn.innerText = originalText;
          }
      },
  
      updateFooterState(page) {
          const footer = document.querySelector('.footer');
          if (!footer) return;
          
          const link = footer.querySelector('.admin-link');
          if (page === 'admin') {
              link.innerHTML = '<i class="fas fa-home"></i> 返回首页';
              link.onclick = (e) => {
                  e.preventDefault();
                  history.pushState(null, '', '/');
                  this.route('/');
              };
              link.href = "/";
          } else {
              link.innerHTML = '<i class="fas fa-cog"></i> 管理后台';
              link.onclick = (e) => {
                  e.preventDefault();
                  history.pushState(null, '', '/admin');
                  this.route('/admin');
              };
              link.href = "/admin";
          }
      },
  
      async toggleStar(id) {
          const site = this.state.sites.find(s => s.id === id);
          if (!site) return;
          
          const newStarred = !site.starred;
          
          // Optimistic update
          site.starred = newStarred;
          this.renderAdmin(document.getElementById('contentArea'));
          
          try {
              await fetch(\`/api/sites/\${id}\`, {
                  method: 'PUT',
                  headers: {'Content-Type': 'application/json'},
                  body: JSON.stringify({ starred: newStarred })
              });
          } catch(e) {
              alert('操作失败');
              // Revert
              site.starred = !newStarred;
              this.renderAdmin(document.getElementById('contentArea'));
          }
      },
  
      async deleteSite(id) {
          if(!confirm('确定删除?')) return;
          await fetch(\`/api/sites/\${id}\`, { method: 'DELETE' });
          this.state.sites = [];
          this.renderAdmin(document.getElementById('contentArea'));
      },
  
      async clearData() {
          const pwd = prompt('请输入管理员密码以确认清空所有数据:');
          if (!pwd) return;
          
          if (!confirm('警告：此操作将永久删除所有网站和分组信息！确定继续吗？')) return;
          
          try {
              const res = await fetch('/api/reset', {
                  method: 'POST',
                  headers: {'Content-Type': 'application/json'},
                  body: JSON.stringify({ password: pwd })
              });
              const data = await res.json();
              if (data.success) {
                  alert('数据已清空');
                  this.state.sites = [];
                  this.state.categories = [];
                  this.renderAdmin(document.getElementById('contentArea'));
              } else {
                  alert('操作失败: ' + (data.message || 'Unknown error'));
              }
          } catch(e) {
              alert('网络错误');
          }
      },
  
      async backupData() {
          try {
              const res = await fetch('/api/export');
              const data = await res.json();
              if (data.success) {
                  const blob = new Blob([JSON.stringify(data.data, null, 2)], {type: 'application/json'});
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = \`nexnav-backup-\${new Date().toISOString().slice(0,10)}.json\`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
              } else {
                  alert('备份失败');
              }
          } catch(e) {
              alert('备份失败: ' + e.message);
          }
      },
  
      async restoreData() {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json';
          input.onchange = async e => {
              const file = e.target.files[0];
              if (!file) return;
              
              if (!confirm('警告：恢复数据将覆盖当前所有数据！确定继续吗？')) return;
              
              const reader = new FileReader();
              reader.onload = async event => {
                  try {
                      const json = JSON.parse(event.target.result);
                      // Support both raw array or { data: ... } wrapper if exported differently, 
                      // but our export format is { version, sites, categories }
                      // API expects { data: { sites: [], categories: [] } } structure or direct?
                      // Let's look at importData: const { data } = await request.json();
                      // So we send { data: json }
                      
                      const res = await fetch('/api/import', {
                          method: 'POST',
                          headers: {'Content-Type': 'application/json'},
                          body: JSON.stringify({ data: json })
                      });
                      
                      const result = await res.json();
                      if (result.success) {
                          alert('恢复成功');
                          this.state.sites = []; // force refresh
                          this.renderAdmin(document.getElementById('contentArea'));
                      } else {
                          alert('恢复失败: ' + (result.message || 'Unknown error'));
                      }
                  } catch(ex) {
                      alert('文件解析失败');
                  }
              };
              reader.readAsText(file);
          };
          input.click();
      },
  };
  
  // Start
  document.addEventListener('DOMContentLoaded', () => {
      App.init();
  });
    `;
    return new Response(js, { headers: { 'Content-Type': 'application/javascript' } });
  }
