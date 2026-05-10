import { describe, expect, it } from 'vitest';

import { createManifest } from '../../scripts/extension-manifest.mjs';

describe('extension manifests', () => {
  it('generates the Chromium manifest without host permissions', () => {
    const manifest = createManifest();

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(['storage']);
    expect(manifest).not.toHaveProperty('host_permissions');
    expect(manifest).not.toHaveProperty('browser_specific_settings');
    expect(manifest.chrome_url_overrides).toEqual({ newtab: 'newtab.html' });
  });
});
