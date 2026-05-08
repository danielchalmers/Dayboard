import { describe, expect, it } from 'vitest';

import { createManifest } from '../../scripts/extension-manifest.mjs';

describe('extension manifests', () => {
  it('generates the Chromium manifest without host permissions', () => {
    const manifest = createManifest('chromium');

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(['storage']);
    expect(manifest).not.toHaveProperty('host_permissions');
    expect(manifest.chrome_url_overrides).toEqual({ newtab: 'newtab.html' });
  });

  it('adds Firefox-specific release metadata only to Firefox builds', () => {
    const chromium = createManifest('chromium');
    const firefox = createManifest('firefox');

    expect(chromium).not.toHaveProperty('browser_specific_settings');
    expect(firefox.browser_specific_settings?.gecko.id).toBe('clockboard@example.invalid');
    expect(firefox.browser_specific_settings?.gecko.data_collection_permissions.required).toEqual(['none']);
  });
});
