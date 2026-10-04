#!/usr/bin/env node
// Install the pinned Camoufox build. `npx camoufox-js fetch` would install the
// latest release, which camoufox-js 0.11.5 cannot launch.
import { downloadBundledCamoufox } from '../lib/camoufox-download.js';

await downloadBundledCamoufox();
