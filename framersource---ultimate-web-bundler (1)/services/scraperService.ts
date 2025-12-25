
import { ScrapeStatus, ScrapeLog, ScrapeResult } from '../types';

const PROXY_URL = 'https://api.allorigins.win/get?url=';

/**
 * Resolves relative URLs within CSS text to absolute URLs.
 */
const resolveCssUrls = (cssText: string, baseUrl: string): string => {
  return cssText.replace(/url\((['"]?)(.*?)\1\)/g, (match, quote, path) => {
    if (!path || path.startsWith('data:') || path.startsWith('http') || path.startsWith('//')) {
      return match;
    }
    try {
      const absoluteAssetUrl = new URL(path, baseUrl).href;
      return `url(${quote}${absoluteAssetUrl}${quote})`;
    } catch (e) {
      return match;
    }
  });
};

export const bundleFramerSite = async (
  targetUrl: string,
  onProgress: (status: ScrapeStatus, log: ScrapeLog) => void
): Promise<ScrapeResult> => {
  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    onProgress(ScrapeStatus.FETCHING, { message, type, timestamp: Date.now() });
  };

  try {
    onProgress(ScrapeStatus.FETCHING, { message: 'Initiating connection...', type: 'info', timestamp: Date.now() });
    
    const response = await fetch(`${PROXY_URL}${encodeURIComponent(targetUrl)}`);
    if (!response.ok) throw new Error('Could not reach target server.');
    
    const data = await response.json();
    const htmlContent = data.contents;
    
    onProgress(ScrapeStatus.PARSING, { message: 'Processing document map...', type: 'info', timestamp: Date.now() });
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const baseUrl = new URL(targetUrl);

    // Style Bundle
    onProgress(ScrapeStatus.INLINING_ASSETS, { message: 'Bundling visual styles...', type: 'info', timestamp: Date.now() });
    const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
    let stylesInlined = 0;

    for (const link of links) {
      const href = link.getAttribute('href');
      if (href) {
        try {
          const absoluteUrl = new URL(href, baseUrl).href;
          const cssRes = await fetch(`${PROXY_URL}${encodeURIComponent(absoluteUrl)}`);
          if (cssRes.ok) {
            const cssData = await cssRes.json();
            let cssText = cssData.contents;
            cssText = resolveCssUrls(cssText, absoluteUrl);
            const styleTag = doc.createElement('style');
            styleTag.textContent = cssText;
            link.replaceWith(styleTag);
            stylesInlined++;
          }
        } catch (e) {
          addLog(`Skipped style: ${href}`, 'warning');
        }
      }
    }

    // Asset Normalization
    onProgress(ScrapeStatus.INLINING_ASSETS, { message: 'Rewriting resource paths...', type: 'info', timestamp: Date.now() });
    const elementsWithPaths = doc.querySelectorAll('[src], [href], [poster]');
    elementsWithPaths.forEach((el) => {
      const attrName = el.hasAttribute('src') ? 'src' : 'href';
      const attrValue = el.getAttribute(attrName);
      
      if (attrValue && !attrValue.startsWith('data:') && !attrValue.startsWith('http') && !attrValue.startsWith('//') && !attrValue.startsWith('#')) {
        try {
          el.setAttribute(attrName, new URL(attrValue, baseUrl).href);
        } catch (e) {}
      }
    });

    const finalHtml = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
    onProgress(ScrapeStatus.SUCCESS, { message: 'Ready for export.', type: 'success', timestamp: Date.now() });

    return {
      html: finalHtml,
      title: doc.title || 'Downloaded Site',
      assetCount: stylesInlined,
      fileSize: finalHtml.length
    };
  } catch (error: any) {
    onProgress(ScrapeStatus.ERROR, { message: error.message || 'Error occurred during scraping.', type: 'error', timestamp: Date.now() });
    throw error;
  }
};
