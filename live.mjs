import {GOOGLE_CLIENT_ID} from './google-config.mjs';
import {GoogleAPI, SCOPES, answerText, eventDraft} from './google-api.mjs';

const $ = id => document.getElementById(id);
const api = new GoogleAPI();
let loaded, draft, generation = 0, expiry;
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
$('timezone').textContent = `Times use this device’s time zone: ${zone}. During a repeated daylight-saving hour, the earlier occurrence is used.`;
$('setup').hidden = Boolean(GOOGLE_CLIENT_ID);
function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
function clearForm() {
  loaded = undefined; draft = undefined; $('responses').replaceChildren(); $('formTitle').textContent = '';
  $('responseCount').textContent = ''; $('schedule').hidden = true; $('result').replaceChildren(); $('review').close();
}
function disconnect() {
  generation++; clearTimeout(expiry); api.disconnect(); clearForm(); $('calendar').replaceChildren();
  $('workspace').disabled = true; $('disconnect').hidden = true; $('connect').disabled = false;
  $('connection').textContent = 'Not connected. Connect Google to load private responses.';
}
$('disconnect').addEventListener('click', disconnect);
$('connect').addEventListener('click', () => {
  disconnect();
  const clientId = GOOGLE_CLIENT_ID || $('clientId').value.trim();
  if (!/^[\w-]+\.apps\.googleusercontent\.com$/.test(clientId)) return status('Enter the Google OAuth web client ID from your site owner.', true);
  if (!globalThis.google?.accounts?.oauth2) return status('Google sign-in has not loaded. Check your connection and try again.', true);
  $('connect').disabled = true; const run = generation;
  const failed = message => { if (run === generation) { disconnect(); status(message, true); } };
  const client = google.accounts.oauth2.initTokenClient({client_id: clientId, scope: SCOPES.join(' '),
    error_callback: () => failed('Google sign-in was closed or blocked. Try connecting again.'),
    callback: async result => {
      if (run !== generation) return;
      try {
        api.authorize(result);
        const calendars = await api.calendars();
        if (run !== generation) return;
        if (!calendars.length) throw Error('This account has no writable calendars.');
        for (const c of calendars) { const option = document.createElement('option'); option.value = c.id; option.textContent = c.summary; $('calendar').append(option); }
        $('workspace').disabled = false; $('disconnect').hidden = false; $('connection').textContent = 'Google connected. Load a form you own or manage.';
        status('Connected. No event is created until you review and confirm it.');
        expiry = setTimeout(() => { disconnect(); status('Your Google session expired. Connect again to continue.', true); }, Math.max(0, api.expiresAt - Date.now()));
      } catch (error) { failed(error.message); }
    }});
  try { client.requestAccessToken({prompt: 'select_account'}); } catch (error) { failed(error.message); }
});
$('formInput').addEventListener('input', () => { generation++; clearForm(); });
$('loadForm').addEventListener('submit', async event => {
  event.preventDefault(); clearForm(); const run = ++generation; $('load').disabled = true;
  status('Loading responses from Google Forms…');
  try {
    const result = await api.form($('formInput').value);
    if (run !== generation) return;
    loaded = result; $('formTitle').textContent = result.form.info.title;
    $('title').value = result.form.info.title;
    $('responseCount').textContent = `${result.responses.length} response(s). Select the people to schedule.`;
    const titles = new Map();
    for (const item of result.form.items || []) {
      if (item.questionItem) titles.set(item.questionItem.question.questionId, item.title);
      for (const q of item.questionGroupItem?.questions || []) titles.set(q.questionId, `${item.title} — ${q.rowQuestion?.title || ''}`);
    }
    result.responses.forEach((response, index) => {
      const card = document.createElement('article'); card.className = 'response-card';
      const label = document.createElement('label'); label.className = 'check-label';
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = index; checkbox.name = 'respondent';
      label.append(checkbox, document.createTextNode(`${response.respondentEmail || 'Response '+(index+1)} · ${new Date(response.lastSubmittedTime || response.createTime).toLocaleString()}`));
      const answers = document.createElement('dl');
      for (const [id, answer] of Object.entries(response.answers || {})) {
        const question = document.createElement('dt'), value = document.createElement('dd');
        question.textContent = titles.get(id) || 'Question '+id; value.textContent = answerText(answer); answers.append(question, value);
      }
      card.append(label, answers); $('responses').append(card);
    });
    $('schedule').hidden = !result.responses.length;
    status(result.responses.length ? 'Responses loaded. Review availability and select participants.' : 'No responses yet. Refresh after participants submit the form.');
  } catch (error) { if (run === generation) status(error.message, true); }
  finally { $('load').disabled = false; }
});
$('eventForm').addEventListener('submit', event => {
  event.preventDefault();
  try {
    if (!loaded) throw Error('Load a form first.');
    draft = eventDraft({formId: loaded.form.formId, calendarId: $('calendar').value, title: $('title').value,
      start: $('start').value, end: $('end').value, invite: $('invite').checked,
      responses: [...document.querySelectorAll('[name=respondent]:checked')].map(input => loaded.responses[Number(input.value)])});
    $('reviewText').textContent = `${draft.event.summary}\nCalendar: ${$('calendar').selectedOptions[0].textContent}\nStart: ${new Date(draft.event.start.dateTime).toLocaleString()}\nEnd: ${new Date(draft.event.end.dateTime).toLocaleString()}\nTime zone: ${zone}\nSelected responses: ${draft.responseIds.length}`;
    $('reviewGuests').textContent = draft.invite ? 'Invitations will be sent to:\n'+draft.event.attendees.map(a => a.email).join('\n') : 'No invitations will be sent. The event will be added to your selected calendar.';
    $('reviewStatus').textContent = ''; $('review').showModal();
  } catch (error) { status(error.message, true); }
});
$('cancel').addEventListener('click', () => $('review').close());
let creating = false;
$('review').addEventListener('cancel', event => { if (creating) event.preventDefault(); });
$('confirm').addEventListener('click', async () => {
  if (!draft || creating) return;
  const run = generation; creating = true; $('confirm').disabled = $('cancel').disabled = true;
  $('reviewStatus').textContent = 'Creating your Google Calendar event…';
  try {
    const result = await api.createEvent(draft);
    if (run !== generation) return;
    $('review').close(); status('Event saved in Google Calendar.'); $('result').replaceChildren();
    const url = new URL(result.htmlLink || 'https://calendar.google.com/');
    if (url.protocol === 'https:' && ['www.google.com','calendar.google.com'].includes(url.hostname)) {
      const link = document.createElement('a'); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Open event in Google Calendar ↗'; $('result').append(link);
    }
  } catch (error) { if (run === generation) $('reviewStatus').textContent = error.message + ' You can retry this event safely; the same request will not create a second event.'; }
  finally { creating = false; $('confirm').disabled = $('cancel').disabled = false; }
});
