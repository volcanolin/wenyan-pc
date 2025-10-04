# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导。

## 开发命令

### Tauri 开发
```bash
# 开发模式
npm run tauri-dev

# 生产构建
npm run tauri
```

### 关键开发说明
- 这是一个带有 Web 前端的 Tauri 应用程序
- 前端使用原生 JavaScript/HTML/CSS（无框架）
- Rust 后端处理剪贴板操作和系统集成
- 使用 `tauri-plugin-sql` 的 SQLite 数据库存储自定义主题

## 架构概览

### 应用程序结构
- **前端**: 原生 JavaScript，带有多个用于编辑器/预览的 iframe
- **后端**: Tauri (Rust)，带有剪贴板和数据库插件
- **主窗口**: 分割视图，左侧为 markdown 编辑器，右侧为实时预览
- **自定义主题系统**: 基于 CSS，使用 SQLite 存储用户主题

### 关键文件和组件

#### 主应用程序入口点
- `src/index.html` - 主应用程序窗口，包含标题栏和 iframe 容器
- `src/main.js` - 主应用程序逻辑，主题管理，平台切换
- `src/right.js` - Markdown 处理，渲染和平台特定输出

#### 内容编辑器和预览
- `src/markdown_editor.html` - 基于 CodeMirror 的 markdown 编辑器
- `src/markdown_preview.html` - 实时预览面板
- `src/css_editor.html` - 自定义主题 CSS 编辑器
- `src/css_preview.html` - 主题预览面板

#### 后端 (Rust)
- `src-tauri/src/main.rs` - Tauri 后端，包含剪贴板命令
- `src-tauri/tauri.conf.json` - Tauri 配置和权限

#### 样式和主题
- `src/styles.css` - 主应用程序样式
- `src/themes/` - 不同平台的内置主题（gzh、zhihu、juejin 等）
- `src/highlight/styles/` - 代码高亮主题

### 平台支持
应用程序支持多个发布平台，具有平台特定的格式化：
- **微信公众号 (gzh)** - 默认平台，支持自定义主题
- **知乎** - 数学公式处理
- **掘金** - 专门的 markdown 处理
- **Medium** - ASCII 表格转换
- **今日头条** - 基本格式化

### 核心功能
1. **多平台 Markdown 发布** - 将 markdown 转换为平台特定的 HTML
2. **自定义主题系统** - 用户可以创建/导入最多 10 个自定义主题
3. **代码高亮** - 多种语法高亮主题（GitHub、VS Code、Monokai 等）
4. **字体选择** - 系统字体选项（serif/sans-serif/主题默认）
5. **图例支持** - 带有平台特定样式的图片说明
6. **脚注转换** - 将链接转换为脚注，适用于学术写作
7. **导出为图片** - 使用 html2canvas 将文章转换为长图

### 数据持久化
- **SQLite 数据库**: 通过 `tauri-plugin-sql` 存储自定义主题
- **LocalStorage**: 用户偏好设置（选中的主题、字体设置、图例状态）
- **文件系统**: 通过 Tauri 文件对话框加载/保存 markdown 文件

### 通信模式
- **iframe 消息传递**: 主窗口通过 `postMessage` 与编辑器/预览 iframe 通信
- **Tauri 命令**: 前端调用 Rust 后端进行剪贴板/数据库操作
- **事件系统**: 用于主题更改、平台切换和 UI 更新的自定义事件

### 重要实现细节
- **主题 CSS 变量**: 自定义主题使用在运行时解析的 CSS 变量
- **平台特定输出**: 每个平台都有专门的 HTML 输出格式化
- **图像处理**: 外部图像转换为 base64 以实现导出功能
- **数学公式支持**: MathJax 集成用于 LaTeX 渲染
- **代码块样式**: 不同平台中代码块的特殊处理

## 脚注系统 (v2.4.8+)

### 核心实现机制
- **CSS类控制**: 脚注链接使用 `footnote-link` CSS 类控制样式，避免 JavaScript 硬编码
- **样式统一**: 所有内置主题支持统一的脚注样式规范，确保视觉一致性
- **自动重置**: 主题切换时自动调用 `resetFootnoteStylesForNewTheme()` 重置脚注样式

### 样式规范
```css
/* 基础脚注链接样式 */
#wenyan a.footnote-link {
    font-weight: bold;
    text-decoration: underline; /* 或使用 border-bottom */
    color: [主题特定颜色];
}
```

### 关键函数和流程
- **`addFootnotes()`**: 添加脚注，将链接转换为脚注格式，添加 `footnote-link` 类
- **`removeFootnotes()`**: 移除脚注，删除 `footnote-link` 类和脚注元素
- **`getContentForGzh()`**: 微信公众号特殊处理，使用 span 包装确保兼容性

### 微信公众号兼容性 (v2.4.8+)
- **特殊处理**: 在 `getContentForGzh()` 中为脚注链接添加 span 包装
- **颜色同步**: 从原始预览 DOM 获取脚注链接的实际颜色
- **结构**: `<span style="text-decoration: underline; color: [color]"><a href="...">链接</a></span>`

### 主题适配原则
- **统一规范**: 使用 `border-bottom` 或 `text-decoration: underline` 中的一种，避免双重下划线
- **颜色继承**: 脚注链接颜色与主题链接颜色保持一致
- **样式隔离**: 脚注链接样式不影响普通链接样式

### 开发注意事项
- 新增主题必须包含 `#wenyan a.footnote-link` 样式定义
- 避免在 JavaScript 中直接设置内联样式
- 主题切换时确保脚注状态正确保持和重置