// Deploy for authorized store users. The messaging bridge serves this exact GitHub Pages origin.
const PAGES_ORIGIN = 'https://villamarketsuk33.github.io';
const STOCK_ENDPOINT = 'https://checkprice.villamarketjp.com/checkprice/index.aspx?br=1000';

function doGet(e) {
  const params = e && e.parameter || {};
  if (params.setup === '1') {
    return HtmlService.createHtmlOutput(`
      <!doctype html><html lang="th"><meta charset="utf-8"><title>เตรียมไฟล์ GitHub</title>
      <style>body{font:16px/1.6 system-ui,sans-serif;max-width:36em;padding:2em;margin:auto}a{color:#12449c}</style>
      <h2>เว็บสแกนสินค้า สุขุมวิท 33</h2>
      <p id="status">กำลังใส่ลิงก์ตัวเชื่อมลงในไฟล์…</p>
      <a id="download" hidden download="index.html">ดาวน์โหลด index.html สำหรับ GitHub</a>
      <script>
        google.script.run.withFailureHandler(function(err) {
          document.getElementById('status').textContent = err.message;
        }).withSuccessHandler(function(html) {
          const a = document.getElementById('download');
          a.href = URL.createObjectURL(new Blob([html], {type:'text/html;charset=utf-8'}));
          a.hidden = false;
          document.getElementById('status').textContent = 'นำไฟล์นี้ไปแทน index.html ใน GitHub Pages ของสาขา';
        }).getConfiguredGithubPage();
      </script></html>`).setTitle('เตรียมไฟล์สำหรับ GitHub');
  }
  if (params.view !== 'stock') {
    return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('ระบบตรวจสอบสินค้า · สุขุมวิท 33')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  if (!/^[0-9a-f-]{36}$/i.test(params.session || '')) {
    return HtmlService.createHtmlOutput('คำขอไม่ถูกต้อง');
  }
  // Only the read-only bridge is embeddable. Validate the caller before requesting any stock.
  const script = `
    const origin = ${JSON.stringify(PAGES_ORIGIN)};
    const session = ${JSON.stringify(params.session)};
    window.addEventListener('message', function(event) {
      const data = event.data;
      const port = event.ports[0];
      if (event.origin !== origin || event.source !== window.top || !port ||
          data?.kind !== 's33-stock-read' || data.session !== session) return;
      function answer(result) { port.postMessage(result); port.close(); }
      google.script.run
        .withSuccessHandler(function(html) { answer({html: html}); })
        .withFailureHandler(function(err) { answer({error: err.message || 'Check Price ไม่ตอบกลับ'}); })
        .fetchStockPage(data.barcode);
    });
    window.top.postMessage({kind:'s33-stock-ready', session:session}, origin);
  `;
  return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><script>' + script + '</script>')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function fetchStockPage(barcode) {
  if (typeof barcode !== 'string' || barcode === '-' || !/^[A-Za-z0-9._-]{1,64}$/.test(barcode)) {
    throw new Error('รูปแบบบาร์โค้ดไม่ถูกต้อง');
  }
  const response = UrlFetchApp.fetch(STOCK_ENDPOINT, {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: 'barcode=' + encodeURIComponent(barcode),
    followRedirects: false,
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) throw new Error('Check Price ตอบกลับ HTTP ' + response.getResponseCode());
  const html = response.getContentText('UTF-8');
  if (html.length > 262144) throw new Error('ผลลัพธ์ใหญ่เกินกว่าหน้าค้นหาสินค้าปกติ');
  return html;
}

function getConfiguredGithubPage() {
  const url = ScriptApp.getService().getUrl();
  if (!url || !/\/exec$/.test(url)) throw new Error('กรุณาเปิดจากลิงก์ที่ลงท้าย /exec?setup=1 ของ Deployment');
  const page = HtmlService.createTemplateFromFile('index').getRawContent();
  const marker = "const STOCK_WEB_APP_URL = '';";
  if (!page.includes(marker)) throw new Error('กรุณาใช้ index.html ต้นฉบับจาก ZIP ในโปรเจกต์ Apps Script');
  return page.replace(marker, () => 'const STOCK_WEB_APP_URL = ' + JSON.stringify(url) + ';');
}
