const path = require('path');
const fs = require('fs');

// Memory optimization settings
process.env.NODE_OPTIONS = '--max-old-space-size=1024';

// Force garbage collection if available
if (typeof global.gc === 'function') {
  try {
    global.gc();
  } catch (error) {
    console.warn('Unable to force garbage collection:', error.message);
  }
}

// Determine the correct path to the compiled main.js
const possiblePaths = [
  path.join(__dirname, 'dist', 'main.js'),
  path.join(__dirname, 'dist', 'src', 'main.js'),
  path.join(__dirname, 'src', 'dist', 'main.js'),
  path.join(process.cwd(), 'dist', 'main.js'),
  path.join(process.cwd(), 'dist', 'src', 'main.js')
];

let mainPath = null;

// Find the correct path
for (const testPath of possiblePaths) {
  if (fs.existsSync(testPath)) {
    mainPath = testPath;
    console.log(`Found main.js at: ${mainPath}`);
    break;
  }
}

if (!mainPath) {
  console.error('Error: Could not find compiled main.js file.');
  console.error('Searched in the following locations:');
  possiblePaths.forEach(p => console.error(`  - ${p}`));
  console.error('\nPlease ensure the application has been built with: npm run build');
  process.exit(1);
}

// Set memory limits and start the application
try {
  require(mainPath);
} catch (error) {
  console.error('Error starting the application:', error);
  process.exit(1);
}