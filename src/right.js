/*
 * Copyright 2024 Lei Cao
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const {markedHighlight} = globalThis.markedHighlight;
let postprocessMarkdown = "";
let isScrollingFromScript = false;
let customCss = "";
let highlightCss = "";
let isCaptionEnabled = false;
// ------- marked.js默认配置开始 -------
// 处理frontMatter的函数
function preprocess(markdown) {
    const { attributes, body } = window.frontMatter(markdown);
    let head = "";
    if (attributes['title']) {
        head = "# " + attributes['title'] + "\n\n";
    }
    if (attributes['description']) {
        head += "> " + attributes['description'] + "\n\n";
    }
    postprocessMarkdown = head + body;
    return postprocessMarkdown;
}
marked.use({ hooks: { preprocess } }); // marked加载frontMatter函数
marked.use(markedHighlight({ // marked加载highlight函数
    langPrefix: "hljs language-",
    highlight: function(code, language) {
        language = hljs.getLanguage(language) ? language : "plaintext";
        return hljs.highlight(code, { language: language }).value;
    }
}));
// 自定义渲染器
const renderer = marked.Renderer;
const parser = marked.Parser;

// 重写渲染标题的方法（h1 ~ h6）
renderer.heading = function(heading) {
    const text = parser.parseInline(heading.tokens);
    const level = heading.depth;
    // 返回带有 span 包裹的自定义标题
    return `<h${level}><span>${text}</span></h${level}>\n`;
};
// 重写渲染paragraph的方法以更好的显示行间公式
renderer.paragraph = function(paragraph) {
    const text = paragraph.text;
    if (text.length > 4 && (/\$\$[\s\S]*?\$\$/g.test(text) || /\\\[[\s\S]*?\\\]/g.test(text))) {
        return `${text}\n`;
    } else {
        return `<p>${parser.parseInline(paragraph.tokens)}</p>\n`;
    }
};

// 重写渲染image的方法以支持图例功能
renderer.image = function(image) {
    const href = image.href;
    const title = image.title ? ` title="${image.title}"` : '';
    const alt = image.text || '';
    let result = `<img src="${href}" alt="${alt}"${title}>`;

    // 如果图例功能开启且alt文本不为空
    if (isCaptionEnabled && alt && alt.trim()) {
        result += `<span style="display: block; text-align: center; font-size: 14px; color: #666666; margin: 2px 0 8px 0; line-height: 1.5; font-style: normal; font-weight: normal;">${alt}</span>`;
    }

    return result;
};

// 配置 marked.js 使用自定义的 Renderer
marked.use({
    renderer: renderer
});
// ------- marked.js默认配置完毕 -------
function getScrollFrame() {
    const height = document.body.scrollHeight;
    const width = document.getElementById("wenyan").offsetWidth;
    const fullWidth = document.body.scrollWidth;
    return { width, height, fullWidth }
}
function setStylesheet(id, href) {
    const style = document.createElement("link");
    style.setAttribute("id", id);
    style.setAttribute("rel", "stylesheet");
    style.setAttribute("href", href);
    document.head.appendChild(style);
}
// 错误处理包装器
const ErrorHandler = {
    // 安全执行函数
    safeExecute(fn, errorMessage = "操作失败", defaultValue = null) {
        try {
            return fn();
        } catch (error) {
            console.error(`${errorMessage}:`, error);
            return defaultValue;
        }
    },

    // 安全的DOM操作
    safeDOMOperation(selector, operation, errorMessage = "DOM操作失败") {
        return this.safeExecute(() => {
            const element = typeof selector === 'string' ? document.querySelector(selector) : selector;
            if (!element) {
                throw new Error(`元素未找到: ${selector}`);
            }
            return operation(element);
        }, errorMessage);
    }
};

function setContent(content) {
    ErrorHandler.safeExecute(() => {
        document.getElementById("wenyan")?.remove();

        const container = document.createElement("section");
        const parsedContent = ErrorHandler.safeExecute(
            () => marked.parse(content),
            "Markdown解析失败",
            "<p>内容解析失败</p>"
        );

        container.innerHTML = parsedContent;
        container.setAttribute("id", "wenyan");
        container.setAttribute("class", "preview");
        document.body.appendChild(container);

        // 安全执行MathJax渲染
        ErrorHandler.safeExecute(
            () => MathJax.typeset(),
            "MathJax渲染失败"
        );
    }, "设置内容失败");
}

/**
 * 重新渲染内容并保持字体设置
 * 专门用于图例开关等需要重新渲染但不影响字体的场景
 */
