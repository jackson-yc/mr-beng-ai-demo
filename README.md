# Mr Beng — interactive dealership concept

An English presentation prototype for a used-car dealership: a miniature 3D showroom, five selectable departments, scripted customer journeys, a workflow map and a presenter guide.

Mr Beng is the requested presentation name. The showroom, employees, inventory and business activity are illustrative, not representations of actual connected business systems. This is an original interpretation of a spatial AI-team concept, not a ChatsHero product or integration.

## Publication status

This repository contains the prepared public showcase. GitHub Pages activation requires separate approval; the repository alone is not a hosted interactive website. No custom domain or existing business website is changed.

## Run locally

With Python 3 installed, open a terminal in this repository and run:

```sh
python3 -m http.server 8796 --bind 127.0.0.1
```

Open `http://127.0.0.1:8796/`. Keep the server running during the presentation; Ctrl+C stops it. Do not double-click `index.html`: ES modules need an HTTP origin.

No build step, npm install, CDN, external fonts, API key or login is required. The vendored Three.js runtime includes its MIT license in `vendor/THREE-LICENSE.txt`. If WebGL is unavailable, the department controls and workflow remain usable.

## Presentation sequence

1. Select the five departments to explain their illustrative responsibilities.
2. Use **Next** to walk through enquiry, shortlist, finance-enquiry collection, human handoff, sample visit, follow-up draft and owner summary.
3. At the handoff, use **Simulate staff review** before continuing. This never approves finance.
4. Try **Customer leaves out their budget** to demonstrate the missing-information gate, and **Customer asks for a person** to demonstrate direct human handoff.
5. Open **How it works** for the workflow and **Presentation guide** for the talk track.
6. Use **Reset demo** to restart the selected scenario.

The 3D camera supports dragging, rotation, zoom and reset. Native department buttons are keyboard-accessible. The normal demo is event-driven, not continuously animated.

## Demo boundaries

- All people, vehicle models, inventory, prices, mileage, slots, messages and metrics are sample data. MYR values are illustrative, not quotations.
- Responses are scripted. There is no live AI, WhatsApp, lender, credit check, CRM, advertising account, stock feed or booking integration.
- No messages, applications, appointments or other business records are submitted.
- Finance is enquiry collection and human handoff, not an eligibility, approval or repayment promise. Stock, prices, appointment and finance details require authorized checks in a real service.
- The owner view reflects one simulation, not business-wide performance. A visit is not represented as a sale.
- Prototype state stays in browser memory and resets on reload. The application does not collect customer data or use browser storage.
- The repository and its included assets are public. This is not confidential or access-controlled hosting.
- A production pilot requires separate scope, privacy and consent controls, system access, human ownership and acceptance tests. Technical checks do not establish customer approval of the design.

## Included files

- `index.html`, `styles.css`, `app.mjs`: interactive presentation.
- `scene.mjs`, `vendor/`: procedural showroom and local rendering runtime.
- `flow.mjs`: deterministic simulation state machine.
- `tests/`: Node tests and browser journey checks; no saved local execution logs.
- `Mr-Beng-workflow.pdf`: one-page exported workflow.
- `previews/`: actual presentation screenshots and `Mr-Beng-AI-team-8s.mp4`.
- `motion-preview.html`, `motion-preview.mjs`: capture-only renderer; not imported or autoplayed by the normal demo.

The silent eight-second video uses scripted employee movement and Sales → Finance → Human handoff highlights. It is labelled simulated concept activity, not real AI processing. Open the MP4 directly to play it; the capture page is not an autoplay page.

## Verification

```sh
node --test tests/*.test.mjs
node --check app.mjs
node --check flow.mjs
node --check scene.mjs
```

For browser regression checks, evaluate `tests/browser-checks.js` in the running demo page and await `runDealerChecks()`. The checks operate only on simulated state.

For a GitHub Pages project site, preserve relative asset paths and verify the full journey under `/mr-beng-ai-demo/`, not only at a server root. The `.nojekyll` marker allows these static files to be served without Jekyll processing. There are no deployment workflows in this repository; pushing files does not enable Pages.
