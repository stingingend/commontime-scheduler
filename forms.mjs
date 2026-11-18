import {readParticipant,normalizeForm} from './domain.mjs';
import {pagesAPI} from './pages-api.mjs';
const $=id=>document.getElementById(id);
try{
 const pageId=location.pathname.startsWith('/forms/')?location.pathname.slice('/forms/'.length):new URLSearchParams(location.search).get('page');
 const meeting=pageId?await pagesAPI.get(pageId):{...readParticipant(location.search),purpose:(new URLSearchParams(location.search).get('purpose')||'').slice(0,500)},form=new URL(normalizeForm(meeting.formUrl));
 $('participantTitle').textContent=meeting.title||'Share your availability';
 document.title=(meeting.title?meeting.title+' · ':'')+'CommonTime';
 if(meeting.purpose)$('participantPurpose').textContent=meeting.purpose;
 if(pageId){document.querySelector('.participant-back').href='/organizer.html#pages';document.querySelector('.client-nav .brand').href='/organizer.html#pages';}
 $('participantDirect').href=form.href;$('participantFallback').href=form.href;
 form.searchParams.set('embedded','true');$('participantForm').src=form.href;
 if(form.pathname==='/forms/d/e/1FAIpQLSfA-UQvuJkVaTuOYdc2dbkIfKFV-M4NhJ0G9rBYmlIiLGnftg/viewform'){
  const section=$('availability'),tabs=document.createElement('div');
  tabs.className='participant-form-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Form style');
  tabs.innerHTML='<button type="button" role="tab" id="googleFormTab" aria-selected="true" aria-controls="googleFormPanel">Google Form</button><button type="button" role="tab" id="customFormTab" aria-selected="false" aria-controls="customFormPanel" tabindex="-1">Custom form</button>';
  const googlePanel=document.createElement('div');googlePanel.id='googleFormPanel';googlePanel.setAttribute('role','tabpanel');googlePanel.setAttribute('aria-labelledby','googleFormTab');
  while(section.children.length>1)googlePanel.append(section.children[1]);
  const customPanel=document.createElement('div');customPanel.id='customFormPanel';customPanel.hidden=true;customPanel.setAttribute('role','tabpanel');customPanel.setAttribute('aria-labelledby','customFormTab');
  const customFrame=document.createElement('iframe');customFrame.title='Custom meeting request form';customFrame.id='participantCustomForm';customPanel.append(customFrame);
  section.append(tabs,googlePanel,customPanel);
  const buttons=[...tabs.children];
  function select(index){
   buttons.forEach((button,i)=>{button.setAttribute('aria-selected',String(i===index));button.tabIndex=i===index?0:-1;});
   googlePanel.hidden=index!==0;customPanel.hidden=index!==1;
   section.querySelector('.participant-provider').textContent=index===0?'Google Forms':'CommonTime';
   if(index===1&&!customFrame.hasAttribute('src'))customFrame.src=new URL('custom-form.html?embed=1',import.meta.url).href;
  }
  buttons.forEach((button,i)=>button.addEventListener('click',()=>select(i)));
  tabs.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const current=buttons.indexOf(document.activeElement),index=event.key==='Home'?0:event.key==='End'?1:1-current;select(index);buttons[index].focus();});
 }
 $('participantContent').hidden=false;$('participantFaq').hidden=false;
}catch{
 $('participantError').hidden=false;
 $('participantErrorText').textContent='We couldn’t open this form. Ask the organizer to send you a new link.';
 $('participantForm').removeAttribute('src');
}
