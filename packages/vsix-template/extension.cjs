/**
 * VS Code extension entry for the __PLUGIN_NAME__ plugin.
 *
 * The extension is a thin shell: all it does is tell VS Code where this
 * plugin's MCP tool server lives, via the MCP server definition provider API
 * (VS Code 1.102+). VS Code spawns the bundled server over stdio with the
 * `node` on the user's PATH — the server has zero npm dependencies, so the
 * bundled mcp/ directory is all it needs.
 *
 * This file is generated from packages/vsix-template/extension.cjs by
 * scripts/build-vsix.mjs; edit the template, not the staged copy.
 */
const vscode = require('vscode');
const path = require('path');

function activate(context) {
  const provider = {
    provideMcpServerDefinitions() {
      return [
        new vscode.McpStdioServerDefinition(
          '__PLUGIN_NAME__',
          'node',
          [context.asAbsolutePath(path.join('mcp', 'server.js'))],
          {},
          '__VERSION__'
        ),
      ];
    },
  };
  context.subscriptions.push(
    vscode.lm.registerMcpServerDefinitionProvider('__PLUGIN_ID__.mcp-servers', provider)
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
