/*************
 *** SETUP ***
 *************/

// Puppeteer doc : https://pptr.dev/
const puppeteer = require("puppeteer");
const readline = require("readline");
const http = require("http");
const https = require("https");
const URL = require("url").URL;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/*****************
 *** FUNCTIONS ***
 *****************/

// Main function to start up things
async function main() {
  rl.question("Enter the URL of the starting webpage: ", async (url) => {
    try {
      const browser = await initializeBrowser();
      const page = await initializePage(browser);
      await processUrl(url, page);
      await browser.close();
      rl.close();
    } catch (error) {
      console.error("Error occurred:", error);
      rl.close();
    }
  });
}

// Launch Puppeteer
// ! Read deprecation warning at the bottom of this file !
async function initializeBrowser() {
  return puppeteer.launch();
}

// Open blank webpage in Puppeteer
async function initializePage(browser) {
  const page = await browser.newPage();
  // Note : if you want to use a custom user-agent which doesn't include "HeadlessChrome", put it here :
  // await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36');
  return page;
}

// Set Arrays of URL's ToVisit/Visited
// Crawl internal links and pages
async function processUrl(url, page) {
  let urlsToVisit = new Set([url]);
  let visitedUrls = new Set();

  while (urlsToVisit.size > 0) {
    const currentUrl = urlsToVisit.values().next().value;
    urlsToVisit.delete(currentUrl);

    if (visitedUrls.has(currentUrl)) continue;

    try {
      // https://www.browserless.io/blog/2023/08/22/waituntil-option-for-puppeteer-and-playwright/
      // https://pptr.dev/api/puppeteer.puppeteerlifecycleevent
      await page.goto(currentUrl, { waitUntil: "networkidle2" });
      visitedUrls.add(currentUrl);
      console.log();
      console.log(`Currently testing: ${currentUrl}`);
      console.log();

      const links = await extractLinks(page);

      links.forEach((link) => {
        if (isInternalLink(link, url) && !visitedUrls.has(link)) {
          urlsToVisit.add(link);
        }
      });

      await checkLinkStatus(links);
    } catch (error) {
      console.error(`Error occurred while accessing: ${currentUrl}`, error);
    }
  }
}

// Extract links from the current page
async function extractLinks(page) {
  return page.$$eval("a", (as) => as.map((a) => a.href));
}

// Determines if the link is an internal link relative to the base URL
function isInternalLink(link, baseUrl) {
  try {
    const linkUrl = new URL(link, baseUrl);
    const base = new URL(baseUrl);
    return linkUrl.origin === base.origin;
  } catch (error) {
    return false;
  }
}

// Write in the console the status of each tested link
async function checkLinkStatus(links) {
  for (const link of links) {
    const requestModule = link.startsWith("https") ? https : http;
    requestModule
      .get(link, (res) => {
        const statusMessage =
          // ANSI Escape Sequences => https://gist.github.com/fnky/458719343aabd01cfb17a3a4f7296797
          // \x1b[31m => Sets the text color to red
          // \x1b[0m => Resets the text formatting to the terminal's default
          res.statusCode === 200
            ? `Status: ${res.statusCode} - Link: ${link}`
            : `\x1b[31mStatus: ${res.statusCode} - Link: ${link}\x1b[0m`;
        https: console.log(statusMessage);
        res.on("data", () => {});
      })
      .on("error", (err) => {
        console.log(`\x1b[31mError: ${err.message} - Link: ${link}\x1b[0m`);
      });
  }
}

// Start the whole process
main();

// NOTE from Puppeteer 21.5.2 :
/*
   Puppeteer old Headless deprecation warning:
    In the near future `headless: true` will default to the new Headless mode
    for Chrome instead of the old Headless implementation. For more
    information, please see https://developer.chrome.com/articles/new-headless/.
    Consider opting in early by passing `headless: "new"` to `puppeteer.launch()`
    If you encounter any bugs, please report them to https://github.com/puppeteer/puppeteer/issues/new/choose.
*/
// => puppeteer.launch({headless: "new"}) tested on 2023-11-23 and buggy
