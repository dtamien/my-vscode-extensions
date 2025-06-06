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
exports.DocxGitContentProvider = void 0;
const vscode = __importStar(require("vscode"));
const docx_handler_1 = require("./docx_handler");
const odt_handler_1 = require("./odt_handler");
const path = __importStar(require("path"));
class DocxGitContentProvider {
    static schemes = ['git', 'gitlenses', 'gitlens'];
    _onDidChangeEmitter = new vscode.EventEmitter();
    onDidChange = this._onDidChangeEmitter.event;
    constructor() { }
    static register(context) {
        const provider = new DocxGitContentProvider();
        const disposables = [];
        // Register for common git-related URI schemes
        for (const scheme of this.schemes) {
            disposables.push(vscode.workspace.registerTextDocumentContentProvider(scheme, provider));
        }
        return disposables;
    }
    async provideTextDocumentContent(uri, token) {
        try {
            // Parse the git URI to get the actual file path
            const filePath = this.parseGitUri(uri);
            if (!filePath) {
                return null;
            }
            // Check if it's a docx or odt file
            const isDocx = filePath.toLowerCase().endsWith('.docx');
            const isOdt = filePath.toLowerCase().endsWith('.odt');
            if (!isDocx && !isOdt) {
                return null; // Let other providers handle non-docx files
            }
            // Get the file content from git
            const fileContent = await this.getGitFileContent(uri);
            if (!fileContent) {
                return `Cannot read ${path.basename(filePath)} from git history`;
            }
            // Create a temporary file to process the docx/odt content
            const tempPath = await this.createTempFile(fileContent, isDocx ? '.docx' : '.odt');
            try {
                let htmlContent;
                if (isDocx) {
                    htmlContent = await docx_handler_1.DocxHandler.renderDocx(tempPath);
                }
                else {
                    htmlContent = await odt_handler_1.OdtHandler.renderOdt(tempPath);
                }
                // Convert HTML to plain text for better diff viewing
                const plainText = this.htmlToPlainText(htmlContent);
                return this.formatContentForDiff(plainText, filePath, uri);
            }
            finally {
                // Clean up temporary file
                await this.cleanupTempFile(tempPath);
            }
        }
        catch (error) {
            console.error('Error providing git content for docx:', error);
            return `Error reading document: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
    parseGitUri(uri) {
        try {
            // Handle different git URI formats
            if (uri.scheme === 'git') {
                // VS Code git extension format: git:/c:/path/to/repo.git/file.docx?ref
                const match = uri.path.match(/^\/.*?\.git\/(.+)$/);
                return match ? match[1] : uri.path;
            }
            else if (uri.scheme === 'gitlens' || uri.scheme === 'gitlenses') {
                // GitLens format might be different
                return uri.path;
            }
            return uri.path;
        }
        catch (error) {
            console.error('Error parsing git URI:', error);
            return null;
        }
    }
    async getGitFileContent(uri) {
        try {
            // Use VS Code's built-in capability to read git content
            const document = await vscode.workspace.fs.readFile(uri);
            return Buffer.from(document);
        }
        catch (error) {
            console.error('Error reading git file content:', error);
            return null;
        }
    }
    async createTempFile(content, extension) {
        const os = require('os');
        const fs = require('fs').promises;
        const path = require('path');
        const tempDir = os.tmpdir();
        const tempFileName = `docx-viewer-temp-${Date.now()}${extension}`;
        const tempPath = path.join(tempDir, tempFileName);
        await fs.writeFile(tempPath, content);
        return tempPath;
    }
    async cleanupTempFile(tempPath) {
        try {
            const fs = require('fs').promises;
            await fs.unlink(tempPath);
        }
        catch (error) {
            // Ignore cleanup errors
            console.warn('Failed to cleanup temp file:', error);
        }
    }
    htmlToPlainText(html) {
        // Remove HTML tags and convert to plain text for better diff viewing
        let text = html
            .replace(/<style[^>]*>.*?<\/style>/gis, '') // Remove style tags
            .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove script tags
            .replace(/<[^>]+>/g, '') // Remove HTML tags
            .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
            .replace(/&lt;/g, '<') // Decode HTML entities
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
        // Add some structure back for better readability
        text = text
            .replace(/([.!?])\s+/g, '$1\n') // New line after sentences
            .replace(/(\n\s*){3,}/g, '\n\n'); // Limit consecutive newlines
        return text;
    }
    formatContentForDiff(content, filePath, uri) {
        const fileName = path.basename(filePath);
        const timestamp = new Date().toISOString();
        return `# Document: ${fileName}
# Source: ${uri.toString()}
# Extracted: ${timestamp}
# Note: This is a text representation of the document content for diff viewing
#       The actual formatting, images, and styles are not shown here.

${content}`;
    }
}
exports.DocxGitContentProvider = DocxGitContentProvider;
//# sourceMappingURL=git_content_provider.js.map