// Simple script to fix the server.js file by removing the duplicated isValidGroup method
const fs = require('fs');

// Read the server.js file
let serverContent = fs.readFileSync('server.js', 'utf8');

// Split the content into lines for easier manipulation
const lines = serverContent.split('\n');

// Find the problematic line where the method appears twice
let duplicateIndex = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === 'const tile1 = nonJokers[i];' &&
      lines[i+1].trim() === 'isValidGroup(tiles) {') {
    duplicateIndex = i + 1;
    break;
  }
}

// If found, remove the duplicate method until the end of the method
if (duplicateIndex !== -1) {
  // Find the end of the duplicate method (closing brace at same indentation level)
  let bracesCount = 1;
  let endIndex = duplicateIndex + 1;
  
  while (bracesCount > 0 && endIndex < lines.length) {
    const line = lines[endIndex];
    if (line.trim() === '}') {
      bracesCount--;
      if (bracesCount === 0) {
        // Found the end of the duplicate method
        break;
      }
    } else if (line.includes('{')) {
      bracesCount++;
    }
    endIndex++;
  }
  
  // Remove the duplicate method
  if (endIndex < lines.length) {
    lines.splice(duplicateIndex, endIndex - duplicateIndex + 1);
    
    // Write back the fixed content
    fs.writeFileSync('server.js', lines.join('\n'));
    console.log('Fixed server.js by removing duplicate isValidGroup method!');
  } else {
    console.log('Could not find the end of the duplicate method.');
  }
} else {
  console.log('Could not find the duplicate method.');
}
