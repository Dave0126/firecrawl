"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const playwright_1 = require("playwright");
const dotenv_1 = __importDefault(require("dotenv"));
const random_useragent_1 = __importDefault(require("random-useragent"));
const get_error_1 = require("./helpers/get_error");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3003;
app.use(body_parser_1.default.json());
const BLOCK_MEDIA = (process.env.BLOCK_MEDIA || 'False').toUpperCase() === 'TRUE';
const PROXY_SERVER = process.env.PROXY_SERVER || null;
const PROXY_USERNAME = process.env.PROXY_USERNAME || null;
const PROXY_PASSWORD = process.env.PROXY_PASSWORD || null;
const AD_SERVING_DOMAINS = [
    'doubleclick.net',
    'adservice.google.com',
    'googlesyndication.com',
    'googletagservices.com',
    'googletagmanager.com',
    'google-analytics.com',
    'adsystem.com',
    'adservice.com',
    'adnxs.com',
    'ads-twitter.com',
    'facebook.net',
    'fbcdn.net',
    'amazon-adsystem.com'
];
let browser;
let context;
const initializeBrowser = () => __awaiter(void 0, void 0, void 0, function* () {
    browser = yield playwright_1.chromium.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    });
    const userAgent = random_useragent_1.default.getRandom();
    const viewport = { width: 1280, height: 800 };
    const contextOptions = {
        userAgent,
        viewport,
    };
    if (PROXY_SERVER && PROXY_USERNAME && PROXY_PASSWORD) {
        contextOptions.proxy = {
            server: PROXY_SERVER,
            username: PROXY_USERNAME,
            password: PROXY_PASSWORD,
        };
    }
    else if (PROXY_SERVER) {
        contextOptions.proxy = {
            server: PROXY_SERVER,
        };
    }
    context = yield browser.newContext(contextOptions);
    if (BLOCK_MEDIA) {
        yield context.route('**/*.{png,jpg,jpeg,gif,svg,mp3,mp4,avi,flac,ogg,wav,webm}', (route, request) => __awaiter(void 0, void 0, void 0, function* () {
            yield route.abort();
        }));
    }
    // Intercept all requests to avoid loading ads
    yield context.route('**/*', (route, request) => {
        const requestUrl = new URL(request.url());
        const hostname = requestUrl.hostname;
        if (AD_SERVING_DOMAINS.some(domain => hostname.includes(domain))) {
            console.log(hostname);
            return route.abort();
        }
        return route.continue();
    });
});
const shutdownBrowser = () => __awaiter(void 0, void 0, void 0, function* () {
    if (context) {
        yield context.close();
    }
    if (browser) {
        yield browser.close();
    }
});
const isValidUrl = (urlString) => {
    try {
        new URL(urlString);
        return true;
    }
    catch (_) {
        return false;
    }
};
const scrapePage = (page, url, waitUntil, waitAfterLoad, timeout, checkSelector) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`Navigating to ${url} with waitUntil: ${waitUntil} and timeout: ${timeout}ms`);
    const response = yield page.goto(url, { waitUntil, timeout });
    if (waitAfterLoad > 0) {
        yield page.waitForTimeout(waitAfterLoad);
    }
    if (checkSelector) {
        try {
            yield page.waitForSelector(checkSelector, { timeout });
        }
        catch (error) {
            throw new Error('Required selector not found');
        }
    }
    return {
        content: yield page.content(),
        status: response ? response.status() : null,
    };
});
app.post('/scrape', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { url, wait_after_load = 0, timeout = 15000, headers, check_selector } = req.body;
    console.log(`================= Scrape Request =================`);
    console.log(`URL: ${url}`);
    console.log(`Wait After Load: ${wait_after_load}`);
    console.log(`Timeout: ${timeout}`);
    console.log(`Headers: ${headers ? JSON.stringify(headers) : 'None'}`);
    console.log(`Check Selector: ${check_selector ? check_selector : 'None'}`);
    console.log(`==================================================`);
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }
    if (!isValidUrl(url)) {
        return res.status(400).json({ error: 'Invalid URL' });
    }
    if (!PROXY_SERVER) {
        console.warn('⚠️ WARNING: No proxy server provided. Your IP address may be blocked.');
    }
    if (!browser || !context) {
        yield initializeBrowser();
    }
    const page = yield context.newPage();
    // Set headers if provided
    if (headers) {
        yield page.setExtraHTTPHeaders(headers);
    }
    let pageContent;
    let pageStatusCode = null;
    try {
        // Strategy 1: Normal
        console.log('Attempting strategy 1: Normal load');
        const result = yield scrapePage(page, url, 'load', wait_after_load, timeout, check_selector);
        pageContent = result.content;
        pageStatusCode = result.status;
    }
    catch (error) {
        console.log('Strategy 1 failed, attempting strategy 2: Wait until networkidle');
        try {
            // Strategy 2: Wait until networkidle
            const result = yield scrapePage(page, url, 'networkidle', wait_after_load, timeout, check_selector);
            pageContent = result.content;
            pageStatusCode = result.status;
        }
        catch (finalError) {
            yield page.close();
            return res.status(500).json({ error: 'An error occurred while fetching the page.' });
        }
    }
    const pageError = pageStatusCode !== 200 ? (0, get_error_1.getError)(pageStatusCode) : false;
    if (!pageError) {
        console.log(`✅ Scrape successful!`);
    }
    else {
        console.log(`🚨 Scrape failed with status code: ${pageStatusCode} ${pageError}`);
    }
    yield page.close();
    res.json({
        content: pageContent,
        pageStatusCode,
        pageError
    });
}));
app.listen(port, () => {
    initializeBrowser().then(() => {
        console.log(`Server is running on port ${port}`);
    });
});
process.on('SIGINT', () => {
    shutdownBrowser().then(() => {
        console.log('Browser closed');
        process.exit(0);
    });
});
