# Enable real Forms responses and Calendar events

The `live.html` organizer workspace uses Google Identity Services and the Google Forms and Calendar REST APIs directly. It works on GitHub Pages. The existing Apps Script form creator can continue creating forms; paste a created form's **editor** URL into this workspace to review its responses.

## One-time site owner setup

1. Open your project in [Google Cloud Console](https://console.cloud.google.com/). A project ID such as `gen-lang-client-0688283537` is not an OAuth client ID.
2. Enable **Google Forms API** and **Google Calendar API** in APIs & Services → Library.
3. Configure the Google Auth Platform consent screen (branding, audience, contact email). While the app is in Testing, add each organizer as a test user. For public use, complete any Google verification required for these scopes.
4. Create an OAuth client with application type **Web application**. Add `https://stingingend.github.io` as an authorized JavaScript origin (origin only, no repository path). For local testing, add `http://localhost:8000`. This popup token flow does not need a redirect URI or a client secret in the website.
5. Copy the client ID ending in `.apps.googleusercontent.com` into `GOOGLE_CLIENT_ID` in `google-config.mjs` and publish the change to GitHub Pages. The client ID is public configuration, not a password. Never publish a client secret. Until configured, `live.html` accepts a client ID for the current session only.

Requested scopes:

- `forms.body.readonly`: question labels and form metadata.
- `forms.responses.readonly`: responses the signed-in organizer can access.
- `calendar.calendarlist.readonly`: list calendars, filtered to calendars the organizer can write.
- `calendar.events`: create the chosen event and retrieve it when recovering a repeated request.

## Organizer workflow

1. Open **Responses & calendar** from CommonTime's home page or host workspace.
2. Connect Google and grant Forms and Calendar permissions using the form creator's account (or an authorized collaborator).
3. Paste the Google Forms editor address, `https://docs.google.com/forms/d/FORM_ID/edit`. Public `/d/e/.../viewform` links use a different identifier and cannot be used to fetch private responses.
4. Load responses. Review all answers, select the responses to schedule, and choose a writable calendar, event title, start, and end. Times use the device's displayed time zone; during a repeated daylight-saving hour, the earlier occurrence is used.
5. Optionally enable email invitations. This requires Google Forms' **Collect email addresses** setting; arbitrary text answers are not treated as verified invitation addresses. When this setting is off, an event can still be created without invitations.
6. Click **Review event**, check the calendar, time, and invitation recipients, then **Create Google Calendar event**. Responses alone never trigger an event.

## Privacy and behavior

Google enforces form and calendar access for the signed-in user. Merely possessing a public participant link does not grant response access. Access tokens and responses remain in browser memory and are cleared on disconnect or expiry; they are never saved in local storage, participant URLs, or the repository. Disconnect clears this session; organizers can revoke the app's authorization in their Google Account settings. Event descriptions do not contain form answers. Calendar event visibility follows the chosen calendar's defaults.

The workspace fetches all response/calendar pages and provides manual response refresh. It does not automatically find a common time or check existing calendar conflicts. The organizer reviews answers and chooses the time. An identical event request uses a stable Google event ID, so retrying after a timeout or refreshing the page does not create a duplicate. Changing event details or selected responses creates a different request. Deleted events are not automatically recreated.

Google authorization expires; reconnect when prompted. Google Workspace administrators may restrict API access. The legacy Form studio remains a demo and does not edit the real form or show these private responses.

## Validation

Run `node --test google-api.test.mjs` and `node static-pages.test.mjs`. Browser integration tests use mocked Google authorization/API responses; a live acceptance test still requires the configured OAuth client and an authorized organizer:

Create a test form, collect an email and availability response, load it, confirm the response is visible only to an authorized account, select a test calendar and time, confirm the event, and verify it in Google Calendar. Verify invitations only with consenting test recipients. Also verify account switching, expired consent, and form permission denial. Never use real participant responses as test fixtures.

References: [Google token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [retrieve form responses](https://developers.google.com/workspace/forms/api/guides/retrieve-forms-responses), [create calendar events](https://developers.google.com/workspace/calendar/api/guides/create-events).
