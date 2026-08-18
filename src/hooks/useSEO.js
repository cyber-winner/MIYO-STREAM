import { useEffect } from 'react';

const SITE_URL = 'https://miyo-stream.cyber-winner.site';

export function useSEO({ title, description, image, url }) {
  useEffect(() => {
    // Title
    if (title) {
      document.title = `${title} | MIYO-STREAM`;
      setMetaTag('property', 'og:title', `${title} | MIYO-STREAM`);
      setMetaTag('name', 'twitter:title', `${title} | MIYO-STREAM`);
    }
    // Description
    if (description) {
      setMetaTag('name', 'description', description);
      setMetaTag('property', 'og:description', description);
      setMetaTag('name', 'twitter:description', description);
    }
    // Image
    if (image) {
      setMetaTag('property', 'og:image', image);
      setMetaTag('name', 'twitter:image', image);
    }
    // URL
    if (url) {
      setMetaTag('property', 'og:url', url);
    }
    // Canonical — auto-generate from pathname if not provided
    const canonicalUrl = url || `${SITE_URL}${window.location.pathname}`;
    setLinkTag('canonical', canonicalUrl);

    return () => {
      document.title = 'MIYO-STREAM - Watch Free Movies & TV';
      setMetaTag('property', 'og:title', 'MIYO-STREAM - Watch Free Movies & TV');
      setMetaTag('name', 'description', 'Stream movies and TV shows for free on MIYO-STREAM. No registration required.');
      setMetaTag('property', 'og:description', 'Stream movies and TV shows for free on MIYO-STREAM. No registration required.');
      setMetaTag('property', 'og:image', 'https://miyo-stream.cyber-winner.site/og-image.png');
      setMetaTag('name', 'twitter:image', 'https://miyo-stream.cyber-winner.site/og-image.png');
      setLinkTag('canonical', SITE_URL + '/');
    };
  }, [title, description, image, url]);
}

function setMetaTag(attrName, attrValue, content) {
  let element = document.querySelector(`meta[${attrName}="${attrValue}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attrName, attrValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function setLinkTag(rel, href) {
  let element = document.querySelector(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}