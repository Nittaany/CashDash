const { SitemapStream, streamToPromise } = require("sitemap");
const { createWriteStream } = require("fs");
const path = require("path");

// Define your website's base URL (use env var or default)
const siteUrl = process.env.SITE_URL || "https://cash-dash-one.vercel.app";
const routes = [
  "/",
  "/login",
  "/register",
];

// Generate sitemap
async function generateSitemap() {
    const sitemapPath = path.join(__dirname, "public", "sitemap.xml");
    const sitemapStream = new SitemapStream({ hostname: siteUrl });
  
    // Create a writable stream for the file
    const writeStream = createWriteStream(sitemapPath);
    sitemapStream.pipe(writeStream);
  
    for (const route of routes) {
      sitemapStream.write({ url: route, changefreq: "daily", priority: 0.8 });
    }
  
    sitemapStream.end();
    await streamToPromise(sitemapStream);
  
    console.log("Sitemap successfully generated!");
  }
  
  // Run the function
  generateSitemap().catch(console.error);
