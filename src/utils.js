'use strict';

/**
 * Общие функции Clarity Guardian.
 *
 * Файл специально не зависит от GitHub/GitLab/Jira.
 * Его можно использовать в любом CI, webhook-сервисе или Docker-обёртке.
 */

const fs = require('fs');
const path = require('path');

function readJsonFile(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const raw = fs.readFileSync(absolutePath, 'utf8');
  return JSON.parse(raw);
}

function writeJsonFile(filePath, data) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  fs.writeFileSync(absolutePath, JSON.stringify(data, null, 2), 'utf8');
}

function readTextFile(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  return fs.readFileSync(absolutePath, 'utf8');
}

function writeTextFile(filePath, content) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  fs.writeFileSync(absolutePath, content, 'utf8');
}

function parseArgs(argv) {
  const args = {};

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

function normalizeText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .trim();
}

function countNonWhitespaceChars(value) {
  return String(value || '').replace(/\s/g, '').length;
}

function extractMarkdownSection(markdown, heading) {
  const normalized = normalizeText(markdown);
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /**
   * Ищем заголовок вида:
   * ## Контекст
   *
   * Потом берём всё содержимое до следующего заголовка уровня ##.
   *
   * Важно:
   * Не используем `$` с multiline-режимом как конец всего текста,
   * потому что в JS `$` начинает матчиться на конец каждой строки.
   */
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

function makeCliError(message) {
  return new Error(`[Clarity Guardian] ${message}`);
}

module.exports = {
  readJsonFile,
  writeJsonFile,
  readTextFile,
  writeTextFile,
  parseArgs,
  normalizeText,
  countNonWhitespaceChars,
  extractMarkdownSection,
  makeCliError
};
