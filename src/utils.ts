import fs from 'node:fs';
import path from 'node:path';

export function readJsonFile<T>(filePath: string): T {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const raw = fs.readFileSync(absolutePath, 'utf8');

  return JSON.parse(raw) as T;
}

export function writeJsonFile(filePath: string, data: unknown): void {
  const absolutePath = path.resolve(process.cwd(), filePath);
  fs.writeFileSync(absolutePath, JSON.stringify(data, null, 2), 'utf8');
}

export function readTextFile(filePath: string): string {
  const absolutePath = path.resolve(process.cwd(), filePath);
  return fs.readFileSync(absolutePath, 'utf8');
}

export function writeTextFile(filePath: string, content: string): void {
  const absolutePath = path.resolve(process.cwd(), filePath);
  fs.writeFileSync(absolutePath, content, 'utf8');
}

export function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};

  for (let i = 2; i < argv.length; i += 1) {
    const current = argv[i];

    if (!current.startsWith('--')) {
      continue;
    }

    const key = current.slice(2);
    const next = argv[i + 1];

    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }

  return args;
}

export function normalizeText(value: unknown): string {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .trim();
}

export function countNonWhitespaceChars(value: string): number {
  return value.replace(/\s/g, '').length;
}

export function extractMarkdownSection(markdown: string, heading: string): string | null {
  const normalized = normalizeText(markdown);
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const regex = new RegExp(
    `^##\\s+${escapedHeading}\\s*\\n([\\s\\S]*?)(?=^##\\s+|\\n*$)`,
    'im'
  );

  const match = normalized.match(regex);

  if (!match) {
    return null;
  }

  return normalizeText(match[1]);
}

export function extractFirstMarkdownSection(
  markdown: string,
  headings: string[]
): string | null {
  for (const heading of headings) {
    const content = extractMarkdownSection(markdown, heading);

    if (content !== null) {
      return content;
    }
  }

  return null;
}

export function replaceManagedBlock(
  body: string,
  startMarker: string,
  endMarker: string,
  block: string
): string {
  const normalizedBody = normalizeText(body);
  const normalizedBlock = normalizeText(block);
  const escapedStart = startMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedEnd = endMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const managedBlockRegex = new RegExp(
    `\\n*${escapedStart}[\\s\\S]*?${escapedEnd}\\n*`,
    'm'
  );

  if (managedBlockRegex.test(normalizedBody)) {
    return normalizeText(normalizedBody.replace(managedBlockRegex, `\n\n${normalizedBlock}\n`));
  }

  if (!normalizedBody) {
    return normalizedBlock;
  }

  return `${normalizedBody}\n\n${normalizedBlock}`;
}

export function getBooleanEnv(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];

  if (value === undefined || value === '') {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export function makeCliError(message: string): Error {
  return new Error(`[Clarity Guardian] ${message}`);
}

export function getStringArg(
  args: Record<string, string | boolean>,
  key: string
): string | undefined {
  const value = args[key];

  if (typeof value !== 'string') {
    return undefined;
  }

  return value;
}
