# CLAUDE.md - 文颜-rev 项目指南

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**原版作者**: Lei Cao © 2024
**增强版**: volcanolin © 2025
**项目标识符**: com.github.volcanolin.wenyan-rev

## 开发命令

### Tauri 开发
```bash
# 开发模式
npm run tauri-dev

# 生产构建
npm run tauri
```

### 版本发布流程
```bash
# 1. 更新版本号
# - package.json (前端版本)
# - src-tauri/Cargo.toml (后端版本)
# - README.md 和 CHANGELOG.md

# 2. 构建生产版本
npm run tauri

# 3. Git 操作
git add .
git commit -m "发布版本 vX.X.X：描述变更"
git tag vX.X.X
git push origin main
git push origin vX.X.X

# 4. 创建 GitHub Release（手动）
# 访问 GitHub Releases 页面创建新 Release
# 上传 src-tauri/target/release/bundle/ 中的安装包
```

### 关键开发说明
- 这是一个带有 Web 前端的 Tauri 应用程序
- 前端使用原生 JavaScript/HTML/CSS（无框架）
- Rust 后端处理剪贴板操作和系统集成
- 使用 `tauri-plugin-sql` 的 SQLite 数据库存储自定义主题

## 架构概览 - 文颜-rev

### 应用程序结构
- **前端**: 原生 JavaScript，带有多个用于编辑器/预览的 iframe
- **后端**: Tauri (Rust)，带有剪贴板和数据库插件
- **主窗口**: 分割视图，左侧为 markdown 编辑器，右侧为实时预览
- **自定义主题系统**: 基于 CSS，使用 SQLite 存储用户主题
- **应用标识**: `com.github.volcanolin.wenyan-rev` (独立于原版，可同时安装)

### 关键文件和组件

#### 主应用程序入口点
- `src/index.html` - 主应用程序窗口，包含标题栏和 iframe 容器（文颜-rev）
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
- **LocalStorage**: 用户偏好设置（选中的主题、字体设置、图例状态、脚注状态）
- **持久化状态对象**: 如 `FootnoteState` 用于管理功能状态的持久化
- **文件系统**: 通过 Tauri 文件对话框加载/保存 markdown 文件

### 通信模式
- **iframe 消息传递**: 主窗口通过 `postMessage` 与编辑器/预览 iframe 通信
- **事件处理器**: `EventHandler` 对象处理各种消息类型，如 `onUpdate`, `onContentChange`, `onFootnoteChange`
- **Tauri 命令**: 前端调用 Rust 后端进行剪贴板/数据库操作
- **事件系统**: 用于主题更改、平台切换和 UI 更新的自定义事件

### 重要实现细节
- **主题 CSS 变量**: 自定义主题使用在运行时解析的 CSS 变量
- **平台特定输出**: 每个平台都有专门的 HTML 输出格式化
- **图像处理**: 外部图像转换为 base64 以实现导出功能
- **数学公式支持**: MathJax 集成用于 LaTeX 渲染
- **代码块样式**: 不同平台中代码块的特殊处理

## 脚注系统 (v2.4.10+)

### 核心实现机制
- **CSS类控制**: 脚注链接使用 `footnote-link` CSS 类控制样式，避免 JavaScript 硬编码
- **持久化状态管理**: 使用 `FootnoteState` 对象通过 localStorage 存储脚注启用状态
- **自动重置**: 主题切换时自动调用 `resetFootnoteStylesForNewTheme()` 重置脚注样式
- **防重复机制**: `addFootnotes()` 函数检测现有脚注，避免重复添加导致序号叠加

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
- **`addFootnotes()`**: 添加脚注，将链接转换为脚注格式，添加 `footnote-link` 类，包含重复检测
- **`removeFootnotes()`**: 移除脚注，删除 `footnote-link` 类和脚注元素，清除持久化状态
- **`FootnoteState`**: 状态管理对象，提供 `isEnabled()`, `setEnabled()`, `clear()` 方法
- **`getContentForGzh()`**: 微信公众号特殊处理，使用 span 包装确保兼容性
- **`refreshContentWithFont()`**: 内容重新渲染时使用持久化状态恢复脚注功能
- **`resetFootnoteStylesForNewTheme()`**: 主题切换时重置脚注样式

### 微信公众号兼容性 (v2.4.8+)
- **特殊处理**: 在 `getContentForGzh()` 中为脚注链接添加 span 包装
- **颜色同步**: 从原始预览 DOM 获取脚注链接的实际颜色
- **结构**: `<span style="text-decoration: underline; color: [color]"><a href="...">链接</a></span>`

