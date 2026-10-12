const $ = selector => document.querySelector(selector);
function userMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^Error invoking remote method 'vesper:[^']+': (?:Error: )?/, '');
}
let token = sessionStorage.getItem('vesper-browser-token') || '', profiles = [], editing = null, busy = false;
let showingTrash = false, visibleProfiles = []; const selectedProfiles = new Set();
window.vesperDesktop?.onDownload?.(value=>{$('#action-status').textContent=value.state==='completed'?`Saved ${value.filename}. Open Vesper → Show downloads to find it.`:'Download '+value.state;});
async function api(path, method = 'GET', settings, key) {
  const response = await fetch(path, { method, headers: { Authorization: `Bearer ${token}`, ...(key?{'Idempotency-Key':key}:{}), ...(settings ? { 'Content-Type': 'application/json' } : {}) }, ...(settings ? { body: JSON.stringify(settings) } : {}) });
  const data = await response.json();
  if (response.status === 401) { lock(); throw new Error('Enter the Browser access token.'); }
  if (!response.ok) throw new Error(data.error || 'Browser operation failed.');
  return data;
}
function lock() { hideNativeWorkbench(); token = ''; sessionStorage.removeItem('vesper-browser-token'); $('#workspace').hidden = true; $('#unlock').hidden = false; $('#lock').hidden = true; $('#connection').textContent = 'Local profiles'; }
function element(tag, text, className) { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; }
let showingFavorites = false, pageIndex = 0, inlineEditing = false, normalProfiles = [];
let pluginState = { installed: false, enabled: false, version: null }, workbenchOpened = false, mountObserver = null;
function renderFolderRail() {
  const query = $('#folder-search').value.trim().toLowerCase(), folders = new Map();
  for (const profile of normalProfiles) if (profile.settings.folder) folders.set(profile.settings.folder, (folders.get(profile.settings.folder) || 0) + 1);
  $('#folder-list').replaceChildren();
  for (const [name, count] of [...folders].sort(([a], [b]) => a.localeCompare(b))) {
    if (!name.toLowerCase().includes(query)) continue;
    const button = element('button', null, 'nav-item folder-item'); button.type = 'button'; button.id = 'folder-' + encodeURIComponent(name);
    button.append(element('span', name, 'folder-name'), element('span', String(count), 'nav-count'));
    button.setAttribute('aria-current', $('#folder-filter').value === name ? 'page' : 'false');
    button.addEventListener('click', () => showCollection(false, false, false, name)); $('#folder-list').append(button);
  }
  $('#no-folders').hidden = $('#folder-list').childElementCount > 0;
  $('#no-folders').textContent = folders.size ? 'No matching folders.' : 'Assign a folder while creating or editing a profile.';
}
function editable(profile) { return !busy && !profile.lease && profile.state !== 'running' && !showingTrash; }
function cell(text, className = 'cell-text') { const node = element('div', text, className); if (text) node.title = text; return node; }
function render() {
  const query = $('#search').value.trim().toLowerCase();
  const visible = profiles.filter(profile => [profile.name, profile.settings.locale, profile.settings.timezone, profile.settings.folder, profile.settings.notes, profile.settings.status, ...(profile.settings.tags || [])].join(' ').toLowerCase().includes(query) && (!$('#folder-filter').value || profile.settings.folder === $('#folder-filter').value) && ($('#state-filter').value === 'all' || profile.state === $('#state-filter').value) && (!showingFavorites || profile.settings.favorite));
  const sort = $('#sort-profiles').value;
  visible.sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'oldest' ? a.createdAt.localeCompare(b.createdAt) : sort === 'running' ? Number(b.state === 'running') - Number(a.state === 'running') || a.name.localeCompare(b.name) : b.createdAt.localeCompare(a.createdAt));
  const pageSize = Number($('#page-size').value), pageCount = Math.max(1, Math.ceil(visible.length / pageSize)); pageIndex = Math.max(0, Math.min(pageIndex, pageCount - 1));
  visibleProfiles = visible.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  document.querySelectorAll('.profile-menu').forEach(menu => menu.remove()); $('#profiles').replaceChildren();
  $('#all-count').textContent = String(normalProfiles.length); $('#count').textContent = `${visible.length ? pageIndex * pageSize + 1 : 0}–${Math.min((pageIndex + 1) * pageSize, visible.length)} of ${visible.length} profiles`;
  $('#running-count').textContent = String(normalProfiles.filter(profile => profile.state === 'running').length); $('#favorite-count').textContent = String(normalProfiles.filter(profile => profile.settings.favorite).length);
  $('#page-label').textContent = `${pageIndex + 1} / ${pageCount}`; $('#previous-page').disabled = pageIndex === 0; $('#next-page').disabled = pageIndex >= pageCount - 1;
  const selectable = visibleProfiles.filter(profile => !profile.lease); $('#select-all').checked = !!selectable.length && selectable.every(profile => selectedProfiles.has(profile.id)); $('#select-all').indeterminate = selectable.some(profile => selectedProfiles.has(profile.id)) && !$('#select-all').checked; $('#select-all').disabled = !selectable.length || busy;
  $('#empty').hidden = visible.length > 0; const filtered = query || $('#folder-filter').value || $('#state-filter').value !== 'all' || showingFavorites;
  $('#empty h2').textContent = showingTrash ? 'Trash is empty' : showingFavorites ? 'No favorite profiles' : filtered ? 'No matching profiles' : 'Create your first profile';
  $('#empty p').textContent = showingTrash ? 'Profiles moved here can be restored.' : showingFavorites ? 'Use the star beside a stopped profile to add it here.' : filtered ? 'Change the search or filter to see more profiles.' : 'Give it a name, choose its connection, then open its browser.';
  for (const profile of visibleProfiles) {
    const row = element('div', null, 'profile-row' + (selectedProfiles.has(profile.id) ? ' selected' : '')); row.dataset.profileId = profile.id; row.setAttribute('role', 'row');
    const checkbox = element('input'); checkbox.type = 'checkbox'; checkbox.checked = selectedProfiles.has(profile.id); checkbox.disabled = Boolean(profile.lease) || busy; checkbox.setAttribute('aria-label', `Select ${profile.name}`);
    checkbox.addEventListener('change', () => { checkbox.checked ? selectedProfiles.add(profile.id) : selectedProfiles.delete(profile.id); render(); });
    const favorite = element('button', profile.settings.favorite ? '★' : '☆', 'favorite-button'); favorite.type = 'button'; favorite.setAttribute('aria-label', `Favorite ${profile.name}`); favorite.setAttribute('aria-pressed', String(Boolean(profile.settings.favorite))); favorite.disabled = !editable(profile); favorite.title = editable(profile) ? 'Toggle favorite' : 'Stop the profile and finish its automation to change its favorite'; favorite.addEventListener('click', () => patchProfile(profile, { favorite: !profile.settings.favorite }));
    const identity = element('div', null, 'name-cell'); identity.append(element('div', profile.name, 'profile-name'), element('div', profile.id.slice(0, 8), 'profile-id')); identity.title = profile.name; identity.addEventListener('dblclick', () => { if (editable(profile)) inlineField(profile, 'name'); });
    const browser = cell(profile.settings.engine==='vesper'?'Vesper':profile.settings.engine === 'brave' ? 'Brave' : 'Chromium', 'browser-cell'); browser.append(element('small', profile.browserVersion?.split('/').pop() || profile.settings.locale || 'System language'));
    const proxy = cell(profile.hasProxy ? 'Saved proxy' : 'Direct', 'proxy-cell' + (profile.hasProxy ? ' saved' : ''));
    const folder = cell(profile.settings.folder || 'Unsorted', 'cell-text folder-cell' + (profile.settings.folder ? '' : ' empty-value')); folder.addEventListener('dblclick', () => { if (editable(profile)) inlineField(profile, 'folder'); });
    const notes = cell(profile.settings.notes || '—'); const tags = element('div', null, 'tag-cell'); tags.title = (profile.settings.tags || []).join(', ');
    for (const tag of (profile.settings.tags || []).slice(0, 2)) tags.append(element('span', tag, 'tag-pill')); if ((profile.settings.tags || []).length > 2) tags.append(element('span', `+${profile.settings.tags.length - 2}`, 'tag-pill'));
    const state = element('div', null, 'state-cell'); state.append(element('span', profile.state === 'running' ? 'Running' : profile.settings.status || 'Stopped', `state ${profile.state || 'stopped'}`)); if (profile.lease) state.append(element('small', 'Automation owned'));
    const actions = element('div', null, 'row-actions');
    if (showingTrash) actions.append(profileAction(profile, 'Restore', 'restore'));
    else {
      actions.append(profileAction(profile, profile.state === 'running' ? 'Stop' : 'Open', profile.state === 'running' ? 'stop' : 'start'));
      const more = element('button', '•••', 'quiet'); more.type = 'button'; more.disabled = busy; more.setAttribute('aria-label', `More actions for ${profile.name}`); more.setAttribute('aria-expanded', 'false'); more.addEventListener('click', () => showProfileMenu(profile, more)); actions.append(more);
    }
    row.append(checkbox, favorite, identity, browser, proxy, folder, notes, tags, state, actions); $('#profiles').append(row);
  }
  $('#bulk-toolbar').hidden = !selectedProfiles.size; for (const item of document.querySelectorAll('[data-bulk]')) { item.hidden = showingTrash ? item.dataset.bulk !== 'restore' : item.dataset.bulk === 'restore'; item.disabled = busy; } $('#selected-count').textContent = `${selectedProfiles.size} selected`;
  renderFolderRail();
}
function showProfileMenu(profile, more) {
  const menu = element('div', null, 'profile-menu'); menu.popover = 'auto'; menu.setAttribute('aria-label', `Actions for ${profile.name}`);
  const custom = (label, action, disabled = false) => { const button = element('button', label, 'quiet'); button.type = 'button'; button.disabled = disabled; button.addEventListener('click', () => { menu.hidePopover(); action(); }); menu.append(button); };
  custom('Rename', () => inlineField(profile, 'name'), !editable(profile)); custom('Move to folder', () => inlineField(profile, 'folder'), !editable(profile)); custom('Copy profile ID', () => copyText(profile.id));
  menu.append(element('hr'));
  for (const [name, action] of [['Edit profile', 'edit'], ['Duplicate', 'duplicate'], ['Cookies', 'cookies'], ['Export archive', 'export'], ['View environment', 'environment'], ['Move to trash', 'trash']]) menu.append(profileAction(profile, name, action, () => menu.hidePopover()));
  if (profile.lease) menu.append(element('p', 'Automation owns this profile. Finish or cancel its run in Workbench to change it.'));
  document.body.append(menu); menu.addEventListener('toggle', event => { more.setAttribute('aria-expanded', String(event.newState === 'open')); if (event.newState === 'closed') menu.remove(); }); menu.showPopover();
  const anchor = more.getBoundingClientRect(), rect = menu.getBoundingClientRect(); menu.style.left = Math.max(8, Math.min(anchor.right - rect.width, innerWidth - rect.width - 8)) + 'px'; menu.style.top = (anchor.bottom + rect.height + 8 > innerHeight ? Math.max(8, anchor.top - rect.height - 4) : anchor.bottom + 4) + 'px'; menu.querySelector('button:not(:disabled)')?.focus();
}
async function patchProfile(profile, settings) {
  busy = true; inlineEditing = false; $('#action-error').textContent = ''; render();
  try { await api(`/api/profiles/${profile.id}`, 'PATCH', settings); await refresh(); $('#action-status').textContent = 'Profile updated.'; }
  catch (error) { $('#action-error').textContent = userMessage(error); }
  finally { busy = false; render(); }
}
function inlineField(profile, field) {
  if (!editable(profile)) return; inlineEditing = true;
  const row = [...document.querySelectorAll('.profile-row')].find(row => row.dataset.profileId === profile.id), target = row.querySelector(field === 'name' ? '.name-cell' : '.folder-cell');
  const form = element('form', null, 'inline-editor'), input = element('input'); input.value = field === 'name' ? profile.name : profile.settings.folder || ''; input.maxLength = field === 'name' ? 200 : 120; input.setAttribute('aria-label', field === 'name' ? 'Profile name' : 'Profile folder'); input.required = field === 'name';
  const save = element('button', '✓'); save.type = 'submit'; save.setAttribute('aria-label', 'Save ' + field); const cancel = element('button', '×'); cancel.type = 'button'; cancel.setAttribute('aria-label', 'Cancel ' + field);
  cancel.addEventListener('click', () => { inlineEditing = false; render(); }); form.addEventListener('submit', event => { event.preventDefault(); void patchProfile(profile, { [field]: input.value.trim() }); }); input.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); inlineEditing = false; render(); } }); form.append(input, save, cancel); target.replaceChildren(form); input.focus(); input.select();
}
async function copyText(value) {
  try { await navigator.clipboard.writeText(value); $('#action-status').textContent = 'Copied to clipboard.'; }
  catch { const { content } = toolDialog('Copy profile ID'); const input = element('input'); input.readOnly = true; input.value = value; content.append(input, element('p', 'Select the value and copy it.', 'hint')); input.focus(); input.select(); }
}
function profileAction(profile,label,action,before){const button=element('button',label,action==='start'?'primary':action==='trash'?'quiet danger':'quiet');button.type='button';const running=profile.state==='running';button.disabled=busy||!!profile.lease||running&&['edit','duplicate','export','trash'].includes(action)||!running&&['cookies','environment'].includes(action);if(button.disabled)button.title=profile.lease?'This profile is owned by an automation':running?'Stop the profile before using this action':'Open the profile before using this action';button.addEventListener('click',()=>{before?.();if(action==='edit')openEditor(profile);else if(action==='export')void exportProfile(profile);else if(['cookies','environment'].includes(action))void inspectProfile(profile,action);else void operate(profile.id,action);});return button;}
async function refresh() {
  const [status, list] = await Promise.all([api('/api/status'), api('/api/profiles'+(showingTrash?'?trash=1':''))]);
  profiles = list; if (!showingTrash) normalProfiles = list; for(const id of selectedProfiles)if(!profiles.some(p=>p.id===id))selectedProfiles.delete(id);const folder=$('#folder-filter'),previous=folder.value;folder.replaceChildren(element('option','All folders'));folder.firstChild.value='';for(const name of [...new Set(profiles.map(p=>p.settings.folder).filter(Boolean))].sort()){const opt=element('option',name);opt.value=name;folder.append(opt);}folder.value=previous; $('#availability').hidden = status.available; $('#availability').textContent = status.message?.startsWith('Chromium is not installed') ? 'Install a browser runtime to open profiles. This downloads compiled browser files; no source checkout is required.' : status.message;
  $('#install-browser').hidden = status.available;
  $('#connection').textContent = status.available ? 'Browser service ready' : 'Setup needed'; render();
}
async function operate(id, action) {
  busy = true; $('#action-error').textContent = ''; render();
  try { await api(`/api/profiles/${id}/${action}`, 'POST'); await refresh(); }
  catch (error) { $('#action-error').textContent = userMessage(error); }
  finally { busy = false; render(); }
}
function proxyFields() { const mode = $('#profile-form').elements.proxyMode.value; $('#proxy-fields').hidden = !['http', 'socks5'].includes(mode); $('#profile-form').elements.host.required = !$('#proxy-fields').hidden; $('#profile-form').elements.port.required = !$('#proxy-fields').hidden; }
let extensionEditorGeneration=0;
function openEditor(profile = null, asNew = false) {
  editing = asNew ? null : profile; const form = $('#profile-form'); form.reset(); $('#form-error').textContent = '';
  form.elements.name.value = profile?.name || ''; form.elements.locale.value = profile?.settings.locale || ''; form.elements.timezone.value = profile?.settings.timezone || '';
  form.elements.engine.value=profile?.settings.engine||'chromium';
  form.elements.fingerprintProtection.value=profile?.settings.fingerprint?.protection||'standard';fingerprintFields();
  form.elements.width.value = profile?.settings.viewport?.width || ''; form.elements.height.value = profile?.settings.viewport?.height || '';
  for(const key of ['folder','notes','status'])form.elements[key].value=profile?.settings[key]||'';form.elements.tags.value=profile?.settings.tags?.join(', ')||'';form.elements.startPages.value=profile?.settings.startPages?.join('\n')||'';
  const environment=profile?.settings.environment||{};form.elements.deviceMemory.value=environment.deviceMemory||'';form.elements.cpu.value=environment.hardwareConcurrency||'';for(const key of ['webRTC','webGL','images'])if(environment[key])form.elements[key].value=environment[key];form.elements.screenWidth.value=environment.screen?.width||'';form.elements.screenHeight.value=environment.screen?.height||'';form.elements.latitude.value=environment.geolocation?.latitude??'';form.elements.longitude.value=environment.geolocation?.longitude??'';
  form.elements.proxyMode.querySelector('[value="keep"]').disabled = !profile?.hasProxy; form.elements.proxyMode.value = profile?.hasProxy ? 'keep' : 'direct';
  $('#dialog-title').textContent = editing ? 'Edit profile' : 'Create profile'; $('#save').textContent = editing ? 'Save changes' : 'Create profile'; showEditorPane('general');proxyFields(); $('#profile-dialog').showModal();loadExtensionChoices(profile);
}
function showEditorPane(name){for(const pane of document.querySelectorAll('.editor-pane'))pane.hidden=pane.dataset.pane!==name;for(const tab of document.querySelectorAll('.editor-tabs button')){const active=tab.dataset.pane===name;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;}}
for(const tab of document.querySelectorAll('.editor-tabs button')){tab.addEventListener('click',()=>showEditorPane(tab.dataset.pane));tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=[...document.querySelectorAll('.editor-tabs button')],index=tabs.indexOf(tab),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;showEditorPane(tabs[next].dataset.pane);tabs[next].focus();});}
$('#profile-form').addEventListener('invalid',event=>{const pane=event.target.closest('.editor-pane');if(pane)showEditorPane(pane.dataset.pane);},true);
$('#unlock-form').addEventListener('submit', async event => {
  event.preventDefault(); token = $('#access-token').value.trim(); $('#unlock-error').textContent = '';
  try { await refresh(); sessionStorage.setItem('vesper-browser-token', token); $('#access-token').value = ''; $('#unlock').hidden = true; $('#workspace').hidden = false; $('#lock').hidden = false; }
  catch (error) { $('#unlock-error').textContent = userMessage(error); }
});
$('#lock').addEventListener('click', lock); $('#create').addEventListener('click', () => openEditor()); $('#search').addEventListener('input', () => { pageIndex = 0; render(); });
$('#install-browser').addEventListener('click', async () => {
  const button = $('#install-browser'); button.disabled = true; button.textContent = 'Installing Chromium…';
  try { await api('/api/v1/browser/install', 'POST'); await refresh(); }
  catch (error) { $('#action-error').textContent = userMessage(error); }
  finally { button.disabled = false; button.textContent = 'Install Chromium'; }
});
$('#refresh').addEventListener('click', () => { $('#action-error').textContent = ''; void refresh().catch(error => { $('#action-error').textContent = userMessage(error); }); });
for (const selector of ['#cancel', '#cancel-top']) $(selector).addEventListener('click', () => $('#profile-dialog').close());
$('#profile-form').elements.proxyMode.addEventListener('change', proxyFields);
function fingerprintFields(){const form=$('#profile-form'),engine=form.elements.engine.value,enabled=['brave','vesper'].includes(engine);$('#fingerprint-setting').hidden=!enabled;form.elements.fingerprintProtection.disabled=!enabled;$('#native-memory-setting').hidden=engine!=='vesper';form.elements.deviceMemory.disabled=engine!=='vesper';}
$('#profile-form').elements.engine.addEventListener('change',fingerprintFields);
$('#profile-form').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget, settings = { name: form.elements.name.value.trim() };
  settings.extensions=[...form.querySelectorAll('[name=extensionId]:checked')].map(input=>input.value);
  settings.engine=form.elements.engine.value;
  settings.fingerprint={protection:['brave','vesper'].includes(settings.engine)?form.elements.fingerprintProtection.value:'off'};
  for(const key of ['folder','status','notes'])settings[key]=form.elements[key].value.trim();settings.tags=form.elements.tags.value.split(',').map(x=>x.trim()).filter(Boolean);settings.startPages=form.elements.startPages.value.split('\n').map(x=>x.trim()).filter(Boolean);
  settings.environment={webRTC:form.elements.webRTC.value,webGL:form.elements.webGL.value,images:form.elements.images.value};if(form.elements.cpu.value)settings.environment.hardwareConcurrency=Number(form.elements.cpu.value);if(settings.engine==='vesper'&&form.elements.deviceMemory.value)settings.environment.deviceMemory=Number(form.elements.deviceMemory.value);
  if(Boolean(form.elements.screenWidth.value)!==Boolean(form.elements.screenHeight.value)){ $('#form-error').textContent='Enter both screen dimensions.';return;}if(form.elements.screenWidth.value)settings.environment.screen={width:Number(form.elements.screenWidth.value),height:Number(form.elements.screenHeight.value),deviceScaleFactor:1};
  if(Boolean(form.elements.latitude.value)!==Boolean(form.elements.longitude.value)){ $('#form-error').textContent='Enter both coordinates.';return;}if(form.elements.latitude.value)settings.environment.geolocation={latitude:Number(form.elements.latitude.value),longitude:Number(form.elements.longitude.value),accuracy:10};
  if (form.elements.locale.value.trim()) settings.locale = form.elements.locale.value.trim();
  if (form.elements.timezone.value.trim()) settings.timezone = form.elements.timezone.value.trim();
  const width = form.elements.width.value, height = form.elements.height.value;
  if (Boolean(width) !== Boolean(height)) { $('#form-error').textContent = 'Enter both viewport width and height.'; return; }
  if (width && height) settings.viewport = { width: Number(width), height: Number(height) };
  const mode = form.elements.proxyMode.value;
  if (mode === 'direct' && editing) settings.proxy = null;
  if (['http', 'socks5'].includes(mode)) settings.proxy = { value: mode, extra: { host: form.elements.host.value.trim(), port: Number(form.elements.port.value), ...(form.elements.username.value ? { id: form.elements.username.value } : {}), ...(form.elements.password.value ? { secret: form.elements.password.value } : {}) } };
  $('#save').disabled = true; $('#form-error').textContent = '';
  try { await api(editing ? `/api/profiles/${editing.id}` : '/api/profiles', editing ? 'PATCH' : 'POST', settings); $('#profile-dialog').close(); await refresh(); }
  catch (error) { $('#form-error').textContent = userMessage(error); }
  finally { $('#save').disabled = false; }
});
void refresh().then(() => { $('#unlock').hidden = true; $('#workspace').hidden = false; $('#lock').hidden = false; }).catch(() => {});
setInterval(() => { if (!$('#workspace').hidden && !busy && !inlineEditing && !$('#profile-dialog').open&&!document.querySelector('.profile-menu:popover-open')) void refresh().catch(error => { $('#action-error').textContent = userMessage(error); }); }, 5000);
function toolDialog(title){if(title==='Profile templates')return toolPage('Templates','Save profile settings once, then use them to create independent profiles.','templates-view');if(title==='Engine updates')return toolPage('Browser engines','Download an engine version, then activate it after stopping your profiles.','updates-view');const dialog=element('dialog',null,'tool-dialog'),heading=element('h2',title),content=element('div'),close=element('button','Close','quiet');close.type='button';close.addEventListener('click',()=>{dialog.close();dialog.remove();});const status=element('p','','error tool-error');status.setAttribute('role','alert');dialog.append(heading,content,status,close);document.body.append(dialog);dialog.showModal();return {dialog,content};}
function setNavigation(id){for(const item of document.querySelectorAll('.nav-item'))item.setAttribute('aria-current',item.id===id?'page':'false');}
function toolPage(title,description,id){hideNativeWorkbench();setNavigation(id);$('#profile-collection').hidden=true;const page=$('#browser-tool-page');page.className='';page.hidden=false;page.replaceChildren();const heading=element('header',null,'tool-heading');heading.append(element('h1',title),element('p',description));const content=element('div',null,'tool-content'),status=element('p','','error tool-error');status.setAttribute('role','alert');page.append(heading,content,status);return {content};}
function showCollection(trash = false, running = false, favorites = false, folder = '') {
  hideNativeWorkbench(); showingTrash = trash; showingFavorites = favorites; pageIndex = 0; inlineEditing = false; selectedProfiles.clear(); $('#profile-collection').hidden = false; $('#browser-tool-page').hidden = true; $('#browser-tool-page').className = ''; $('#state-filter').value = running ? 'running' : 'all'; $('#folder-filter').value = folder;
  setNavigation(trash ? 'trash-view' : running ? 'running-view' : favorites ? 'favorites-view' : folder ? 'folder-' + encodeURIComponent(folder) : 'profiles-view');
  $('.collection-heading h1').textContent = trash ? 'Trash' : running ? 'Running profiles' : favorites ? 'Favorites' : folder || 'All profiles'; $('.collection-heading p').textContent = trash ? 'Restore profiles and keep their saved data.' : running ? 'Browser sessions currently open on this PC.' : favorites ? 'Your starred browser profiles.' : folder ? 'Profiles grouped in this folder.' : 'Organize and open your independent browser sessions.'; $('#create').hidden = trash; $('.import-button').hidden = trash; void refresh().catch(error => $('#action-error').textContent = userMessage(error));
}
function toolButton(parent,title,fn){const b=element('button',title,'quiet');b.type='button';b.addEventListener('click',async()=>{b.disabled=true;try{await fn();}catch(error){(b.closest('dialog, #browser-tool-page')?.querySelector('.tool-error')||$('#action-error')).textContent=userMessage(error);}finally{b.disabled=false;}});parent.append(b);return b;}
function downloadJSON(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=element('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function inspectProfile(profile,kind){
 try{const data=await api('/api/v1/profiles/'+profile.id+'/'+kind),{content}=toolDialog((kind==='cookies'?'Cookies: ':'Environment: ')+profile.name);
 if(kind==='environment'){const facts=element('dl',null,'environment-facts');for(const [label,value]of [['Browser',profile.settings.engine==='vesper'?'Vesper':profile.settings.engine==='brave'?'Brave':'Chromium'],['Language',data.locale],['Timezone',data.timezone],['CPU threads (page)',data.hardwareConcurrency],['Screen',data.screen?.width+' × '+data.screen?.height],['Window content',data.viewport?.width+' × '+data.viewport?.height],['Graphics renderer',data.webGL?.renderer||'Unavailable']])facts.append(element('dt',label),element('dd',String(value??'Unavailable')));content.append(facts,element('p','These values were observed in this running page. Worker and site-specific values can differ.','hint'));}
 else{const summary=element('p',data.length+' cookies in this profile. Exports contain private cookie values.','hint'),table=element('div',null,'cookie-summary');for(const cookie of data){const row=element('div');row.append(element('strong',cookie.name),element('span',cookie.domain),element('small',cookie.session||!cookie.expires||cookie.expires<0?'Session cookie':new Date(cookie.expires*1000).toLocaleDateString()));table.append(row);}content.append(summary,table);toolButton(content,'Export cookies',()=>downloadJSON(data,profile.id+'-cookies.json'));const label=element('label','Import JSON cookies'),input=element('input');input.type='file';input.accept='.json';label.append(input);content.append(label);input.addEventListener('change',async()=>{try{if(!input.files[0])return;if(input.files[0].size>60000)throw new Error('Cookie file exceeds 60 KiB.');await api('/api/v1/profiles/'+profile.id+'/cookies','POST',{cookies:JSON.parse(await input.files[0].text())});content.append(element('p','Cookies imported. Close and reopen this panel to refresh the list.','hint'));}catch(error){content.closest('dialog').querySelector('.tool-error').textContent=userMessage(error);}});}
 const details=element('details'),raw=element('pre',JSON.stringify(data,null,2));details.append(element('summary','Technical details'),raw);content.append(details);
 }catch(error){$('#action-error').textContent=userMessage(error);}
}
$('#folder-filter').addEventListener('change',render);
for(const [selector,trash]of [['#profiles-view',false],['#trash-view',true]])$(selector).addEventListener('click',()=>showCollection(trash));
$('#running-view').addEventListener('click',()=>showCollection(false,true));$('#state-filter').addEventListener('change',render);
$('#select-all').addEventListener('change',event=>{for(const profile of visibleProfiles.filter(p=>!p.lease)){if(event.target.checked)selectedProfiles.add(profile.id);else selectedProfiles.delete(profile.id);}render();});
$('#help-view').addEventListener('click',()=>{const {content}=toolPage('Getting started','Browser keeps your sessions. Workbench runs automations using the same profile store.','help-view');const list=element('ol',null,'guide-steps');for(const [title,text]of [['1. Create a browser profile','Give it a name. General settings organize the profile; Environment settings control supported native browser options.'],['2. Choose its connection','Open the Proxy tab to enter your HTTP or SOCKS5 endpoint. Direct access works without buying a proxy.'],['3. Open and work','Click Open to launch a separate browser window. Stop it before editing, duplicating or exporting it. More contains cookies and environment reports.'],['4. Automate in Workbench','Open Vesper Workbench to run scripts or flows. Enable the Workbench add-on and open it from the navigation rail. A run owns its profile until cleanup finishes.']]){const item=element('li');item.append(element('strong',title),element('p',text));list.append(item);}content.append(list);const actions=element('div',null,'guide-actions');toolButton(actions,'Create profile',()=>openEditor());toolButton(actions,'View profiles',()=>showCollection());content.append(actions);});
$('#proxies-view').addEventListener('click',async()=>{const {content}=toolPage('Proxy connections','Connections assigned to your profiles. Reusable automation proxy inventory is managed in Workbench.','proxies-view');try{const items=await api('/api/profiles');if(!items.length)content.append(element('p','Create a profile, then add connection details in its Proxy tab.'));for(const profile of items){const row=element('article',null,'proxy-assignment'),identity=element('div');identity.append(element('strong',profile.name),element('p',profile.hasProxy?'Saved proxy credentials':'Direct connection'));row.append(identity);const edit=toolButton(row,'Edit connection',()=>{openEditor(profile);showEditorPane('proxy');});edit.disabled=!!profile.lease||profile.state==='running';if(edit.disabled)edit.title='Stop the profile and finish its automation before editing';content.append(row);}}catch(error){$('#browser-tool-page .tool-error').textContent=userMessage(error);}});
for(const control of document.querySelectorAll('[data-bulk]'))control.addEventListener('click',async()=>{busy=true;try{const result=await api('/api/v1/profiles/bulk','POST',{ids:[...selectedProfiles],action:control.dataset.bulk},'bulk-'+crypto.randomUUID());const failures=result.results.filter(x=>!x.ok);$('#action-error').textContent=failures.map(x=>x.error).join('\n');selectedProfiles.clear();await refresh();}catch(error){$('#action-error').textContent=userMessage(error);}finally{busy=false;render();}});
$('#templates-view').addEventListener('click',async()=>{try{profiles=await api('/api/profiles');const templates=await api('/api/v1/templates'),{content}=toolDialog('Profile templates');content.append(element('p','Templates copy settings into independent profiles. Proxy credentials stay with their original profile.','hint'));const label=element('label','Save settings from profile'),source=element('select');for(const profile of profiles.filter(x=>!x.trashedAt)){const opt=element('option',profile.name);opt.value=profile.id;source.append(opt);}source.setAttribute('aria-label','Save settings from profile');label.append(source);content.append(label);const nameLabel=element('label','Template name'),name=element('input');nameLabel.append(name);content.append(nameLabel);toolButton(content,'Save template',async()=>{const selected=profiles.find(x=>x.id===source.value);if(!selected)throw new Error('Create a profile first.');const template=await api('/api/v1/templates','POST',{name:name.value,settings:selected.settings});appendTemplate(template);name.value='';});function appendTemplate(template){const row=element('article',null,'template-item');row.append(element('strong',template.name),element('p',`Revision ${template.revision}`,'hint'));toolButton(row,'Create profile',()=>openEditor({name:template.name,settings:template.settings,hasProxy:false},true));toolButton(row,'Export template',()=>downloadJSON(template,template.name+'-template.json'));content.append(row);}for(const template of templates)appendTemplate(template);}catch(error){$('#action-error').textContent=userMessage(error);}});
$('#updates-view').addEventListener('click',async()=>{
 const {content}=toolDialog('Engine updates'),message=element('p','Download a pinned engine, then test it. Activation requires a fresh passing test and backs up every stopped profile.','hint');
 const familyLabel=element('label','Engine'),family=element('select');for(const [value,title]of [['chromium','Chromium'],['brave','Brave — native fingerprint privacy'],['vesper','Vesper — local native kernel']]){const opt=element('option',title);opt.value=value;family.append(opt);}family.setAttribute('aria-label','Engine');familyLabel.append(family);
 const label=element('label','Pinned version or revision'),input=element('input');input.placeholder='Chromium revision or Brave 1.97.56';family.addEventListener('change',()=>{input.placeholder=family.value==='vesper'?'Full path to your compiled chrome.exe':'Chromium revision or Brave 1.97.56';});label.append(input);content.append(message,familyLabel,label);
 const stageButton=toolButton(content,'Download engine',async()=>{const native=family.value==='vesper';message.textContent=native?'Staging local kernel…':'Downloading and verifying engine…';await api(native?'/api/v1/engine/native/stage':'/api/v1/engine/stage','POST',native?{executablePath:input.value.trim()}:{buildId:input.value.trim(),family:family.value});message.textContent='Staged. Test this engine before activation.';await list();});family.addEventListener('change',()=>{stageButton.textContent=family.value==='vesper'?'Stage local kernel':'Download engine';label.firstChild.textContent=family.value==='vesper'?'Compiled executable path':'Pinned version or revision';});
 const versions=element('div');content.append(versions);async function list(){const state=await api('/api/v1/engine/versions');versions.replaceChildren();for(const item of state.staged){const name=item.family==='vesper'?'Vesper':item.family==='brave'?'Brave':'Chromium',row=element('article',null,'template-item');row.append(element('strong',name+' '+item.buildId));const qualification=item.qualification;row.append(element('p',qualification?'Engine test: '+qualification.state+' · '+new Date(qualification.completedAt||qualification.startedAt).toLocaleString()+(qualification.errors?.length?' · '+qualification.errors.join('; '):''):'Engine test: not run','hint'));toolButton(row,'Test engine',async()=>{message.textContent='Testing first scripts, frames and workers in an isolated profile…';try{const result=await api('/api/v1/engine/qualify','POST',{buildId:item.buildId,family:item.family||'chromium'});message.textContent='Engine test '+result.state+'. '+result.checks.length+' checks completed.';}finally{await list();}});toolButton(row,'Test, back up and activate',async()=>{message.textContent='Testing engine, then saving profile backups…';try{const result=await api('/api/v1/engine/activate','POST',{buildId:item.buildId,family:item.family||'chromium'});message.textContent='Activated '+name+' '+result.buildId+'. '+result.profilesBackedUp+' profiles backed up.';await refresh();}finally{await list();}});versions.append(row);}}
 try{await list();}catch(error){message.textContent=userMessage(error);}
});
function saveDownload(blob,name){const url=URL.createObjectURL(blob),a=element('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function exportProfile(profile){try{const response=await fetch(`/api/v1/profiles/${profile.id}/archive`,{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)throw new Error((await response.json()).error);saveDownload(await response.blob(),profile.name.replace(/[^a-z0-9_-]/gi,'_')+'.workbench.tgz');}catch(error){$('#action-error').textContent=userMessage(error);}}
$('#import-profile').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;busy=true;render();try{if(file.size>512*1024**2)throw new Error('Profile archive exceeds 512 MiB.');const response=await fetch('/api/v1/profiles/import',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/gzip'},body:file});if(!response.ok)throw new Error((await response.json()).error);await refresh();}catch(error){$('#action-error').textContent=userMessage(error);}finally{busy=false;event.target.value='';render();}});


function hideNativeWorkbench() {
  workbenchNavigation++;
  workbenchOpened = false; mountObserver?.disconnect(); mountObserver = null;
  if (typeof window.vesperDesktop?.hideWorkbench === 'function') void window.vesperDesktop.hideWorkbench().catch(() => {});
}
async function refreshPluginState() {
  if (typeof window.vesperDesktop?.pluginStatus !== 'function') { pluginState = { installed: false, enabled: false, version: null }; $('#workbench-view').hidden = true; return pluginState; }
  const state = await window.vesperDesktop.pluginStatus(); pluginState = { installed: Boolean(state.installed), enabled: Boolean(state.enabled), version: state.version || null }; $('#workbench-view').hidden = !(pluginState.installed && pluginState.enabled); return pluginState;
}
async function showAddons() {
  const { content } = toolPage('Add-ons', 'Add tools to your Browser workspace. Install and enable them when you need them.', 'addons-view');
  try { await refreshPluginState(); } catch (error) { content.append(element('p', userMessage(error), 'error')); return; }
  const card = element('article', null, 'addon-card'), mark = element('img'); mark.src = '/vesper-mark.svg'; mark.alt = ''; const info = element('div'); info.append(element('h2', 'Vesper Workbench'), element('p', 'Run scripts and flows against your Browser profiles. The Workbench opens inside this workspace.'), element('p', 'by true-utopian', 'hint'));
  if (typeof window.vesperDesktop?.installWorkbench !== 'function') { info.append(element('p', 'Open Vesper Browser Desktop to install this add-on. The browser-based manager cannot host native add-ons.', 'notice')); }
  else {
    info.append(element('p', pluginState.installed ? `${pluginState.enabled ? 'Enabled' : 'Disabled'}${pluginState.version ? ' · Version ' + pluginState.version : ''}` : 'Not installed', 'addon-status'));
    const actions = element('div', null, 'addon-actions');
    if (!pluginState.installed) toolButton(actions, 'Install Workbench', async () => { await window.vesperDesktop.installWorkbench(); await showAddons(); });
    else {
      toolButton(actions, 'Update add-on', async () => { await window.vesperDesktop.installWorkbench(); await showAddons(); });
      toolButton(actions, pluginState.enabled ? 'Disable add-on' : 'Enable add-on', async () => { await window.vesperDesktop.setWorkbenchEnabled(!pluginState.enabled); await showAddons(); });
      if (pluginState.enabled) toolButton(actions, 'Open Workbench', showWorkbench);
    }
    info.append(actions);
  }
  card.append(mark, info); content.append(card);
}
let workbenchNavigation = 0;
function resizeNativeWorkbench() {
  const mount = $('#workbench-mount'); if (!mount || !workbenchOpened || typeof window.vesperDesktop?.resizeWorkbench !== 'function') return;
  const bounds = mount.getBoundingClientRect();
  if (bounds.width < 1 || bounds.height < 1) return;
  void window.vesperDesktop.resizeWorkbench({ x: Math.round(bounds.x), y: Math.round(bounds.y), width: Math.round(bounds.width), height: Math.round(bounds.height) }).catch(error => { const status = $('#browser-tool-page .tool-error'); if (status) status.textContent = userMessage(error); });
}
async function showWorkbench() {
  if (typeof window.vesperDesktop?.openWorkbench !== 'function') { await showAddons(); return; }
  await refreshPluginState(); if (!pluginState.installed || !pluginState.enabled) { await showAddons(); return; }
  const { content } = toolPage('Workbench', 'Automation pipelines using your Browser profile store.', 'workbench-view'); const revision = ++workbenchNavigation;
  $('#browser-tool-page').className = 'native-workbench-page'; const mount = element('div'); mount.id = 'workbench-mount'; mount.setAttribute('aria-label', 'Native Workbench application'); mount.append(element('p', 'Opening Workbench…', 'mount-message')); content.append(mount);
  await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
  const before = mount.getBoundingClientRect(); if (before.width < 1 || before.height < 1) throw new Error('Workbench needs a visible workspace area.');
  try {
    const result = await window.vesperDesktop.openWorkbench();
    if (revision !== workbenchNavigation || $('#workbench-view').getAttribute('aria-current') !== 'page') { await window.vesperDesktop.hideWorkbench(); return; }
    if (!result.opened) throw new Error('The desktop host could not open Workbench.');
    mount.replaceChildren(); workbenchOpened = true; resizeNativeWorkbench(); mountObserver = new ResizeObserver(resizeNativeWorkbench); mountObserver.observe(mount);
  } catch (error) { mount.replaceChildren(element('p', userMessage(error), 'mount-message error')); }
}
$('#favorites-view').addEventListener('click', () => showCollection(false, false, true));
$('#folder-search').addEventListener('input', renderFolderRail);
$('#add-folder').addEventListener('click', () => { showCollection(); openEditor(); $('#profile-form').elements.folder.focus(); });
$('#clear-selection').addEventListener('click', () => { selectedProfiles.clear(); render(); });
for (const selector of ['#sort-profiles', '#state-filter', '#page-size']) $(selector).addEventListener('change', () => { pageIndex = 0; render(); });
$('#sort-name').addEventListener('click', () => { $('#sort-profiles').value = 'name'; pageIndex = 0; render(); });
$('#previous-page').addEventListener('click', () => { pageIndex--; render(); }); $('#next-page').addEventListener('click', () => { pageIndex++; render(); });
$('#addons-view').addEventListener('click', () => void showAddons());
$('#workbench-view').addEventListener('click', () => void showWorkbench().catch(error => $('#action-error').textContent = userMessage(error)));
$('#api-view').addEventListener('click', async () => {
  const { content } = toolPage('API access', 'Connect your own tools to this local Browser instance.', 'api-view');
  try {
    const capabilities = await api('/api/v1/capabilities'), facts = element('dl', null, 'api-facts');
    for (const [key, value] of [['Base URL', location.origin + '/api/v1'], ['API version', capabilities.apiVersion], ['Browser version', capabilities.version], ['Authentication', 'Bearer token']]) facts.append(element('dt', key), element('dd', String(value)));
    content.append(facts, element('p', 'Read the instance token through the Browser CLI. Tokens and profile cookies are private; keep them out of shared code.', 'hint'));
    const snippet = 'curl -H "Authorization: Bearer <your-token>" ' + location.origin + '/api/v1/profiles'; content.append(element('pre', snippet, 'api-snippet'));
    toolButton(content, 'Copy base URL', () => copyText(location.origin + '/api/v1')); toolButton(content, 'Download OpenAPI schema', async () => downloadJSON(await api('/api/v1/openapi.json'), 'vesper-browser-openapi.json'));
  } catch (error) { $('#browser-tool-page .tool-error').textContent = userMessage(error); }
});
$('#settings-view').addEventListener('click', async () => {
  const { content } = toolPage('Workspace settings', 'Control this profile list and your local Browser session.', 'settings-view');
  const list = element('div', null, 'settings-list'), rows = element('label', 'Profiles per page'), select = element('select');
  for (const value of ['25', '50', '100']) { const option = element('option', value); option.value = value; select.append(option); } select.value = $('#page-size').value; select.addEventListener('change', () => { $('#page-size').value = select.value; pageIndex = 0; localStorage.setItem('vesper-page-size', select.value); }); rows.append(select); list.append(rows);
  const shortcutHeading = element('h3', 'Keyboard shortcuts'), shortcuts = element('dl', null, 'keyboard-list');
  for (const [name, key] of [['Create profile', 'Ctrl+N'], ['Find a profile', 'Ctrl+K'], ['Refresh profiles', 'Ctrl+R'], ['Clear selection or cancel edit', 'Esc']]) { const value = element('dd'); value.append(element('kbd', key)); shortcuts.append(element('dt', name), value); }
  list.append(shortcutHeading, shortcuts); toolButton(list, 'Lock workspace', lock); toolButton(list, 'Manage browser engines', () => $('#updates-view').click()); content.append(list);
});
document.addEventListener('keydown', event => {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName), modal = document.querySelector('dialog[open]');
  if ((event.ctrlKey || event.metaKey) && !event.altKey && ['n', 'k', 'r'].includes(event.key.toLowerCase()) && !$('#workspace').hidden && !modal) {
    event.preventDefault(); if (event.key.toLowerCase() === 'n') { showCollection(); openEditor(); } else if (event.key.toLowerCase() === 'k') { showCollection(); $('#search').focus(); } else void refresh().catch(error => $('#action-error').textContent = userMessage(error));
  } else if (event.key === 'Escape' && !typing && !modal && selectedProfiles.size) { selectedProfiles.clear(); render(); }
});
const savedPageSize = localStorage.getItem('vesper-page-size'); if (['25', '50', '100'].includes(savedPageSize)) $('#page-size').value = savedPageSize;
window.addEventListener('resize', resizeNativeWorkbench);
window.vesperDesktop?.onNavigateProfiles?.(() => showCollection());
void refreshPluginState().catch(() => {});




async function loadExtensionChoices(profile){
 const generation=++extensionEditorGeneration,choices=$('#extension-choices'),save=$('#save');save.disabled=true;choices.replaceChildren(element('p','Loading local extension packages…','hint'));
 try{const [catalog,assigned]=await Promise.all([api('/api/v1/extensions'),profile?.id?api('/api/v1/profiles/'+profile.id+'/extensions'):[]]);if(generation!==extensionEditorGeneration)return;const records=[...new Map([...catalog,...assigned].map(record=>[record.id,record])).values()];choices.replaceChildren();if(!records.length)choices.append(element('p','Import an extension ZIP from Extensions in the sidebar, then assign it here.','hint'));for(const record of records){const label=element('label',null,'extension-choice'),input=element('input');input.type='checkbox';input.name='extensionId';input.value=record.id;input.checked=(profile?.settings.extensions||[]).includes(record.id);input.setAttribute('aria-label','Assign '+record.name+' '+record.version);label.append(input,element('span',record.name+' · '+record.version));choices.append(label);}save.disabled=false;}catch(error){if(generation===extensionEditorGeneration){choices.replaceChildren(element('p',userMessage(error),'error'));}}
}
$('#extensions-view').addEventListener('click',async()=>{
 const {content}=toolPage('Extensions','Import local Manifest V3 packages and assign a version to each profile.','extensions-view');
 const label=element('label','Import extension ZIP'),upload=element('input');upload.type='file';upload.accept='.zip,application/zip';upload.setAttribute('aria-label','Import extension ZIP');label.append(upload);const message=element('p','The ZIP must contain manifest.json at its root. Maximum ZIP size: 40 MiB.','hint'),list=element('div');content.append(label,message,list);
 async function refreshExtensions(){const records=await api('/api/v1/extensions');list.replaceChildren();if(!records.length)list.append(element('p','No extension packages imported yet.'));for(const record of records){const row=element('article',null,'template-item');row.append(element('strong',record.name+' · '+record.version),element('p',record.description||'Local extension package','hint'),element('p','Permissions: '+(record.permissions.join(', ')||'None')+' · Sites: '+(record.hostPermissions.join(', ')||'None'),'hint'),element('p',record.files+' files · '+(record.bytes/1024).toFixed(0)+' KiB','hint'));list.append(row);}}
 upload.addEventListener('change',async()=>{const file=upload.files?.[0];if(!file)return;upload.disabled=true;try{if(file.size>40*1024**2)throw new Error('Extension ZIP exceeds 40 MiB');const response=await fetch('/api/v1/extensions/import',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/zip'},body:file});const result=await response.json();if(!response.ok)throw new Error(result.error||'Extension import failed');message.textContent='Imported '+result.name+' '+result.version+'. Assign it in a stopped profile’s Extensions tab.';await refreshExtensions();}catch(error){message.textContent=userMessage(error);}finally{upload.disabled=false;upload.value='';}});
 try{await refreshExtensions();}catch(error){message.textContent=userMessage(error);}
});
