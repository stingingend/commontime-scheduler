import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GoogleAPI, SCOPES, formIdFromInput, eventDraft, localInstant, answerText} from './google-api.mjs';

const token = {access_token:'test-only', expires_in:3600, scope:SCOPES.join(' ')};
const reply = (data, status=200) => ({ok:status < 400,status,json:async()=>data});
function apiWith(fetcher) { const api = new GoogleAPI(fetcher); api.authorize(token); return api; }
const input = {formId:'form1',calendarId:'team@example.com',title:'Planning',start:'2027-01-04T10:00',end:'2027-01-04T10:30',responses:[{responseId:'response1',respondentEmail:'guest@example.com'}],invite:false};

test('editor form IDs are accepted; public and hostile URLs are rejected', () => {
  assert.equal(formIdFromInput('https://docs.google.com/forms/d/abc_123/edit?usp=sharing'),'abc_123');
  assert.equal(formIdFromInput('abc_123'),'abc_123');
  for (const url of ['https://docs.google.com/forms/d/e/public/viewform','https://forms.gle/abc','https://evil.example/forms/d/abc/edit','https://user@docs.google.com/forms/d/abc/edit','http://docs.google.com/forms/d/abc/edit']) assert.throws(()=>formIdFromInput(url));
});
test('partial consent and expired/disconnected sessions cannot send API calls', async () => {
  let calls=0; const api=new GoogleAPI(async()=>{calls++;return reply({});});
  assert.throws(()=>api.authorize({...token,scope:SCOPES[0]}),/permissions/);
  await assert.rejects(api.calendars(),/expired/);
  api.authorize(token); api.expiresAt=Date.now()-1;
  await assert.rejects(api.calendars(),/expired/); assert.equal(calls,0);
});
test('response pagination and question metadata are retrieved with authorization', async () => {
  const calls=[]; const api=apiWith(async(url,options)=>{
    calls.push(url); assert.equal(options.headers.Authorization,'Bearer test-only');
    if (!url.includes('/responses')) return reply({formId:'form1',info:{title:'Planning'}});
    return reply(url.includes('pageToken=next')?{responses:[{responseId:'2'}]}:{responses:[{responseId:'1'}],nextPageToken:'next'});
  });
  const result=await api.form('form1'); assert.equal(result.form.formId,'form1'); assert.equal(result.responses.length,2); assert.equal(calls.length,3);
});
test('only writable calendars survive all calendar pages', async () => {
  const api=apiWith(async url=>reply(url.includes('pageToken=next')?{items:[{id:'b',accessRole:'writer'}]}:{items:[{id:'a',accessRole:'owner'},{id:'no',accessRole:'reader'}],nextPageToken:'next'}));
  assert.deepEqual((await api.calendars()).map(c=>c.id),['a','b']);
});
test('permission errors propagate and 401 clears the token', async () => {
  const api=apiWith(async()=>reply({error:{message:'denied'}},403)); await assert.rejects(api.form('private'),/denied access/);
  api.fetcher=async()=>reply({},401); await assert.rejects(api.form('private'),/expired/); assert.equal(api.token,'');
});
test('event drafts validate selection and times and never copy answers', () => {
  assert.throws(()=>eventDraft({...input,responses:[]}),/Select/);
  assert.throws(()=>eventDraft({...input,end:input.start}),/end/);
  assert.throws(()=>localInstant('2027-02-30T10:00'),/does not exist/);
  assert.throws(()=>eventDraft({...input,invite:true,responses:[{responseId:'1'}]}),/no collected email/);
  const draft=eventDraft({...input,responses:[{...input.responses[0],answers:{secret:'private'}}]});
  assert.equal(draft.event.attendees,undefined); assert.ok(!JSON.stringify(draft).includes('private'));
  assert.deepEqual(eventDraft({...input,invite:true}).event.attendees,[{email:'guest@example.com'}]);
});
test('identical events recover from 409; notifications require explicit invite choice', async () => {
  const calls=[]; let saved;
  const api=apiWith(async(url,options)=>{
    calls.push({url,options});
    if (options.method==='POST') {
      const body=JSON.parse(options.body);
      if (saved) { assert.equal(body.id,saved.id); return reply({},409); }
      saved=body; return reply(body);
    }
    return reply(saved);
  });
  const draft=eventDraft(input); const first=await api.createEvent(draft); const second=await api.createEvent(draft);
  assert.equal(first.id,second.id); assert.match(first.id,/^[0-9a-f]{64}$/);
  assert.match(calls[0].url,/sendUpdates=none/); assert.equal(calls.length,3);
  const invited=apiWith(async(url)=>{assert.match(url,/sendUpdates=all/);return reply({});}); await invited.createEvent(eventDraft({...input,invite:true}));
});
test('deleted events and unrelated conflicts are not reported as success', async () => {
  for (const result of [{status:'cancelled'}, {extendedProperties:{private:{commonTimeRequest:'other'}}}]) {
    const api=apiWith(async(url,options)=>options.method==='POST'?reply({},409):reply(result));
    await assert.rejects(api.createEvent(eventDraft(input)),/removed or changed/);
  }
});
test('network failures can be retried with the same ID', async () => {
  let id; let first=true;
  const api=apiWith(async(url,options)=>{const body=JSON.parse(options.body); if(first){first=false;id=body.id;throw Error('offline');} assert.equal(body.id,id);return reply(body);});
  await assert.rejects(api.createEvent(eventDraft(input)),/offline/);
  assert.equal((await api.createEvent(eventDraft(input))).id,id);
});
test('multi-select and file answers are presented as text', () => {
  assert.equal(answerText({textAnswers:{answers:[{value:'Monday'},{value:'Tuesday'}]}}),'Monday, Tuesday');
  assert.equal(answerText({fileUploadAnswers:{answers:[{fileName:'schedule.pdf'}]}}),'schedule.pdf');
});
