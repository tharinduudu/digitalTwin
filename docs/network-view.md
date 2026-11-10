# The network view

Open `http://127.0.0.1:8791/network.html` after starting `node server.mjs`.
This page puts the public gLOWCOST station records on Earth. Selecting a station
shows its observation dates, data availability and the status reported by the
data portal. The data button uses the station link supplied by the portal map.
The detector, assembly guide and readout bench are still separate views.

## Where the numbers come from

The first snapshot was read from the public Network summary and station map at
<https://cosmic.gsu.edu/~cosmic/dataportal/> on 5 November 2026. It has 36 detector
IDs. This is not necessarily 36 different instruments: the portal includes
similarly named records whose relationship has not been confirmed.

The portal calls a record Running when its latest preprocessed observation is
within 48 hours, based on the latest SQLite ingestion. Here it is labelled
Recent data. That is not proof that the Pi is connected right now. A separate
amber status retains the portal's Check stability assessment. No assessment
is recalculated from the computer clock.

Observation times have no consistent published time zone. They are shown as
received, without a UTC suffix. Only the snapshot capture time is UTC.

USA and United States are counted together, giving 11 countries. The source
country field is kept. The Singapore record has a wrong city in the summary;
its map coordinates place it in Singapore. Colombo has conflicting East/West
names in its data links. Those links and names are retained, with a warning.
CHARA has observations and a Stable label but no dates, and the portal says
Awaiting ingestion. This is shown as missing ingested data, not as online.

## Updating the snapshot

`public/assets/network-snapshot.json` contains the data and its provenance.
Each row follows the `columns` list. `portalQueries` holds the original public
map links, keyed by detector ID. To update it:

1. Read the current Network summary in the portal, keeping the detector IDs.
2. Check its map for coordinates and station data links. Do not manufacture a
   location when one is absent, or merge records only because their names match.
3. Update the rows and `capturedAt` together. Keep missing dates as `null`.
4. Run `node --test tests/*.test.mjs`, review changed records and totals, then
   check the globe and the station panel locally.

The page does not scrape the Streamlit application in each visitor's browser.
There is no documented public JSON endpoint being used here. Until a reviewed
data export is connected, it remains a dated snapshot. Reloading this page does
not fetch new detector measurements. The current portal is always linked.

## How the drawing works

`network-data.js` validates records, assigns display statuses and filters the
list. `network-globe.js` uses Three.js and the local Natural Earth land file
to draw Earth. Latitude and longitude place each pin on the sphere. Nearby
records share a pin, but remain separate in the station list and detail panel.
Labels behind Earth are hidden; labels near one another avoid overlapping.

`network.js` connects selection, search, filters and the station panel. Text
from the snapshot is assigned with `textContent`, not executed as HTML.
There are no invented count rates or muons travelling between countries.
The linked 3D detector is the reference design, not an assertion about the
hardware installed at every site.

## Hosting and map credit

The page uses the same free, static GitHub Pages build as the other views.
No map token, backend service or subscription is needed. Processing happens
on the viewer's computer. Normal GitHub Pages traffic and storage limits still
apply. Public browser assets contain no detector SSH credentials.

Land geometry is Natural Earth 1:110m land, public domain:
<https://www.naturalearthdata.com/about/terms-of-use/>.
The bundled source is `geojson/ne_110m_land.geojson` from
<https://github.com/nvkelso/natural-earth-vector>.
