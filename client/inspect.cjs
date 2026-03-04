const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    page.on('pageerror', exception => {
        console.log(`Uncaught exception: "${exception}"`);
    });

    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log(`Console Error: "${msg.text()}"`);
        }
    });

    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000); // give it time to crash

    await browser.close();
})();
