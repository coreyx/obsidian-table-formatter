/**
 * Minimal pass/fail reporter shared by the scratch regression scripts.
 */

let passed = 0;
let failed = 0;

/**
 * Records one check, printing PASS or FAIL. On failure, prints the expected
 * and actual values so the diff is visible without a debugger.
 */
export function check(name: string, actual: unknown, expected: unknown): void {
	const ok = JSON.stringify(actual) === JSON.stringify(expected);
	if (ok) {
		passed++;
		console.log(`PASS ${name}`);
	} else {
		failed++;
		console.log(`FAIL ${name}`);
		console.log(`  expected: ${JSON.stringify(expected)}`);
		console.log(`  actual:   ${JSON.stringify(actual)}`);
	}
}

/**
 * Prints the totals and sets a non-zero exit code if anything failed.
 */
export function finish(): void {
	console.log(`${passed} passed, ${failed} failed`);
	if (failed) process.exitCode = 1;
}
