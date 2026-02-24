import { readFile } from 'node:fs/promises';

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

function extractSingleValue(text, pattern, label) {
  const match = text.match(pattern);
  if (!match) {
    throw new Error(`Could not find ${label}.`);
  }

  return match[1];
}

function extractTopChangelogVersion(readmeText) {
  const lines = readmeText.split(/\r?\n/);
  const changelogIndex = lines.findIndex((line) => line.trim() === '== Changelog ==');
  if (changelogIndex === -1) {
    throw new Error('Could not find "== Changelog ==" section in readme.txt.');
  }

  for (let index = changelogIndex + 1; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (trimmed === '') {
      continue;
    }

    const match = trimmed.match(/^=\s*(\d+\.\d+\.\d+)\s*=$/);
    if (match) {
      return match[1];
    }

    if (/^==\s*[^=].*==$/.test(trimmed)) {
      break;
    }
  }

  throw new Error('Could not find top changelog version heading in readme.txt.');
}

async function loadVersions() {
  const [codelliaPhp, readme, packageJsonRaw] = await Promise.all([
    readFile('codellia.php', 'utf8'),
    readFile('readme.txt', 'utf8'),
    readFile('package.json', 'utf8'),
  ]);

  const packageJson = JSON.parse(packageJsonRaw);
  if (typeof packageJson.version !== 'string' || !VERSION_PATTERN.test(packageJson.version)) {
    throw new Error('package.json version is missing or not in x.y.z format.');
  }

  return {
    phpHeaderVersion: extractSingleValue(codelliaPhp, /^\s*\*\s+Version:\s*(\d+\.\d+\.\d+)\s*$/m, 'plugin header Version'),
    phpConstantVersion: extractSingleValue(
      codelliaPhp,
      /define\(\s*'CODELLIA_VERSION',\s*'(\d+\.\d+\.\d+)'\s*\);/,
      'CODELLIA_VERSION'
    ),
    stableTagVersion: extractSingleValue(readme, /^Stable tag:\s*(\d+\.\d+\.\d+)\s*$/m, 'Stable tag'),
    changelogVersion: extractTopChangelogVersion(readme),
    packageJsonVersion: packageJson.version,
  };
}

async function main() {
  const expectedVersion = process.argv[2];
  if (expectedVersion && !VERSION_PATTERN.test(expectedVersion)) {
    throw new Error('Expected version argument must be in x.y.z format.');
  }

  const versions = await loadVersions();
  const uniqueVersions = new Set(Object.values(versions));

  if (uniqueVersions.size !== 1) {
    const lines = Object.entries(versions).map(([key, value]) => `- ${key}: ${value}`);
    fail(`Version mismatch detected:\n${lines.join('\n')}`);
    return;
  }

  const currentVersion = Object.values(versions)[0];
  if (expectedVersion && currentVersion !== expectedVersion) {
    fail(`Version check failed: expected ${expectedVersion}, found ${currentVersion}.`);
    return;
  }

  process.stdout.write(`Version check passed: ${currentVersion}\n`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
