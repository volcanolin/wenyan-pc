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

const { resolveResource } = window.__TAURI__.path;
const { readTextFile, writeBinaryFile } = window.__TAURI__.fs;
const { appWindow } = window.__TAURI__.window;

const { invoke } = window.__TAURI__.tauri;
const { save, open, message } = window.__TAURI__.dialog;
const { fetch: tauriFetch, ResponseType } = window.__TAURI__.http;
const { listen } = window.__TAURI__.event;

const builtinThemes = [
    {
        id: 'gzh_default',
        name: '默认',
        author: ''
    },
    {
        id: 'orangeheart',
        name: 'Orange Heart',
        author: 'evgo2017'
    },
    {
        id: 'rainbow',
        name: 'Rainbow',
        author: 'thezbm'
    },
    {
        id: 'lapis',
        name: 'Lapis',
        author: 'YiNN'
    },
    {
        id: 'pie',
        name: 'Pie',
        author: 'kevinzhao2233'
    },
    {
        id: 'maize',
        name: 'Maize',
        author: 'BEATREE'
    },
    {
        id: 'purple',
        name: 'Purple',
        author: 'hliu202'
    },
    {
        id: 'phycat',
        name: '物理猫-薄荷',
        author: 'sumruler'
    }
];

const highlightThemes = [
    { id: 'github', name: 'GitHub' },
    { id: 'vs', name: 'Visual Studio' },
    { id: 'vs2015', name: 'Visual Studio 2015' },
    { id: 'atom-one-dark', name: 'Atom Dark' },
    { id: 'atom-one-light', name: 'Atom Light' },
    { id: 'monokai', name: 'Monokai' }
];

let selectedTheme = 'gzh_default';
let highlightStyle = 'highlight/styles/github.min.css';
let previewMode = 'style.css';
let content = '';
let isFootnotes = false;
let isCaptionEnabled = false;
let platform = 'gzh';
let leftReady = false;
let rightReady = false;
let customThemeContent = '';
let selectedCustomTheme = '';

