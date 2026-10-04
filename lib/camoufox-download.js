import { DefaultAddons, maybeDownloadAddons } from 'camoufox-js/dist/addons.js';
import { ALLOW_GEOIP, downloadMMDB } from 'camoufox-js/dist/locale.js';
import { CamoufoxFetcher } from 'camoufox-js/dist/pkgman.js';

// camoufox-js 0.11.5 cannot launch Camoufox 156: it generates config properties
// (navigator.product, canvas:aaOffset and others) that 156 removed, so every
// launch fails with "Unknown property ... in config". Install the last build
// verified with this camoufox-js instead of the latest release. Raise both
// together once camoufox-js supports the newer build.
export const PINNED_CAMOUFOX_VERSION = '152.0.4-beta.31';

export class PinnedCamoufoxFetcher extends CamoufoxFetcher {
  constructor() {
    super();
    // The default first page of 30 releases would eventually drop the pin.
    this.apiUrl += '?per_page=100';
  }

  checkAsset(asset) {
    const match = super.checkAsset(asset);
    return match && match[0].fullString === PINNED_CAMOUFOX_VERSION ? match : null;
  }
}

// camoufox-js does not currently expose its fetch command from the public
// entrypoint. Use its downloader implementation directly, without spawning a
// shell or a second Node process during this package's lifecycle hook.
export async function downloadBundledCamoufox({
  createFetcher = () => new PinnedCamoufoxFetcher(),
  shouldDownloadGeoIp = ALLOW_GEOIP,
  downloadGeoIp = downloadMMDB,
  downloadAddons = maybeDownloadAddons,
} = {}) {
  const fetcher = createFetcher();
  await fetcher.install();

  if (shouldDownloadGeoIp) downloadGeoIp();
  await downloadAddons(DefaultAddons);
}
