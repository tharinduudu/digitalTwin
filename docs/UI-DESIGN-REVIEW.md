# UI and learning design review — 10 November 2026

## Aim and limits

Help a first-time visitor understand the instrument, take a useful action and
choose to explore another layer. A long visit can mean curiosity or confusion;
raw dwell time is not a sufficient success measure. No claim of increased
visitor retention is established by this redesign. No visitor analytics,
external services or personal-data collection were added.

This is a detailed heuristic review informed by published research and design
systems, not a psychological assessment of individual users. Learning-memory
retention in an educational study is different from visitors returning to a
website. Evidence in other contexts motivates design hypotheses here; it does
not supply a measured conversion or retention lift for this site.

## Evidence and interpretation

- **Apple HIG, Color**: consistent colour roles and hierarchy. Used for a small
  shared palette across HTML, canvas and the source CAD stage, rather than a
  dark visual island. This is interface guidance, not a universal emotional
  meaning assigned to green. https://developer.apple.com/design/human-interface-guidelines/color
- **NN/g, Proximity (2020)**: spatial grouping communicates relationships. The
  model and parameter controls share one workspace; preview buttons sit under
  the preview; collection controls are a separate group.
  https://www.nngroup.com/articles/gestalt-proximity/
- **NN/g, Recognition and Recall (2024)**: visible cues reduce memory demands.
  Numeric-only stages now also name the topic; presets show their selected
  state. https://www.nngroup.com/articles/recognition-and-recall/
- **NN/g, Progressive Disclosure (2006)**: secondary controls can be deferred.
  Numerical precision is expandable; provenance and limitations remain
  accessible without occupying the whole initial task surface.
  https://www.nngroup.com/articles/progressive-disclosure/
- **GOV.UK Design System, Button**: descriptive action text and a clear main
  action. Collection is visually primary; reset, pause and export remain
  secondary. https://design-system.service.gov.uk/components/button/
- **NN/g, Response Time Limits (1993)**: feedback matters when calculations
  interrupt interaction. Source sampling uses a worker with real progress and
  cancellation; CAD loading has an explicit state. Thresholds are heuristics,
  not a measured performance benchmark of this application.
  https://www.nngroup.com/articles/response-times-3-important-limits/
- **Schneider et al. (2018), Educational Research Review 23, 1–24**: a meta-analysis
  of 103 studies, N=12,201, reported benefits of instructional signaling for
  memory retention and transfer. This supports testing consistent labels and
  visual/text correspondence. It does not prove a benefit for this interface
  or predict repeat visits. https://doi.org/10.1016/j.edurev.2017.11.001
- **PhET research**: simulation affordances and implicit scaffolding support
  exploratory learning; excessive explicit guidance can reduce exploration in
  some studied settings. The suggested comparison is optional, and users keep
  direct control of angle, bearing and duration. No forced tutorial or answer
  gate was introduced. https://phet.colorado.edu/publications/prst-per-2010.pdf
  and https://phet.colorado.edu/publications/Paulson_etal_2009/Paulson_etal_2009.pdf
- **WCAG contrast guidance**: readable text and discernible controls, not low
  contrast everywhere. Key specified colour pairs were calculated; this is
  not a claim of a complete WCAG audit. https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html

## Detail-by-detail decisions