function refreshContentWithFont(content) {
    // 保存当前字体设置
    const currentFont = FontManager.getCurrentFont();
    const fontFamily = FontManager.getFontFamily(currentFont);

    // 保存当前脚注状态
    const wasFootnotesEnabled = document.querySelectorAll('#footnotes').length > 0;
    const footnoteLinks = document.querySelectorAll('a.footnote-link').length;

    // 重新渲染内容
    setContent(content);

    // 恢复脚注状态（如果之前启用了脚注）
    if (wasFootnotesEnabled || footnoteLinks > 0) {
        setTimeout(() => {
            addFootnotes();
        }, 50); // 延迟确保DOM完全更新
    }

    // 重新应用字体设置
    if (fontFamily) {
        setTimeout(() => {
            FontManager.applyToPreview(fontFamily);
        }, 10); // 短暂延迟确保DOM已更新
    }
}
function setPreviewMode(mode) {
    document.getElementById("style")?.remove();
    setStylesheet("style", mode);
}
function setCustomTheme(css) {
    document.getElementById("theme")?.remove();
    const style = document.createElement("style");
    style.setAttribute("id", "theme");
    customCss = replaceCSSVariables(css);
    style.textContent = customCss;
    document.head.appendChild(style);

    // 重置脚注样式以适应新主题
    resetFootnoteStylesForNewTheme();
}
function setHighlight(css) {
    document.getElementById("hljs")?.remove();
    if (css) {
        const style = document.createElement("style");
        style.setAttribute("id", "hljs");
        highlightCss = css;
        style.textContent = css;
        document.head.appendChild(style);
    } else {
        css = "";
    }
}
function getContent() {
    const wenyan = document.getElementById("wenyan");
    const clonedWenyan = wenyan.cloneNode(true);
    const elements = clonedWenyan.querySelectorAll("mjx-container");
    elements.forEach(element => {
        const svg = element.firstChild;
        const parent = element.parentElement;
        element.remove();
        let img = document.createElement("img");
        const encodedSVG = encodeURIComponent(svg.outerHTML);
        const dataURL = `data:image/svg+xml,${encodedSVG}`;
        img.setAttribute("src", dataURL);
        parent.appendChild(img);
    });
    return clonedWenyan.outerHTML;
}
function getContentWithMathImg() {
    const wenyan = document.getElementById("wenyan");
    const clonedWenyan = wenyan.cloneNode(true);
    const elements = clonedWenyan.querySelectorAll("mjx-container");
    elements.forEach(element => {
        const math = element.getAttribute("math");
        const parent = element.parentElement;
        element.remove();
        let img = document.createElement("img");
        img.setAttribute("alt", math);
        img.setAttribute("data-eeimg", "true");
        img.setAttribute("style", "margin: 0 auto; width: auto; max-width: 100%;");
        parent.appendChild(img);
    });
    return clonedWenyan.outerHTML;
}
// 辅助函数：解析和合并CSS样式
function parseAndMergeStyles(customCss, highlightCss) {
    const ast = csstree.parse(customCss, {
        context: 'stylesheet',
        positions: false,
        parseAtrulePrelude: false,
        parseCustomProperty: false,
        parseValue: false
    });

    const ast1 = csstree.parse(highlightCss, {
        context: 'stylesheet',
        positions: false,
        parseAtrulePrelude: false,
        parseCustomProperty: false,
        parseValue: false
    });

    ast.children.appendList(ast1.children);
    return ast;
}

// 辅助函数：应用CSS样式到DOM元素
function applyCssStyles(ast, clonedWenyan) {
    csstree.walk(ast, {
        visit: 'Rule',
        enter(node, item, list) {
            const selectorList = node.prelude.children;
            selectorList.forEach((selectorNode) => {
                const selector = csstree.generate(selectorNode);
                const declarations = node.block.children.toArray();

                if (selector === "#wenyan") {
                    declarations.forEach((decl) => {
                        const value = csstree.generate(decl.value);
                        clonedWenyan.style[decl.property] = value;
                    });
                } else {
                    const elements = clonedWenyan.querySelectorAll(selector);
                    elements.forEach((element) => {
                        declarations.forEach((decl) => {
                            const value = csstree.generate(decl.value);
                            element.style[decl.property] = value;
                        });
                    });
                }
            });
        }
    });
}

// 辅助函数：处理数学公式
function processMathEquations(clonedWenyan) {
    const elements = clonedWenyan.querySelectorAll("mjx-container");
    elements.forEach(element => {
        const svg = element.querySelector('svg');
        svg.style.width = svg.getAttribute("width");
        svg.style.height = svg.getAttribute("height");
        svg.removeAttribute("width");
        svg.removeAttribute("height");
        const parent = element.parentElement;
        element.remove();
        parent.appendChild(svg);
        if (parent.classList.contains('block-equation')) {
            parent.setAttribute("style", "text-align: center; margin-bottom: 1rem;");
        }
    });
}

// 辅助函数：处理行内代码
function processInlineCode(clonedWenyan) {
    const elements = clonedWenyan.querySelectorAll("code:not(pre code)");
    elements.forEach(code => {
        code.style.fontFamily = FontManager.getCodeFont();
        code.style.fontSize = '14px';
        code.style.lineHeight = '1.5';

        // 处理行内空格
        code.innerHTML = code.innerHTML.replace(/ {2,}/g, (match) => {
            return '\u2003'.repeat(match.length);
        });

        // 如果是列表项中的行内代码，特殊处理
        if (code.parentElement.tagName === 'LI') {
            const wrapper = document.createElement('span');
            wrapper.style.display = 'inline';
            let node = code.nextSibling;
            while (node) {
                const next = node.nextSibling;
                wrapper.appendChild(node);
                node = next;
            }
            code.insertAdjacentElement('afterend', wrapper);
        }
    });
}

