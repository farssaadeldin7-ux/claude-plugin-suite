/**
 * VS Code extension entry for the __PLUGIN_NAME__ plugin.
 *
 * The extension is a thin shell: all it does is tell VS Code where this
 * plugin's MCP tool server lives, via the MCP server definition provider API
 * (VS Code 1.102+). The server has zero npm dependencies, so the bundled
 * mcp/ directory is all it needs.
 *
 * The server runs on the `node` from the user's PATH when one exists.
 * On a machine without Node.js, it falls back to the editor's own bundled
 * Node runtime (the Electron binary with ELECTRON_RUN_AS_NODE set) — the
 * extension must work for customers who are not Node developers, and
 * "spawn node ENOENT" is not an acceptable first experience.
 *
 * This file is generated from packages/vsix-template/extension.cjs by
 * scripts/build-vsix.mjs; edit the template, not the staged copy.
 */
const vscode = require('vscode');
const path = require('path');
const { spawnSync } = require('child_process');

function serverRuntime() {
  try {
    const probe = spawnSync('node', ['--version'], { timeout: 5000 });
    if (!probe.error && probe.status === 0) return { command: 'node', env: {} };
  } catch {
    // fall through to the bundled runtime
  }
  return { command: process.execPath, env: { ELECTRON_RUN_AS_NODE: '1' } };
}

function activate(context) {
  const provider = {
    provideMcpServerDefinitions() {
      const runtime = serverRuntime();
      return [
        new vscode.McpStdioServerDefinition(
          '__PLUGIN_NAME__',
          runtime.command,
          [context.asAbsolutePath(path.join('mcp', 'server.js'))],
          runtime.env,
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
