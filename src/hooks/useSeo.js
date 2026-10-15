import { useEffect } from "react";
import {
  SITE_URL,
  SITE_NAME,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
} from "../config/site";

// Deliberately dependency-free (no react-helmet/react-helmet-async).
// This is a client-only SPA, so there's no server render to inject tags
// into before hydration — plain useEffect + direct DOM writes is enough,
// and it keeps the whole SEO layer at zero extra npm packages.

function setMetaByName(name, content) {
  if (!content) return;
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function setMetaByProperty(property, content) {
  if (!content) return;
  let tag = document.querySelector(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("property", property);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function setCanonical(href) {
  let tag = document.querySelector('link[rel="canonical"]');
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", "canonical");
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", href);
}

/**
 * Sets per-page SEO tags. Call once near the top of any route/page component.
 *
 * @param {Object} opts
 * @param {string} [opts.title] - Page title (site name is appended automatically).
 * @param {string} [opts.description] - Meta description, ~150-160 chars is ideal.
 * @param {string} [opts.path] - Route path starting with "/", used for canonical + og:url.
 * @param {string} [opts.image] - Absolute image URL for social previews.
 * @param {boolean} [opts.noindex] - Set true for utility pages (cart, login) that shouldn't be indexed.
 */
export function useSeo({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  image = DEFAULT_OG_IMAGE,
  noindex = false,
} = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
    const url = `${SITE_URL}${path}`;

    document.title = fullTitle;

    setMetaByName("description", description);
    setMetaByName("robots", noindex ? "noindex, nofollow" : "index, follow");

    setMetaByProperty("og:title", fullTitle);
    setMetaByProperty("og:description", description);
    setMetaByProperty("og:url", url);
    setMetaByProperty("og:image", image);
    setMetaByProperty("og:type", "website");
    setMetaByProperty("og:site_name", SITE_NAME);

    setMetaByName("twitter:card", "summary_large_image");
    setMetaByName("twitter:title", fullTitle);
    setMetaByName("twitter:description", description);
    setMetaByName("twitter:image", image);

    setCanonical(url);
  }, [title, description, path, image, noindex]);
}