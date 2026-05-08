export function createManifest(target: 'chromium' | 'firefox'): {
  manifest_version: 3;
  name: string;
  short_name: string;
  version: string;
  description: string;
  default_locale: string;
  icons: Record<number, string>;
  permissions: string[];
  action: {
    default_title: string;
    default_popup: string;
    default_icon: Record<number, string>;
  };
  options_ui: {
    page: string;
    open_in_tab: boolean;
  };
  chrome_url_overrides: {
    newtab: string;
  };
  browser_specific_settings?: {
    gecko: {
      id: string;
      data_collection_permissions: {
        required: string[];
      };
    };
  };
};
