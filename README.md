<div align="center">
    <img alt="logo" src="data/256-mac.png" />
</div>

# 文颜-rev (WenYan-rev) - 增强版

> 基于 [caol64/wenyan-pc](https://github.com/caol64/wenyan-pc) 增强版本
>
> **原作者**: Lei Cao © 2024
> **增强版**: volcanolin © 2025

## 🌟 版本特色

**当前版本：2.4.11**

本版本在原项目基础上进行了大量功能增强和用户体验优化，让 Markdown 写作和发布更加高效便捷。

## 🆕 新增功能 (相比原版)

### 1. 📸 图例功能 - v2.4.5
- **智能图片说明**：自动将图片 alt 文本转换为图例，显示在图片下方
- **一键切换**：支持开启/关闭图例显示，适应不同发布需求
- **样式统一**：图例居中对齐，灰色文字，与整体风格协调
- **状态同步**：按钮颜色实时反映功能开启状态

### 2. 🔤 字体选择系统 - v2.4.2
- **三种字体模式**：
  - 🎨 跟随主题：使用主题默认字体
  - 📰 衬线字体：Optima / 微软雅黑组合，适合正式文档
  - 💻 无衬线字体：现代系统字体，清晰易读
- **持久化存储**：字体设置自动保存，重启后保持生效
- **智能应用**：字体设置不影响代码块和其他特殊元素

### 3. 🎨 主题系统增强
- **自定义主题扩展**：从最多3个增加到**10个**自定义主题
- **主题重命名**：双击主题名称即可重命名，管理更便捷
- **代码高亮主题**：支持6种高亮主题
  - GitHub (默认)
  - Visual Studio / Visual Studio 2015
  - Atom Dark / Atom Light
  - Monokai
- **专业代码字体**：使用 JetBrains Mono 字体，代码显示更专业

### 4. 📝 内容处理优化
- **任务列表改进**：修复复选框文本换行问题，微信公众号兼容性更好
- **脚注功能重大增强**：修复双重下划线问题，改进微信公众号兼容性
- **脚注样式优化**：统一所有主题的脚注样式，确保视觉一致性
- **脚注与图例功能交互修复**：解决切换图例时脚注功能失效的问题 (v2.4.9)
- **伪元素支持增强**：改进CSS伪元素处理，修复复制到微信公众号的格式问题 (v2.4.9)
- **脚注状态持久化**：修复内容更新时脚注功能失效问题，确保编辑时脚注始终保持显示 (v2.4.10)
- **脚注重复显示修复**：解决脚注序号重复叠加显示的问题，提升用户体验 (v2.4.10)
- **跨平台字体适配**：不同操作系统下字体显示效果一致

### 5. ⚡ 性能与架构优化
- **模块化设计**：事件处理、错误处理、性能优化分离
- **状态管理**：完善的状态同步机制，UI状态与功能状态一致
- **内存优化**：防抖节流、批量DOM操作，提升响应速度
- **错误处理**：安全的DOM操作，优雅降级确保稳定性

## 📋 原版核心功能

### 多平台发布支持
- 📱 **微信公众号**：完美适配，支持自定义主题
- 🤔 **知乎**：数学公式支持，专业的技术写作
- ⛏️ **掘金**：专门的 Markdown 处理
- 🌐 **Medium**：ASCII 表格转换
- 📰 **今日头条**：基础格式化支持

### 基础功能
- ✅ **代码高亮**：多种语法高亮主题
- 📐 **数学公式**：MathJax 支持，LaTeX 渲染
- 🔗 **链接转脚注**：学术写作友好
- 📄 **front matter 支持**：标准 Markdown 元数据
- 🖼️ **图片导出**：支持生成长图片

### 内置主题模板
- [Orange Heart](https://github.com/evgo2017/typora-theme-orange-heart)
- [Rainbow](https://github.com/thezbm/typora-theme-rainbow)
- [Lapis](https://github.com/YiNNx/typora-theme-lapis)
- [Pie](https://github.com/kevinzhao2233/typora-theme-pie)
- [Maize](https://github.com/BEATREE/typora-maize-theme)
- [Purple](https://github.com/hliu202/typora-purple-theme)
- [物理猫-薄荷](https://github.com/sumruler/typora-theme-phycat)

### 自定义主题
- 支持自定义样式
- 支持导入现成的主题
- [使用教程](https://babyno.top/posts/2024/11/wenyan-supports-customized-themes/)
- [功能讨论](https://github.com/caol64/wenyan/discussions/9)
- [主题分享](https://github.com/caol64/wenyan/discussions/13)

## 🚀 快速开始

### 下载安装
- **Windows 版本**：[ Releases ](https://github.com/volcanolin/wenyan-pc/releases)
- **系统要求**：Windows 10/11

### 使用方法
1. **写作**：左侧编辑器编写 Markdown
2. **预览**：右侧实时预览效果
3. **发布**：选择目标平台，一键复制格式化内容
4. **自定义**：调整主题、字体、图例等设置

## 📷 应用截图

![](data/2.4.6.png)

## 🛠️ 技术架构

- **前端**：原生 JavaScript / HTML / CSS
- **后端**：Tauri (Rust)
- **Markdown 解析**：Marked.js
- **数学公式**：MathJax
- **代码高亮**：highlight.js
- **数据库**：SQLite (自定义主题存储)

## 📈 版本演进

- **v2.4.11** - 文颜-rev 版本：修改应用标识符，支持与原版同时安装
- **v2.4.9** - 修复脚注与图例功能交互冲突，增强CSS伪元素支持
- **v2.4.8** - 完善状态持久化，修复图例和脚注功能重启后状态恢复问题
- **v2.4.7** - 修复字体持久化，优化状态同步
- **v2.4.6** - 新增图例功能，扩展自定义主题数量
- **v2.4.5** - 脚注功能修复，主题选择器优化
- **v2.4.4** - 跨平台字体适配，UI 改进
- **v2.4.3** - 字体选择功能，任务列表优化
- **v2.4.2** - 代码高亮主题扩展，渲染优化

## 📖 更多功能

[https://yuzhi.tech/docs/wenyan](https://yuzhi.tech/docs/wenyan)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 💬 支持

如果您觉得不错，可以给原版作者家猫咪买点罐头吃。[喂猫❤️](https://yuzhi.tech/sponsor)

如果您认可本增强版的改进，也可以请我喝一杯咖啡~

![](data/wx.png) ![](data/zfb.png)

## 📄 许可证

Apache License Version 2.0

## 🙏 致谢

- [原版项目](https://github.com/caol64/wenyan-pc) - 核心功能基础
- [Tauri](https://tauri.app/) - 跨平台框架
- 各主题作者 - 美观的界面设计

---

> 💡 **提示**：文颜-rev 是基于原版文颜的增强版本，专注于 Windows 平台的用户体验优化，相比原版增加了多项实用功能，特别适合需要频繁发布到多个平台的内容创作者。