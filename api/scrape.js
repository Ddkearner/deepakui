import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';

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
    return cssContent.replace(/url\((['"]?)(.*?)\1\)/gi, (match, quote, url) => {
        const absoluteUrl = makeAbsolute(url, baseUrl);
        return `url(${quote}${absoluteUrl}${quote})`;
    });
};

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        console.log(`Scraping: ${url}`);

        // 1. Fetch main HTML with strict 6s timeout
        const response = await axios.get(url, {
            timeout: 6000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });

        const html = response.data;
        const $ = cheerio.load(html);
        const baseUrl = new URL(url);

        // 2. Process Stylesheets
        const stylePromises = [];
        $('link[rel="stylesheet"]').each((i, el) => {
            const href = $(el).attr('href');
            if (href) {
                const fullUrl = makeAbsolute(href, baseUrl);
                const promise = axios.get(fullUrl, { timeout: 3000 })
                    .then(resp => {
                        const rewritedCss = rewriteCssUrls(resp.data, fullUrl);
                        const styleTag = `<style>/* ${fullUrl} */\n${rewritedCss}</style>`;
                        $(el).replaceWith(styleTag);
                    })
                    .catch(err => {
                        console.error(`Failed to load css: ${fullUrl}`);
                        $(el).attr('href', fullUrl);
                    });
                stylePromises.push(promise);
            }
        });

        // 3. Broad Resource Rewriting
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

        // 4. Process srcset
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

        if ($('head').length > 0) {
            $('head').prepend(`<base href="${url}">`);
        }

        // Wait for styles, but timeout explicitly
        const stylesTimeout = new Promise(resolve => setTimeout(resolve, 3000));
        await Promise.race([Promise.all(stylePromises), stylesTimeout]);

        const finalHtml = $.html();

        res.status(200).json({ html: finalHtml });

    } catch (error) {
        console.error('Scraping error:', error);
        res.status(500).json({ error: error.message || 'Scraping failed or timed out' });
    }
}
