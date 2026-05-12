const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  // Save dummy image
  const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';
  fs.writeFileSync('test.png', Buffer.from(base64Data, 'base64'));

  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

  console.log('Navigating to http://localhost:4200/ocr');
  await page.goto('http://localhost:4200/ocr', { waitUntil: 'networkidle0' });

  console.log('Entering API key...');
  await page.type('#apiKey', 'sk-F4E6zm64NCNbKh7c6gRjjDNNBd5NgfNrPU9TOIiQ8y2CCNCZ');

  console.log('Uploading image...');
  const elementHandle = await page.$('input[type=file]');
  await elementHandle.uploadFile('test.png');

  console.log('Waiting for button to become enabled...');
  await page.waitForFunction('!document.querySelector(".submit-btn").disabled', { timeout: 5000 });

  console.log('Clicking Extract Text...');
  await page.click('.submit-btn');

  console.log('Waiting for result or error...');
  
  try {
    await page.waitForFunction('document.querySelector(".result-content pre") || document.querySelector(".error-message")', { timeout: 65000 });
    
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
