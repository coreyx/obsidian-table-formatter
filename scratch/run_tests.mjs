// Runs every scratch/test_*.ts regression script with Node's built-in type
// stripping and exits non-zero if any of them fails. npm scripts can't rely on
// shell glob expansion on Windows, so the file list is gathered here.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const scripts = readdirSync(dir).filter((f) => /^test_.*\.ts$/.test(f)).sort();
let failed = 0;
for (const script of scripts) {
	console.log(`\n=== ${script}`);
	const result = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', join(dir, script)], { stdio: 'inherit' });
	if (result.status !== 0) failed++;
}
console.log(`\n${scripts.length - failed}/${scripts.length} test scripts passed`);
process.exit(failed ? 1 : 0);
