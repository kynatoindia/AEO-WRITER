const fs = require('fs');
const path = require('path');

const files = [
  'src/lib/inngest/functions.ts',
  'src/lib/inngest/project-initialization.ts'
];

files.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace the pattern: }, {\n      retries: RETRY_CONFIG[...].attempts,\n    });
  content = content.replace(/}, \{\s*\n\s*retries: RETRY_CONFIG\[[^\]]*\]\.attempts,\s*\n\s*\}\);/g, '});');
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed ${filePath}`);
});