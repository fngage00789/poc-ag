const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';
  fs.writeFileSync('test.png', Buffer.from(base64Data, 'base64'));

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('request', request => {
    if (request.url().includes('typhoon-api')) {
      console.log('NETWORK REQUEST TO:', request.url());
    }
  });
  page.on('response', response => {
    if (response.url().includes('typhoon-api')) {
      console.log('NETWORK RESPONSE:', response.status());
    }
  });
  page.on('requestfailed', request => {
    if (request.url().includes('typhoon-api')) {
      console.log('NETWORK FAILED:', request.errorText());
    }
  });

  await page.goto('http://localhost:4200/ocr', { waitUntil: 'networkidle0' });
  await page.type('#apiKey', 'sk-F4E6zm64NCNbKh7c6gRjjDNNBd5NgfNrPU9TOIiQ8y2CCNCZ');

  const elementHandle = await page.$('input[type=file]');
  await elementHandle.uploadFile('test.png');

  await page.waitForFunction('!document.querySelector(".submit-btn").disabled', { timeout: 5000 });
  await page.click('.submit-btn');

  try {
    await page.waitForFunction('document.querySelector(".result-content pre") || document.querySelector(".error-message")', { timeout: 15000 });
    const resultText = await page.evaluate(() => {
      const result = document.querySelector('.result-content pre');
      if (result) return 'RESULT: ' + result.innerText;
      const err = document.querySelector('.error-message');
      if (err) return 'ERROR: ' + err.innerText;
      return 'NONE';
    });
    console.log(resultText);
  } catch (err) {
    console.log('Timed out waiting for result or error.');
  }

  await browser.close();
  fs.unlinkSync('test.png');
})();
