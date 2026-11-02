// npm install --no-save playwright && npx playwright install chromium
// node --test live.browser.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {SCOPES} from './google-api.mjs';
const {chromium} = createRequire(import.meta.url)('playwright');

test('organizer reviews private responses before explicitly creating a real event', async () => {
  const server = createServer(async (req,res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (!/^\/[\w.-]+$/.test(path)) {res.writeHead(404).end();return;}
    try {const data=await readFile(new URL('.'+path,import.meta.url));res.setHeader('Content-Type',path.endsWith('.mjs')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');res.end(data);}
    catch {res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || undefined});
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('https://accounts.google.com/gsi/client', route=>route.fulfill({contentType:'text/javascript',body:`window.google={accounts:{oauth2:{initTokenClient:options=>({requestAccessToken:()=>options.callback(${JSON.stringify({access_token:'test-only',expires_in:3600,scope:SCOPES.join(' ')})})})}}};`}));
    let posts=0, saved;
    await page.route('https://www.googleapis.com/**', async route=>{
      const request=route.request();
      if(request.method()==='POST'){posts++;saved=request.postDataJSON();await route.fulfill({json:{...saved,htmlLink:'https://calendar.google.com/calendar/event?eid=test'}});}
      else await route.fulfill({json:{items:[{id:'test-calendar',summary:'Test calendar',accessRole:'owner'}]}});
    });
    let denied=false;
    await page.route('https://forms.googleapis.com/**',route=>{
      if(denied)return route.fulfill({status:403,json:{error:{message:'Forbidden'}}});
      return route.fulfill({json:route.request().url().includes('/responses')?{responses:[{responseId:'r1',respondentEmail:'test@example.com',createTime:'2026-11-01T12:00:00Z',answers:{q1:{textAnswers:{answers:[{value:'<img src=x onerror=alert(1)> Monday at 10'}]}}}}]}:{formId:'form1',info:{title:'Team catch-up'},items:[{title:'Availability',questionItem:{question:{questionId:'q1'}}}]}});
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/live.html`);
    await page.locator('#clientId').fill('123-test.apps.googleusercontent.com');
    await page.locator('#connect').click();
    await page.waitForFunction(()=>!document.getElementById('workspace').disabled,{},{timeout:5000}).catch(async error=>{throw Error((await page.locator('#status').innerText())+'; '+errors.join('; ')+'; '+error.message);});
    await page.locator('#formInput').fill('https://docs.google.com/forms/d/form1/edit');
    await page.locator('#load').click();
    await page.locator('.response-card').waitFor();
    assert.match(await page.locator('#responses').innerText(),/Monday at 10/);
    assert.equal(await page.locator('#responses img').count(),0);
    assert.equal(posts,0);
    await page.locator('[name=respondent]').check();
    await page.locator('#start').fill('2027-01-04T10:00');await page.locator('#end').fill('2027-01-04T10:30');
    await page.locator('#invite').check();
    await page.getByRole('button',{name:'Review event',exact:true}).click();
    assert.match(await page.locator('#reviewGuests').innerText(),/test@example.com/);
    assert.equal(posts,0);
    await page.locator('#cancel').click();assert.equal(posts,0);
    await page.getByRole('button',{name:'Review event',exact:true}).click();
    await page.locator('#confirm').click();
    await page.locator('#result a').waitFor();assert.equal(posts,1);
    assert.equal(saved.summary,'Team catch-up');assert.equal(saved.attendees[0].email,'test@example.com');assert.equal(saved.description,undefined);
    assert.equal(await page.evaluate(()=>Object.keys(localStorage).length),0);
    // A failed refresh must remove previously loaded private response data.
    denied=true;await page.locator('#load').click();
    await page.waitForFunction(()=>document.getElementById('status').textContent.includes('denied access'));
    assert.equal(await page.locator('.response-card').count(),0);
    assert.equal(await page.locator('#schedule').isVisible(),false);
    await page.locator('#disconnect').click();assert.equal(await page.locator('#formInput').isDisabled(),true);
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.deepEqual(errors,[]);
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
});
