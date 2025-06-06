"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocxDiffEditorProvider = void 0;
const vscode = __importStar(require("vscode"));
const docx_handler_1 = require("./docx_handler");
const odt_handler_1 = require("./odt_handler");
const path = __importStar(require("path"));
class DocxDiffEditorProvider {
    _onDidChangeCustomDocument = new vscode.EventEmitter();
    onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;
    activeDiffPanels = new Map();
    currentZoom = 1.0;
    syncScrolling = true;
    async resolveCustomEditor(document, webviewPanel, _token) {
        const panelKey = document.uri.toString();
        this.activeDiffPanels.set(panelKey, webviewPanel);
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(path.dirname(__dirname))]
        };
        webviewPanel.webview.onDidReceiveMessage(message => this.handleWebviewMessage(message), undefined, []);
        webviewPanel.onDidDispose(() => {
            this.activeDiffPanels.delete(panelKey);
        });
        await this.renderSingleDocument(document.uri, webviewPanel);
    }
    async createDiffView(originalUri, modifiedUri) {
        try {
            const panel = vscode.window.createWebviewPanel('docxDiff', `Compare: ${path.basename(originalUri.fsPath)} ↔ ${path.basename(modifiedUri.fsPath)}`, vscode.ViewColumn.One, {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(path.dirname(__dirname))]
            });
            const panelKey = `${originalUri.toString()}_${modifiedUri.toString()}`;
            this.activeDiffPanels.set(panelKey, panel);
            panel.webview.onDidReceiveMessage(message => this.handleWebviewMessage(message), undefined, []);
            panel.onDidDispose(() => {
                this.activeDiffPanels.delete(panelKey);
            });
            await this.renderDiffContent(originalUri, modifiedUri, panel);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to create diff view: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async renderSingleDocument(uri, panel) {
        try {
            panel.webview.html = this.getLoadingHtml();
            const documentHtml = await this.convertDocumentToHtml(uri);
            const html = this.generateHtml(documentHtml, uri);
            panel.webview.html = html;
        }
        catch (error) {
            console.error('Error rendering document:', error);
            panel.webview.html = this.getErrorHtml('Document Rendering Error', error instanceof Error ? error.message : 'Unknown error occurred');
        }
    }
    async renderDiffContent(originalUri, modifiedUri, panel) {
        try {
            panel.webview.html = this.getLoadingHtml();
            const [originalHtml, modifiedHtml] = await Promise.all([
                this.convertDocumentToHtml(originalUri),
                this.convertDocumentToHtml(modifiedUri)
            ]);
            const diffHtml = this.generateDiffHtml(originalHtml, modifiedHtml, originalUri, modifiedUri);
            panel.webview.html = diffHtml;
        }
        catch (error) {
            console.error('Error rendering diff content:', error);
            panel.webview.html = this.getErrorHtml('Diff Rendering Error', error instanceof Error ? error.message : 'Unknown error occurred');
        }
    }
    async convertDocumentToHtml(uri) {
        const filePath = uri.fsPath;
        const fileExtension = path.extname(filePath).toLowerCase();
        try {
            let documentHtml;
            if (fileExtension === '.docx') {
                documentHtml = await docx_handler_1.DocxHandler.renderDocx(filePath);
            }
            else if (fileExtension === '.odt') {
                documentHtml = await odt_handler_1.OdtHandler.renderOdt(filePath);
            }
            else {
                throw new Error(`Unsupported file format: ${fileExtension}`);
            }
            return documentHtml;
        }
        catch (error) {
            console.error(`Error converting ${filePath}:`, error);
            throw new Error(`Failed to convert ${path.basename(filePath)}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    processDocumentHtml(html) {
        return html;
    }
    generateHtml(documentHtml, uri) {
        const config = vscode.workspace.getConfiguration('docxreader');
        const font = config.get('font', 'Arial');
        const theme = config.get('theme', 'auto');
        const fileName = path.basename(uri.fsPath);
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document Viewer</title>
    ${this.getInlineCSS()}
    <style>
        body { font-family: '${font}', sans-serif; }
    </style>
</head>
<body class="vscode-${theme}" data-theme="${theme}">
    <div class="document-container">
        <div class="document-header">
            <span class="file-icon">📄</span>
            <span class="file-name">${fileName}</span>
        </div>
        <div class="document-content">
            <div class="document-wrapper" style="transform: scale(${this.currentZoom});">
                ${this.processDocumentHtml(documentHtml)}
            </div>
        </div>
    </div>
</body>
</html>`;
    }
    generateDiffHtml(originalHtml, modifiedHtml, originalUri, modifiedUri) {
        const config = vscode.workspace.getConfiguration('docxreader');
        const font = config.get('font', 'Arial');
        const theme = config.get('theme', 'auto');
        const originalFileName = path.basename(originalUri.fsPath);
        const modifiedFileName = path.basename(modifiedUri.fsPath);
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document Comparison</title>
    ${this.getInlineCSS()}
    <style>
        body { font-family: '${font}', sans-serif; }
    </style>
</head>
<body class="vscode-${theme}" data-theme="${theme}">
    <div class="diff-container">
        <div class="diff-toolbar">
            <div class="diff-title">
                <span class="diff-icon">⚖️</span>
                <span>Document Comparison</span>
            </div>
            <div class="diff-controls">
                <button id="toggleSync" class="sync-btn ${this.syncScrolling ? 'active' : ''}" 
                        title="Toggle Synchronous Scrolling">
                    🔗 Sync Scroll
                </button>
                <button id="zoomOut" title="Zoom Out">🔍-</button>
                <span id="zoomLevel">${Math.round(this.currentZoom * 100)}%</span>
                <button id="zoomIn" title="Zoom In">🔍+</button>
                <button id="resetZoom" title="Reset Zoom">⚊</button>
            </div>
        </div>

        <div class="diff-headers">
            <div class="diff-header original">
                <span class="file-icon">📄</span>
                <span class="file-name" title="${originalUri.fsPath}">${originalFileName}</span>
                <span class="version-label">Original</span>
            </div>
            <div class="diff-header modified">
                <span class="file-icon">📄</span>
                <span class="file-name" title="${modifiedUri.fsPath}">${modifiedFileName}</span>
                <span class="version-label">Modified</span>
            </div>
        </div>

        <div class="diff-content">
            <div class="diff-pane original-pane" id="originalPane">
                <div class="document-wrapper" id="originalDoc" style="transform: scale(${this.currentZoom});">
                    ${this.processDocumentHtml(originalHtml)}
                </div>
            </div>
            <div class="diff-separator"></div>
            <div class="diff-pane modified-pane" id="modifiedPane">
                <div class="document-wrapper" id="modifiedDoc" style="transform: scale(${this.currentZoom});">
                    ${this.processDocumentHtml(modifiedHtml)}
                </div>
            </div>
        </div>
    </div>

    <script>
        ${this.getDiffViewerScript()}
    </script>
</body>
</html>`;
    }
    getDiffViewerScript() {
        return `
            const vscode = acquireVsCodeApi();
            let currentZoom = ${this.currentZoom};
            let syncScrolling = ${this.syncScrolling};
            
            const originalPane = document.getElementById('originalPane');
            const modifiedPane = document.getElementById('modifiedPane');
            const originalDoc = document.getElementById('originalDoc');
            const modifiedDoc = document.getElementById('modifiedDoc');
            
            document.getElementById('zoomIn').addEventListener('click', () => {
                if (currentZoom < 3.0) {
                    currentZoom = Math.min(3.0, currentZoom + 0.1);
                    updateZoom();
                    vscode.postMessage({
                        command: 'zoomChanged',
                        zoom: currentZoom
                    });
                }
            });
            
            document.getElementById('zoomOut').addEventListener('click', () => {
                if (currentZoom > 0.5) {
                    currentZoom = Math.max(0.5, currentZoom - 0.1);
                    updateZoom();
                    vscode.postMessage({
                        command: 'zoomChanged',
                        zoom: currentZoom
                    });
                }
            });
            
            document.getElementById('resetZoom').addEventListener('click', () => {
                currentZoom = 1.0;
                updateZoom();
                vscode.postMessage({
                    command: 'zoomChanged',
                    zoom: currentZoom
                });
            });
            
            function updateZoom() {
                const zoomPercent = Math.round(currentZoom * 100);
                document.getElementById('zoomLevel').textContent = zoomPercent + '%';
                if (originalDoc) originalDoc.style.transform = 'scale(' + currentZoom + ')';
                if (modifiedDoc) modifiedDoc.style.transform = 'scale(' + currentZoom + ')';
            }
            
            let isScrolling = false;
            
            function syncScroll(sourcePane, targetPane) {
                if (!syncScrolling || isScrolling || !sourcePane || !targetPane) return;
                
                isScrolling = true;
                const scrollRatio = sourcePane.scrollTop / (sourcePane.scrollHeight - sourcePane.clientHeight);
                const targetScrollTop = scrollRatio * (targetPane.scrollHeight - targetPane.clientHeight);
                targetPane.scrollTop = targetScrollTop;
                
                setTimeout(() => {
                    isScrolling = false;
                }, 50);
            }
            
            if (originalPane && modifiedPane) {
                originalPane.addEventListener('scroll', () => {
                    syncScroll(originalPane, modifiedPane);
                });
                
                modifiedPane.addEventListener('scroll', () => {
                    syncScroll(modifiedPane, originalPane);
                });
            }
            
            document.getElementById('toggleSync').addEventListener('click', () => {
                syncScrolling = !syncScrolling;
                const btn = document.getElementById('toggleSync');
                btn.classList.toggle('active', syncScrolling);
                
                vscode.postMessage({
                    command: 'syncScrollToggled',
                    enabled: syncScrolling
                });
            });
            
            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'updateZoom':
                        currentZoom = message.zoom;
                        updateZoom();
                        break;
                    case 'toggleSync':
                        syncScrolling = message.enabled;
                        document.getElementById('toggleSync').classList.toggle('active', syncScrolling);
                        break;
                }
            });
            
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey || e.metaKey) {
                    switch (e.key) {
                        case '+':
                        case '=':
                            e.preventDefault();
                            document.getElementById('zoomIn').click();
                            break;
                        case '-':
                            e.preventDefault();
                            document.getElementById('zoomOut').click();
                            break;
                        case '0':
                            e.preventDefault();
                            document.getElementById('resetZoom').click();
                            break;
                    }
                }
            });
        `;
    }
    async handleWebviewMessage(message) {
        switch (message.command) {
            case 'zoomChanged':
                if (message.zoom !== undefined) {
                    this.currentZoom = message.zoom;
                }
                break;
            case 'syncScrollToggled':
                if (message.enabled !== undefined) {
                    this.syncScrolling = message.enabled;
                }
                break;
            case 'error':
                if (message.message) {
                    vscode.window.showErrorMessage(`Diff Viewer Error: ${message.message}`);
                }
                break;
            case 'info':
                if (message.message) {
                    vscode.window.showInformationMessage(message.message);
                }
                break;
        }
    }
    saveCustomDocument(_document, _cancellation) {
        return Promise.resolve();
    }
    saveCustomDocumentAs(_document, _destination, _cancellation) {
        throw new Error('Save As not supported for diff viewer');
    }
    revertCustomDocument(_document, _cancellation) {
        return Promise.resolve();
    }
    backupCustomDocument(document, context, _cancellation) {
        return Promise.resolve({
            id: context.destination.toString(),
            delete: async () => { }
        });
    }
    openCustomDocument(uri, _openContext, _token) {
        return {
            uri,
            dispose: () => { }
        };
    }
    getLoadingHtml() {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            font-family: var(--vscode-font-family);
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .loading {
            text-align: center;
        }
        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid var(--vscode-progressBar-background);
            border-top: 4px solid var(--vscode-progressBar-foreground);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="loading">
        <div class="spinner"></div>
        <p>Loading document comparison...</p>
    </div>
</body>
</html>`;
    }
    getErrorHtml(title, message) {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            font-family: var(--vscode-font-family);
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .error {
            text-align: center;
            padding: 20px;
        }
        .error-icon {
            font-size: 48px;
            margin-bottom: 20px;
        }
        h2 {
            color: var(--vscode-errorForeground);
            margin: 0 0 10px 0;
        }
        p {
            margin: 0;
            opacity: 0.8;
        }
    </style>
</head>
<body>
    <div class="error">
        <div class="error-icon">⚠️</div>
        <h2>${title}</h2>
        <p>${message}</p>
    </div>
</body>
</html>`;
    }
    getInlineCSS() {
        return `<style>
        :root {
            --diff-bg: var(--vscode-editor-background, #1e1e1e);
            --diff-fg: var(--vscode-editor-foreground, #d4d4d4);
            --diff-border: var(--vscode-panel-border, #3c3c3c);
            --diff-hover: var(--vscode-list-hoverBackground, #2a2d2e);
            --diff-active: var(--vscode-list-activeSelectionBackground, #094771);
            --diff-radius: 4px;
            --diff-shadow: rgba(0, 0, 0, 0.3);
        }

        body {
            margin: 0;
            padding: 0;
            background: var(--diff-bg);
            color: var(--diff-fg);
            font-family: var(--vscode-font-family);
            overflow: hidden;
        }

        .diff-container {
            display: flex;
            flex-direction: column;
            height: 100vh;
        }

        .diff-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 16px;
            background: var(--diff-bg);
            border-bottom: 1px solid var(--diff-border);
            flex-shrink: 0;
        }

        .diff-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
            font-size: 14px;
        }

        .diff-controls {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .diff-controls button {
            background: transparent;
            border: 1px solid var(--diff-border);
            color: var(--diff-fg);
            padding: 4px 8px;
            border-radius: var(--diff-radius);
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s ease;
        }

        .diff-controls button:hover {
            background: var(--diff-hover);
        }

        .sync-btn.active {
            background: var(--diff-active);
            color: white;
        }

        .diff-headers {
            display: flex;
            flex-shrink: 0;
            border-bottom: 1px solid var(--diff-border);
        }

        .diff-header {
            flex: 1;
            padding: 12px 16px;
            display: flex;
            align-items: center;
            gap: 8px;
            background: var(--diff-bg);
            font-size: 13px;
        }

        .diff-header.original {
            border-right: 1px solid var(--diff-border);
        }

        .file-name {
            font-weight: 500;
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .version-label {
            padding: 2px 6px;
            background: var(--diff-hover);
            border-radius: var(--diff-radius);
            font-size: 11px;
            opacity: 0.8;
        }

        .diff-content {
            display: flex;
            flex: 1;
            overflow: hidden;
        }

        .diff-pane {
            flex: 1;
            overflow: auto;
            padding: 20px;
            background: var(--diff-bg);
        }

        .diff-pane.original-pane {
            border-right: 1px solid var(--diff-border);
        }

        .diff-separator {
            width: 1px;
            background: var(--diff-border);
            flex-shrink: 0;
        }

        .document-wrapper {
            max-width: 210mm;
            margin: 0 auto;
            background: var(--vscode-editor-background, white);
            border-radius: var(--diff-radius);
            padding: 40px;
            box-shadow: 0 2px 8px var(--diff-shadow);
            transform-origin: top center;
            transition: transform 0.2s ease;
            line-height: 1.6;
        }

        body.vscode-dark .document-wrapper {
            background: var(--vscode-editor-background, #2d2d30);
        }

        .document-wrapper h1,
        .document-wrapper h2,
        .document-wrapper h3,
        .document-wrapper h4,
        .document-wrapper h5,
        .document-wrapper h6 {
            margin: 1.5em 0 0.5em 0;
            line-height: 1.4;
        }

        .document-wrapper h1 { font-size: 2em; }
        .document-wrapper h2 { font-size: 1.7em; }
        .document-wrapper h3 { font-size: 1.4em; }
        .document-wrapper h4 { font-size: 1.2em; }
        .document-wrapper h5 { font-size: 1.1em; }
        .document-wrapper h6 { font-size: 1em; }

        .document-wrapper p {
            margin: 0.8em 0;
            text-align: justify;
        }

        .document-wrapper table {
            border-collapse: collapse;
            margin: 1em 0;
            width: 100%;
        }

        .document-wrapper table td,
        .document-wrapper table th {
            border: 1px solid var(--diff-border);
            padding: 8px 12px;
        }

        .document-wrapper table th {
            background: var(--diff-hover);
            font-weight: 600;
        }

        .document-wrapper img {
            max-width: 100%;
            height: auto;
            border-radius: var(--diff-radius);
            margin: 1em 0;
        }

        .diff-pane::-webkit-scrollbar {
            width: 12px;
        }

        .diff-pane::-webkit-scrollbar-track {
            background: var(--vscode-scrollbarSlider-background);
        }

        .diff-pane::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-background);
            border-radius: 6px;
        }

        .diff-pane::-webkit-scrollbar-thumb:hover {
            background: var(--vscode-scrollbarSlider-hoverBackground);
        }

        @media (max-width: 768px) {
            .diff-content {
                flex-direction: column;
            }
            
            .diff-headers {
                flex-direction: column;
            }
            
            .diff-header.original {
                border-right: none;
                border-bottom: 1px solid var(--diff-border);
            }
            
            .diff-pane.original-pane {
                border-right: none;
                border-bottom: 1px solid var(--diff-border);
            }
            
            .diff-separator {
                width: 100%;
                height: 1px;
            }
            
            .document-wrapper {
                padding: 20px;
            }
        }
        </style>`;
    }
}
exports.DocxDiffEditorProvider = DocxDiffEditorProvider;
//# sourceMappingURL=diff_handler.js.map