### 主题适配原则
- **统一规范**: 使用 `border-bottom` 或 `text-decoration: underline` 中的一种，避免双重下划线
- **颜色继承**: 脚注链接颜色与主题链接颜色保持一致
- **样式隔离**: 脚注链接样式不影响普通链接样式

## CSS 伪元素处理系统 (v2.4.9+)

### 核心实现机制
- **伪元素转换**: 将CSS伪元素 (`::before`, `::after`) 转换为实际的HTML元素
- **跨平台兼容**: 解决CSS伪元素在某些平台（如微信公众号）中不显示的问题
- **智能布局**: 自动处理伪元素与主内容的布局关系

### 关键函数和流程
- **`processPseudoElements()`**: 遍历DOM元素，查找并处理伪元素
- **`buildPseudoSpan()`**: 创建HTML span元素替代CSS伪元素
- **`refreshContentWithFont()`**: 内容重新渲染时自动恢复脚注和伪元素状态

### 布局控制策略
- **内联元素**: 使用 `<span>` 替代 `<section>` 避免不必要的换行
- **垂直对齐**: 为三角形装饰等元素设置适当的 vertical-align 属性
- **行内块布局**: 使用 `display: inline-block` 精确控制布局

### 主题适配原则
- 新增主题必须包含 `#wenyan a.footnote-link` 样式定义
- 避免在 JavaScript 中直接设置内联样式
- 主题切换时确保脚注状态正确保持和重置

## 状态管理和功能交互

### 功能间协调机制
- **轻量级 vs 重量级操作**: 脚注功能使用DOM操作，图例功能使用内容重新渲染
- **状态持久化**: LocalStorage 存储功能状态，重启后自动恢复
- **状态同步**: 按钮颜色与功能状态实时同步，提供即时视觉反馈

### 重要修复 (v2.4.10)
- **状态持久化修复**: 解决内容更新时脚注功能失效的根本问题
- **序号重复修复**: 防止多次调用导致脚注序号叠加显示
- **事件处理完善**: 修复 `onContentChange` 事件中缺少脚注状态恢复
- **重复调用优化**: 添加防重复机制，确保脚注功能的可靠性

### 重要修复 (v2.4.9)
- **交互冲突修复**: 解决图例开关导致脚注功能失效的问题
- **状态保持机制**: 在 `refreshContentWithFont()` 中自动恢复脚注状态

## 关键架构设计原则

### 状态管理模式
- **轻量级操作**: 脚注功能使用直接DOM操作，避免内容重新渲染
- **重量级操作**: 图例功能使用内容重新渲染，确保样式一致性
- **持久化状态**: 使用 localStorage 和专用状态对象管理功能状态
- **状态隔离**: 各功能状态独立存储，避免相互影响
- **自动恢复**: 内容重新渲染后通过持久化状态自动恢复功能状态

### 跨平台兼容策略
- **渐进增强**: 核心功能在所有平台可用，高级功能在支持平台增强
- **平台特定处理**: 不同平台有专门的HTML输出格式化逻辑
- **优雅降级**: 高级功能不支持时自动回退到基础功能
- **一致性保证**: 确保核心功能在所有平台的用户体验一致

## 开发指导原则

### 功能开发规范
- **最小影响原则**: 新功能应尽可能减少对现有功能的影响
- **向后兼容**: 确保新版本不破坏现有用户的文档和设置
- **渐进式改进**: 优先改进现有功能，再添加新功能
- **用户体验优先**: 所有技术决策应以提升用户体验为最终目标

### 代码质量标准
- **模块化设计**: 功能模块之间应保持低耦合、高内聚
- **错误处理**: 所有用户操作都应有适当的错误处理和用户反馈
- **性能优化**: DOM操作应批量进行，避免频繁重排重绘
- **状态一致性**: UI状态必须与功能状态保持实时同步

### 测试和调试
- **跨平台测试**: 新功能必须在所有支持平台测试兼容性
- **功能交互测试**: 重点测试功能开关之间的交互影响
- **状态持久化测试**: 确保应用重启后状态正确恢复
- **内容更新测试**: 验证编辑内容时功能状态保持稳定
- **重复操作测试**: 确保多次点击不会导致功能异常
- **边界情况处理**: 测试空内容、特殊字符等边界情况