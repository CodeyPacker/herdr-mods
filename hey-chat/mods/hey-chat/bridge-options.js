// One launch format for chats opened by people and by other chats.
export function bridgeArgs(o) {
  return ['serve', '--chat', o.chat, '--agent', o.agent, '--cwd', o.cwd, '--state', o.state,
    ...(o.session ? ['--resume', o.session] : []), ...(o.model ? ['--model', o.model] : []),
    ...(o.title ? ['--title', o.title] : []), '--links', 'true'];
}

// Provider-native connections use the same local MCP server and tools.
export const LINK_TOOL_NAMES = ['chat_create', 'chat_send', 'chat_read', 'chat_summary', 'chat_models'];

export function chatMcpServer({ node, script, port, state, chat, provider = 'claude', linked = true }) {
  return { command: node, args: [script, 'mcp', '--port', String(port), '--state', state, '--chat', chat,
    ...(linked ? ['--links', 'true'] : []), '--agent', provider] };
}
export function codexMcpArgs(server) {
  return ['-c', `mcp_servers.heychat.command=${JSON.stringify(server.command)}`,
    '-c', `mcp_servers.heychat.args=${JSON.stringify(server.args)}`,
    ...LINK_TOOL_NAMES.flatMap(name => ['-c', `mcp_servers.heychat.tools.${name}.approval_mode="approve"`])];
}
