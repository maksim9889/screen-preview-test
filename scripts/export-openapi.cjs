/**
 * Export OpenAPI Specification to Public Folder
 *
 * This script exports the OpenAPI spec as a static JSON file
 * that can be accessed at /openapi.json
 */

const fs = require('fs');
const path = require('path');

// This is a workaround since we can't easily import TS files in Node
// We'll generate the spec by reading the TypeScript file
const specFilePath = path.join(__dirname, '..', 'app', 'lib', 'openapi-spec.ts');
const specContent = fs.readFileSync(specFilePath, 'utf8');

// Extract the spec object (hacky but works)
const specMatch = specContent.match(/export const openApiSpec = ({[\s\S]*}) as const;/);

if (!specMatch) {
  console.error('❌ Could not find openApiSpec export in openapi-spec.ts');
  process.exit(1);
}

// Evaluate the spec (Note: This is not secure for untrusted code)
let openApiSpec;
try {
  openApiSpec = eval(`(${specMatch[1]})`);
} catch (error) {
  console.error('❌ Failed to parse OpenAPI spec:', error.message);
  process.exit(1);
}

// Create public directory if it doesn't exist
const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
  console.log('📁 Created public/ directory');
}

// Write spec to public/openapi.json
const outputPath = path.join(publicDir, 'openapi.json');
fs.writeFileSync(outputPath, JSON.stringify(openApiSpec, null, 2));

console.log('✅ OpenAPI spec exported to public/openapi.json');
console.log(`📊 Spec version: ${openApiSpec.info.version}`);
console.log(`📝 ${Object.keys(openApiSpec.paths).length} endpoints documented`);
console.log('');
console.log('Access at: http://localhost:5174/openapi.json');
