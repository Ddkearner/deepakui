const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

// Helper to make URLs absolute
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

// Helper to rewrite URLs inside CSS content
const rewriteCssUrls = (cssContent, baseUrl) => {
    if (!cssContent) return '';
    return cssContent.replace(/url\((['"']?)(.*?)\1\)/gi, (match, quote, url) => {
        const absoluteUrl = makeAbsolute(url, baseUrl);
        return `url(${quote}${absoluteUrl}${quote})`;
    });
};

exports.handler = async function (event, context) {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { url } = JSON.parse(event.body);
        if (!url) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'URL is required' })
            };
        }

        console.log(`Scraping: ${url}`);

        // Fetch the main HTML
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });

        const html = response.data;
        const $ = cheerio.load(html);
        const baseUrl = new URL(url);

        // Process Stylesheets
        const stylePromises = [];
        $('link[rel="stylesheet"]').each((i, el) => {
            const href = $(el).attr('href');
            if (href) {
                const fullUrl = makeAbsolute(href, baseUrl);
                const promise = axios.get(fullUrl, { timeout: 8000 }).then(resp => {
                    const rewritedCss = rewriteCssUrls(resp.data, fullUrl);
                    $(el).replaceWith(`<style>/* ${fullUrl} */\n${rewritedCss}</style>`);
                }).catch(() => {
                    $(el).attr('href', fullUrl);
                });
                stylePromises.push(promise);
            }
        });

        // Rewrite resources
        $('[src], [href], [poster]').each((i, el) => {
            const $el = $(el);
            if ($el.is('link[rel="stylesheet"]')) return;
            ['src', 'href', 'poster'].forEach(attr => {
                const val = $el.attr(attr);
                if (val) $el.attr(attr, makeAbsolute(val, baseUrl));
            });
        });

        // Process srcset
        $('[srcset]').each((i, el) => {
            const srcset = $(el).attr('srcset');
            if (srcset) {
                const newSrcset = srcset.split(',').map(part => {
                    const bits = part.trim().split(/\s+/);
                    if (bits.length > 0) bits[0] = makeAbsolute(bits[0], baseUrl);
                    return bits.join(' ');
                }).join(', ');
                $(el).attr('srcset', newSrcset);
            }
        });

        // Inline styles
        $('*[style]').each((i, el) => {
            const style = $(el).attr('style');
            if (style && style.includes('url(')) {
                $(el).attr('style', rewriteCssUrls(style, baseUrl));
            }
        });

        $('*').removeAttr('integrity').removeAttr('crossorigin');
        if ($('head').length > 0) {
            $('head').prepend(`<base href="${url}">`);
        }

        await Promise.all(stylePromises);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ html: $.html() })
        };

    } catch (error) {
        console.error('Scraping error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Failed to scrape website' })
        };
    }
};