const fontFamilies = [
    { id: 'theme', name: '跟随主题', value: null },
    { id: 'sans-serif', name: '无衬线', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
    { id: 'serif', name: '衬线', value: 'Optima, "Microsoft YaHei", PingFangSC-regular, serif' }
];

/**
 * Simple font selector setup using FontManager
 * This function initializes the font selector system
 */
function addFontSelector() {
    // Initialize FontManager if not already created
    if (typeof FontManager === 'undefined') {
        window.FontManager = {
            getCurrentFont: () => localStorage.getItem('preferred-font') || 'theme',
            getFontFamily: (fontId) => {
                const font = fontFamilies.find(f => f.id === fontId);
                return font ? font.value : null;
            },
            applyToContent: (fontFamily) => {
                // Forward to existing updatePreviewFont function
                updatePreviewFont(fontFamily);
            },
            applyToPreview: (fontFamily) => {
                // Forward to existing updatePreviewFont function
                updatePreviewFont(fontFamily);
            }
        };
    }

    // Initialize current font from localStorage
    const currentFont = FontManager.getCurrentFont();
    const fontFamily = FontManager.getFontFamily(currentFont);

    // Apply current font to preview
    if (fontFamily) {
        updatePreviewFont(fontFamily);
    }

    console.log('Font selector initialized with:', currentFont);
}

window.addEventListener('message', async (event) => {
    if (event.data) {
        if (event.data.type === 'onReady') {
            leftReady = true;
            load();
        } else if (event.data.type === 'onChange') {
            content = event.data.value;
            localStorage.setItem('lastArticle', content);
            onContentChange();
        } else if (event.data.type === 'onRightReady') {
            rightReady = true;
            load();
        } else if (event.data.type === 'leftScroll') {
            const iframe = document.getElementById('rightFrame');
            const iframeWindow = iframe.contentWindow;
            iframeWindow.scroll(event.data.value.y0);
        } else if (event.data.type === 'rightScroll') {
            const iframe = document.getElementById('leftFrame');
            const iframeWindow = iframe.contentWindow;
            iframeWindow.scroll(event.data.value.y0);
        } else if (event.data.clicked) {
            hideThemeOverlay();
            hideMenu();
            hideBubble();
        } else if (event.data.type === 'onReadyCss') {
            loadCustomTheme();
        } else if (event.data.type === 'onChangeCss') {
            customThemeContent = event.data.value;
            updateThemePreview();
        } else if (event.data.type === 'updateFont') {
            const fontFamily = event.data.fontFamily;
            document.getElementById('wenyan').style.fontFamily = fontFamily;
        }
    }
});

async function load() {
    if (leftReady && rightReady) {
        try {
            // 初始化数据库
            await invoke('plugin:sql|load', {
                db: 'sqlite:data.db'
            });
            await invoke('plugin:sql|execute', {
                db: 'sqlite:data.db',
                query: `CREATE TABLE IF NOT EXISTS CustomTheme (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    content TEXT NOT NULL,
                    createdAt TEXT NOT NULL
                );`,
                values: []
            });

            // 先加载主题列表
            await loadCustomThemes();
            
            // 然后添加字体选择器
            addFontSelector();
            
            let lastArticle = localStorage.getItem('lastArticle');
            if (!lastArticle) {
                const resourcePath = await resolveResource('resources/example.md');
                lastArticle = await readTextFile(resourcePath);
            }
            content = lastArticle;
            
            // 加载编辑器内容
            const iframe = document.getElementById('leftFrame');
            if (iframe) {
                const message = {
                    type: 'onUpdate',
                    value: content
                };
                iframe.contentWindow.postMessage(message, '*');
            }

            // 加载主题
            let gzhTheme = localStorage.getItem('gzhTheme');
            if (gzhTheme) {
                selectedTheme = gzhTheme;
                if (gzhTheme.startsWith('customTheme')) {
                    const id = gzhTheme.replace('customTheme', '');
                    customThemeContent = await getCustomThemeById(id);
                } else {
                    const themeResponse = await fetch(`themes/${selectedTheme}.css`);
                    customThemeContent = await themeResponse.text();
                }
            } else {
                const themeResponse = await fetch(`themes/${selectedTheme}.css`);
                customThemeContent = await themeResponse.text();
            }

            // 设置选中的主题
            const themeElement = document.getElementById(selectedTheme);
            if (themeElement) {
                themeElement.classList.add('selected');
            }

            // 加载高亮主题
            const savedTheme = localStorage.getItem('highlight-theme');
            if (savedTheme) {
                const themeId = `highlight-${savedTheme}`;
                const highlightElement = document.getElementById(themeId);
                if (highlightElement) {
                    highlightElement.classList.add('selected');
                }
            }

            // 延迟同步图例和脚注按钮状态，确保DOM已完全加载
            setTimeout(() => {
                syncCaptionButtonState();
                syncFootnoteButtonState();

                // 更新预览（确保在状态同步后再调用）
                onUpdate();
            }, 150);

        } catch (error) {
            console.error('Error reading file:', error);
            await message(`${error}`, 'Error reading file');
        }
    }
}

async function onUpdate() {
    const iframe = document.getElementById('rightFrame');
    if (iframe) {
        // 获取代码高亮样式
        const highlightResponse = await fetch(highlightStyle);
        const highlightCss = await highlightResponse.text();
        
        const message = {
            type: 'onUpdate',
            content: content,
            highlightCss: highlightCss,  // 确保这里传递了高亮样式
            previewMode: previewMode,
            themeValue: customThemeContent,
            isCaptionEnabled: isCaptionEnabled,
            isFootnotesEnabled: isFootnotes  // 🔥 新增：传递脚注状态
        };
        iframe.contentWindow.postMessage(message, '*');
    }
}

async function onContentChange() {
    const iframe = document.getElementById('rightFrame');
    if (iframe) {
        const message = {
            type: 'onContentChange',
            content: content,
            isCaptionEnabled: isCaptionEnabled
        };
        iframe.contentWindow.postMessage(message, '*');
    }
}

async function onPeviewModeChange(button) {
    const useElement = button.querySelector('use');
    if (previewMode === 'style.css') {
        previewMode = 'desktop_style.css';
        useElement.setAttribute('href', '#mobileIcon');
    } else {
        previewMode = 'style.css';
        useElement.setAttribute('href', '#desktopIcon');
    }
    const iframe = document.getElementById('rightFrame');
    if (iframe) {
        const message = {
            type: 'onPeviewModeChange',
            previewMode: previewMode
        };
        iframe.contentWindow.postMessage(message, '*');
    }
}

async function onFootnoteChange(button) {
    isFootnotes = !isFootnotes;
    localStorage.setItem('footnotesEnabled', isFootnotes); // 持久化脚注状态

    // 🔥 新增：立即更新按钮颜色，提供即时反馈
    if (isFootnotes) {
        button.style.backgroundColor = '#007AFF';
        button.style.color = 'white';
    } else {
        button.style.backgroundColor = '';
        button.style.color = '';
    }

    const useElement = button.querySelector('use');
    useElement.setAttribute('href', '#footnoteIcon');

    // 统一使用消息传递机制，避免重新渲染整个内容
    const iframe = document.getElementById('rightFrame');
    if (iframe) {
        const message = {
            type: 'onFootnoteChange',
            isFootnotesEnabled: isFootnotes
        };
        iframe.contentWindow.postMessage(message, '*');
    }
}

async function onCaptionChange(button) {
    // 先切换状态（用于显示用户点击的即时反馈）
    isCaptionEnabled = !isCaptionEnabled;
    localStorage.setItem('captionEnabled', isCaptionEnabled);
    if (isCaptionEnabled) {
        button.style.backgroundColor = '#007AFF';
        button.style.color = 'white';
    } else {
        button.style.backgroundColor = '';
        button.style.color = '';
    }

    // 发送图例状态变化消息，包含当前内容以便重新渲染
    const iframe = document.getElementById('rightFrame');
    if (iframe) {
        const message = {
            type: 'onCaptionChange',
            isCaptionEnabled: isCaptionEnabled,
            content: content  // 发送当前内容
        };
        iframe.contentWindow.postMessage(message, '*');
    }
}

async function changePlatform(selectedPlatform) {
    hideMenu();
    hideThemeOverlay();
    if (selectedPlatform !== 'gzh') {
        document.getElementById('gzhThemeButton').style.display = 'none';
        document.getElementById('exportImageButton').style.display = 'none';
    } else {
        if (document.getElementById('gzhThemeButton').style.display === 'none') {
            document.getElementById('gzhThemeButton').style.display = '';
        }
        if (document.getElementById('exportImageButton').style.display === 'none') {
            document.getElementById('exportImageButton').style.display = '';
        }
    }
    platform = selectedPlatform;
    let selectedTheme = platform + '_default';
    if (platform === 'gzh') {
        let gzhTheme = localStorage.getItem('gzhTheme');
        if (gzhTheme) {
            selectedTheme = gzhTheme;
        }
    }
    changeTheme(selectedTheme);
}

/**
 * 根据保存的图例功能状态同步按钮颜色
 * 直接从localStorage读取图例功能开关状态，确保按钮状态与功能状态一致
 */
function syncCaptionButtonState() {
    try {
        // 直接从localStorage读取图例功能状态
        const savedState = localStorage.getItem('captionEnabled') === 'true';

        // 同步按钮状态
        const captionButtons = document.querySelectorAll('button[onclick*="onCaptionChange"]');
        if (captionButtons.length > 0) {
            const button = captionButtons[0];
            if (savedState) {
                // 图例功能开启 → 按钮蓝色
                button.style.backgroundColor = '#007AFF';
                button.style.color = 'white';
            } else {
                // 图例功能关闭 → 按钮透明
                button.style.backgroundColor = '';
                button.style.color = '';
            }
        }

        // 更新全局状态变量
        const previousState = isCaptionEnabled;
        isCaptionEnabled = savedState;
        console.log('图例功能状态已同步:', savedState); // 调试日志

        // 🔥 关键修复：如果状态发生变化，主动触发内容更新
        if (previousState !== savedState) {
            console.log('检测到图例状态变化，触发内容重新渲染'); // 调试日志
            // 延迟执行，确保按钮状态更新完成
            setTimeout(() => {
                onUpdate();
            }, 100);
        }
    } catch (error) {
        console.warn('同步图例按钮状态失败:', error);
        // 出错时默认关闭图例功能
        isCaptionEnabled = false;
        localStorage.setItem('captionEnabled', 'false');
        console.log('图例功能状态已重置为默认值:', false); // 调试日志
    }
}

/**
 * 根据保存的脚注功能状态同步按钮颜色
 * 直接从localStorage读取脚注功能开关状态，确保按钮状态与功能状态一致
 */
function syncFootnoteButtonState() {
    try {
        // 直接从localStorage读取脚注功能状态
        const savedState = localStorage.getItem('footnotesEnabled') === 'true';

        // 同步按钮状态
        const footnoteButtons = document.querySelectorAll('button[onclick*="onFootnoteChange"]');
        if (footnoteButtons.length > 0) {
            const button = footnoteButtons[0];
            if (savedState) {
                // 脚注功能开启 → 按钮蓝色
                button.style.backgroundColor = '#007AFF';
                button.style.color = 'white';
            } else {
                // 脚注功能关闭 → 按钮透明
                button.style.backgroundColor = '';
                button.style.color = '';
            }
        }

        // 更新全局状态变量
        const previousState = isFootnotes;
        isFootnotes = savedState;
        console.log('脚注功能状态已同步:', savedState); // 调试日志

        // 🔥 关键修复：如果状态发生变化，主动触发内容更新
        if (previousState !== savedState) {
            console.log('检测到脚注状态变化，触发内容重新渲染'); // 调试日志
            // 延迟执行，确保按钮状态更新完成
            setTimeout(() => {
                onUpdate();
            }, 100);
        }
    } catch (error) {
        console.warn('同步脚注按钮状态失败:', error);
        // 出错时默认关闭脚注功能
        isFootnotes = false;
        localStorage.setItem('footnotesEnabled', 'false');
        console.log('脚注功能状态已重置为默认值:', false); // 调试日志
    }
}

async function onCopy(button) {
    const iframe = document.getElementById('rightFrame');
    const iframeWindow = iframe.contentWindow;
    let htmlValue = '';
    if (platform === 'gzh') {
        htmlValue = iframeWindow.getContentForGzh();
    } else if (platform === 'zhihu') {
        htmlValue = iframeWindow.getContentWithMathImg();
    } else if (platform === 'juejin') {
        htmlValue = iframeWindow.getPostprocessMarkdown();
    } else if (platform === 'medium') {
        htmlValue = iframeWindow.getContentForMedium();
    } else {
        htmlValue = iframeWindow.getContent();
    }
    
    if (platform === 'juejin') {
        await invoke('write_text_to_clipboard', { text: htmlValue });
    } else {
        await invoke('write_html_to_clipboard', { text: htmlValue });
    }
    const useElement = button.querySelector('use');
    useElement.setAttribute('href', '#checkIcon');
    setTimeout(() => {
        useElement.setAttribute('href', '#clipboardIcon');
    }, 1000);
}

function displayThemeOverlay() {
    const themeOverlay = document.getElementById('themeOverlay');
    themeOverlay.style.display = 'block';
}

function hideThemeOverlay() {
    const themeOverlay = document.getElementById('themeOverlay');
    themeOverlay.style.display = 'none';
}

function hideMenu() {
    const themeOverlay = document.getElementById('dropdown');
    themeOverlay.style.display = 'none';
    const mainMenu = document.getElementById('mainMenu');
    mainMenu.style.display = 'none';
}

async function changeTheme(theme) {
    selectedTheme = theme;
    if (selectedTheme.startsWith('customTheme')) {
        const id = selectedTheme.replace('customTheme', '');
        customThemeContent = await getCustomThemeById(id);
    } else {
        const themeResponse = await fetch(`themes/${selectedTheme}.css`);
        customThemeContent = await themeResponse.text();
    }
    const iframe = document.getElementById('rightFrame');
    if (iframe) {
        const highlightResponse = await fetch(highlightStyle);
        const highlightCss = await highlightResponse.text();
        const message = {
            type: 'onUpdate',
            highlightCss: highlightCss,
            themeValue: customThemeContent
        };
        if (platform == 'zhihu') {
            delete message.highlightCss;
        }
        iframe.contentWindow.postMessage(message, '*');
    }
    if (platform === 'gzh') {
        localStorage.setItem('gzhTheme', selectedTheme);
    }
}

function showMoreMenu() {
    const dropdown = document.getElementById('dropdown');
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

function showMainMenu() {
    const dropdown = document.getElementById('mainMenu');
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

async function openAbout() {
    appWindow.emit('open-about');
}

async function exportLongImage() {
    const iframe = document.getElementById('rightFrame');
    const iframeDocument = iframe.contentDocument || iframe.contentWindow.document;
    const clonedWenyan = iframeDocument.getElementById('wenyan').cloneNode(true);
    const images = clonedWenyan.querySelectorAll('img');
    const promises = Array.from(images).map(async (img, index) => {
        try {
            // 获取图片二进制数据
            const response = await tauriFetch(img.src, {
                method: 'GET',
                responseType: ResponseType.Binary
            });
            const arrayBuffer = await response.data;

            // 将 ArrayBuffer 转换为 Base64 字符串
            const base64String = arrayBufferToBase64(arrayBuffer);
            const mimeType = response.headers['content-type'] || 'image/png'; // 获取 MIME 类型

            // 替换 img.src
            img.src = `data:${mimeType};base64,${base64String}`;
        } catch (error) {
            console.error(`Failed to process image ${index}:`, error);
            await message(`${error}`, 'Error exporting image.');
        }
    });
    let elements = clonedWenyan.querySelectorAll('mjx-container');
    elements.forEach((element) => {
        const svg = element.querySelector('svg');
        svg.style.width = svg.getAttribute('width');
        svg.style.height = svg.getAttribute('height');
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        const parent = element.parentElement;
        element.remove();
        parent.appendChild(svg);
        if (parent.classList.contains('block-equation')) {
            parent.setAttribute('style', 'text-align: center; margin-bottom: 1rem;');
        }
    });
    Promise.all(promises)
        .then(() => {
            clonedWenyan.classList.add('invisible');
            // console.log(clonedWenyan.outerHTML);
            iframeDocument.body.appendChild(clonedWenyan);
            html2canvas(clonedWenyan, {
                logging: false
            })
            .then((canvas) => {
                // 将 Canvas 转换为 JPEG 图像数据
                canvas.toBlob(
                    async (blob) => {
                        const filePath = await save({
                            filters: [
                                {
                                    name: 'Image',
                                    extensions: ['jpeg']
                                }
                            ]
                        });
                        if (filePath) {
                            blob.arrayBuffer().then(async (arrayBuffer) => {
                                await writeBinaryFile(filePath, arrayBuffer);
                            });
                        }
                    },
                    'image/jpeg',
                    0.9
                ); // 0.9 表示 JPEG 压缩系数
                iframeDocument.body.removeChild(clonedWenyan);
            })
            .catch((error) => {
                console.error('Error capturing with html2canvas:', error);
                iframeDocument.body.removeChild(clonedWenyan);
                message(`${error}`, 'Error capturing with image');
            });
        })
        .catch((error) => {
            console.error('An error occurred during the image processing:', error);
            message(`${error}`, 'Error during the image processing');
        });
}

// 将 ArrayBuffer 转换为 Base64 字符串的辅助函数
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

async function showCssEditor(customTheme) {
    const element = document.getElementById('btnDeleteTheme');
    if (element) {
        element.remove();
    }
    selectedCustomTheme = customTheme ? customTheme : '';
    const iframe = document.getElementById('cssLeftFrame');
    
    // 先移除可能存在的旧监听器
    const oldHandleMessage = iframe._handleMessage;
    if (oldHandleMessage) {
        window.removeEventListener('message', oldHandleMessage);
    }
    
    // 等待编辑器准备就绪后填充内容
    const handleMessage = async (event) => {
        if (event.data.type === 'onReadyCss') {
            iframe.contentWindow.setContent(customThemeContent);
            window.removeEventListener('message', handleMessage);
        }
    };
    
    // 保存监听器引用以便后续清理
    iframe._handleMessage = handleMessage;
    
    // 先添加监听器，再设置 src
    window.addEventListener('message', handleMessage);
    iframe.src = '/css_editor.html';
    if (selectedCustomTheme) {
        const footer = document.getElementById('footerButtonContainer');
        const btn = document.createElement('button');
        btn.setAttribute('id', 'btnDeleteTheme');
        btn.classList.add('modal__btn', 'modal__btn-delete');
        btn.addEventListener('click', () => deleteCustomTheme());
        btn.innerHTML = '删除';
        footer.insertBefore(btn, footer.firstChild);
    }
    
    MicroModal.show('modal-1');
    hideThemeOverlay();
}

async function loadCustomThemes() {
    const ul = document.getElementById('gzhThemeSelector');
    if (ul) {
        ul.innerHTML = '';
        // 添加内置主题
        builtinThemes.forEach((i) => {
            const li = document.createElement('li');
            li.setAttribute('id', i.id);
            const span1 = document.createElement('span');
            span1.innerHTML = i.name;
            const span2 = document.createElement('span');
            span2.innerHTML = i.author;
            li.style.display = 'flex';
            li.style.alignItems = 'center';
            li.appendChild(span1);
            li.appendChild(span2);
            ul.appendChild(li);
        });

        // 加载自定义主题
        const customThemes = await invoke('plugin:sql|select', {
            db: 'sqlite:data.db',
            query: 'SELECT * FROM CustomTheme',
            values: []
        });

        // 如果存在自定义主题，添加分隔符和主题列表
        if (customThemes && customThemes.length > 0) {
            // 添加自定义主题分隔符
            const customSeparator = document.createElement('li');
            customSeparator.classList.add('separator');
            customSeparator.textContent = '自定义主题';
            ul.appendChild(customSeparator);

            // 添加自定义主题列表
            customThemes.forEach((i, index) => {
                const li = document.createElement('li');
                li.setAttribute('id', `customTheme${i.id}`);
                const span1 = document.createElement('span');
                span1.innerHTML = `${i.name}`;
                span1.addEventListener('dblclick', () => showRenameInput(i.id, span1));
                
                const span2 = document.createElement('span');
                span2.innerHTML = `<svg width="12" height="16" fill="none" xmlns="http://www.w3.org/2000/svg"><use href="#editIcon"></use></svg>`;
                span2.addEventListener('click', () => showCssEditor(`${i.id}`));
                
                li.appendChild(span1);
                li.appendChild(span2);
                if (index === 0) {
                    li.classList.add('border-li');
                }
                ul.appendChild(li);
            });
        }

        // 添加"创建新主题"按钮（如果自定义主题数量小于3）
        if (customThemes && customThemes.length < 10) {
            const li = document.createElement('li');
            li.setAttribute('id', 'create-theme');
            li.classList.add('border-li');
            const span1 = document.createElement('span');
            span1.innerHTML = '创建新主题';
            const span2 = document.createElement('span');
            span2.style.display = 'flex';
            span2.style.alignItems = 'center';
            span2.innerHTML = `<svg width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg"><use href="#plusIcon"></use></svg>`;
            span2.addEventListener('click', async () => {
                // 获取当前选中的主题内容作为新主题的初始内容
                const selectedTheme = document.querySelector('#gzhThemeSelector li.selected');
                if (selectedTheme) {
                    const themeId = selectedTheme.id;
                    if (themeId.startsWith('customTheme')) {
                        // 如果选中的是自定义主题，获取其内容
                        const result = await invoke('plugin:sql|select', {
                            db: 'sqlite:data.db',
                            query: 'SELECT content FROM CustomTheme WHERE id = ?',
                            values: [themeId.replace('customTheme', '')]
                        });
                        if (result && result.length > 0) {
                            customThemeContent = result[0].content;
                            showCssEditor();
                        }
                    } else {
                        // 如果选中的是内置主题，获取其内容
                        try {
                            const response = await fetch(`themes/${themeId}.css`);
                            customThemeContent = await response.text();
                            showCssEditor();
                        } catch (error) {
                            console.error('Error loading theme:', error);
                            await message('加载主题失败', { type: 'error' });
                        }
                    }
                } else {
                    // 如果没有选中的主题，使用默认主题内容
                    try {
                        const response = await fetch('themes/gzh_default.css');
                        customThemeContent = await response.text();
                        showCssEditor();
                    } catch (error) {
                        console.error('Error loading default theme:', error);
                        await message('加载默认主题失败', { type: 'error' });
                    }
                }
            });
            li.appendChild(span1);
            li.appendChild(span2);
            ul.appendChild(li);
        }

        // 添加代码高亮主题分隔符
        const highlightSeparator = document.createElement('li');
        highlightSeparator.classList.add('separator');
        highlightSeparator.textContent = '代码高亮主题';
        ul.appendChild(highlightSeparator);

        // 添加代码高亮主题
        highlightThemes.forEach((theme) => {
            const li = document.createElement('li');
            li.setAttribute('id', `highlight-${theme.id}`);
            li.classList.add('highlight-theme');
            const span1 = document.createElement('span');
            span1.innerHTML = theme.name;
            li.appendChild(span1);
            ul.appendChild(li);
        });

        // 设置主题选择器的高度
        if (customThemes && customThemes.length > 0) {
            const height = calcHeight(customThemes.length);
            document.getElementById('themeOverlay').setAttribute("style", `height: ${height}px;`);
        } else {
            document.getElementById('themeOverlay').removeAttribute("style");
        }

        const listItems = ul.querySelectorAll('li');
        listItems.forEach((item) => {
            item.addEventListener('click', function() {
                if (item.classList.contains('highlight-theme')) {
                    const themeId = item.id.replace('highlight-', '');
                    changeHighlightTheme(themeId);
                    listItems.forEach((li) => {
                        if (li.classList.contains('highlight-theme')) {
                            li.classList.remove('selected');
                        }
                    });
                    item.classList.add('selected');
                } else if (!item.classList.contains('separator') && item.id !== 'create-theme') {
                    listItems.forEach((li) => {
                        if (!li.classList.contains('highlight-theme')) {
                            li.classList.remove('selected');
                        }
                    });
                    item.classList.add('selected');
                    changeTheme(item.id);
                }
            });
        });
    }
}

async function saveCustomTheme() {
    if (selectedCustomTheme) {
        await invoke('plugin:sql|execute', {
            db: 'sqlite:data.db',
            query: 'UPDATE CustomTheme SET content = ?, createdAt = ? WHERE id = ?;',
            values: [customThemeContent, new Date().toISOString(), selectedCustomTheme]
        });
    } else {
        await invoke('plugin:sql|execute', {
            db: 'sqlite:data.db',
            query: 'INSERT INTO CustomTheme (name, content, createdAt) VALUES (?, ?, ?);',
            values: ['自定义主题', customThemeContent, new Date().toISOString()]
        });
    }
    MicroModal.close('modal-1');
    await loadCustomThemes();
    document.getElementById(selectedTheme).classList.add('selected');
    changeTheme(selectedTheme);
}

async function deleteCustomTheme() {
    if (selectedCustomTheme) {
        await invoke('plugin:sql|execute', {
            db: 'sqlite:data.db',
            query: 'DELETE FROM CustomTheme WHERE id = ?;',
            values: [selectedCustomTheme]
        });
    }
    MicroModal.close('modal-1');
    await loadCustomThemes();
    selectedTheme = 'gzh_default';
    document.getElementById(selectedTheme).classList.add('selected');
    changeTheme(selectedTheme);
}

async function loadCustomTheme() {
    if (!selectedCustomTheme) {
        if (selectedTheme) {
            if (selectedTheme.startsWith('customTheme')) {
                const id = selectedTheme.replace('customTheme', '');
                customThemeContent = await getCustomThemeById(id);
            } else {
                const themeResponse = await fetch(`themes/${selectedTheme}.css`);
                customThemeContent = await themeResponse.text();
            }
        } else {
            const theme = 'gzh_default';
            const themeResponse = await fetch(`themes/${theme}.css`);
            customThemeContent = await themeResponse.text();
        }
    }

    const iframe = document.getElementById('cssLeftFrame');
    const iframeWindow = iframe.contentWindow;
    iframeWindow.setContent(customThemeContent);
}

async function getCustomThemeById(id) {
    const customTheme = await invoke('plugin:sql|select', {
        db: 'sqlite:data.db',
        query: 'SELECT * FROM CustomTheme WHERE id = ?;',
        values: [id]
    });
    if (customTheme && customTheme.length > 0) {
        return customTheme[0].content;
    }
    return null;
}

async function updateThemePreview() {
    const iframe = document.getElementById('cssRightFrame');
    const iframeWindow = iframe.contentWindow;
    iframeWindow.setCss(customThemeContent);
}

async function openMarkdownFile() {
    const selected = await open({
        multiple: false,
        filters: [
            {
                name: 'Markdown',
                extensions: ['md', 'markdown']
            }
        ]
    });
    
    if (selected) {
        try {
            const fileContent = await readTextFile(selected);
            const iframe = document.getElementById('leftFrame');
            const iframeWindow = iframe.contentWindow;
            iframeWindow.setContent(fileContent);
        } catch (error) {
            console.error("Error reading file:", error);
            await message(`${error}`, '文件读取失败');
        }
    }
}

async function openCssFile() {
    const selected = await open({
        multiple: false,
        filters: [
            {
                name: 'Stylesheet',
                extensions: ['css']
            }
        ]
    });
    
    if (selected) {
        try {
            const fileContent = await readTextFile(selected);
            const iframe = document.getElementById('cssLeftFrame');
            const iframeWindow = iframe.contentWindow;
            iframeWindow.loadCss(fileContent);
        } catch (error) {
            console.error("Error reading file:", error);
            await message(`${error}`, '文件读取失败');
        }
    }
}

listen('tauri://file-drop', async(event) => {
    try {
        if (event && event.payload) {
            const fileUrl = event.payload[0];
            if (fileUrl.endsWith('.md') || fileUrl.endsWith('.markdown')) {
                const fileContent = await readTextFile(fileUrl);
                const iframe = document.getElementById('leftFrame');
                const iframeWindow = iframe.contentWindow;
                iframeWindow.setContent(fileContent);
            }
        }
    } catch (error) {
        console.error("Error reading file:", error);
        await message(`${error}`, '文件读取失败');
    }
});

function openHelpBubble() {
    const bubbleBox = document.getElementById('bubbleBox');
    const isVisible = bubbleBox.style.display === 'block';
    bubbleBox.style.display = isVisible ? 'none' : 'block';
}

document.addEventListener('click', (event) => {
    const helpButton = document.getElementById('helpButton');
    const bubbleBox = document.getElementById('bubbleBox');
    if (!bubbleBox.contains(event.target) && !helpButton.contains(event.target)) {
        bubbleBox.style.display = 'none';
    }
});

function hideBubble() {
    document.getElementById('bubbleBox').style.display = 'none';
}

function calcHeight(customThemeCount) {
    // 基础高度 + 内置主题高度 + 两个分隔线高度 + 代码高亮主题高度 + 自定义主题高度
    const separatorHeight = customThemeCount > 0 ? 60 : 30; // 如果有自定义主题则是两个分隔符的高度，否则一个
    return 240 + (Math.min(customThemeCount, 10) * 25) + separatorHeight + (highlightThemes.length * 25);
}

async function changeHighlightTheme(theme) {
    localStorage.setItem('highlight-theme', theme);
    highlightStyle = `highlight/styles/${theme}.min.css`;
    onUpdate();
}

function showRenameInput(themeId, span) {
    const oldName = span.innerText;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = oldName;
    input.style.width = '120px';
    input.style.border = '1px solid #ccc';
    input.style.padding = '2px 4px';
    input.style.borderRadius = '3px';
    
    span.innerHTML = '';
    span.appendChild(input);
    input.focus();
    
    async function finishRename() {
        const newName = input.value.trim();
        if (newName && newName !== oldName) {
            await renameCustomTheme(themeId, newName);
            span.innerHTML = newName;
        } else {
            span.innerHTML = oldName;
        }
    }
    
    input.addEventListener('blur', finishRename);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            finishRename();
        }
    });
}

