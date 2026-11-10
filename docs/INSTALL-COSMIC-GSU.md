# Install the Digital Twin on cosmic.gsu.edu

The recommended installation is a static, browser-only site at a dedicated
URL such as **https://cosmic.gsu.edu/digital-twin/**. That URL is a proposed
location, not an existing server configuration. A cosmic.gsu.edu administrator
must choose the actual directory, confirm permissions and provide the upload
method. This guide does not assume an SSH username, document root or web server.

No installation on cosmic.gsu.edu has been performed by adding this guide.

## What this installation provides

All seven visitor-facing pages, CAD models, particle simulation, scintillation
explanation, student experiment, electronics bench and saved network snapshot
run in the visitor's browser. The web host serves files only. It needs no Node
process, database, npm dependencies or detector connection at runtime.

Counts are simulated. The network page contains a dated snapshot. The detector
counts events/coincidences; it does not measure muon energy. An optional energy
loss estimate in the deeper explanation is a calculation with assumed inputs,
not a detector measurement.

## 1. Build on an administrator's workstation

Use Git and Node.js 22 (the version used by this repository's deployment
workflow). No `npm install` is needed.

```sh
git clone https://github.com/tharinduudu/digitalTwin.git
cd digitalTwin
node --test tests/*.test.mjs
GITHUB_SHA="$(git rev-parse HEAD)" node scripts/build-pages.mjs
```

For an existing checkout, first commit or otherwise preserve local work, then
update the intended branch with `git pull --ff-only` before testing/building.

The website is in `dist/`. **Upload the contents of `dist/`, not the repository
and not the unbuilt `public/` directory.** The build marks both root and
revision-directory pages as browser-only simulations. Copying `public/` alone
can make the detector page request the local `/api/events` endpoint.

The generated layout is:

```text
dist/
  index.html
  detector.html
  scintillation.html
  investigate.html
  assembly.html
  probe.html
  network.html
  .nojekyll
  <12-character-commit>/
    index.html
    ...other pages, JavaScript, CSS, vendor/, assets/...
```

Keep the revision directory and its internal paths intact. Root pages use a
relative `<base>` pointing to it. This supports hosting beneath a subdirectory
without changing JavaScript URLs. `.nojekyll` is needed for GitHub Pages only;
other static hosts may safely ignore it.

## 2. Preview the built site

Serve `dist/` over HTTP; do not open HTML with `file://`.

```sh
python3 -m http.server 8792 --bind 127.0.0.1 --directory dist
```

Visit **http://127.0.0.1:8792/** and open every navigation destination. The
Detector page must say **Simulation**, load the CAD and update counts. The
experiment must collect a run and export CSV. Test the tile angle slider,
assembly controls and electronics bench. Check the browser console for missing
assets or module/worker errors. Stop this preview with Ctrl+C when finished.

The development command `node server.mjs` serves `public/`, not `dist/`; use
the static preview above to check the actual hosting package.

## 3. Upload to the approved web directory

Ask the administrator to map a dedicated directory to the chosen HTTPS URL,
with `index.html` as its directory index. Leave the existing cosmic.gsu.edu
homepage and data portal intact. Do not upload into their root directories.

Using SFTP or the institution's file manager, upload the revision directory
first. After its upload completes, upload the seven root HTML files. Root HTML
is the entry point to the new revision, so this order avoids linking visitors
to assets that have not arrived yet.

If the administrator supplies an SSH upload destination, the equivalent
commands from the checkout are below. Replace the example destination with
the actual approved account, hostname and absolute path before running.
These commands are examples; they are not server credentials.

```sh
DEPLOY_TARGET='WEB_ACCOUNT@WEB_HOST:/ABSOLUTE/APPROVED/WEBROOT/digital-twin'
REVISION="$(git rev-parse --short=12 HEAD)"
rsync -av "dist/$REVISION/" "$DEPLOY_TARGET/$REVISION/"
rsync -av dist/*.html "$DEPLOY_TARGET/"
```

