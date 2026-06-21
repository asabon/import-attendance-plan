const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(command) {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'inherit'] }).trim();
  } catch (error) {
    // If command fails, exit the process (child stdout/stderr is already printed or handled)
    process.exit(1);
  }
}

// OS-specific npx command execution
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

console.log('===================================================');
console.log(' Starting Deployment Validation...');
console.log('===================================================');

// 1. Get the current git tag pointing to HEAD
let currentTag;
try {
  currentTag = run('git describe --tags --exact-match');
} catch (error) {
  console.error('\n❌ Error: Current commit is not tagged.');
  console.error('Please publish the release on GitHub first (which creates the vX.Y.Z tag) and run "git pull" before deploying.\n');
  process.exit(1);
}

console.log(`✓ Current commit is tagged with: ${currentTag}`);

// 2. Validate tag format (vX.Y.Z)
const tagMatch = currentTag.match(/^v(\d+\.\d+\.\d+)$/);
if (!tagMatch) {
  console.error(`\n❌ Error: Tag "${currentTag}" does not match the required release format (vX.Y.Z).\n`);
  process.exit(1);
}
const tagVersion = tagMatch[1];

// 3. Read version from Version.gs
const versionFile = path.join(__dirname, '..', 'src', 'Version.gs');
if (!fs.existsSync(versionFile)) {
  console.error(`\n❌ Error: Version.gs not found at ${versionFile}\n`);
  process.exit(1);
}

const versionContent = fs.readFileSync(versionFile, 'utf-8');
const versionMatch = versionContent.match(/IMPORT_ATTENDANCE_PLAN_VERSION\s*=\s*['"]([^'"]+)['"]/);
if (!versionMatch) {
  console.error('\n❌ Error: Could not find IMPORT_ATTENDANCE_PLAN_VERSION in Version.gs\n');
  process.exit(1);
}
const codeVersion = versionMatch[1];

// 4. Validate version match
if (tagVersion !== codeVersion) {
  console.error(`\n❌ Error: Version mismatch!`);
  console.error(`  - Git Tag version: ${tagVersion}`);
  console.error(`  - Version.gs version: ${codeVersion}\n`);
  process.exit(1);
}

console.log('✓ Version match validation passed.');

// 5. Check git working tree status
const gitStatus = run('git status --porcelain');
if (gitStatus.length > 0) {
  console.error('\n❌ Error: Git working directory is not clean.');
  console.error('Please commit or stash your changes before deploying.\n');
  process.exit(1);
}

console.log('✓ Git working directory is clean.');

// 6. clasp push --force
console.log('\n[1/3] Running clasp push...');
run(`${npxCmd} clasp push --force`);
console.log('✓ clasp push completed.');

// 7. clasp version
console.log('\n[2/3] Creating GAS version...');
const versionOutput = run(`${npxCmd} clasp version "v${codeVersion}"`);
console.log(versionOutput);

const gasVersionMatch = versionOutput.match(/Created version (\d+)/);
if (!gasVersionMatch) {
  console.error('\n❌ Error: Could not parse GAS version number from clasp output.\n');
  process.exit(1);
}
const gasVersionNumber = gasVersionMatch[1];

// 8. clasp deploy
console.log(`\n[3/3] Deploying version ${gasVersionNumber} to GAS...`);
const deployOutput = run(`${npxCmd} clasp deploy --versionNumber ${gasVersionNumber} --description "v${codeVersion}"`);
console.log(deployOutput);

console.log('\n===================================================');
console.log(' 🎉 Deployment Completed Successfully!');
console.log('===================================================');
