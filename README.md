# Atlas — a travel readiness atlas

Atlas combines a 3D Earth, attributed place photography, itinerary drafting, and practical trip-preparation tools. Its product thesis is **trip readiness for travelers from India**: keep the plan, local conditions, budget, packing, and next actions together. AI trip planning is an established category; Atlas does not claim otherwise.

## Preview and deployment

For the complete experience locally, install the Vercel CLI and run:

```sh
npx vercel dev
```

For AI planning locally, copy `.env.example` to `.env.local`, put your Gemini key there, and keep that file private. Then open the local URL Vercel prints. A plain static server will show the demo and local trip tools, but `/api/plan` needs a Vercel-compatible runtime.

To deploy, upload this folder to a GitHub repository and import that repository in Vercel. There is no frontend build step. Add `GEMINI_API_KEY` to the Vercel project's Environment Variables, redeploy, and the AI planner will be enabled. `GEMINI_MODEL` is optional; the default is `gemini-3.5-flash-lite`. Keep the key in Vercel's server environment; never put it in the browser or commit it into Git. Check the current Google AI Studio model quota and terms before launch; the free tier varies by model and can change.

The included Kyoto demo runs without credentials. The free-first tools (globe, search, saved local journeys, checklist, map links, and exports) can be explored without AI credentials.

## 40+ user-facing features

1. NASA Blue Marble textured, rotatable 3D Earth.
2. Pointer/touch globe drag and automatic orbital rotation.
3. Animated atmospheric edge, cloud mantle, and sea sheen (clearly described as simulated).
4. Curated destination focus for 11 recognizable places.
5. Locally bundled Three.js runtime and destination scene catalog.
6. Destination suggestions through Open-Meteo geocoding.
7. Wikimedia Commons destination photo search with creator/license attribution.
8. Bundled Kyoto landmark visual fallback, so the featured-destination card is never empty in local previews; live Wikimedia photos replace it when available.
9. Compass-needle cursor on mouse and trackpad, with direction-following feedback and standard touch behavior on phones and tablets.
8. Private server-side Gemini itinerary endpoint.
9. No-key interactive Kyoto demo.
10. Day count control from one to ten days.
11. Eight trip-vibe choices.
12. Free-form trip preferences for the AI prompt.
13. Route pins and connecting lines on the globe.
14. Per-stop Google Maps directions/search links.
15. Add and remove itinerary stops.
16. Edit stop notes inline.
17. Mark itinerary stops complete.
18. Live destination weather and a three-day forecast.
19. INR-first daily trip budget with five currencies.
20. Dated reference currency conversion.
21. Editable, locally saved packing checklist.
22. Add a custom packing item.
23. Vibe-aware packing suggestions.
24. Destination local time where in the curated timezone list.
25. Common language and currency reference for curated places.
26. OpenStreetMap destination map link.
27. Nearby airport search link.
28. Public transit search link.
29. Government of India's travel-advisory link.
30. Passport expiry reminder with an entry-rule caveat.
31. Save trips privately in local storage.
32. Open and delete saved trips.
33. Duplicate a saved journey.
34. Share a trip using a self-contained link.
35. Download a JSON trip backup.
36. Import a JSON trip backup.
37. Export itinerary stops to CSV.
38. Create a calendar `.ics` file.
39. Print/save a clean trip PDF from the browser.
40. Recover the last planning draft after refresh.
41. Persist currency and budget preferences.
42. Large-text display setting.
43. Paper-light theme toggle.
44. Reduce-motion setting and operating-system reduced-motion support.
45. Optional Supabase email account and private cloud backup/restore.

The interactive globe remains the hero centerpiece and the destination card searches Wikimedia Commons on demand for a landmark whose file title matches the selected city or one of its known landmarks, with contributor and license attribution. This uses a broad, live image catalog instead of requiring a separate bundled image for every city. Search results without a city/landmark title match are rejected to prevent showing a photograph from the wrong place. When opened offline, Kyoto uses bundled generated illustrative artwork; other places use a clearly labeled Earth-horizon fallback until a matching destination photo can be fetched. Neither generated fallback is represented as a real photograph or live satellite imagery. The local 3D landmark library currently has 12 locations, including Mysuru.

## Optional Supabase cloud backup

All trip features work locally without an account. To enable backup between devices:

1. Create a Supabase project and run the SQL in [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor.
2. In Atlas, paste the project URL and public/anon key in **Optional · Private cloud backup**, then choose **Save connection**.
3. Create an account (confirm its email if Supabase asks), sign in, then use **Back up / sync** or **Restore journeys**.

The browser stores only the Supabase URL, publishable/anon key, and current auth session. The database uses row-level security so a signed-in user can access only their own trip rows. Do not use a Supabase service-role key in this app.

## Data and limits

- **Weather/geocoding:** Open-Meteo. The free API is limited to non-commercial use and has no uptime guarantee; before monetizing Atlas, switch to a provider plan that licenses commercial use or another suitable source. Open-Meteo forecasts are estimates, not safety warnings.
- **Exchange rates:** Frankfurter reference data, updated by working day. It is not a card/bank quote and should not be used for payments.
- **Place photographs:** Wikimedia Commons; image pages and license attribution are shown in the image caption. Image lookup requires an internet connection.
- **AI:** Gemini may invent details or return stale opening-hour information. Verify every booking-critical detail with the venue, airline, government, or travel provider.
- **Maps/transit:** Links open third-party search pages; Atlas does not claim to have booked transit or verified live routing.
- **Globe:** NASA Blue Marble is a composite base texture, not a live Earth feed. Cloud/sea shimmer is a visual simulation and does not represent measured clouds, water motion, or tides.
- **Privacy:** Local-only trips stay in this browser. A copied trip link contains its itinerary in the URL; share it only with people you intend to show it to.

## Assets

- `assets/textures/earth-blue-marble.jpg`: NASA Blue Marble: Next Generation, January global base map, 5400 × 2700. See [`assets/ASSET-CREDITS.md`](assets/ASSET-CREDITS.md).
- `assets/vendor/three.min.js`: Three.js r128; license included alongside it.
- `assets/scenes/destinations.js`: bundled destination names, coordinates, aliases, and scene categories.
- `assets/atlas-earth-horizon.png`: bundled illustrative Earth view used as an offline-safe fallback.
- `assets/kyoto-kiyomizu-editorial.png`: bundled illustrative Kyoto landmark visual used when the Commons photo service is unavailable.
- `api/plan.js`: Vercel server function for the Gemini API. Vercel builds functions from the `/api` directory; see [Vercel Functions](https://vercel.com/docs/functions).

## Later paid tier, if wanted

Keep the planning, local saves, exports, checklists, globe, and community demo free. Premium could pay for higher AI limits, provider-grounded results, verified live disruption alerts, commercial weather usage, or synced team/family trips. These paid services are not active in this build; do not advertise them as available until the provider and billing integration are in place.
