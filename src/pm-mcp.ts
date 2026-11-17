import { existsSync } from 'node:fs';
import path from 'node:path';
import { fromJsonSchema, McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createPmAgentTools, PM_AGENT_TOOLS } from './pm-agent-tools';
import { WORKSPACE_TOOLS, createWorkspaceTools } from './pm-workspace-tools';
import { getStringArg, makeCliError, parseArgs, readJsonFile } from './utils';

function main(): void {
  const args = parseArgs(process.argv);
  const demo = args.demo === true;
  const workspace = args.workspace === true || args.codex === true;
  const input = getStringArg(args, 'input');
  const baselinePath = getStringArg(args, 'baseline');

  if (Number(demo) + Number(workspace) + Number(Boolean(input)) !== 1 || (baselinePath && !input)) {
    throw makeCliError('Укажи --workspace, --demo или --input tasks.json [--baseline approved.json].');
  }

  const parentDir = path.dirname(__dirname);
  const projectDir = existsSync(path.join(parentDir, 'package.json')) ? parentDir : path.dirname(parentDir);
  const dataDir = path.join(projectDir, 'data');
  const snapshot = workspace ? undefined : readJsonFile(demo ? path.join(dataDir, 'demo-tasks.json') : input!);
  const baseline = demo
    ? readJsonFile(path.join(dataDir, 'demo-scope-baseline.json'))
    : baselinePath ? readJsonFile(baselinePath) : undefined;

  // Read user arguments from the launch directory and resolve bundled templates from the project.
  process.chdir(projectDir);
  const workspaceTools = workspace ? createWorkspaceTools(projectDir) : undefined;
  const tools = workspace ? undefined : createPmAgentTools(snapshot, baseline);

  serveStdio(() => {
    const server = new McpServer({ name: 'clarity-guardian-pm', version: '2.0.0' });

    for (const tool of workspace ? WORKSPACE_TOOLS : PM_AGENT_TOOLS) {
      const readOnly = tool.name !== 'save_drafts';
      server.registerTool(tool.name, {
        description: tool.description,
        inputSchema: fromJsonSchema(tool.parameters),
        annotations: { readOnlyHint: readOnly, destructiveHint: false, idempotentHint: readOnly, openWorldHint: false }
      }, (params) => {
        let data;

        try {
          if (workspaceTools) {
            data = workspaceTools.call(tool.name, params);
          } else {
            const result = tools!.call(tool.name, params);
            data = { ...result.data, taskRefs: result.refs };
          }
        } catch (error) {
          data = { error: error instanceof Error ? error.message : String(error) };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(data) }],
          structuredContent: data,
          isError: 'error' in data
        };
      });
    }

    return server;
  });
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