The destination must already exist and be writable by the deployment account.
The revision must match the `GITHUB_SHA` used for the build. The examples omit
`--delete` so updates retain old revision assets for open tabs and rollback.
For a high-traffic site, the administrator can stage each root HTML file under
a temporary name and rename it into place after upload, avoiding partial-file
reads. Keep source code and any server-side settings outside the public web
root; only the static build belongs here.

## 4. Web-host requirements

- Serve the chosen directory and its revision subdirectories through HTTPS.
- Serve `.html` as `text/html`, `.js` as a JavaScript MIME type such as
  `text/javascript`, `.css` as `text/css`, and `.json`/`.geojson` as JSON.
  Serve `.glb`, `.stl`, `.png`, `.jpg` and `.svg` files normally. ES modules and
  module workers must receive JavaScript rather than an HTML error page.
- Preserve file-name case. Ensure the deployment account creates files readable
  by the web server, using the institution's permissions policy.
- No SPA fallback, PHP handler, `/api/` route or reverse proxy is needed.
  Missing assets should return an actual 404 rather than the homepage.
- If the host uses a Content Security Policy, have the administrator permit
  this site's same-origin modules/assets, its inline import maps and
  same-origin module workers. Use the institution's approved nonce/hash policy
  for inline import maps; do not disable the existing policy globally.
- Root HTML should revalidate on updates (for example, `Cache-Control:
  no-cache`). Commit-named revision assets can have a longer cache lifetime.
  Do not rebuild different content under the same commit/revision name.

No Apache/Nginx configuration is prescribed because the server type and
available access have not been established. The administrator should implement
these requirements in the existing virtual host or directory configuration.

## 5. Verify on cosmic.gsu.edu

At the administrator-approved URL:

1. Confirm the large Digital Twin title, official logo and detector portrait.
2. Follow all seven navigation links, including Assembly before Electronics.
3. Confirm **Simulation** on Detector after navigating from another page;
   no local detector API connection should be attempted.
4. Collect a short simulated observation, change the angle, compare rates and
   download CSV. A simulated week is a calculation, not a week-long wait.
5. Verify scintillation stages and path length, assembly playback, PCB views,
   oscilloscope controls and globe records. The main tile exercise must not
   present a MeV value as measured data.
6. Check desktop and phone layouts and the browser console/network panel for
   asset failures, blocked workers, MIME errors or CSP violations.

Browser support requires JavaScript, ES modules, module workers and WebGL.
Performance depends on the device. Browser-tab storage holds comparisons; it is
not a server database and does not share student work between devices.

## Updates and rollback

Build a new tested commit with its own revision name, upload its revision
folder, then update the root HTML files. Keep a copy of the previous seven
root HTML files before replacing them. To roll back, restore those files;
they point to the retained earlier revision directory. Do not remove old
revision directories until the administrator's retention policy allows it.

Pushing to GitHub currently publishes **GitHub Pages only**. It does not upload
to cosmic.gsu.edu. Institutional hosting updates require the upload procedure
above unless the administrator separately configures a deployment pipeline.
Do not put deployment credentials in the repository or browser assets.

## Optional measured-count connection is a separate installation

Static hosting does not expose the local detector feed. The existing
`server.mjs` listens on `127.0.0.1:8791` and can read completed minute records
with the optional SSH detector source described in the README. It supplies
minute totals, not reconstructed particle trajectories, waveforms or energies.

A public measured-feed service would require a separately administered backend,
authorised network access to the detector, credential management and an
appropriate proxy/access policy. The current server also expects root-mounted
paths; putting it under `/digital-twin/` would require correct prefix handling
and an unbuffered SSE route. This guide does not configure or deploy that
service. Use the static simulation for the public installation unless the
institution explicitly approves and engineers a measured-feed deployment.
