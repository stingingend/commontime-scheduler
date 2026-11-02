export const SCOPES = [
  'https://www.googleapis.com/auth/forms.body.readonly',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];

export function formIdFromInput(input) {
  const value = input.trim();
  if (/^[\w-]+$/.test(value)) return value;
  let url;
  try { url = new URL(value); } catch { throw Error('Enter the form’s editor URL or form ID.'); }
  const match = url.pathname.match(/^\/forms\/d\/([\w-]+)\/edit\/?$/);
  if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com' || url.port || url.username || url.password || !match)
    throw Error('Use the editor URL ending in /edit, not the published /viewform or forms.gle link.');
  return match[1];
}

export function answerText(answer) {
  if (answer.textAnswers) return answer.textAnswers.answers.map(a => a.value).join(', ');
  if (answer.fileUploadAnswers) return answer.fileUploadAnswers.answers.map(a => a.fileName).join(', ');
  return '(No answer)';
}

export function localInstant(value) {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value)) throw Error('Choose a valid date and time.');
  const date = new Date(value);
  const parts = value.split(/[-T:]/).map(Number);
  if (!Number.isFinite(date.getTime()) || [date.getFullYear(), date.getMonth()+1, date.getDate(), date.getHours(), date.getMinutes()].some((n,i) => n !== parts[i]))
    throw Error('This local time does not exist. Choose another time.');
  return date;
}

export function eventDraft({formId, calendarId, title, start, end, responses, invite}) {
  const from = localInstant(start), to = localInstant(end);
  if (!title.trim()) throw Error('Enter an event title.');
  if (to <= from) throw Error('The end must be after the start.');
  if (!responses.length) throw Error('Select at least one response to schedule.');
  const emails = [...new Set(responses.map(r => r.respondentEmail).filter(Boolean))].sort();
  if (invite && responses.some(r => !r.respondentEmail))
    throw Error('Some selected responses have no collected email. Turn off invitations or select responses with collected emails.');
  return {formId, calendarId, responseIds: responses.map(r => r.responseId).sort(), invite,
    event: {summary: title.trim(), start: {dateTime: from.toISOString()}, end: {dateTime: to.toISOString()},
      ...(invite ? {attendees: emails.map(email => ({email}))} : {})}};
}

export class GoogleAPI {
  constructor(fetcher = globalThis.fetch.bind(globalThis)) { this.fetcher = fetcher; this.disconnect(); }
  disconnect() { this.token = ''; this.expiresAt = 0; }
  authorize(result) {
    if (result.error || !result.access_token) throw Error(result.error_description || result.error || 'Google authorization failed.');
    const granted = new Set((result.scope || '').split(' '));
    if (SCOPES.some(s => !granted.has(s))) throw Error('Allow Forms and Calendar permissions to use this workspace.');
    this.token = result.access_token;
    this.expiresAt = Date.now() + Number(result.expires_in) * 1000 - 30000;
  }
  async request(url, options = {}) {
    if (!this.token || !(Date.now() < this.expiresAt)) { this.disconnect(); throw Error('Your Google session expired. Connect Google again.'); }
    const response = await this.fetcher(url, {...options, headers: {'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json'}});
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) this.disconnect();
      const error = Error(response.status === 401 ? 'Your Google session expired. Connect Google again.' : response.status === 403 ? 'Google denied access. Check your form permissions, consent scopes, and enabled APIs.' : data.error?.message || 'Google request failed.');
      error.status = response.status;
      throw error;
    }
    return data;
  }
  async list(url, key) {
    const items = []; let next;
    do {
      const page = new URL(url);
      if (next) page.searchParams.set('pageToken', next);
      const data = await this.request(page.href);
      items.push(...(data[key] || [])); next = data.nextPageToken;
    } while (next);
    return items;
  }
  async calendars() {
    return (await this.list('https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer', 'items'))
      .filter(c => ['owner','writer'].includes(c.accessRole));
  }
  async form(input) {
    const id = formIdFromInput(input);
    const base = `https://forms.googleapis.com/v1/forms/${encodeURIComponent(id)}`;
    const form = await this.request(base);
    const responses = await this.list(base + '/responses?pageSize=500', 'responses');
    return {form, responses};
  }
  async createEvent(draft) {
    // Stable ID makes retrying after a lost network response safe, including after reload.
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(draft)));
    const id = [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2,'0')).join('');
    const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(draft.calendarId)}/events`;
    try {
      return await this.request(base + '?sendUpdates=' + (draft.invite ? 'all' : 'none'), {
        method: 'POST', body: JSON.stringify({...draft.event, id, extendedProperties: {private: {commonTimeRequest: id}}}),
      });
    } catch (error) {
      if (error.status !== 409) throw error;
      const existing = await this.request(base + '/' + id);
      if (existing.status === 'cancelled' || existing.extendedProperties?.private?.commonTimeRequest !== id)
        throw Error('This event was removed or changed. Check Google Calendar before scheduling again.');
      return existing;
    }
  }
}
