import { readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import ignore from 'ignore';
import AdmZip from 'adm-zip';

const ZIP_FILE = 'codellia.zip';
const DISTIGNORE_FILE = '.distignore';

async function loadDistignoreRules() {
  const raw = await readFile(DISTIGNORE_FILE, 'utf8');
  const rules = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));

  // Always avoid recursively embedding the output archive.
  rules.push(`/${ZIP_FILE}`);
  return rules;
}

function createMatcher(rules) {
  return ignore().add(rules);
}

function normalizeRelativePath(inputPath) {
  return inputPath.replace(/\\/g, '/');
}

function isIgnored(matcher, relativePath, isDirectory) {
  const normalized = normalizeRelativePath(relativePath);
  if (matcher.ignores(normalized)) {
    return true;
  }

  return isDirectory ? matcher.ignores(`${normalized}/`) : false;
}

async function collectFiles(matcher, relativeDir = '') {
  const absoluteDir = path.resolve(relativeDir || '.');
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    if (isIgnored(matcher, relativePath, entry.isDirectory())) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(matcher, relativePath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(normalizeRelativePath(relativePath));
    }
  }

  return files;
}

function buildZip(files, rootFolder, zipFilePath) {
  const zip = new AdmZip();

  for (const relativeFile of files) {
    const directory = path.posix.dirname(relativeFile);
    const zipDirectory = directory === '.' ? rootFolder : `${rootFolder}/${directory}`;
    zip.addLocalFile(path.resolve(relativeFile), zipDirectory);
  }

  zip.writeZip(zipFilePath);
}

async function resolveRootFolderName() {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  const packageName = typeof packageJson.name === 'string' ? packageJson.name.trim() : '';
  return packageName !== '' ? packageName : path.basename(process.cwd());
}

async function main() {
  const rules = await loadDistignoreRules();
  const matcher = createMatcher(rules);
  const files = await collectFiles(matcher);

  if (files.length === 0) {
    throw new Error('No files matched for archive. Check .distignore rules.');
  }

  const rootFolder = await resolveRootFolderName();
  await rm(ZIP_FILE, { force: true });
  buildZip(files, rootFolder, ZIP_FILE);

  process.stdout.write(`Created ${ZIP_FILE} from ${files.length} files using ${DISTIGNORE_FILE}.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
