#!/usr/bin/env node
/**
 * Replaces $env-VAR_NAME placeholders in a file with the value of the matching
 * environment variable. Scans the input for any string that begins with "$env-"
 * and substitutes the rest as the env var name.
 *
 * Usage: ts-node resolveYamlEnvs.ts <inputFile> <outputFile>
 * Example: ts-node scripts/resolveYamlEnvs.ts openapi-docs/integrations/docs-file-s3.yaml openapi-docs/integrations/docs-file-resolved.yaml
 */
import * as fs from 'fs';
import * as path from 'path';

const argv = process.argv.slice(2);
const inputFile = argv[0];
const outputFile = argv[1];

if (!inputFile || !outputFile) {
  console.error('Usage: ts-node resolveYamlEnvs.ts <inputFile> <outputFile>');
  process.exit(1);
}

const inputPath = path.resolve(process.cwd(), inputFile);
const outputPath = path.resolve(process.cwd(), outputFile);

let content = fs.readFileSync(inputPath, 'utf8');

// Match $env-VAR_NAME (variable name: letters, digits, underscore)
const envPlaceholderRegex = /\$env-([A-Za-z0-9_]+)/g;
let hasMissingEnv = false;
content = content.replace(envPlaceholderRegex, (_match, varName: string) => {
  const value = process.env[varName];
  if (value === undefined) {
    console.error(`Error: environment variable ${varName} is not set (used in $env-${varName})`);
    hasMissingEnv = true;
    return '';
  }
  return value;
});
if (hasMissingEnv) {
  process.exit(1);
}

fs.writeFileSync(outputPath, content, 'utf8');
console.log('Wrote', outputPath);