async function renameCustomTheme(id, newName) {
    await invoke('plugin:sql|execute', {
        db: 'sqlite:data.db',
        query: 'UPDATE CustomTheme SET name = ? WHERE id = ?;',
        values: [newName, id]
    });
}


function displayFontSelector(button) {
    // 先移除已存在的选择器
    const existingSelector = document.getElementById('fontSelector');
    if (existingSelector) {
        existingSelector.remove();
    }

    const selector = document.createElement('div');
    selector.id = 'fontSelector';
    selector.style.cssText = `
        position: fixed;
        background: white;
        border: 1px solid #eee;
        border-radius: 4px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        z-index: 100;
        width: 120px;
        pointer-events: auto;
    `;

    fontFamilies.forEach(font => {
        const option = document.createElement('div');
        option.style.cssText = `
            padding: 8px 16px;
            cursor: pointer;
            font-size: 14px;
        `;
        option.textContent = font.name;

        const currentFont = localStorage.getItem('preferred-font') || 'theme';
        if (currentFont === font.id) {
            option.style.backgroundColor = '#f0f0f0';
        }

        option.onmouseover = () => {
            option.style.backgroundColor = '#f0f0f0';
        };
        option.onmouseout = () => {
            if (currentFont !== font.id) {
                option.style.backgroundColor = '';
            }
        };
        option.onclick = (e) => {
            e.stopPropagation();
            localStorage.setItem('preferred-font', font.id);
            if (font.id === 'theme') {
                updatePreviewFont(null);
            } else {
                updatePreviewFont(font.value);
            }
            selector.remove();
        };

        selector.appendChild(option);
    });

    // 调整定位，让选择框更靠近按钮
    const rect = button.getBoundingClientRect();
    selector.style.top = `${rect.top}px`;
    selector.style.left = `${rect.left - 120}px`;

    document.body.appendChild(selector);

    // 使用捕获阶段处理点击事件，确保在其他点击事件之前处理
    function handleClick(e) {
        if (!selector.contains(e.target) && !button.contains(e.target)) {
            selector.remove();
            document.removeEventListener('click', handleClick, true);
        }
    }

    // 延迟添加事件监听，避免立即触发
    requestAnimationFrame(() => {
        document.addEventListener('click', handleClick, true);
    });
}

function updatePreviewFont(fontFamily) {
    const iframe = document.getElementById('rightFrame');
    if (iframe) {
        const message = {
            type: 'updateFont',
            fontFamily: fontFamily
        };
        iframe.contentWindow.postMessage(message, '*');
    }
}