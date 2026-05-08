import packageJson from '../package.json' with { type: 'json' };

const commonIcons = {
  16: 'icons/icon-16.png',
  32: 'icons/icon-32.png',
  48: 'icons/icon-48.png',
  128: 'icons/icon-128.png'
};

export function createManifest(target) {
  const manifest = {
    manifest_version: 3,
    name: '__MSG_extensionName__',
    short_name: 'Clockboard',
    version: packageJson.version,
    description: '__MSG_extensionDescription__',
    default_locale: 'en',
    icons: commonIcons,
    permissions: ['storage'],
    action: {
      default_title: 'Clockboard',
      default_popup: 'popup.html',
      default_icon: commonIcons
    },
    options_ui: {
      page: 'options.html',
      open_in_tab: true
    },
    chrome_url_overrides: {
      newtab: 'newtab.html'
    }
  };

  if (target === 'firefox') {
    manifest.browser_specific_settings = {
      gecko: {
        id: 'clockboard@example.invalid',
        data_collection_permissions: {
          required: ['none']
        }
      }
    };
  }

  return manifest;
}
