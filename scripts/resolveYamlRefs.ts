#!/usr/bin/env node
/**
 * Resolves $ref in a YAML file by inlining the contents of each referenced file.
 * Referenced paths are resolved relative to the directory of the input file.
 *
 * Usage: ts-node resolveYamlRefs.ts <inputFile> <outputFile>
 * Example: ts-node scripts/resolveYamlRefs.ts cloudformation/stacks/main/template.yaml cloudformation/stacks/main/template-merged.yaml
 */
import * as fs from 'fs';
import * as path from 'path';

const argv = process.argv.slice(2);
const inputFile = argv[0];
const outputFile = argv[1];

if (!inputFile || !outputFile) {
  console.error('Usage: ts-node resolveYamlRefs.ts <inputFile> <outputFile>');
  process.exit(1);
}

const inputPath = path.resolve(process.cwd(), inputFile);
const outputPath = path.resolve(process.cwd(), outputFile);
const inputDir = path.dirname(inputPath);

function indent(text: string, prefix: string): string {
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? prefix + line : line))
    .join('\n');
}

let content = fs.readFileSync(inputPath, 'utf8');

// Match "  KeyName:\n    $ref: path/to/file.yaml" (path may be quoted or unquoted)
const refRegex = /\n(  )([\w]+):\n    \$ref:\s*([^\n]+)/g;
content = content.replace(refRegex, (_match, indentTwo: string, keyName: string, refPath: string) => {
  const refPathTrimmed = refPath.trim().replace(/^['"]|['"]$/g, '');
  const resolvedPath = path.join(inputDir, refPathTrimmed);
  const refContent = fs.readFileSync(resolvedPath, 'utf8');
  const trimmed = refContent.replace(/\n$/, '');
  return `\n${indentTwo}${keyName}:\n${indent(trimmed, '    ')}`;
});

fs.writeFileSync(outputPath, content, 'utf8');
console.log('Wrote', outputPath);
