import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';

const app = express();
app.use(cors());
app.use(express.json());

// Helper to make URLs absolute
const makeAbsolute = (relativeUrl, baseUrl) => {
    try {
        if (!relativeUrl) return relativeUrl;
        // Data URIs, common protocols, and hashes should be left alone
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
    // Replace url(...) patterns
    return cssContent.replace(/url\((['"]?)(.*?)\1\)/gi, (match, quote, url) => {
        const absoluteUrl = makeAbsolute(url, baseUrl);
        return `url(${quote}${absoluteUrl}${quote})`;
    });
};

app.post('/api/scrape', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        console.log(`Scraping: ${url}`);

        // 1. Fetch the main HTML
        const response = await axios.get(url, {
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
                const promise = axios.get(fullUrl, { timeout: 8000 }).then(resp => {
                    const rewritedCss = rewriteCssUrls(resp.data, fullUrl);
                    const styleTag = `<style>/* ${fullUrl} */\n${rewritedCss}</style>`;
                    $(el).replaceWith(styleTag);
                }).catch(err => {
                    console.error(`Failed to load css: ${fullUrl}`);
                    $(el).attr('href', fullUrl); // Fallback to absolute
                });
                stylePromises.push(promise);
            }
        });

        // 3. Broad Resource Rewriting (Absolute Paths)
        // This covers img, script, a, video, source, and anything with src, href, poster
        $('[src], [href], [poster]').each((i, el) => {
            const $el = $(el);

            // Skip the stylesheet links we are currently inlining or have already replaced
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

        // 6. Cleanup (integrity/crossorigin can cause issues with absolute URLs if hashes don't match or CORS isn't right)
        $('*').removeAttr('integrity').removeAttr('crossorigin');

        // Optional: Inject Base Tag as catch-all
        if ($('head').length > 0) {
            $('head').prepend(`<base href="${url}">`);
        }

        // Wait for CSS fetches to finish
        await Promise.all(stylePromises);

        const finalHtml = $.html();
        res.json({ html: finalHtml });

    } catch (error) {
        console.error('Scraping error:', error);
        res.status(500).json({ error: error.message || 'Failed to scrape website' });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Scraper server running on http://localhost:${PORT}`);
});
