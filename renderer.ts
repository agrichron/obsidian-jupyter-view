import { App, MarkdownRenderer } from 'obsidian';
import { Component } from 'obsidian';

interface JupyterCell {
    cell_type: string;
    source: string[];
    outputs?: any[];
    metadata?: {
        vscode?: {
            languageId?: string;
            [key: string]: any;
        };
    }
}
interface JupyterNotebook {
    cells: JupyterCell[];
}

export async function renderNotebook(notebook: JupyterNotebook, container: HTMLElement, app: App, component: Component) {
    try {
        // 验证笔记本对象是否有效
        if (!notebook || !Array.isArray(notebook.cells)) {
            throw new Error('无效的 Jupyter 笔记本格式');
        }

        const notebookContainer = container.createEl('div', {
            cls: 'jupyter-notebook'
        });

        for (const cell of notebook.cells) {
            const cellElement = notebookContainer.createEl('div', {
                cls: 'jupyter-cell'
            });

            switch (cell.cell_type) {
                case 'markdown':
                    renderMarkdownCell(cell, cellElement, app, component);
                    break;
                case 'code':
                    await renderCodeCell(cell, cellElement, app, component);
                    break;
            }
        }
    } catch (error) {
        // 创建错误提示元素
        const errorElement = container.createEl('div', {
            cls: 'jupyter-error',
            text: `解析笔记本出错: ${error.message}`
        });
        console.error('Jupyter 笔记本解析错误:', error);
    }
}

async function renderMarkdownCell(
    cell: JupyterCell,
    container: HTMLElement,
    app: App,
    component: Component
) {
    try {
        const content = cell.source.join('');
        const markdownContainer = container.createEl('div', {
            cls: 'jupyter-markdown-cell'
        });

        await MarkdownRenderer.render(
            app,
            content,
            markdownContainer,
            './',
            component
        );
    } catch (error) {
        console.error('Markdown 渲染错误:', error);
        container.createEl('div', {
            text: `Markdown 渲染错误: ${error.message}`,
            cls: 'jupyter-error'
        });
    }
}

async function renderCodeCell(cell: JupyterCell, container: HTMLElement, app: App, component: Component) {
    console.log('renderCodeCell', cell);
    // 创建代码容器
    const codeContainer = container.createEl('div', {
        cls: 'jupyter-code-input'
    });

    // 创建语言标签容器
    const languageLabel = codeContainer.createEl('div', {
        cls: 'jupyter-code-language'
    });

    // 读取cell中的language
    const language = cell.metadata?.vscode?.languageId || 'python';
    // 设置语言标签文本

    languageLabel.setText(language);

    // 使用 MarkdownRenderer 渲染代码块
    const sourceCode = cell.source.join('');
    const markdownCode = '```' + language + '\n' + sourceCode + '\n```';

    await MarkdownRenderer.render(
        app,
        markdownCode,
        codeContainer,
        './',
        component
    );

    // 渲染输出
    if (cell.outputs && cell.outputs.length > 0) {
        const outputContainer = container.createEl('div', {
            cls: 'jupyter-output'
        });

        for (const output of cell.outputs) {
            renderOutput(output, outputContainer);
        }
    }
}

function renderOutput(output: any, container: HTMLElement) {
    if (output.output_type === 'stream') {
        container.createEl('pre', {
            text: output.text.join(''),
            cls: 'jupyter-output-stream'
        });
    } else if (output.output_type === 'execute_result' || output.output_type === 'display_data') {
        if (output.data['text/plain']) {
            container.createEl('pre', {
                text: output.data['text/plain'].join(''),
                cls: 'jupyter-output-result'
            });
        }

        if (output.data['image/png']) {
            const imgContainer = container.createEl('div', {
                cls: 'jupyter-output-image'
            });

            const img = imgContainer.createEl('img', {
                attr: {
                    src: `data:image/png;base64,${output.data['image/png']}`,
                    alt: 'Jupyter输出图像'
                }
            });
        }

        if (output.data['image/svg+xml']) {
            const svgContainer = container.createEl('div', {
                cls: 'jupyter-output-svg'
            });

            if (typeof output.data['image/svg+xml'] === 'string') {
                svgContainer.innerHTML = output.data['image/svg+xml'];
            } else if (Array.isArray(output.data['image/svg+xml'])) {
                svgContainer.innerHTML = output.data['image/svg+xml'].join('');
            }
        }

        if (output.data['text/html']) {
            const htmlContainer = container.createEl('div', {
                cls: 'jupyter-output-html'
            });

            htmlContainer.innerHTML = Array.isArray(output.data['text/html'])
                ? output.data['text/html'].join('')
                : output.data['text/html'];
        }
    }
} 