import { default as MarkdownIt } from 'markdown-it';
import { MarkdownRenderer } from 'obsidian';

interface JupyterCell {
    cell_type: string;
    source: string[];
    outputs?: any[];
}

interface JupyterNotebook {
    cells: JupyterCell[];
}

export async function renderNotebook(notebook: JupyterNotebook, container: HTMLElement) {
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
                    renderMarkdownCell(cell, cellElement);
                    break;
                case 'code':
                    renderCodeCell(cell, cellElement);
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

function renderMarkdownCell(cell: JupyterCell, container: HTMLElement) {
    try {
        const content = cell.source.join('');
        const markdownContainer = container.createEl('div', {
            cls: 'jupyter-markdown-cell'
        });

        // 创建 MarkdownIt 实例
        const md = MarkdownIt({
            html: true,
            linkify: true,
            typographer: true
        });

        markdownContainer.innerHTML = md.render(content);
    } catch (error) {
        console.error('Markdown 渲染错误:', error);
        container.createEl('div', {
            text: `Markdown 渲染错误: ${error.message}`,
            cls: 'jupyter-error'
        });
    }
}

function renderCodeCell(cell: JupyterCell, container: HTMLElement) {
    // 创建代码容器
    const codeContainer = container.createEl('div', {
        cls: 'jupyter-code-input'
    });

    // 创建 pre 和 code 元素
    const pre = codeContainer.createEl('pre');
    const code = pre.createEl('code', {
        cls: 'language-python'
    });

    // 设置代码内容
    const sourceCode = cell.source.join('');
    code.setText(sourceCode);



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