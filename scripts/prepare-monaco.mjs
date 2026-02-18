import { access, copyFile, cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');

const monacoDir = path.join(rootDir, 'node_modules', 'monaco-editor');
const sourceVsDir = path.join(monacoDir, 'dev', 'vs');

const outputDir = path.join(rootDir, 'assets', 'monaco');
const outputVsDir = path.join(outputDir, 'vs');

async function fileExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function syncOptionalFile(sourcePath, destPath) {
  if (await fileExists(sourcePath)) {
    await copyFile(sourcePath, destPath);
  }
}

async function main() {
  if (!(await fileExists(sourceVsDir))) {
    throw new Error(
      'Monaco AMD assets were not found at node_modules/monaco-editor/dev/vs. Run "npm install" first.'
    );
  }

  await rm(outputVsDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await cp(sourceVsDir, outputVsDir, { recursive: true });

  await syncOptionalFile(path.join(monacoDir, 'LICENSE'), path.join(outputDir, 'LICENSE'));
  await syncOptionalFile(
    path.join(monacoDir, 'ThirdPartyNotices.txt'),
    path.join(outputDir, 'ThirdPartyNotices.txt')
  );

  process.stdout.write('Prepared Monaco assets in assets/monaco.\n');
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
