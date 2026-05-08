import EntryShell from '../ui/EntryShell.svelte';
import '../styles/global.css';
import { mount } from 'svelte';

mount(EntryShell, {
  target: document.getElementById('app') ?? document.body,
  props: {
    title: 'Clockboard',
    subtitle: 'New tab dashboard'
  }
});
