import { Plugin, WorkspaceLeaf, TextFileView, MarkdownView, TFile, EditorSuggest, App, EditorSuggestTriggerInfo, EditorSuggestContext, EditorPosition, Editor } from 'obsidian';
import { renderNotebook } from './renderer';

// 定义视图类型常量，用于注册和识别 Jupyter 笔记本视图
const VIEW_TYPE_JUPYTER = "jupyter-notebook";

/**
 * Jupyter 笔记本视图类
 * 继承自 TextFileView 以处理文本文件
 */
class JupyterView extends TextFileView {
    // 存储原始文件内容
    data: string;
    file: TFile | null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
        this.data = '';
        console.log('JupyterView 初始化');
    }

    getViewType() {
        return VIEW_TYPE_JUPYTER;
    }

    getDisplayText() {
        const filename = this.file?.basename || "Jupyter Notebook";
        console.log('当前文件名:', filename);
        return filename;
    }

    getIcon() {
        return "code";
    }

    /**
     * 设置视图内容
     * @param data - 文件内容
     * @param clear - 是否清除现有内容
     */
    async setViewData(data: string, clear: boolean) {

        // 保存原始数据
        this.data = data;

        try {
            // 清空现有内容
            this.contentEl.empty();

            // 检查数据是否为空
            if (!data) {
                console.error('文件内容为空');
                throw new Error('文件内容为空');
            }

            // 尝试解析 JSON
            const notebook = JSON.parse(data);

            // 验证笔记本格式
            if (!notebook || !Array.isArray(notebook.cells)) {
                console.error('无效的笔记本格式:', notebook);
                throw new Error('无效的 Jupyter 笔记本格式');
            }

            // 渲染笔记本
            await renderNotebook(notebook, this.contentEl, this.app, this);

        } catch (error) {
            console.error('Jupyter 笔记本加载错误:', error);
            console.error('错误堆栈:', error.stack);

            // 显示错误信息
            this.contentEl.empty();
            this.contentEl.createEl('div', {
                cls: 'jupyter-error',
                text: `加载 Jupyter 笔记本时出错: ${error.message}`
            });

            // 添加重试按钮
            const retryButton = this.contentEl.createEl('button', {
                text: '重试加载',
                cls: 'jupyter-retry-button'
            });

            retryButton.addEventListener('click', async () => {
                console.log('触发重试加载');
                await this.setViewData(this.data, true);
            });
        }
    }

    /**
     * 统计笔记本中各类型单元格的数量
     * @param cells - 单元格数组
     * @returns 单元格类型统计对象
     */
    private getCellTypeStats(cells: any[]) {
        return cells.reduce((stats: any, cell: any) => {
            stats[cell.cell_type] = (stats[cell.cell_type] || 0) + 1;
            return stats;
        }, {});
    }

    clear() {
        console.log('清除视图内容');
        this.data = '';
        this.contentEl.empty();
    }

    getViewData() {
        return this.data;
    }

    async refresh() {
        console.log('刷新视图');
        if (this.data) {
            await this.setViewData(this.data, true);
        }
    }
}

/**
 * Jupyter 笔记本插件主类
 */
export default class JupyterNotebookPlugin extends Plugin {
    async onload() {

        setTimeout(() => {
            // @ts-ignore
            console.warn('Plugin loaded:', this.app.plugins.plugins['obsidian-jupyter-notebook'] ? 'Yes' : 'No');
        }, 1000);

        // 注册自定义视图
        this.registerView(
            VIEW_TYPE_JUPYTER,
            (leaf: WorkspaceLeaf) => new JupyterView(leaf)
        );

        // 注文件扩展名
        this.registerExtensions(['ipynb'], VIEW_TYPE_JUPYTER);

        // 添加刷新命令
        this.addCommand({
            id: 'refresh-jupyter-notebook',
            name: '刷新 Jupyter 笔记本视图',
            checkCallback: (checking: boolean) => {
                const activeView = this.app.workspace.getActiveViewOfType(JupyterView);
                if (activeView) {
                    if (!checking) {
                        activeView.refresh();
                    }
                    return true;
                }
                return false;
            }
        });

        // 添加文件建议处理器
        this.app.workspace.onLayoutReady(() => {
            // 扩展默认的文件建议器
            this.registerEditorSuggest(new JupyterFileSuggest(this.app));
        });

    }

