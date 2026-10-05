import './styles.css';
import { startOverlay } from './overlay.ts';
import { renderSetup } from './setup.ts';

const app = document.getElementById('app')!;
const q = new URLSearchParams(location.search);
const callsign = q.get('callsign');

if (callsign) startOverlay(app, q);
else renderSetup(app);
