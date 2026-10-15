/* Practical, local-first trip conveniences. No account or paid map key is required. */
(() => {
  const $ = id => document.getElementById(id);
  const compassCursor = $('atlas-cursor');
  if (compassCursor && matchMedia('(hover:hover) and (pointer:fine)').matches) {
    document.documentElement.classList.add('atlas-cursor-on');
    let lastPointer = null;
    addEventListener('pointermove', event => {
      compassCursor.style.transform = `translate3d(${event.clientX - 24}px,${event.clientY - 24}px,0)`;
      if (lastPointer) {
        const dx = event.clientX - lastPointer.x, dy = event.clientY - lastPointer.y;
        if (Math.hypot(dx, dy) > 1.5) compassCursor.style.setProperty('--bearing', `${Math.atan2(dy, dx) * 180 / Math.PI + 90}deg`);
      }
      lastPointer = { x: event.clientX, y: event.clientY };
    });
    document.addEventListener('pointerover', event => compassCursor.classList.toggle('is-interactive', !!event.target.closest('a,button,input,select,[role="button"]')));
    addEventListener('pointerdown', () => compassCursor.classList.add('is-pressed'));
    addEventListener('pointerup', () => compassCursor.classList.remove('is-pressed'));
  }
  const setOrbitalReadingMode = () => document.documentElement.classList.toggle('atlas-scrolled', scrollY > innerHeight * .58);
  addEventListener('scroll', setOrbitalReadingMode, { passive: true });
  addEventListener('resize', setOrbitalReadingMode, { passive: true });
  setOrbitalReadingMode();
  const STORE = 'atlas_saved_journeys_v1';
  const PACK = 'atlas_packing_v1';
  const DRAFT = 'atlas_draft_v1';
  const BASE_PACKING = ['Passport / ID and copies','Flight and accommodation confirmations','Payment cards and a little local cash','Travel insurance details','Prescription medicines','Phone, charger and power adapter','Comfortable walking shoes','Weather-appropriate layers','Reusable water bottle','Small day bag','Emergency contact details','Offline map downloaded'];
  let current = window.atlasCurrentTrip || null;
  let coordinates = { lat: 35.0116, lon: 135.7681, name: 'Kyoto, Japan' };
  const PHOTO_STORE = 'atlas_destination_photo_cache_v1';
  const photoCache = new Map();
  try {
    const savedPhotos = JSON.parse(localStorage.getItem(PHOTO_STORE) || '{}');
    Object.entries(savedPhotos).forEach(([place, photo]) => {
      if (photo?.image?.startsWith('https://') && photo?.source?.startsWith('https://')) photoCache.set(place, photo);
    });
  } catch {}
  const rememberPhoto = (place, photo) => {
    photoCache.set(place, photo);
    try { localStorage.setItem(PHOTO_STORE, JSON.stringify(Object.fromEntries([...photoCache].slice(-100)))); } catch {}
  };
  let photoRequest = 0;
  const sceneCatalog = window.ATLAS_DESTINATIONS || [];
  const sceneFor = text => {
    const q = String(text || '').toLowerCase();
    return sceneCatalog.find(item => item.aliases.some(alias => q === alias || q.includes(alias))) || null;
  };
  const notify = (message, isError = false) => {
    const node = $('save-status');
    if (node) { node.textContent = message; node.style.color = isError ? '#df9b86' : '#a7c7b5'; }
  };
  const readTrips = () => { try { return JSON.parse(localStorage.getItem(STORE) || '[]'); } catch { return []; } };
  const writeTrips = data => localStorage.setItem(STORE, JSON.stringify(data));
  const cloudConfig = () => { try { return JSON.parse(localStorage.getItem('atlas_cloud_config') || '{}'); } catch { return {}; } };
  const cloudSession = () => { try { return JSON.parse(localStorage.getItem('atlas_cloud_session') || 'null'); } catch { return null; } };
  const setCloudSession = session => { if (session) localStorage.setItem('atlas_cloud_session', JSON.stringify(session)); else localStorage.removeItem('atlas_cloud_session'); };
  const refreshCloudSession = async () => {
    let session = cloudSession(); const config = cloudConfig();
    if (!session?.access_token || !config.url || !config.key) throw new Error('Connect Supabase and sign in first.');
    if (session.expires_at && session.expires_at > Date.now()/1000 + 60) return session;
    if (!session.refresh_token) throw new Error('Your cloud session expired. Sign in again.');
    const response = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, { method:'POST', headers:{ apikey:config.key, 'content-type':'application/json' }, body:JSON.stringify({refresh_token:session.refresh_token}) });
    const data = await response.json(); if (!response.ok) throw new Error(data.msg || 'Cloud session expired. Please sign in again.');
    session = { ...data, expires_at:Date.now()/1000 + (data.expires_in || 3600) }; setCloudSession(session); return session;
  };
  const cloudFetch = async (path, options = {}) => {
    const config = cloudConfig(), session = await refreshCloudSession();
    const response = await fetch(`${config.url}${path}`, { ...options, headers:{ apikey:config.key, authorization:`Bearer ${session.access_token}`, 'content-type':'application/json', ...(options.headers || {}) } });
    if (!response.ok) { const info = await response.json().catch(() => ({})); throw new Error(info.message || info.msg || 'Cloud storage request failed. Check the setup instructions.'); }
    return response.status === 204 ? null : response.json().catch(() => null);
  };
  const tripTitle = trip => trip?.city || 'Untitled journey';
  const safeJson = value => JSON.stringify(value, null, 2);
  const saveFile = (name, content, type) => {
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([content], { type })); link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1500);
  };
  const refreshSaved = selected => {
    const select = $('saved-trips'); if (!select) return;
    const trips = readTrips();
    select.innerHTML = trips.length ? '<option value="">Choose a saved journey</option>' : '<option value="">No saved journeys yet</option>';
    trips.forEach(item => { const option = document.createElement('option'); option.value = item.id; option.textContent = `${item.trip.city} · ${new Date(item.savedAt).toLocaleDateString()}`; select.appendChild(option); });
    if (selected) select.value = selected;
  };
  const persistPacking = () => {
    const rows = [...document.querySelectorAll('#packing-list input[type=checkbox]')].map(input => ({ text: input.nextElementSibling.textContent, checked: input.checked }));
    localStorage.setItem(PACK, JSON.stringify(rows));
    document.querySelectorAll('#packing-list .check-row').forEach(row => row.classList.toggle('done', row.querySelector('input').checked));
  };
  const paintPacking = (items = BASE_PACKING) => {
    let saved = []; try { saved = JSON.parse(localStorage.getItem(PACK) || '[]'); } catch {}
    const savedMap = new Map(saved.map(x => [x.text, x.checked]));
    const uniqueItems = [...new Set(items)];
    $('packing-list').innerHTML = uniqueItems.map((item, index) => `<label class="check-row ${savedMap.get(item) ? 'done' : ''}"><input type="checkbox" ${savedMap.get(item) ? 'checked' : ''} aria-label="Mark ${item} complete"><span>${item}</span></label>`).join('');
    $('packing-list').querySelectorAll('input').forEach(input => input.addEventListener('change', persistPacking));
  };
  const drawLocalDetails = (name = coordinates.name, coord = coordinates) => {
    const scene = sceneFor(name);
    const details = {
      'Kyoto': ['Asia/Tokyo','JPY','Japanese'], 'Japan': ['Asia/Tokyo','JPY','Japanese'], 'Mount Fuji': ['Asia/Tokyo','JPY','Japanese'],
      'Swiss Alps': ['Europe/Zurich','CHF','German / French / Italian'], 'Paris': ['Europe/Paris','EUR','French'], 'Agra': ['Asia/Kolkata','INR','Hindi'], 'India': ['Asia/Kolkata','INR','Hindi / English'],
      'Rome': ['Europe/Rome','EUR','Italian'], 'Cairo': ['Africa/Cairo','EGP','Arabic'], 'New York': ['America/New_York','USD','English'], 'Sydney': ['Australia/Sydney','AUD','English'], 'Dubai': ['Asia/Dubai','AED','Arabic / English'], 'Kathmandu': ['Asia/Kathmandu','NPR','Nepali']
    };
    const key = scene?.name.split(',')[0] || name.split(',')[0]; const info = details[key] || ['','—',''];
    let localTime = 'Time zone unavailable';
    if (info[0]) { try { localTime = new Intl.DateTimeFormat(undefined, { timeZone: info[0], dateStyle: 'medium', timeStyle: 'short' }).format(new Date()); } catch {} }
    $('local-details').innerHTML = `<div class="detail-item"><span>Local time</span><b>${localTime}</b></div><div class="detail-item"><span>Currency</span><b>${info[1]}</b></div><div class="detail-item"><span>Common languages</span><b>${info[2] || 'Check locally'}</b></div><div class="detail-item"><span>Approx. coordinates</span><b>${Number(coord.lat).toFixed(2)}°, ${Number(coord.lon).toFixed(2)}°</b></div>`;
    $('map-link').href = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(coord.lat)}&mlon=${encodeURIComponent(coord.lon)}#map=11/${encodeURIComponent(coord.lat)}/${encodeURIComponent(coord.lon)}`;
    const mapQuery = encodeURIComponent(`airport near ${name}`); $('airport-link').href = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
    $('transit-link').href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`public transit ${name}`)}`;
  };
  const updateBudget = () => {
    const days = Math.max(1, Number($('days').value || current?.days?.length || 1));
    const amount = Math.max(0, Number($('daily-budget').value || 0)) * days;
    const currency = $('budget-currency').value;
    const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥' };
    $('budget-total').innerHTML = `${symbols[currency] || ''}${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} <small>${days} days · excludes flights and accommodation unless you include them</small>`;
    localStorage.setItem('atlas_budget_v1', JSON.stringify({ amount: $('daily-budget').value, currency }));
  };
  const dailyWeather = async () => {
    $('weather-readout').innerHTML = '<span class="weather-temp">…</span><span>Checking current conditions and near-term forecast.</span>';
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${coordinates.lat}&longitude=${coordinates.lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=3&timezone=auto`;
      const response = await fetch(url); if (!response.ok) throw new Error('Forecast service is unavailable right now.');
      const data = await response.json(); const now = data.current; const today = data.daily;
      $('weather-readout').innerHTML = `<span class="weather-temp">${Math.round(now.temperature_2m)}°</span><span>${weatherName(now.weather_code)} · feels like a ${Math.round(today.temperature_2m_min[0])}–${Math.round(today.temperature_2m_max[0])}° day<br>Humidity ${Math.round(now.relative_humidity_2m)}% · wind ${Math.round(now.wind_speed_10m)} km/h · rain chance ${today.precipitation_probability_max[0] ?? '—'}%</span>`;
      $('weather-next-days').innerHTML = `<div class="forecast-strip">${today.time.slice(0,3).map((date,index)=>`<div><small>${index===0?'TODAY':new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{weekday:'short'}).toUpperCase()}</small><b>${Math.round(today.temperature_2m_max[index])}° / ${Math.round(today.temperature_2m_min[index])}°</b><span>${today.precipitation_probability_max[index] ?? 0}% rain</span></div>`).join('')}</div><div class="subtle">Open-Meteo · forecast, not a guarantee · refresh before departure.</div>`;
    } catch (error) { $('weather-readout').innerHTML = `<span class="weather-temp">—°</span><span>${error.message} Please retry later.</span>`; $('weather-next-days').textContent = ''; }
  };
  function weatherName(code) {
    if (code === 0) return 'Clear sky'; if ([1,2,3].includes(code)) return 'Partly cloudy'; if ([45,48].includes(code)) return 'Fog';
    if ([51,53,55,56,57].includes(code)) return 'Drizzle'; if ([61,63,65,66,67,80,81,82].includes(code)) return 'Rain showers'; if ([71,73,75,77,85,86].includes(code)) return 'Snow'; if ([95,96,99].includes(code)) return 'Thunderstorms'; return 'Changeable skies';
  }
  const preparePlaceVisual = query => {
    const place = String(query || '').trim() || 'Destination';
    const kyotoFallback = /\bkyoto\b/i.test(place);
    $('visual-image').style.backgroundImage = kyotoFallback
      ? 'linear-gradient(180deg,#07101c05 30%,#111913d9 100%),url("assets/kyoto-kiyomizu-editorial.png")'
      : 'linear-gradient(180deg,#07101c05 30%,#111913d9 100%),url("assets/atlas-earth-horizon.png")';
    $('visual-place').textContent = place.toUpperCase();
    $('visual-loading').textContent = `FINDING A LANDMARK · ${place.toUpperCase()}`;
    $('visual-credit').textContent = kyotoFallback ? 'Illustrative Kyoto artwork · not a photograph' : 'Looking for a verified landmark photograph';
    $('visual-credit').removeAttribute('href');
    return kyotoFallback;
  };
  window.atlasPreviewPlace = preparePlaceVisual;
  const loadPlaceImage = async (query) => {
    const figure = $('destination-visual'); if (!figure) return;
    const thisRequest = ++photoRequest;
    const place = String(query || 'Kyoto, Japan').trim(); const kyotoFallback = preparePlaceVisual(place);
    if (photoCache.has(place)) return applyPhoto(photoCache.get(place));
    try {
      const scene = sceneFor(place);
      const landmark = scene?.landmark;
      const terms = `${landmark ? `${landmark} ${place}` : place} landmark travel`;
      const params = new URLSearchParams({ action:'query', generator:'search', gsrsearch:terms, gsrnamespace:'6', gsrlimit:'8', prop:'imageinfo', iiprop:'url|extmetadata', iiurlwidth:'900', format:'json', origin:'*' });
      const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
      if (!response.ok) throw new Error('Photo search failed');
      const data = await response.json();
      if (thisRequest !== photoRequest) return;
      const pages = Object.values(data.query?.pages || {}).filter(page => page.imageinfo?.[0]?.thumburl && page.imageinfo?.[0]?.mime?.startsWith('image/'));
      if (!pages.length) throw new Error('No suitable public photograph found');
      const city = place.split(',')[0].trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      const countryNames = new Set(['india','usa','france','italy','egypt','australia','nepal','switzerland','japan','uae']);
      const matchingScene = scene;
      const matchTerms = [city, ...(matchingScene?.aliases || []).filter(alias => !countryNames.has(alias.toLowerCase()))]
        .map(term => term.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()).filter(term => term.length > 2);
      const exactPlacePages = pages.filter(page => {
        const title = page.title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
        return matchTerms.some(term => title.includes(term));
      });
      if (!exactPlacePages.length) throw new Error(`No Commons image title matched ${city} or its known landmarks`);
      const words = place.toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 2);
      exactPlacePages.sort((a,b) => {
        const score = page => { const title = page.title.toLowerCase(); return words.reduce((n,word) => n + (title.includes(word) ? 3 : 0),0) + (/landscape|skyline|temple|mountain|city|coast|architecture/i.test(title) ? 2 : 0) - (/map|logo|flag|diagram|coat of arms/i.test(title) ? 12 : 0); };
        return score(b)-score(a);
      });
      const page = exactPlacePages[0], info = page.imageinfo[0], meta = info.extmetadata || {};
      const strip = value => String(value || '').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
      const author = strip(meta.Artist?.value || info.user || 'Wikimedia contributor');
      const license = strip(meta.LicenseShortName?.value || 'See file page for license');
      const fileUrl = `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replaceAll(' ','_'))}`;
      const photo = { image: info.thumburl, title: page.title.replace('File:',''), author, license, source: fileUrl };
      rememberPhoto(place,photo); applyPhoto(photo);
    } catch {
      if (thisRequest !== photoRequest) return;
      // The Commons search endpoint may be temporarily unavailable or may
      // reject a broad query. Retry with the selected place's known landmark
      // article so a matching image can still load from the Wikimedia API.
      try {
        const scene = sceneFor(place), article = scene?.landmark || place.split(',')[0].trim();
        const fallbackUrl = new URL('https://en.wikipedia.org/w/api.php');
        fallbackUrl.search = new URLSearchParams({ action:'query', titles:article, prop:'pageimages', format:'json', pithumbsize:'900', origin:'*' }).toString();
        const fallbackResponse = await fetch(fallbackUrl);
        const data = fallbackResponse.ok ? await fallbackResponse.json() : null;
        const page = Object.values(data?.query?.pages || {})[0];
        if (thisRequest !== photoRequest) return;
        if (page?.thumbnail?.source) {
          const articleUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent((page.title || article).replaceAll(' ','_'))}`;
          const photo = { image: page.thumbnail.source, title: page.title || article, author: 'Wikipedia article', license: 'Image source and attribution', source: articleUrl };
          rememberPhoto(place, photo); applyPhoto(photo); return;
        }
      } catch { if (thisRequest !== photoRequest) return; }
      // Keep the place-specific Kyoto illustration only for Kyoto. For any
      // other city, show the explicitly labeled Earth view rather than a
      // photograph of the wrong destination.
      $('visual-loading').textContent = kyotoFallback ? 'KIYOMIZU-DERA · KYOTO FIELD NOTE' : 'LANDMARK PHOTO UNAVAILABLE';
      $('visual-credit').textContent = kyotoFallback ? 'Illustrative artwork · not a real photograph' : 'Could not load a matching image. Check your connection and try again.';
      $('visual-credit').removeAttribute('href');
    }
  };
  window.atlasLoadPlaceImage = loadPlaceImage;
  loadPlaceImage('Kyoto, Japan');
  function applyPhoto(photo) {
    $('visual-image').style.backgroundImage = `linear-gradient(180deg,#13202c00 45%,#111913d9 100%),url("${photo.image}")`;
    $('visual-loading').textContent = photo.title.length > 60 ? photo.title.slice(0,57)+'…' : photo.title;
    $('visual-credit').textContent = `${photo.author} · ${photo.license}`; $('visual-credit').href = photo.source;
  }
  const onTrip = trip => {
    current = trip;
    const scene = sceneFor(trip.city);
    const first = trip.days?.[0] || {};
    coordinates = scene ? { lat: scene.lat, lon: scene.lon, name: scene.name } : { lat: Number(first.lat) || 0, lon: Number(first.lon) || 0, name: trip.city };
    drawLocalDetails(trip.city, coordinates); updateBudget();
    loadPlaceImage(trip.city);
    document.querySelectorAll('#out .stop-done input').forEach(input => {
      const stop = input.closest('.stop'), day = stop.closest('.day'); const d = Number(day.dataset.dayIndex), s = Number(stop.dataset.stopIndex);
      input.checked = !!trip.days?.[d]?.stops?.[s]?.done;
      input.addEventListener('change', () => { trip.days[d].stops[s].done = input.checked; notify(input.checked ? 'Stop marked complete' : 'Stop marked not complete'); });
    });
    notify('Journey ready · save it on this device');
    const tips = [...BASE_PACKING];
    if (/nature|adventure/i.test(window.atlasVibe || '')) tips.push('Sun protection and insect repellent','Quick-dry layers');
    if (/culture|history|art/i.test(window.atlasVibe || '')) tips.push('Modest layer for religious sites','Small notebook or sketchbook');
    paintPacking(tips);
  };
  window.AtlasTools = { onTrip };

  $('weather-button').addEventListener('click', dailyWeather);
  $('daily-budget').addEventListener('input', updateBudget); $('budget-currency').addEventListener('change', updateBudget); $('days').addEventListener('input', updateBudget);
  $('currency-button').addEventListener('click', async () => {
    const base = $('budget-currency').value; const target = base === 'INR' ? 'USD' : 'INR';
    $('currency-result').textContent = 'Fetching a reference exchange rate…';
    try { const response = await fetch(`https://api.frankfurter.dev/v2/rates?base=${base}&quotes=${target}`); if (!response.ok) throw new Error('Rate service unavailable'); const data = await response.json(); const quote = data.find(row => row.quote === target); if (!quote) throw new Error('No rate available'); const rate = quote.rate; const total = Number($('daily-budget').value || 0) * Math.max(1, Number($('days').value || 1)); $('currency-result').textContent = `Reference only · ${base} ${total.toLocaleString()} ≈ ${target} ${(total * rate).toLocaleString(undefined, { maximumFractionDigits: 0 })} · rate dated ${quote.date}.`; }
    catch { $('currency-result').textContent = 'Could not fetch a current rate. Your budget estimate is still available in the selected currency.'; }
  });
  $('add-check-item').addEventListener('click', () => { const value = prompt('Add an item to your packing list'); if (value?.trim()) { const label = document.createElement('label'); label.className = 'check-row'; label.innerHTML = `<input type="checkbox"><span>${value.trim().replace(/[<>]/g,'')}</span>`; $('packing-list').appendChild(label); label.querySelector('input').addEventListener('change', persistPacking); persistPacking(); } });
  $('new-checklist').addEventListener('click', () => { if (!confirm('Reset your packing checklist?')) return; localStorage.removeItem(PACK); paintPacking(); notify('Packing checklist reset'); });
  $('save-trip').addEventListener('click', () => {
    if (!current) { notify('Generate a plan or open the demo before saving.', true); return; }
    document.querySelectorAll('#out .day').forEach(dayNode => { const d=Number(dayNode.dataset.dayIndex); const day=current.days?.[d]; if (!day) return; dayNode.querySelectorAll('.stop').forEach(stopNode => { const s=Number(stopNode.dataset.stopIndex); if (day.stops?.[s]) day.stops[s].desc=stopNode.querySelector('.d').textContent.trim(); }); });
    const list = readTrips(); const existing = list.find(item => item.trip.city === current.city);
    if (existing) { existing.trip = current; existing.savedAt = new Date().toISOString(); writeTrips(list); refreshSaved(existing.id); notify('Saved changes to this journey'); }
    else { const item = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), trip: current, savedAt: new Date().toISOString() }; list.unshift(item); writeTrips(list); refreshSaved(item.id); notify('Journey saved privately on this device'); }
  });
  const savedCloudConfig = cloudConfig(); if (savedCloudConfig.url) $('supabase-url').value = savedCloudConfig.url; if (savedCloudConfig.key) $('supabase-key').value = savedCloudConfig.key;
  const authRequest = async (flow) => {
    const config = cloudConfig(); const email = $('cloud-email').value.trim(), password = $('cloud-password').value;
    if (!config.url || !config.key) throw new Error('Save your Supabase project URL and public key first.');
    if (!email || password.length < 6) throw new Error('Enter your email and a password of at least six characters.');
    const endpoint = flow === 'signup' ? 'signup' : 'token?grant_type=password';
    const response = await fetch(`${config.url}/auth/v1/${endpoint}`, { method:'POST', headers:{ apikey:config.key, 'content-type':'application/json' }, body:JSON.stringify({ email, password }) });
    const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.msg || data.message || 'Could not complete sign-in.');
    if (data.access_token) { data.expires_at = Date.now()/1000 + (data.expires_in || 3600); setCloudSession(data); $('cloud-status').textContent = `Connected as ${data.user?.email || email}.`;
    } else { $('cloud-status').textContent = 'Check your email to confirm the new account, then sign in.'; }
  };
  $('supabase-config').addEventListener('click', () => {
    const url = $('supabase-url').value.trim().replace(/\/$/,''), key = $('supabase-key').value.trim();
    if (!/^https:\/\/[\w-]+\.supabase\.co$/.test(url) || key.length < 20) { $('cloud-status').textContent = 'Enter a valid Supabase project URL and public/anon key.'; return; }
    localStorage.setItem('atlas_cloud_config', JSON.stringify({url,key})); $('cloud-status').textContent = 'Connection details saved in this browser. Create or sign into your account.';
  });
  $('cloud-signup').addEventListener('click', async () => { $('cloud-status').textContent = 'Creating account…'; try { await authRequest('signup'); } catch (error) { $('cloud-status').textContent = error.message; } });
  $('cloud-login').addEventListener('click', async () => { $('cloud-status').textContent = 'Signing in…'; try { await authRequest('login'); } catch (error) { $('cloud-status').textContent = error.message; } });
  $('cloud-logout').addEventListener('click', async () => { try { const config = cloudConfig(), session = cloudSession(); if (session?.access_token) await fetch(`${config.url}/auth/v1/logout`, {method:'POST',headers:{apikey:config.key,authorization:`Bearer ${session.access_token}`}}); } catch {} setCloudSession(null); $('cloud-status').textContent = 'Signed out. Local saved trips remain on this device.'; });
  $('cloud-backup').addEventListener('click', async () => {
    $('cloud-status').textContent = 'Backing up saved journeys…';
    try { const session = await refreshCloudSession(); const trips = readTrips(); const rows = trips.map(item => { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id)) item.id = crypto.randomUUID(); return { id:item.id, user_id:session.user.id, payload:item.trip, updated_at:new Date().toISOString() }; }); writeTrips(trips); if (rows.length) await cloudFetch('/rest/v1/atlas_trips?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)}); refreshSaved(); $('cloud-status').textContent = `${rows.length} journey${rows.length===1?'':'s'} synced to your private account.`; }
    catch (error) { $('cloud-status').textContent = error.message; }
  });
  $('cloud-restore').addEventListener('click', async () => {
    $('cloud-status').textContent = 'Restoring journeys…';
    try { const rows = await cloudFetch('/rest/v1/atlas_trips?select=id,payload,updated_at&order=updated_at.desc'); const merged = new Map(readTrips().map(item => [item.id,item])); (rows || []).forEach(row => merged.set(row.id,{id:row.id,trip:row.payload,savedAt:row.updated_at})); writeTrips([...merged.values()]); refreshSaved(); $('cloud-status').textContent = `${(rows || []).length} cloud journey${rows?.length===1?'':'s'} restored to this device.`; }
    catch (error) { $('cloud-status').textContent = error.message; }
  });
  $('load-trip').addEventListener('click', () => { const item = readTrips().find(x => x.id === $('saved-trips').value); if (!item) return notify('Choose a saved journey first.', true); render(item.trip); window.scrollTo({ top: 0, behavior: 'smooth' }); notify('Journey opened'); });
  $('delete-trip').addEventListener('click', () => { const id = $('saved-trips').value; if (!id) return notify('Choose a saved journey first.', true); writeTrips(readTrips().filter(x => x.id !== id)); refreshSaved(); notify('Saved journey deleted'); });
  $('share-trip').addEventListener('click', async () => {
    if (!current) return notify('Generate a plan or open the demo before sharing.', true);
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(current)))); const url = `${location.origin}${location.pathname}#trip=${encoded}`;
    try { await navigator.clipboard.writeText(url); notify('Share link copied · anyone with the link can view this itinerary'); } catch { prompt('Copy this share link', url); }
  });
  $('export-trip').addEventListener('click', () => { if (!current) return notify('Generate a plan or open the demo before exporting.', true); saveFile(`${tripTitle(current).replace(/[^\w-]+/g,'-').toLowerCase()}.json`, safeJson(current), 'application/json'); notify('Trip backup downloaded'); });
  $('import-trip').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async event => { const file=event.target.files?.[0]; if(!file)return; try { const data=JSON.parse(await file.text()); const trip=data.trip||data; if(!trip?.city||!Array.isArray(trip.days)) throw new Error('This file does not look like an Atlas itinerary.'); const id=crypto.randomUUID?crypto.randomUUID():String(Date.now()); const all=readTrips(); all.unshift({id,trip,savedAt:new Date().toISOString()}); writeTrips(all); refreshSaved(id); render(trip); notify('Journey imported and saved on this device'); } catch(error) { notify(error.message || 'Could not import this file.',true); } event.target.value=''; });
  $('print-trip').addEventListener('click', () => { if (!current) return notify('Generate a plan or open the demo before printing.', true); window.print(); });
  const duplicate = document.createElement('button'); duplicate.className = 'tool-button'; duplicate.textContent = 'Duplicate journey'; duplicate.addEventListener('click', () => { if (!current) return notify('Open a journey before duplicating.', true); const copy = structuredClone(current); copy.city += ' · copy'; const arr = readTrips(); arr.unshift({ id: String(Date.now()), trip: copy, savedAt: new Date().toISOString() }); writeTrips(arr); refreshSaved(arr[0].id); notify('A separate copy was added to saved journeys'); });
  const csv = document.createElement('button'); csv.className = 'tool-button'; csv.textContent = 'Export stops as CSV'; csv.addEventListener('click', () => { if (!current) return notify('Open a journey before exporting.', true); const rows = [['day','time','place','note'], ...current.days.flatMap(day => (day.stops || []).map(stop => [day.n, stop.time || '', stop.name || '', stop.desc || '']))]; const content = rows.map(row => row.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n'); saveFile('atlas-stops.csv', content, 'text/csv'); notify('Stops exported as CSV'); });
  const cal = document.createElement('button'); cal.className = 'tool-button'; cal.textContent = 'Create calendar file'; cal.addEventListener('click', () => { if (!current) return notify('Open a journey before creating a calendar.', true); const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Atlas//Trip planner//EN']; current.days.forEach((day,index) => { lines.push('BEGIN:VEVENT',`UID:atlas-${Date.now()}-${index}@local`,`SUMMARY:${String(day.title || tripTitle(current)).replace(/[\\,;]/g,' ')}`,`DESCRIPTION:${String(current.city).replace(/[\\,;]/g,' ')}`,`DTSTART;VALUE=DATE:${new Date(Date.now()+index*86400000).toISOString().slice(0,10).replaceAll('-','')}`, 'END:VEVENT'); }); lines.push('END:VCALENDAR'); saveFile('atlas-journey.ics', lines.join('\r\n'), 'text/calendar'); notify('Calendar file created'); });
  document.querySelector('.tool-row').append(duplicate, csv, cal);
  refreshSaved(); paintPacking();

  $('passport-expiry').addEventListener('change', () => {
    const value = $('passport-expiry').value; if (!value) { $('passport-status').textContent = 'Expiry date stays on this device.'; return; }
    const days = Math.ceil((new Date(value + 'T00:00:00') - new Date()) / 86400000);
    $('passport-status').textContent = days < 0 ? 'This date has passed. Check your passport status.' : days < 180 ? `${days} days left · many destinations ask travelers to have around six months of validity; verify official entry rules.` : `${days} days left · verify the destination’s current entry rules before booking.`;
    localStorage.setItem('atlas_passport_date', value);
  });
  const passport = localStorage.getItem('atlas_passport_date'); if (passport) { $('passport-expiry').value = passport; $('passport-expiry').dispatchEvent(new Event('change')); }
  const settings = [['reduce-motion','atlas_reduce_motion',v => document.documentElement.classList.toggle('atlas-reduced-motion',v)], ['large-type','atlas_large_type',v => document.documentElement.classList.toggle('atlas-large-type',v)], ['light-theme','atlas_light_theme',v => document.documentElement.classList.toggle('atlas-light',v)]];
  settings.forEach(([id,key,apply]) => { const box = $(id); box.checked = localStorage.getItem(key) === 'true'; apply(box.checked); box.addEventListener('change', () => { localStorage.setItem(key, box.checked); apply(box.checked); }); });
  try { const b = JSON.parse(localStorage.getItem('atlas_budget_v1') || '{}'); if (b.amount) $('daily-budget').value = b.amount; if (b.currency) $('budget-currency').value = b.currency; } catch {} updateBudget();
  // Draft recovery means a refresh does not erase the destination, trip length, mood, or notes.
  try { const draft = JSON.parse(localStorage.getItem(DRAFT) || '{}'); if (draft.dest) $('dest').value = draft.dest; if (draft.days) $('days').value = draft.days; if (draft.notes) $('notes').value = draft.notes; if (draft.vibe) { window.atlasVibe = draft.vibe; document.querySelectorAll('#vibes .chip').forEach(chip => { const selected = chip.textContent === draft.vibe; chip.classList.toggle('on', selected); if (selected) chip.click(); }); } } catch {}
  const storeDraft = () => { const selected = document.querySelector('#vibes .chip.on')?.textContent || 'Culture & history'; window.atlasVibe = selected; localStorage.setItem(DRAFT, JSON.stringify({ dest: $('dest').value, days: $('days').value, notes: $('notes').value, vibe: selected })); };
  ['dest','days','notes'].forEach(id => $(id).addEventListener('input', storeDraft)); document.querySelectorAll('#vibes .chip').forEach(chip => chip.addEventListener('click', () => { window.atlasVibe = chip.textContent; storeDraft(); }));
  $('dest').setAttribute('list','atlas-location-suggestions'); const list = document.createElement('datalist'); list.id = 'atlas-location-suggestions'; $('dest').after(list);
  let geoTimer; $('dest').addEventListener('input', () => { clearTimeout(geoTimer); geoTimer = setTimeout(async () => { const query = $('dest').value.trim(); if (query.length < 3) return; try { const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`); const data = await response.json(); list.innerHTML = ''; (data.results || []).forEach(place => { const option = document.createElement('option'); option.value = [place.name, place.admin1, place.country].filter(Boolean).join(', '); option.dataset.lat = place.latitude; option.dataset.lon = place.longitude; list.appendChild(option); }); } catch {} }, 420); });
  $('dest').addEventListener('change', () => { const result = [...list.options].find(option => option.value === $('dest').value); const scene = sceneFor($('dest').value); if (result) coordinates = { lat: Number(result.dataset.lat), lon: Number(result.dataset.lon), name: result.value }; else if (scene) coordinates = { lat: scene.lat, lon: scene.lon, name: scene.name }; drawLocalDetails(coordinates.name, coordinates); });
  $('dest').addEventListener('change', () => loadPlaceImage($('dest').value));
  $('scene-chips').addEventListener('click', event => { const chip = event.target.closest('button'); if (chip) { const scene=sceneFor($('dest').value || chip.textContent); if(scene)coordinates={lat:scene.lat,lon:scene.lon,name:scene.name}; drawLocalDetails(coordinates.name,coordinates); loadPlaceImage($('dest').value || chip.textContent); } });
  document.querySelector('.navlinks a[href="#tools"]').addEventListener('click', event => { event.preventDefault(); $('tools').scrollIntoView({behavior:'smooth'}); });
  const hashMatch = location.hash.match(/#trip=(.+)$/); if (hashMatch) { try { const trip = JSON.parse(decodeURIComponent(escape(atob(hashMatch[1])))); if (trip?.days?.length) { render(trip); history.replaceState(null,'',location.pathname); } } catch { notify('This trip link could not be opened.', true); } }
  drawLocalDetails(); loadPlaceImage($('dest').value || 'Kyoto, Japan');
})();
