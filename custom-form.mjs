import {slotInstant} from './domain.mjs';
export function meetingAnswer(day,time,zone,duration,now=Date.now()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^\d{2}:\d{2}$/.test(time))throw Error('Choose a date and start time.');
 if(![15,30,45,60].includes(Number(duration)))throw Error('Choose a meeting length.');
 const start=slotInstant(day,time,zone);
 const wall=new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(start).replace(',','');
 if(wall!==day+' '+time)throw Error('That time is unavailable because the clocks change. Choose another time.');
 if(start.getTime()<=now)throw Error('Choose a time in the future.');
 return 'Start: '+start.toISOString()+'. End: '+new Date(start.getTime()+Number(duration)*60000).toISOString()+'. Entered as '+day+' at '+time+' in '+zone+'. Duration: '+duration+' minutes.';
}
if(typeof document!=='undefined'){
 if(new URLSearchParams(location.search).get('embed')==='1')document.body.classList.add('custom-embedded');
 const $=id=>document.getElementById(id),form=$('customMeetingForm'),date=$('meetingDate'),time=$('meetingTime'),zone=$('meetingZone');
 const localZone=Intl.DateTimeFormat().resolvedOptions().timeZone;
 if(![...zone.options].some(o=>o.value===localZone)){const option=document.createElement('option');option.value=localZone;option.textContent=localZone.replaceAll('_',' ');zone.append(option);}zone.value=localZone;
 const dayFormat=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}),next=new Date();next.setDate(next.getDate()+1);date.value=dayFormat.format(next);date.min=dayFormat.format(new Date());
 const duration=()=>form.querySelector('[name=duration]:checked').value;
 function render(){
  $('summaryTopic').textContent=$('meetingTopic').value.trim()||'A time to meet.';
  $('summaryDate').textContent=date.value?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',weekday:'short',timeZone:'UTC'}).format(new Date(date.value+'T12:00:00Z')):'Choose a date';
  $('summaryTime').textContent=time.value?new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZone:'UTC'}).format(new Date('2000-01-01T'+time.value+':00Z')):'Choose a time';
  $('summaryDuration').textContent=duration()+' minutes';$('summaryZone').textContent=zone.options[zone.selectedIndex].textContent;
  form.querySelectorAll('[data-time]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.time===time.value)));
 }
 form.addEventListener('input',render);form.addEventListener('change',render);
 $('timeChoices').addEventListener('click',event=>{const button=event.target.closest('button[data-time]');if(button){time.value=button.dataset.time;render();}});
 form.addEventListener('submit',event=>{
  $('customError').hidden=true;
  try{$('googleTime').value=meetingAnswer(date.value,time.value,zone.value,duration());}catch(error){event.preventDefault();$('customError').textContent=error.message;$('customError').hidden=false;return;}
  $('sendRequest').disabled=true;$('submissionPanel').hidden=false;form.hidden=true;$('submissionHeading').focus();$('submissionPanel').scrollIntoView({block:'start'});
 });
 $('googleSubmission').addEventListener('load',()=>{if(!$('submissionPanel').hidden){$('sendRequest').disabled=false;$('submissionStatus').textContent='Read Google Forms’ message below to confirm whether your response was accepted. Watch your inbox for the separate meeting confirmation.';}});
 $('editRequest').addEventListener('click',()=>{$('submissionPanel').hidden=true;form.hidden=false;$('sendRequest').disabled=false;$('meetingTopic').focus();});render();
}
