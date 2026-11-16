import { existsSync } from 'node:fs';
import path from 'node:path';
import { fromJsonSchema, McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createPmAgentTools, PM_AGENT_TOOLS } from './pm-agent-tools';
import { getStringArg, makeCliError, parseArgs, readJsonFile } from './utils';

function main(): void {
  const args = parseArgs(process.argv);
  const demo = args.demo === true;
  const input = getStringArg(args, 'input');
  const baselinePath = getStringArg(args, 'baseline');

  if (demo ? Boolean(input || baselinePath) : !input) {
    throw makeCliError('Укажи --demo или --input tasks.json [--baseline approved.json].');
  }

  const parentDir = path.dirname(__dirname);
  const projectDir = existsSync(path.join(parentDir, 'package.json')) ? parentDir : path.dirname(parentDir);
  const dataDir = path.join(projectDir, 'data');
  const snapshot = readJsonFile(demo ? path.join(dataDir, 'demo-tasks.json') : input!);
  const baseline = demo
    ? readJsonFile(path.join(dataDir, 'demo-scope-baseline.json'))
    : baselinePath ? readJsonFile(baselinePath) : undefined;

  // Read user arguments from the launch directory and resolve bundled templates from the project.
  process.chdir(projectDir);
  const tools = createPmAgentTools(snapshot, baseline);

  serveStdio(() => {
    const server = new McpServer({ name: 'clarity-guardian-pm', version: '2.0.0' });

    for (const tool of PM_AGENT_TOOLS) {
      server.registerTool(tool.name, {
        description: tool.description,
        inputSchema: fromJsonSchema(tool.parameters),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
      }, (params) => {
        const result = tools.call(tool.name, params);
        const data = { ...result.data, taskRefs: result.refs };

        return {
          content: [{ type: 'text', text: JSON.stringify(data) }],
          structuredContent: data,
          isError: 'error' in result.data
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