| Detail | Likely usability issue | Decision / hypothesis to test |
| --- | --- | --- |
| First screen | A technical dashboard can overwhelm new visitors | One subject, actual detector CAD, short plain-language promise |
| First action | Similar buttons compete | Follow a muon is the introduction's main action |
| Header | Repeated long technical destinations increase scanning | Short familiar links; deeper routes remain reachable |
| Page heading | Oversized experiment title displaces the instrument | Compact single heading, task-focused supporting sentence |
| Surface palette | Dark canvas appears to be another product | Warm paper, sage-grey stage, continuous workspace border |
| Primary accent | Decorative colour competes with interactions | Deep green reserved for actionable/selected states |
| Physics colour | Model markers need meaning | Labelled blue light, green fibre, amber muon; not colour alone |
| Source CAD materials | A CSS filter would obscure real components | Shared physical studio lighting; no geometry scaling or image filters |
| Metal legibility | Soft lighting can wash out edges | Controlled environment exposure and retained geometry/edge definition |
| Canvas labels | Tiny or occluded labels demand visual effort | Larger readable labels rendered after the transparent tile |
| Type hierarchy | Equal text density conceals the next task | Clear heading/body/caption roles and limited text measure |
| Muted text | Pale green on pale green becomes unreadable | Calculated key text contrasts, roughly 4.9:1 or better |
| Buttons | Ambiguous symbols require recall | Verbs for actions; visible pressed state for presets |
| Range sliders | Precision without context is confusing | Named parameter, units and current value adjacent |
| Preset angles | A blank starting point raises effort | Recognizable 0/30/60/90 presets without restricting exploration |
| Compass directions | Colour or arrow direction can be misread | Named N/E/S/W options plus numeric bearing |
| Preview controls | Pause can be mistaken for stopping an observation | Preview controls directly under the 3D view; calculation has its own cancel |
| Exposure | Named months imply calendar dates | Exact day counts remain in every option and result |
| Default exposure | Too many initial decisions | One week ready to run; longer exposures still available |
| Precision | Numerical sample count is an advanced concept | Expandable control with its effect explained |
| Loading | Blank area looks broken | Explicit CAD loading and failure text, without fake percentages |
| Worker delay | No response creates uncertainty | Actual progress, current state and cancellation |
| Results | Large totals alone obscure the finding | Normalized-rate summary beside preserved detailed rows |
| Comparing runs | Duration changes can lead to false conclusions | Suggested comparison keeps exposure and bearing fixed |
| End of guided tour | Restart-only is a dead end | Optional onward link into the tile lesson |
| Scintillation stages | Numbers alone lack information scent | Named steps; controls near the changing visual |
| Playback | Independent animations can contradict pause | Process state drives tile light and the molecular explanation |
| Scientific detail | Fine print everywhere discourages initial exploration | Short local model notes plus expandable full explanations |
| Saved place | Returning means redoing the same work | Guide position and experiment rows retained in this browser tab |
| Duplicate invitations | Repeating equal CTAs adds noise | Removed repeated two-button block at the end of the landing page |
| Completion | Reward language can imply learning was demonstrated | No badges or claims of mastery; explicit next learning destination |
| Mobile | Side-by-side content becomes cramped | Single-column workspaces; visual controls kept with the visual |
| Focus | Keyboard users can lose their place | Visible focus, native controls and correct current/pressed states |
| Motion | Animation can distract or exclude visitors | User-operated playback and existing reduced-motion handling |
| Recovery | Errors can discard effort | Cancellation preserves saved runs; last results stay inspectable |
| Export | Users need ownership of work | CSV with simulated provenance, settings and uncertainty |
| Credibility | A polished image can imply scientific validation | Actual/source/illustrative distinctions remain explicit |
| Privacy | Engagement analysis can silently become tracking | No analytics added; real user testing is a separate future step |

## Colour checks (specified CSS pairs)

| Role | Foreground / background | Contrast |
| --- | --- | --- |
| Main body | #263d32 / #f6f7f3 | 10.87:1 |
| Secondary stage text | #596b5e / #edf0e9 | 4.94:1 |
| Main action | #ffffff / #2f644c | 6.89:1 |
| Stage caption | #4c6550 / #edf0e9 | 5.55:1 |
| Diagram text | #344b3e / #edf0e9 | 8.21:1 |
| Secondary button text | #435c47 / #ffffff | 7.34:1 |
| Slider track | #7d9375 / #ffffff | 3.33:1 |

Actual rendering, transparency, state, zoom and surrounding colours still
require review. Contrast calculations do not establish full accessibility.

## Validation needed with people

Recruit general-public adults, STEM students and teachers separately, with
consent and appropriate arrangements for minors. Ask them to explain what a
muon does, find the light-producing part, collect one run, compare another
angle fairly, and distinguish simulated from measured results. Observe first
use before offering guidance. Test mobile and keyboard-only use as well.

Useful outcomes: first meaningful interaction, task completion, errors,
unprompted exploration, correct explanation, and choosing another learning
layer. Track return visits only with an explicitly approved privacy approach.
Do not interpret long dwell time as success without understanding why.

Compare the earlier and redesigned UI with the same tasks. Record sample,
recruitment, devices, prior knowledge and uncertainty; determine the necessary
sample size from the intended claim. Avoid declaring statistical improvement
from a few informal sessions. No such user study has yet been run.

## Student attention review

