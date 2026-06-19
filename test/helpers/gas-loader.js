const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadGasFiles(context = {}) {
  const srcDir = path.resolve(__dirname, '../../src');
  const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.gs'));

  // Node.jsの標準的なグローバルオブジェクトをサンドボックスに引き継ぐ
  const sandbox = {
    ...context,
    console,
    Date,
    Object,
    Array,
    String,
    Number,
    RegExp,
    JSON,
    Error,
    TypeError,
  };

  vm.createContext(sandbox);

  for (const file of files) {
    const code = fs.readFileSync(path.join(srcDir, file), 'utf8');
    vm.runInContext(code, sandbox, { filename: file });
  }

  return sandbox;
}

module.exports = { loadGasFiles };
