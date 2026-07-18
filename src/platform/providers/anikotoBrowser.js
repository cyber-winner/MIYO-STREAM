// Bundles the unmodified anikoto extension for use inside the native apps.
// The .cjs file is converted by Rollup's CommonJS plugin at build time
// (see build.commonjsOptions in vite.config.js). Cheerio is aliased to
// cheerio/slim (browser-safe, htmlparser2-based) in the Vite config.
import provider from '../../../extensions/Anime/anikoto.cjs';

export default provider;
