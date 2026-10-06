import { h } from './dom.ts';

export function renderSetup(root: HTMLElement) {
  document.body.classList.add('is-setup');

  const callsign = h('input', { name: 'callsign', placeholder: 'FAOR_TWR', required: '', autocomplete: 'off', spellcheck: 'false' });
  const airport = h('input', { name: 'airport', placeholder: 'from callsign', maxlength: '4', autocomplete: 'off', spellcheck: 'false' });
  const url = h('input', { readonly: '', class: 'url' });
  const copy = h('button', { type: 'button' }, 'Copy');
  const open = h('a', { target: '_blank' }, 'Open overlay ↗');
  const result = h('div.result', {}, h('label', {}, 'OBS Browser Source URL', h('div.url-row', {}, url, copy)), open);
  result.hidden = true;

  const form = h(
    'form',
    {},
    h('h1', 'Tower overlay'),
    h('p.hint', 'Enter the position you are controlling. Live VATSIM data for its airport is shown in the lower third.'),
    h('label', {}, 'Position callsign', callsign),
    h('label', {}, 'Airport ICAO (optional override)', airport),
    h('button', { type: 'submit' }, 'Create overlay URL'),
    result,
    h('p.hint', 'In OBS: Sources → + → Browser. Paste the URL, set width 1920 and height 1080, and tick “Control audio via OBS” so the board’s flap sound goes to the mixer (mute it there if you don’t want it).'),
  );

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = new URLSearchParams({ callsign: callsign.value.trim().toUpperCase() });
    if (airport.value.trim()) q.set('airport', airport.value.trim().toUpperCase());
    url.value = `${location.origin}/?${q}`;
    open.href = url.value;
    result.hidden = false;
  });
  copy.addEventListener('click', async () => {
    await navigator.clipboard.writeText(url.value);
    copy.textContent = 'Copied';
    setTimeout(() => (copy.textContent = 'Copy'), 1500);
  });

  root.append(h('main.setup', {}, form));
  callsign.focus();
}
