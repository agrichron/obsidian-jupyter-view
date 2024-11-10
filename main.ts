import { Plugin, WorkspaceLeaf, TextFileView } from 'obsidian';
import { renderNotebook } from './renderer';

// 定义视图类型
const VIEW_TYPE_JUPYTER = "jupyter-notebook";

// 创建 Jupyter 笔记本视图类
class JupyterView extends TextFileView {
    data: string;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
        this.data = '';
    }

    // 获取视图类型
    getViewType() {
        return VIEW_TYPE_JUPYTER;
    }

    // 获取显示文本
    getDisplayText() {
        return this.file?.basename || "Jupyter Notebook";
    }

    // 获取图标
    getIcon() {
        return "code";
    }

    // 设置文件内容
    async setViewData(data: string, clear: boolean) {
        // 保存原始数据
        this.data = data;

        try {
            // 清空现有内容
            this.contentEl.empty();

            // 检查数据是否为空
            if (!data) {
                throw new Error('文件内容为空');
            }

            // 尝试解析 JSON
            const notebook = JSON.parse(data);

            // 验证笔记本格式
            if (!notebook || !Array.isArray(notebook.cells)) {
                throw new Error('无效的 Jupyter 笔记本格式');
            }

            // 渲染笔记本
            await renderNotebook(notebook, this.contentEl);
        } catch (error) {
            console.error('Jupyter 笔记本加载错误:', error);

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
                await this.setViewData(this.data, true);
            });
        }
    }

    // 清除内容
    clear() {
        this.data = '';
        this.contentEl.empty();
    }

    // 获取保存数据
    getViewData() {
        return this.data;
    }

    // 添加一个刷新方法
    async refresh() {
        if (this.data) {
            await this.setViewData(this.data, true);
        }
    }
}

export default class JupyterNotebookPlugin extends Plugin {
    async onload() {
        // 注册自定义视图
        this.registerView(
            VIEW_TYPE_JUPYTER,
            (leaf: WorkspaceLeaf) => new JupyterView(leaf)
        );

        // 注册 .ipynb 文件扩展名，将其绑定到我们的视图类型
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

        // 注册 jupyter 类型的处理器
        // 用于渲染 Markdown 中的 ```jupyter 代码块
        this.registerMarkdownCodeBlockProcessor('jupyter', async (source, el, ctx) => {
            try {
                // 将源文本解析为 JSON 格式的笔记本数据
                const notebook = JSON.parse(source);
                // 调用渲染函数来显示笔记本内容
                await renderNotebook(notebook, el);
            } catch (error) {
                // 如果解析或渲染过程出错，显示错误信息
                el.createEl('div', {
                    text: `解析 Jupyter 内容时出错: ${error.message}`,
                    cls: 'jupyter-error'
                });
            }
        });
    }

    async onunload() {
        // 注销所有 jupyter-notebook 类型的视图
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_JUPYTER);
    }
} 