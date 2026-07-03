/**
 * @file get-errors.js
 * @description GAS Web App APIからスター付きの未処理エラーメール一覧を取得し、ローカルファイルに保存するNode.jsスクリプト。
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'config.local.json');
const logsDir = path.join(__dirname, '..', 'logs');

// 設定ファイルが存在しない場合はテンプレートを生成
if (!fs.existsSync(configPath)) {
  const template = {
    webAppUrl: "https://script.google.com/macros/s/XXXXX/exec",
    apiToken: "YOUR_SECRET_TOKEN"
  };
  fs.writeFileSync(configPath, JSON.stringify(template, null, 2), 'utf8');
  console.log(`[WARNING] 設定ファイルが見つからないため、新規作成しました: ${configPath}`);
  console.log('ファイルを開いて GAS の Web App URL と APIトークンを設定し、再度実行してください。');
  process.exit(1);
}

// 設定ファイルの読み込みと検証
let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  console.error(`[ERROR] config.local.json の読み込みに失敗しました: ${e.message}`);
  process.exit(1);
}

if (!config.webAppUrl || !config.apiToken || config.webAppUrl.includes('XXXXX')) {
  console.error('[ERROR] config.local.json に正しい webAppUrl と apiToken を設定してください。');
  process.exit(1);
}

// 保存先ディレクトリの作成
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * リダイレクト（302など）に追従してHTTP GETリクエストを行います。
 * 
 * @param {string} url - リクエスト対象のURL
 * @param {function} callback - コールバック関数 (error, data)
 */
function fetchUrl(url, callback) {
  console.log(`[DEBUG] 接続中: ${url.substring(0, 120)}...`);
  
  const req = https.get(url, (res) => {
    console.log(`[DEBUG] ステータス: ${res.statusCode}`);
    
    // 301, 302, 303, 307, 308 などのリダイレクトに対応
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      console.log(`[DEBUG] リダイレクト先: ${res.headers.location.substring(0, 120)}...`);
      fetchUrl(res.headers.location, callback);
      return;
    }

    if (res.statusCode !== 200) {
      callback(new Error(`HTTP ステータスコード: ${res.statusCode}`));
      return;
    }

    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => { 
      console.log(`[DEBUG] データ受信完了 (${rawData.length} バイト)`);
      callback(null, rawData); 
    });
  });

  // 15秒のタイムアウトを設定
  req.setTimeout(15000, () => {
    req.destroy();
    callback(new Error('接続タイムアウト（15秒経過）'));
  });

  req.on('error', (err) => {
    callback(err);
  });
}

// 認証パラメータ付きでリクエスト送信
const requestUrl = `${config.webAppUrl}?token=${encodeURIComponent(config.apiToken)}`;
console.log('GAS Web API からエラー情報を取得中...');

fetchUrl(requestUrl, (err, data) => {
  if (err) {
    console.error('[ERROR] APIからのデータ取得に失敗しました:', err.message);
    process.exit(1);
  }

  try {
    const responseJson = JSON.parse(data);
    
    if (responseJson.success === false) {
      console.error('[ERROR] API処理でエラーが発生しました:', responseJson.error || '不明なエラー');
      process.exit(1);
    }

    const destPath = path.join(logsDir, 'active_errors.json');
    fs.writeFileSync(destPath, JSON.stringify(responseJson, null, 2), 'utf8');

    console.log(`\n[SUCCESS] エラー情報を正常に取得・更新しました。`);
    console.log(`- 未対処エラー件数: ${responseJson.errors.length} 件`);
    console.log(`- ログ保存先: ${destPath}\n`);

    if (responseJson.errors.length > 0) {
      console.log('以下のエラーメールが検出されています:');
      responseJson.errors.forEach((err, idx) => {
        console.log(`  [${idx + 1}] 送信元: ${err.from} / 日時: ${err.date}`);
        console.log(`      エラー内容: ${err.errorMsg}`);
      });
    }
  } catch (parseErr) {
    console.error('[ERROR] レスポンスのパースに失敗しました。Web AppのURLが正しいか確認してください。');
    console.error('受信データ:', data);
    process.exit(1);
  }
});
