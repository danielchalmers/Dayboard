import { mount } from 'svelte';

import '../styles/global.css';
import Options from '../ui/Options.svelte';

mount(Options, {
  target: document.getElementById('app') ?? document.body
});
