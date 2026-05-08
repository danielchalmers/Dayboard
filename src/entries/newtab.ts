import { mount } from 'svelte';

import '../styles/global.css';
import NewTab from '../ui/NewTab.svelte';

mount(NewTab, {
  target: document.getElementById('app') ?? document.body
});
