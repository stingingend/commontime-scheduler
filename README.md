# CommonTime website

Static site for GitHub Pages. The embedded Google Form and scheduling backend run on Google Forms and Apps Script. No responses or credentials are stored in this repository.

Enable Pages from the main branch, root directory. Open the published site to share meeting availability.

## Organizer and participant pages

Open `organizer.html#pages` or use **Host workspace** from the landing page. Create a form in the CommonTime Google Forms sidebar, then choose **Continue in CommonTime**. The handoff accepts `created_form`, `created_title`, and `created_purpose` on `organizer.html` and prepares a participant link. Existing published Google Forms can also be attached manually.

Participant URLs use `forms.html?form=...&title=...&purpose=...`, so they work on GitHub Pages without a Node server or shared page database. They contain only public display information and the respondent URL; never put private notes or credentials in those fields. Each Google Form receives responses directly. The saved host list is local to the organizer's browser, not an authenticated or synchronized account. Clearing browser storage removes that list but does not invalidate copied links.

The website's builder, responses dashboard, and calendar previews remain explicitly labeled sample data. Actual calendar scheduling runs in the separately authorized Apps Script project. Participants do not install an add-on. Existing form permissions still determine who can respond.

For the Google Forms creator, set Script Property `CTM_WEBSITE_URL` to `https://stingingend.github.io/commontime-scheduler/organizer.html` or use this URL as its default handoff. The Google Form source lives in `CSCI591USCAiken/CommonTime`, branch `KAN-13-prototypeB`, under `google-creator/`.

Run `node static-pages.test.mjs` to verify static participant links, separate forms, browser persistence, and validation. No credentials, runtime page databases, or participant responses are published.
