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
 $('participantContent').hidden=false;$('participantFaq').hidden=false;
}catch{
 $('participantError').hidden=false;
 $('participantErrorText').textContent='We couldn’t open this form. Ask the organizer to send you a new link.';
 $('participantForm').removeAttribute('src');
}