    async onunload() {
        console.log('卸载 Jupyter Notebook 插件');
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_JUPYTER);
    }
}

// 创建文件建议器
class JupyterFileSuggest extends EditorSuggest<TFile> {
    constructor(app: App) {
        super(app);
    }

    onTrigger(cursor: EditorPosition, editor: Editor): EditorSuggestTriggerInfo | null {
        const line = editor.getLine(cursor.line);
        const beforeCursor = line.slice(0, cursor.ch);

        // 检查是否输入了 [.
        if (beforeCursor.endsWith('[.')) {
            return {
                start: { line: cursor.line, ch: cursor.ch - 2 },
                end: { line: cursor.line, ch: cursor.ch + 1 },
                query: ''
            };
        }

        // 检查是否在 [. ] 之间
        const lastTrigger = beforeCursor.lastIndexOf('[.');
        console.log('lastTrigger', lastTrigger);

        if (lastTrigger === -1) return null;

        // 提取查询文本
        let query = line.slice(lastTrigger + 2, cursor.ch);

        // 如果查询文本中包含 ]，则截断
        const queryCloseBracket = query.indexOf(']');
        if (queryCloseBracket !== -1) {
            query = query.slice(0, queryCloseBracket);
        }

        // 只有当查询包含 .ipynb 文件时才触发
        const hasIpynbFile = this.app.vault.getFiles()
            .some(file => file.extension === 'ipynb' &&
                (file.basename.toLowerCase().includes(query.toLowerCase()) ||
                    file.path.toLowerCase().includes(query.toLowerCase())));

        if (!hasIpynbFile) return null;

        return {
            start: { line: cursor.line, ch: lastTrigger },
            end: { line: cursor.line, ch: cursor.ch + 1 },
            query: query
        };
    }

    selectSuggestion(file: TFile, evt: MouseEvent | KeyboardEvent): void {
        if (!this.context) return;

        const editor = this.context.editor;
        const { start, end } = this.context;
        const relativePath = file.path;

        // 替换 [. 为 [[ 格式
        const suggestionText = `[[${relativePath}|📓 ${file.basename}]]`;
        editor.replaceRange(
            suggestionText,
            { line: start.line, ch: start.ch }, // 从 [. 开始
            { line: start.line, ch: end.ch }
        );

        // 将光标移动到 ]] 后面
        editor.setCursor({
            line: start.line,
            ch: start.ch + suggestionText.length
        });
    }

    // 添加是否应该自动选择第一个建议的检查
    shouldSelectFirstItem(): boolean {
        return true;
    }

    // 检查是否应该接受建议
    shouldAcceptSuggestion(suggestion: TFile): boolean {
        return true;
    }

    // 检查是否应该显示建议
    shouldShowSuggestion(): boolean {
        return true;
    }

    getSuggestions(context: EditorSuggestContext): TFile[] {
        const query = context.query.toLowerCase();
        console.log('Getting suggestions for query:', query);

        // 获取所有 .ipynb 文件
        const files = this.app.vault.getFiles()
            .filter(file => {
                const isMatch = file.extension === 'ipynb' &&
                    (file.basename.toLowerCase().includes(query) ||
                        file.path.toLowerCase().includes(query));
                return isMatch;
            });
        console.log(files);

        console.log('Found matching files:', files.length);
        return files;
    }

    renderSuggestion(file: TFile, el: HTMLElement): void {
        const suggestionEl = el.createEl('div', {
            cls: 'jupyter-suggestion'
        });

        // 添加文件图标
        suggestionEl.createEl('span', {
            cls: 'suggestion-icon',
            text: '📓 '
        });

        // 添加文件名
        suggestionEl.createEl('span', {
            cls: 'suggestion-file',
            text: file.basename
        });

        // 添加路径（如果在子文件夹中）
        if (file.parent && file.parent.path !== '/') {
            suggestionEl.createEl('span', {
                cls: 'suggestion-path',
                text: ` (${file.parent.path})`
            });
        }
    }
} 