// 辅助函数：处理加粗文本
function processStrongText(clonedWenyan) {
    const elements = clonedWenyan.querySelectorAll("strong");
    elements.forEach(strong => {
        if (strong.parentElement.tagName === 'LI') {
            const wrapper = document.createElement('span');
            wrapper.style.display = 'inline';
            let node = strong.nextSibling;
            while (node) {
                const next = node.nextSibling;
                wrapper.appendChild(node);
                node = next;
            }
            strong.insertAdjacentElement('afterend', wrapper);
        }
    });
}

// 辅助函数：处理代码块
function processCodeBlocks(clonedWenyan, highlightCss) {
    const elements = clonedWenyan.querySelectorAll("pre");
    elements.forEach(pre => {
        // 设置 pre 元素的样式
        pre.style.fontFamily = FontManager.getCodeFont();
        pre.style.fontSize = '14px';
        pre.style.lineHeight = '1.5';
        pre.style.padding = '16px 20px';
        pre.style.margin = '16px 0';
        pre.style.borderRadius = '4px';
        pre.style.border = 'none';
        pre.style.boxShadow = 'none';

        // 根据主题设置背景色
        const isDarkTheme = highlightCss.includes('background:#1e1e1e') ||
                           highlightCss.includes('background:#282c34') ||
                           highlightCss.includes('background:#272822');

        if (isDarkTheme) {
            const bgColor = highlightCss.match(/\.hljs\{[^}]*background:(#[a-f0-9]+)[^}]*\}/i);
            pre.style.backgroundColor = bgColor ? bgColor[1] : '#1e1e1e';
        } else {
            pre.style.backgroundColor = '#f8f9fa';
        }

        // 设置 code 元素的样式
        const code = pre.querySelector('code');
        if (code) {
            code.style.fontFamily = FontManager.getCodeFont();
            code.style.fontSize = '14px';
            code.style.lineHeight = '1.5';
            code.style.display = 'block';
            code.style.backgroundColor = 'transparent';
            code.style.border = 'none';
            code.style.padding = '0';

            // 处理换行和缩进
            const lines = code.innerHTML.split('\n');
            const processedLines = lines.map(line => {
                return line.replace(/^( +)/g, (match) => {
                    return '\u2003'.repeat(match.length);
                }).replace(/ {2,}/g, (match) => {
                    return '\u2003'.repeat(match.length);
                });
            });

            code.innerHTML = processedLines.join('<br>');
        }
    });
}

// 辅助函数：处理图片说明
function processImageCaptions(clonedWenyan) {
    const images = clonedWenyan.querySelectorAll('img');
    images.forEach(img => {
        const nextSpan = img.nextElementSibling;
        if (nextSpan && nextSpan.tagName === 'SPAN' && nextSpan.textContent === img.alt) {
            nextSpan.style.setProperty('display', 'block', 'important');
            nextSpan.style.setProperty('text-align', 'center', 'important');
            nextSpan.style.setProperty('font-size', '14px', 'important');
            nextSpan.style.setProperty('color', '#666666', 'important');
            nextSpan.style.setProperty('margin', '2px 0 8px 0', 'important');
            nextSpan.style.setProperty('line-height', '1.5', 'important');
            nextSpan.style.setProperty('font-style', 'normal', 'important');
            nextSpan.style.setProperty('font-weight', 'normal', 'important');
        }
    });
}

// 辅助函数：处理CSS伪元素
function processPseudoElements(clonedWenyan, ast) {
    const elements = clonedWenyan.querySelectorAll('h1, h2, h3, h4, h5, h6, blockquote');
    elements.forEach(element => {
        const afterResults = new Map();
        const beforeResults = new Map();
        csstree.walk(ast, {
            visit: 'Rule',
            enter(node) {
                const selector = csstree.generate(node.prelude);
                const tagName = element.tagName.toLowerCase();

                if (selector.includes(`${tagName}::after`)) {
                    extractDeclarations(node, afterResults);
                } else if (selector.includes(`${tagName}::before`)) {
                    extractDeclarations(node, beforeResults);
                }
            }
        });
        if (afterResults.size > 0) {
            element.appendChild(buildPseudoSpan(afterResults));
        }
        if (beforeResults.size > 0) {
            element.insertBefore(buildPseudoSpan(beforeResults), element.firstChild);
        }
    });
}

// 辅助函数：处理任务列表
function processTaskLists(clonedWenyan) {
    const elements = clonedWenyan.querySelectorAll('li input[type="checkbox"]');
    elements.forEach(checkbox => {
        const checkboxSpan = document.createElement('span');
        checkboxSpan.innerHTML = checkbox.checked ? '☑' : '☐';
        checkboxSpan.style.marginRight = '0.5em';
        checkboxSpan.style.verticalAlign = 'middle';
        checkboxSpan.style.fontSize = '16px';

        checkbox.parentNode.replaceChild(checkboxSpan, checkbox);

        const wrapper = document.createElement('section');
        wrapper.style.display = 'inline';
        wrapper.style.verticalAlign = 'middle';

        let node = checkboxSpan.nextSibling;
        while (node) {
            const next = node.nextSibling;
            wrapper.appendChild(node);
            node = next;
        }
        checkboxSpan.insertAdjacentElement('afterend', wrapper);
    });
}

// 统一的字体处理系统
const FontManager = {
    // 字体配置
    FONTS: {
        serif: '"Noto Serif CJK SC", "Noto Serif SC", "Source Han Serif SC", "Source Han Serif", serif',
        sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        code: "'JetBrains Mono', Menlo, Consolas, Monaco, monospace"
    },

    // 获取当前字体设置
    getCurrentFont() {
        return localStorage.getItem('preferred-font') || 'theme';
    },

    // 解析字体族名称
    getFontFamily(fontType = 'theme') {
        switch (fontType) {
            case 'serif':
                return this.FONTS.serif;
            case 'sans':
                return this.FONTS.sans;
            case 'theme':
            default:
                return null; // 使用主题默认字体
        }
    },

    // 应用字体到DOM元素
    applyFontToElement(element, fontFamily) {
        if (fontFamily) {
            element.style.setProperty('font-family', fontFamily, 'important');
        } else {
            element.style.removeProperty('font-family');
        }
    },

    // 应用字体到克隆的内容（用于内容生成）
    applyToContent(clonedWenyan) {
        const preferredFont = this.getCurrentFont();
        const fontFamily = this.getFontFamily(preferredFont);

        if (fontFamily) {
            // 应用到所有文本元素，但排除代码块
            const textElements = clonedWenyan.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th, span:not(pre *)');
            textElements.forEach(element => {
                this.applyFontToElement(element, fontFamily);
            });
            // 设置根元素的字体
            this.applyFontToElement(clonedWenyan, fontFamily);
        }
    },

    // 应用字体到预览（用于实时预览）
    applyToPreview() {
        const preferredFont = this.getCurrentFont();
        const fontFamily = this.getFontFamily(preferredFont);
        const wenyan = document.getElementById('wenyan');

        if (wenyan) {
            this.applyFontToElement(wenyan, fontFamily);
        }
    },

    // 获取代码字体
    getCodeFont() {
        return this.FONTS.code;
    }
};

// 辅助函数：应用字体设置（重构后使用FontManager）
function applyFontSettings(clonedWenyan) {
    FontManager.applyToContent(clonedWenyan);
}

function getContentForGzh() {
    const ast = parseAndMergeStyles(customCss, highlightCss);
    const wenyan = document.getElementById("wenyan");
    const clonedWenyan = wenyan.cloneNode(true);

    applyCssStyles(ast, clonedWenyan);
    processMathEquations(clonedWenyan);
    processInlineCode(clonedWenyan);
    processStrongText(clonedWenyan);
    processCodeBlocks(clonedWenyan, highlightCss);
    processImageCaptions(clonedWenyan);
    processPseudoElements(clonedWenyan, ast);
    processTaskLists(clonedWenyan);
    applyFontSettings(clonedWenyan);

    // 处理脚注链接的特殊样式，确保微信公众号兼容性
    // 首先从原始预览DOM获取脚注链接的实际颜色
    const originalFootnoteLinks = wenyan.querySelectorAll('a.footnote-link');
    let linkColor = '#0069c2'; // 默认颜色

    if (originalFootnoteLinks.length > 0) {
        linkColor = window.getComputedStyle(originalFootnoteLinks[0]).color;
    }

    const footnoteLinks = clonedWenyan.querySelectorAll('a.footnote-link');
    footnoteLinks.forEach(link => {
        // 移除CSS类，改为内联样式
        link.classList.remove('footnote-link');

        // 创建包装span确保下划线在微信公众号中正常显示
        // 使用从原始预览DOM获取的颜色，确保与预览区完全一致
        const wrapper = document.createElement('span');
        wrapper.style.textDecoration = 'underline';
        wrapper.style.textDecorationColor = 'inherit';
        wrapper.style.fontWeight = 'bold';
        wrapper.style.color = linkColor;

        // 替换链接为包装后的结构
        link.parentNode.replaceChild(wrapper, link);
        wrapper.appendChild(link);

        // 移除链接自身的下划线避免冲突
        link.style.textDecoration = 'none';
        link.style.color = linkColor;
    });

    clonedWenyan.setAttribute("data-provider", "WenYan");
    return `${clonedWenyan.outerHTML.replace(/class="mjx-solid"/g, 'fill="none" stroke-width="70"')}`;
}
  function extractDeclarations(ruleNode, resultMap) {
    csstree.walk(ruleNode.block, {
        visit: 'Declaration',
        enter(declNode) {
            const property = declNode.property;
            const value = csstree.generate(declNode.value);
            resultMap.set(property, value);
        }
    });
}
function getContentForMedium() {
    const wenyan = document.getElementById("wenyan");
    const clonedWenyan = wenyan.cloneNode(true);
    // 处理blockquote，移除<p>标签
    clonedWenyan.querySelectorAll('blockquote p').forEach(p => {
        const span = document.createElement('span');
        span.innerText = p.innerText + "\n\n";
        p.replaceWith(span);
    });
    // 处理代码块
    clonedWenyan.querySelectorAll('pre').forEach(p => {
        const code = p.querySelector('code');
        p.setAttribute("data-code-block-lang", "none");
        if (code) {
            // 获取 class 属性
            const classAttribute = code.getAttribute('class');
            // 提取语言
            if (classAttribute) {
                const language = classAttribute.split(' ').find(cls => cls.startsWith('language-')).replace('language-', '');
                if (language) {
                    p.setAttribute("data-code-block-lang", language);
                }
            }
            // 获取所有子 span 元素
            const spans = code.querySelectorAll('span');

            // 遍历每个 span 元素，将它们替换为它们的文本内容
            spans.forEach(span => {
                span.replaceWith(...span.childNodes); // 只替换标签，保留内容
            });
            // 如果不删除多余的换行符，编辑器会把代码块分割，暂时未找到好的解决方法
            code.innerHTML = code.innerHTML.replace(/\n+/g, '\n');
        }
        p.setAttribute("data-code-block-mode", "2");
    });
    // 处理table，转成ascii格式
    clonedWenyan.querySelectorAll('table').forEach(t => {
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.innerText = tableToAsciiArt(t);
        pre.appendChild(code);
        pre.setAttribute("data-code-block-lang", "none");
        pre.setAttribute("data-code-block-mode", "2");
        t.replaceWith(pre);
    });
    // 处理嵌套ul li
    clonedWenyan.querySelectorAll('ul ul').forEach(ul => {
        transformUl(ul);  // 处理每个 <ul>
    });
    // 原样输出公式
    clonedWenyan.querySelectorAll("mjx-container").forEach(element => {
        const math = element.getAttribute("math");
        const parent = element.parentElement;
        element.remove();
        parent.innerHTML = math;
    });
    return clonedWenyan.outerHTML;
}
function getPostprocessMarkdown() {
    return postprocessMarkdown;
}
function scroll(scrollFactor) {
    isScrollingFromScript = true;
    window.scrollTo(0, document.body.scrollHeight * scrollFactor);
    requestAnimationFrame(() => isScrollingFromScript = false);
}
function addFootnotes(listStyle) {
    let footnotes = [];
    let footnoteIndex = 0;
    const links = document.querySelectorAll('a[href]');
    links.forEach((linkElement) => {
        const title = linkElement.textContent || linkElement.innerText;
        const href = linkElement.getAttribute("href");

        footnotes.push([++footnoteIndex, title, href]);

        // 添加脚注链接样式类，让CSS控制样式
        linkElement.classList.add('footnote-link');

        // 添加脚注标记
        const footnoteMarker = document.createElement('sup');
        footnoteMarker.setAttribute("class", "footnote");
        footnoteMarker.innerHTML = `[${footnoteIndex}]`;
        linkElement.after(footnoteMarker);
    });
    if (footnoteIndex > 0) {
        if (!listStyle) {
            let footnoteArray = footnotes.map((x) => {
                if (x[1] === x[2]) {
                    return `<p><span class="footnote-num">[${x[0]}]</span><span class="footnote-txt"><i>${x[1]}</i></span></p>`;
                }
                return `<p><span class="footnote-num">[${x[0]}]</span><span class="footnote-txt">${x[1]}: <i>${x[2]}</i></span></p>`;
            });
            const footnotesHtml = `<h3>引用链接</h3><section id="footnotes">${footnoteArray.join("")}</section>`;
            document.getElementById("wenyan").innerHTML += footnotesHtml;
        } else {
            let footnoteArray = footnotes.map((x) => {
                if (x[1] === x[2]) {
                    return `<li id="#footnote-${x[0]}">[${x[0]}]: <i>${x[1]}</i></li>`;
                }
                return `<li id="#footnote-${x[0]}">[${x[0]}] ${x[1]}: <i>${x[2]}</i></li>`;
            });
            const footnotesHtml = `<h3>引用链接</h3><div id="footnotes"><ul>${footnoteArray.join("")}</ul></div>`;
            document.getElementById("wenyan").innerHTML += footnotesHtml;
        }
    }
}

/**
 * 移除脚注功能
 * 移除所有脚注标记和脚注列表，恢复原始链接样式
 */
function removeFootnotes() {
    // 移除脚注列表
    const footnotesContainer = document.querySelector('#footnotes');
    if (footnotesContainer) {
        footnotesContainer.remove();
    }

    // 移除脚注相关的标题（如果有）
    const footnoteHeaders = document.querySelectorAll('h3');
    footnoteHeaders.forEach(header => {
        if (header.textContent === '引用链接') {
            header.remove();
        }
    });

    // 移除脚注链接样式类
    const footnoteLinks = document.querySelectorAll('a.footnote-link');
    footnoteLinks.forEach(link => {
        link.classList.remove('footnote-link');
    });

    // 移除脚注标记
    const footnoteMarkers = document.querySelectorAll('sup.footnote');
    footnoteMarkers.forEach(marker => {
        marker.remove();
    });
}

/**
 * 重置脚注样式以适应新主题
 * 在主题切换时调用，确保脚注样式与新主题同步
 */
function resetFootnoteStylesForNewTheme() {
    // 检查是否启用了脚注功能
    const hasFootnotesEnabled = document.querySelectorAll('sup.footnote').length > 0;

    if (hasFootnotesEnabled) {
        // 获取当前的脚注状态（通过是否有脚注标记判断）
        const listStyle = document.querySelector('#footnotes ul') ? true : false;

        // 先移除所有脚注
        removeFootnotes();

        // 延迟重新添加脚注，确保新样式已加载
        setTimeout(() => {
            addFootnotes(listStyle);
        }, 50);
    }
}

function tableToAsciiArt(table) {
    const rows = Array.from(table.querySelectorAll('tr')).map(tr =>
        Array.from(tr.querySelectorAll('th, td')).map(td => td.innerText.trim())
    );

    if (rows.length === 0) return '';

    // 获取每列的最大宽度
    const columnWidths = rows[0].map((_, i) =>
        Math.max(...rows.map(row => row[i].length))
    );

    const horizontalLine = '+' + columnWidths.map(width => '-'.repeat(width + 2)).join('+') + '+\n';

    // 格式化行数据
    const formattedRows = rows.map(row =>
        '| ' + row.map((cell, i) => cell.padEnd(columnWidths[i])).join(' | ') + ' |\n'
    );

    // 构建最终的表格
    let asciiTable = horizontalLine;
    asciiTable += formattedRows[0];  // 表头
    asciiTable += horizontalLine;
    asciiTable += formattedRows.slice(1).join('');  // 表内容
    asciiTable += horizontalLine;

    return asciiTable;
}
// 递归处理所有嵌套的 <ul>，将其转换为 Medium 风格
function transformUl(ulElement) {
    // 先递归处理子 <ul>
    ulElement.querySelectorAll('ul').forEach(nestedUl => {
        transformUl(nestedUl);  // 递归调用处理嵌套 <ul>
    });

    // 把 <li> 转换成 Medium-friendly 格式
    let replaceString = Array.from(ulElement.children).map(item => item.outerHTML).join(' ');
    
    // 将 <li> 标签替换为 Medium 风格列表
    replaceString = replaceString.replace(/<li>/g, '<br>\n- ').replace(/<\/li>/g, '');

    // 将原来的 <ul> 替换为转换后的字符串
    ulElement.outerHTML = replaceString;
}

// 优化的CSS变量解析器
const CSSVariableProcessor = {
    // 优化的正则表达式
    PATTERNS: {
        // 匹配CSS变量定义：--variable-name: value;
        VARIABLE_DEF: /--([a-zA-Z0-9\-]+)\s*:\s*([^;]+);/g,
        // 匹配var()引用：var(--variable-name)
        VARIABLE_USAGE: /var\(--([a-zA-Z0-9\-]+)\)/g,
        // 匹配:root规则
        ROOT_RULE: /:root\s*\{[^}]*\}/g
    },

    // 解析CSS变量
    parse(css) {
        try {
            const variables = this.extractVariables(css);
            const resolvedVariables = this.resolveVariables(variables);
            return this.replaceInCSS(css, resolvedVariables);
        } catch (error) {
            console.error('CSS变量解析错误:', error);
            return css; // 出错时返回原始CSS
        }
    },

    // 提取变量定义
    extractVariables(css) {
        const variables = {};
        let match;

        while ((match = this.PATTERNS.VARIABLE_DEF.exec(css)) !== null) {
            const varName = match[1];
            let varValue = match[2].trim();

            // 清理值：移除多余空白和换行
            varValue = varValue.replace(/\s+/g, ' ').trim();

            // 验证变量名
            if (this.isValidVariableName(varName)) {
                variables[varName] = varValue;
            }
        }

        return variables;
    },

    // 递归解析变量引用
    resolveVariables(variables, visited = new Set()) {
        const resolved = {};

        for (const [varName, varValue] of Object.entries(variables)) {
            try {
                resolved[varName] = this.resolveValue(varValue, variables, visited);
            } catch (error) {
                console.warn(`解析变量 ${varName} 时出错:`, error);
                resolved[varName] = varValue; // 出错时使用原始值
            }
        }

        return resolved;
    },

    // 解析单个值
    resolveValue(value, variables, visited, path = new Set()) {
        // 检查循环引用
        if (path.has(value)) {
            throw new Error('检测到循环引用');
        }
        path.add(value);

        let resolvedValue = value;
        let match;

        // 使用replace的回调函数来避免正则表达式状态问题
        resolvedValue = resolvedValue.replace(this.PATTERNS.VARIABLE_USAGE, (match, varName) => {
            if (variables.hasOwnProperty(varName)) {
                // 递归解析引用的变量
                return this.resolveValue(variables[varName], variables, visited, new Set(path));
            }
            // 如果变量不存在，保持原样
            return match;
        });

        return resolvedValue;
    },

    // 在CSS中替换变量引用
    replaceInCSS(css, resolvedVariables) {
        let result = css;

        // 首先替换所有var()引用
        result = result.replace(this.PATTERNS.VARIABLE_USAGE, (match, varName) => {
            return resolvedVariables[varName] || match; // 如果变量不存在，保持原样
        });

        // 移除:root规则
        result = result.replace(this.PATTERNS.ROOT_RULE, '');

        return result;
    },

    // 验证变量名
    isValidVariableName(name) {
        return /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name);
    },

    // 清理函数：移除已解析的变量缓存
    clear() {
        // 如果有缓存，在这里清理
    }
};

