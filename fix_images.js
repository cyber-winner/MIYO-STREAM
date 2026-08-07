const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.js') || file.endsWith('.jsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./src');
let count = 0;
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  // Match single or double quoted absolute paths for images
  let changed = false;
  let newContent = content.replace(/(['"])\/([a-zA-Z0-9_.-]+\.(?:gif|webp|png|jpg))\1/g, (match, quote, filename) => {
    changed = true;
    return '`${import.meta.env.BASE_URL}' + filename + '`';
  });
  if (changed) {
    fs.writeFileSync(f, newContent);
    console.log('Fixed:', f);
    count++;
  }
});
console.log('Done! Files modified:', count);
