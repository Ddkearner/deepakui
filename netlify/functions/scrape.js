import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';

// Helper to make URLs absolute - matched from server/index.js
const makeAbsolute = (relativeUrl, baseUrl) => {
    try {
        if (!relativeUrl) return relativeUrl;
        if (relativeUrl.trim().startsWith('data:') ||
            relativeUrl.trim().startsWith('http') ||
            relativeUrl.trim().startsWith('//') ||
            relativeUrl.trim().startsWith('#') ||
            relativeUrl.trim().startsWith('mailto:') ||
            relativeUrl.trim().startsWith('tel:') ||
            relativeUrl.trim().startsWith('javascript:')) {
            return relativeUrl;
        }
        return new URL(relativeUrl, baseUrl).toString();
    } catch (e) {
        return relativeUrl;
    }
};

// Helper to rewrite URLs inside CSS content - matched from server/index.js
const rewriteCssUrls = (cssContent, baseUrl) => {
    if (!cssContent) return '';
    return cssContent.replace(/url\((['"]?)(.*?)\1\)/gi, (match, quote, url) => {
        const absoluteUrl = makeAbsolute(url, baseUrl);
        return `url(${quote}${absoluteUrl}${quote})`;
    });
};

export const handler = async (event, context) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    let url;
    try {
        const body = JSON.parse(event.body);
        url = body.url;
    } catch (e) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid JSON body' })
        };
    }

    if (!url) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'URL is required' })
        };
    }

    try {
        console.log(`Scraping: ${url}`);

        // 1. Fetch the main HTML
        const response = await axios.get(url, {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });

        const html = response.data;
        const $ = cheerio.load(html);
        const baseUrl = new URL(url);

        // 2. Process Stylesheets (Link tags) - Fetch and Inline
        const stylePromises = [];
        $('link[rel="stylesheet"]').each((i, el) => {
            const href = $(el).attr('href');
            if (href) {
                const fullUrl = makeAbsolute(href, baseUrl);
                // Reduce timeout to 3s and add minimal error handling
                const promise = axios.get(fullUrl, { timeout: 3000 }).then(resp => {
                    const rewritedCss = rewriteCssUrls(resp.data, fullUrl);
                    const styleTag = `<style>/* ${fullUrl} */\n${rewritedCss}</style>`;
                    $(el).replaceWith(styleTag);
                }).catch(err => {
                    // Fail silently for CSS to keep main process alive
                    $(el).attr('href', fullUrl);
                });

                if (stylePromises.length < 15) { // Limit to 15 parallel CSS fetches
                    stylePromises.push(promise);
                }
            }
        });

        // 3. Broad Resource Rewriting (Absolute Paths)
        $('[src], [href], [poster]').each((i, el) => {
            const $el = $(el);
            if ($el.is('link[rel="stylesheet"]')) return;

            ['src', 'href', 'poster'].forEach(attr => {
                const val = $el.attr(attr);
                if (val) {
                    $el.attr(attr, makeAbsolute(val, baseUrl));
                }
            });
        });

        // 4. Process srcset specifically
        $('[srcset]').each((i, el) => {
            const srcset = $(el).attr('srcset');
            if (srcset) {
                const newSrcset = srcset.split(',').map(part => {
                    const trimmed = part.trim();
                    const bits = trimmed.split(/\s+/);
                    if (bits.length > 0) {
                        bits[0] = makeAbsolute(bits[0], baseUrl);
                    }
                    return bits.join(' ');
                }).join(', ');
                $(el).attr('srcset', newSrcset);
            }
        });

        // 5. Process Inline Styles
        $('*[style]').each((i, el) => {
            const style = $(el).attr('style');
            if (style && style.includes('url(')) {
                $(el).attr('style', rewriteCssUrls(style, baseUrl));
            }
        });

        // 6. Cleanup
        $('*').removeAttr('integrity').removeAttr('crossorigin');

        // Optional: Inject Base Tag as catch-all
        if ($('head').length > 0) {
            $('head').prepend(`<base href="${url}">`);
        }

        // Wait for CSS fetches to finish
        await Promise.all(stylePromises);

        const finalHtml = $.html();

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ html: finalHtml })
        };

    } catch (error) {
        console.error('Scraping error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'Failed to scrape website' })
        };
    }
};
