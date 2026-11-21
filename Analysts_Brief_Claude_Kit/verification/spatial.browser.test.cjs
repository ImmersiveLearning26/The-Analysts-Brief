/* Continuation test: NOT successfully run in the editing environment.
   In web/: npm install --save-dev playwright && npx playwright install chromium
   Start npm run dev, then from kit root: node verification/spatial.browser.test.cjs */
const {createRequire}=require('node:module');
const path=require('node:path'), fs=require('node:fs'), assert=require('node:assert/strict');
const req=createRequire(path.resolve(__dirname,'../web/package.json'));
const {chromium}=req('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1366,height:768}}), errors=[];
 const out=path.join(__dirname,'spatial-browser');fs.mkdirSync(out,{recursive:true});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.BASE_URL||'http://127.0.0.1:5180/')+'?dev=1');
 await page.waitForFunction(()=>window.__ab,{},{timeout:60000});
 const action=(a,arg)=>page.locator(`[data-action="${a}"]${arg===undefined?'':`[data-arg="${arg}"]`}`).filter({visible:true}).first().click();
 await action('start'); await page.locator('#name').fill('Review Analyst');await page.locator('[data-form=identity] button').click();await action('declare');await action('go','P03');
 await page.waitForFunction(()=>__ab.world()?.inspector.state==='held');
 for(let i=0;i<18;i++){
  await action('tag',i<16?'foundations':'aside');
  if(i<17){await action('doc','1');await page.waitForFunction(i=>__ab.world().inspector.pageIdx===i,i+1);}
 }
 await page.screenshot({path:path.join(out,'P03-desktop.png')});
 await action('reviewSources');await action('commitEvidence');await page.locator('#factor').waitFor();
 assert.equal(await page.locator('#drawer').isVisible(),false,'case notes must not open automatically');
 await action('runModel');await page.locator('[data-action=compare]').waitFor();await action('go','P08');
 await action('finding','F2');await action('finding','F6');await page.locator('#why').fill('Army oversight and succession rules changed the outcome together.');await page.locator('[data-form=findings] button.primary').click();
 await page.locator('[data-action=hallDetails]').waitFor({timeout:60000});assert.equal(await page.locator('#drawer').isVisible(),false,'feedback must not interrupt the next task');await action('go','P10');
 for(const id of ['L1-2','L2-2','L3-3','L4-2','L5-1']){await action('choice',id);await action('lever','1');}
 await page.locator('#rationale').fill('Focused checks and consultation use the time available; some claims remain uncertain.');await action('runHall');await page.waitForFunction(()=>document.querySelector('.kicker')?.textContent==='After your test');await page.locator('[data-form=rationale] button.primary').click();
 await page.locator('[data-action=recordConsent]').waitFor();await action('go','P13');
 assert.equal(await page.locator('#stage .card').count(),0,'topic check only appears on request');
 await page.locator('#brief').fill('The inherited boundary and institutions matter. Army and succession rules mattered. I recommend consultation and oversight. Further evidence is needed.');await action('checkBrief');await page.locator('[data-form=brief] button.primary').click();await page.locator('.debrief-grid').waitFor();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('analysts-brief-prod-v1')));assert.deepEqual(saved.strands,['Strong','Strong','Strong']);
 await page.reload();await action('resume');await page.locator('.debrief-grid').waitFor();
 const overflow=[];
 for(const size of [{width:1366,height:768},{width:390,height:844}]){
  await page.setViewportSize(size);
  for(let i=0;i<15;i++){
   const id='P'+String(i).padStart(2,'0');await page.getByLabel('Developer state navigation').selectOption(id);
   await page.waitForFunction(id=>document.body.dataset.page===id&&!document.body.classList.contains('busy'),id);
   const bounds=await page.evaluate(()=>({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight,iw:innerWidth,ih:innerHeight}));
   if(bounds.w>bounds.iw||bounds.h>bounds.ih)overflow.push({id,size,...bounds});
   if([0,1,3,5,9,11,14].includes(i))await page.screenshot({path:path.join(out,`${id}-${size.width}.png`)});
  }
 }
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({normalFlow:true,resume:true,savedStrands:saved.strands,errors,overflow},null,2));
 await browser.close();assert.deepEqual(errors,[]);assert.deepEqual(overflow,[]);console.log('SPATIAL_BROWSER_CHECKS_PASSED');
})().catch(e=>{console.error(e);process.exit(1)});
