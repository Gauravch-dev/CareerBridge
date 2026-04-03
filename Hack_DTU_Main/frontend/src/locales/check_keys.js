const fs = require('fs');
const en = JSON.parse(fs.readFileSync('en.json', 'utf-8'));

const codeKeys = fs.readFileSync('/tmp/code_keys_clean.txt', 'utf-8').trim().split('\n');

function hasKey(obj, keyPath) {
  const parts = keyPath.split('.');
  let current = obj;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null || !(part in current)) {
      return false;
    }
    current = current[part];
  }
  return true;
}

const missing = codeKeys.filter(key => !hasKey(en, key));

console.log(`Total keys in code: ${codeKeys.length}`);
console.log(`Missing from en.json: ${missing.length}`);
console.log('\nMissing keys:');
missing.forEach(key => console.log(key));
