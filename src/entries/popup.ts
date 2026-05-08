import { mount } from 'svelte';

import '../styles/global.css';
import Popup from '../ui/Popup.svelte';

mount(Popup, {
  target: document.getElementById('app') ?? document.body
});
