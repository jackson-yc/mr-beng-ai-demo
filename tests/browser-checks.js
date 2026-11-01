/* Browser regression checks. Evaluate runDealerChecks() on the local demo page. */
async function runDealerChecks(){
 const results=[];const q=s=>document.querySelector(s);const wait=()=>new Promise(r=>setTimeout(r,60));
 const check=(condition,label)=>{if(!condition)throw new Error(label);results.push(label);};
 const click=async s=>{const node=q(s);check(!!node,`control exists: ${s}`);node.click();await wait();};
 const step=()=>Number(document.body.dataset.step);
 const path=async value=>{q('#scenario').value=value;q('#scenario').dispatchEvent(new Event('change',{bubbles:true}));await wait();};
 await path('standard');check(step()===0,'standard starts at enquiry');
 await click('#next');check(step()===1,'vehicle shortlist');
 await click('#next');check(step()===2,'finance enquiry');
 await click('#next');check(step()===3,'staff handoff');
 await click('#next');check(step()===3&&q('#validation').textContent.includes('Staff review'),'review gate blocks next');
 await click('#review');await click('#next');check(step()===4,'review permits demo visit');
 await click('#next');check(step()===5,'follow-up draft');await click('#next');check(step()===6,'owner summary');
 check(q('#panel-body').textContent.includes('Not recorded'),'visit is not misrepresented as a purchase');
 await click('#next');check(step()===0,'replay resets journey');
 await path('missing');await click('#next');await click('#next');await click('#next');check(step()===2&&q('#validation').textContent.includes('Budget is missing'),'missing budget pauses journey');
 const financeFact=label=>[...document.querySelectorAll('#panel-body .fact-list div')].find(row=>row.querySelector('dt').textContent===label)?.querySelector('dd').textContent;
 await click('[data-role=finance]');
 check(financeFact('Deposit preference')==='Awaiting customer input','missing scenario does not fabricate deposit before customer input');
 check(financeFact('Preferred term')==='Awaiting customer input','missing scenario does not fabricate term before customer input');
 await click('#conversation-tab');await click('#provide-budget');
 await click('[data-role=finance]');
 check(financeFact('Deposit preference')==='MYR 8,000 · customer-stated','provided scenario shows customer-stated deposit');
 check(financeFact('Preferred term')==='Five years · to discuss','provided scenario shows customer-stated term');
 await click('#conversation-tab');await click('#next');check(step()===3,'provided budget permits handoff');
 await path('human');await click('#next');await click('#next');check(step()===3,'human request skips automated finance intake');
 await click('[data-role=finance]');check(q('#panel-body').textContent.includes('Not collected'),'human path does not fabricate finance preferences');
 await click('#conversation-tab');await click('#next');check(step()===3,'human path still requires staff review');
 await click('#review');await click('#next');check(step()===4,'human handoff supports demo visit');
 await click('#back');await click('#next');check(step()===3,'back does not bypass fresh review');
 await click('#reset');check(step()===0&&q('#validation').textContent==='','reset clears validation');
 for(const id of ['sales','finance','ads','owner','human']){await click(`[data-role=${id}]`);check(q(`[data-role=${id}]`).getAttribute('aria-pressed')==='true',`department ${id} selected`);}
 await click('.nav[data-view=workflow]');check(!q('#workflow').hidden&&q('#showroom').hidden,'workflow navigation');
 await click('.nav[data-view=presenter]');check(!q('#presenter').hidden,'presenter guide navigation');
 await click('[data-tour=missing]');check(step()===0&&document.body.dataset.path==='missing'&&!q('#showroom').hidden,'guide launches chosen scenario');
 await path('standard');
 check(document.documentElement.scrollWidth<=innerWidth,'no page horizontal overflow');
 check(document.body.textContent.includes('No live integrations'),'demo disclosure present');
 return {passed:results.length,checks:results};
}