There is no measured, fixed attention span for a whole generation that can
set this interface's section length. The popular eight-second claim is not a
sound design premise (King's College London Policy Institute report, 2022:
https://www.kcl.ac.uk/policy-institute/assets/how-people-focus-and-live-in-the-modern-information-environment.pdf).
Short-form-video associations cannot establish a universal causal attention
limit for all students. This product has not measured its students' attention.

Freeman et al. (2014), a meta-analysis of undergraduate STEM courses, supports
active learning in that context, not a claimed retention uplift for this
school-student website: https://doi.org/10.1073/pnas.1319030111.
PhET findings are a closer interaction-design reference, but still require
validation with this content, age range and setting.

| Layer | Attention risk in the current content | Applied response | What needs observing |
| --- | --- | --- | --- |
| Introduction | Many routes before the visitor understands the subject | One initial particle journey; concise promise; source-CAD visual | Do students identify what they can do next? |
| Guided muon | Passive reading with repeated scene | Six selectable named steps; replay; restored place; onward tile link | Can students explain a coincidence and choose a deeper layer? |
| Scintillation | Abstract explanation and motion disconnected | Same process state for CAD and molecular diagram; play/scrub beside visual | Do labels and visual changes support an accurate explanation? |
| Path exercise | Numbers without a question | Optional prediction; selecting either response sets a real 60° calculation and explains the result | Do students test another angle on their own? |
| Angle workspace | Too many configuration choices or no starting question | Optional first investigation, usable defaults, direct tilt feedback | Can a student collect a run without assistance? |
| Calculation | Waiting without a visible purpose | Actual worker progress, cancel, preserved rows | Do users understand computation is ongoing? |
| Results | Large totals without a takeaway | Latest normalized-rate summary and optional next-angle setup that holds exposure/bearing | Do students compare fairly rather than count-duration effects? |
| Deeper assembly/electronics/network | Advanced material may exceed prior knowledge | Separate destinations reached by choice; clear links, no forced sequence | Where do learners stop or misinterpret provenance? These deeper tools need their own audience tests. |
| Returning | Repeating already completed navigation | Browser-tab guide position and experiment rows are restored | Can users resume without losing context? |

The optional challenges are invitations, not mandatory gates. No flashing
alerts, autoplay audio, countdowns, streak pressure, fake rewards, infinite
scroll or unsolicited inactivity prompts were added. Re-engagement here means
presenting a meaningful scientific question and preserving the learner's
control, not continually interrupting their attention.

The table records design hypotheses and implementation review, not proof that
each section retains a cohort. To establish that, observe representative
students doing the tasks and assess comprehension alongside continuation.

## Shared interface across all seven pages

The local preview now loads `site-theme.css` last on Discover, Scintillation,
Experiment, Detector, Assembly, Electronics and Network. The shared header
keeps the same seven destinations, selected-page treatment, typography and
focus outline. Legacy workspaces use the same white panels and sage studio
background. The oscilloscope retains a dark plotting surface for its existing
white and magenta instrument traces. Models retain their source dimensions;
lighting and presentation changes do not rescale physical parts. Assembly
guide sprites use light backings with dark text.

Browser checks at widths 320, 390, 768 and 1440 px found no document horizontal
overflow or interactive elements extending beyond the viewport across all seven
pages. Saved desktop and phone screenshots were reviewed, including loaded
assembly geometry, PCB and oscilloscope, globe and detector. The detector's
phone process strip was enlarged to prevent its third explanation being
clipped. Long content remains reachable by page scrolling or named workspace
scroll areas; the experiment results table retains its horizontal scroll.
Assembly complete-view and electronics front/back/3D controls were exercised.
These checks cover the tested states and viewport sizes, not every possible
camera rotation, browser zoom, device or user-generated result.

## First-visitor proportions and learning sequence

The homepage now uses an immediately available 900 × 980 source-CAD portrait
instead of initializing a second WebGL scene. The portrait occupies the larger
column on desktop and appears directly below the title on phones. This removes
loading-state dependence from the first view and makes the instrument readable.
The interactive guided scene remains below. The official main-site logo
replaces the improvised wordmark on all seven visitor-facing pages.

The recommended path is introduction and guided muon → complete instrument →
scintillation and fibre/SiPM process → orientation experiment → electronic
readout. Construction and the worldwide network are optional branches. Homepage
cards, navigation order and end-of-page continuation links now agree with that
sequence. Branches are explicitly labelled rather than presented as required
learning prerequisites. No claim of measured retention improvement is made.

Particle markers now use saturated colours suited to the light studio, larger
illustrative heads and more opaque trails. The experiment and scintillator
muon markers are blue; detector pair-selected tracks use green, orange or
purple. Ambient paths use blue. Display colours, head diameters and speeds
are illustrative and do not change transport, counts or source-CAD dimensions.