// 兼容性别名（保持向后兼容）
function replaceCSSVariables(css) {
    return CSSVariableProcessor.parse(css);
}

function buildPseudoSpan(beforeRresults) {
    // 创建一个新的 <span> 元素
    const span = document.createElement('span');
    // 将伪类的内容和样式应用到 <span> 标签
    if (beforeRresults.get("content")) {
        span.textContent = beforeRresults.get("content").replace(/['"]/g, '');
        beforeRresults.delete("content");
    }
    for (const [k, v] of beforeRresults) {
        if (v.includes("url(")) {
            const svgMatch = v.match(/data:image\/svg\+xml;utf8,(.*<\/svg>)/);
            const base64SvgMatch = v.match(/data:image\/svg\+xml;base64,([^"'\)]*)["']?\)/);
            const httpMatch = v.match(/(?:"|')?(https?[^"'\)]*)(?:"|')?\)/);
            if (svgMatch) {
                const svgCode = decodeURIComponent(svgMatch[1]);
                span.innerHTML = svgCode;
            } else if (base64SvgMatch) {
                const decodedString = atob(base64SvgMatch[1]);
                span.innerHTML = decodedString;
            } else if (httpMatch) {
                const img = document.createElement('img');
                img.src = httpMatch[1];
                img.setAttribute("style", "vertical-align: top;");
                span.appendChild(img);
            }
            beforeRresults.delete(k);
        }
    }
    const entries = Array.from(beforeRresults.entries());
    let cssString = entries.map(([key, value]) => `${key}: ${value}`).join('; ');

    // 特殊处理：确保伪元素保持原有的布局特性
    const display = beforeRresults.get("display");
    const verticalAlign = beforeRresults.get("vertical-align");

    // 如果原始样式没有明确设置display，默认使用inline-block以避免换行
    if (!display && (!cssString.includes('display:') || !cssString.includes('display :'))) {
        span.style.display = 'inline-block';
    }

    // 保持垂直对齐，特别是对于三角形装饰
    if (verticalAlign) {
        span.style.verticalAlign = verticalAlign;
    } else if (cssString.includes('border-bottom') && !cssString.includes('vertical-align')) {
        // 对于border技巧创建的三角形，默认使用bottom对齐
        span.style.verticalAlign = 'bottom';
    }

    // 应用其他样式
    span.style.cssText = cssString;
    return span;
}
function removeComments(input) {
    // 正则表达式：匹配单行和多行注释
    const pattern = /\/\*[\s\S]*?\*\//gm;

    // 使用正则表达式替换匹配的注释部分为空字符串
    const output = input.replace(pattern, '');

    // 返回去除了注释的字符串
    return output;
}

//// 非通用方法
// 事件处理系统
const EventHandler = {
    // 事件处理器映射
    handlers: {
        'onUpdate': function(data) {
            if (data.content) setContent(data.content);
            if (data.highlightCss) setHighlight(data.highlightCss);
            if (data.previewMode) setPreviewMode(data.previewMode);
            if (data.themeValue) setCustomTheme(`${data.themeValue}`);
            if (data.hasOwnProperty('isCaptionEnabled')) {
                isCaptionEnabled = data.isCaptionEnabled;
            }
            if (data.hasOwnProperty('isFootnotesEnabled')) {
                if (data.isFootnotesEnabled) {
                    addFootnotes();
                } else {
                    removeFootnotes();
                }
            }

            // 内容加载完成后，重新应用已保存的字体设置
            setTimeout(() => {
                const savedFont = localStorage.getItem('preferred-font');
                if (savedFont && savedFont !== 'theme') {
                    const fontFamily = FontManager.getFontFamily(savedFont);
                    if (fontFamily) {
                        FontManager.applyToPreview(fontFamily);
                    }
                }
            }, 50); // 短暂延迟确保DOM更新完成
        },
        'onContentChange': function(data) {
            setContent(data.content);
            if (data.hasOwnProperty('isCaptionEnabled')) {
                isCaptionEnabled = data.isCaptionEnabled;
            }

            // 内容重新渲染完成后，重新应用已保存的字体设置
            setTimeout(() => {
                const savedFont = localStorage.getItem('preferred-font');
                if (savedFont && savedFont !== 'theme') {
                    const fontFamily = FontManager.getFontFamily(savedFont);
                    if (fontFamily) {
                        FontManager.applyToPreview(fontFamily);
                    }
                }
            }, 50); // 短暂延迟确保DOM更新完成
        },
        'onPeviewModeChange': function(data) {
            setPreviewMode(data.previewMode);
        },
        'onFootnoteChange': function(data) {
            if (data.isFootnotesEnabled) {
                addFootnotes();
            } else {
                removeFootnotes();
            }
        },
        'onCaptionChange': function(data) {
            isCaptionEnabled = data.isCaptionEnabled;
            // 重新渲染内容以应用图例状态变化，同时保持字体设置
            if (data.content) {
                refreshContentWithFont(data.content);
            }
        },
        'updateFont': function(data) {
            FontManager.applyToPreview();
        }
    },

    // 初始化事件监听
    init() {
        this.messageHandler = this.handleMessage.bind(this);
        window.addEventListener('message', this.messageHandler);
    },

    // 清理事件监听
    destroy() {
        if (this.messageHandler) {
            window.removeEventListener('message', this.messageHandler);
            this.messageHandler = null;
        }
    },

    // 统一的消息处理入口
    handleMessage(event) {
        if (!event.data || !event.data.type) return;

        const handler = this.handlers[event.data.type];
        if (handler) {
            try {
                handler(event.data);
            } catch (error) {
                console.error(`Error handling event ${event.data.type}:`, error);
            }
        }
    },

    // 注册新的事件处理器
    register(eventType, handler) {
        this.handlers[eventType] = handler;
    },

    // 移除事件处理器
    unregister(eventType) {
        delete this.handlers[eventType];
    }
};

// 初始化事件处理器
EventHandler.init();
// 性能优化工具
const PerformanceUtils = {
    // 防抖函数
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // 节流函数
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // 批量DOM操作
    batchDOMUpdate(callback) {
        const fragment = document.createDocumentFragment();
        const result = callback(fragment);
        if (result && result !== fragment) {
            return result;
        }
        return fragment;
    }
};

// 滚动事件处理（优化性能）
const ScrollHandler = {
    init() {
        this.handleScroll = PerformanceUtils.throttle(this.handleScroll.bind(this), 16); // ~60fps
        window.addEventListener('scroll', this.handleScroll, { passive: true });
    },

    destroy() {
        if (this.handleScroll) {
            window.removeEventListener('scroll', this.handleScroll);
            this.handleScroll = null;
        }
    },

    handleScroll() {
        if (!isScrollingFromScript) {
            const scrollRatio = window.scrollY / document.body.scrollHeight;
            const message = {
                type: 'rightScroll',
                value: { y0: scrollRatio }
            };
            window.parent.postMessage(message, '*');
        }
    }
};

// 点击事件处理
const ClickHandler = {
    init() {
        this.handleClick = this.handleClick.bind(this);
        window.addEventListener('click', this.handleClick);
    },

    destroy() {
        if (this.handleClick) {
            window.removeEventListener('click', this.handleClick);
            this.handleClick = null;
        }
    },

    handleClick(event) {
        window.parent.postMessage({ clicked: true }, '*');
    }
};

// 初始化所有事件处理器
ScrollHandler.init();
ClickHandler.init();

// 应用清理函数
function cleanupEventHandlers() {
    EventHandler.destroy();
    ScrollHandler.destroy();
    ClickHandler.destroy();
    CSSVariableProcessor.clear();
}

// 性能监控：可选的性能度量
const PerformanceMonitor = {
    marks: new Map(),

    start(label) {
        if (window.performance && performance.mark) {
            performance.mark(`${label}_start`);
        }
    },

    end(label) {
        if (window.performance && performance.mark && performance.measure) {
            performance.mark(`${label}_end`);
            performance.measure(label, `${label}_start`, `${label}_end`);
        }
    },

    getMeasures() {
        if (window.performance && performance.getEntriesByType) {
            return performance.getEntriesByType('measure');
        }
        return [];
    }
};

// 初始化完成消息
const message = {
    type: 'onRightReady'
};

ErrorHandler.safeExecute(() => {
    window.parent.postMessage(message, '*');
}, "发送就绪消息失败");

// 如果页面卸载，清理事件处理器
window.addEventListener('beforeunload', cleanupEventHandlers);

// 导出调试工具（仅在开发环境）
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.WenYanDebug = {
        ErrorHandler,
        PerformanceUtils,
        PerformanceMonitor,
        CSSVariableProcessor,
        FontManager,
        EventHandler,
        cleanupEventHandlers
    };
}