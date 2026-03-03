/**
 * Merges all CloudFormation YAML under a stack directory into a single template file.
 * Usage: ts-node scripts/mergeTemplate.ts <inDir> <outFile> <description> [--fix-transform]
 *   inDir       Stack directory (e.g. cloudformation/stacks/main)
 *   outFile     Output path (e.g. cloudformation/stacks/mergedMainTemplate.yaml)
 *   description Overwrites the merged template's Description (single line)
 *   --fix-transform  Apply SAM Transform/orphan fixes (use for main stack only)
 * Run from project root.
 */
import * as fs from 'fs';
import * as path from 'path';

const projectRoot = process.cwd();
const args = process.argv.slice(2);
const fixTransform = args.includes('--fix-transform');
const positional = args.filter((a) => a !== '--fix-transform');

const inDir = path.resolve(projectRoot, positional[0] ?? '');
const outFile = path.resolve(projectRoot, positional[1] ?? '');
const description = positional[2] ?? '';

if (!inDir || !outFile || !description) {
  console.error('Usage: mergeTemplate.ts <inDir> <outFile> <description> [--fix-transform]');
  process.exit(1);
}

const SAM_TRANSFORM = "'AWS::Serverless-2016-10-31'";

function fixTransformEmptyDescription(content: string): string {
  return content.replace(
    /^Transform:\nDescription:/m,
    `Transform:\n  - ${SAM_TRANSFORM}\nDescription:`
  );
}

function removeOrphanTransformItem(content: string): string {
  let s = content.replace(
    new RegExp(`\n  - ${SAM_TRANSFORM}\nParameters:`, 'g'),
    '\nParameters:'
  );
  s = s.replace(
    new RegExp(`\n  - ${SAM_TRANSFORM}\nGlobals:`, 'g'),
    '\nGlobals:'
  );
  return s;
}

function applyTransformFixes(content: string): string {
  return removeOrphanTransformItem(fixTransformEmptyDescription(content));
}

/** Replace the first Description: line in the template with the given description. */
function setDescription(content: string, newDescription: string): string {
  return content.replace(/^Description: .*$/m, `Description: ${newDescription}`);
}

function main(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const merger = require('cloudformation-yml-merger') as { default: (inputDir: string, outputFile: string) => void };
  merger.default(inDir, outFile);
  let content = fs.readFileSync(outFile, 'utf8');
  if (fixTransform) {
    content = applyTransformFixes(content);
  }
  content = setDescription(content, description);
  fs.writeFileSync(outFile, content);
}

main();
