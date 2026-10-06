// Read-only HTTP verification. Optional protection bypass is supplied via env,
// never written to output. Run against a production-build local server or Preview.
import { JSDOM } from "jsdom"
import assert from "node:assert/strict"

const base = process.env.SEO_VERIFY_BASE_URL || "http://localhost:3000"
const bypass = process.env.SEO_VERIFY_BYPASS
const headers = {
  "user-agent": "Googlebot",
  ...(bypass ? { "x-vercel-protection-bypass": bypass } : {}),
}
const categories = ["women", "men", "kids", "footwear", "bags", "vintage", "accessories", "perfume"]
const titles = new Set()
const descriptions = new Set()
const results = []

async function read(path, redirect = "manual") {
  const response = await fetch(new URL(path, base), { headers, redirect, signal: AbortSignal.timeout(45_000) })
  return { response, html: await response.text() }
}

async function verify(path, canonical, indexable) {
  const { response, html } = await read(path)
  assert.equal(response.status, 200, `${path}: status`)
  const document = new JSDOM(html).window.document
  assert.equal(document.querySelector('link[rel="canonical"]')?.getAttribute("href"), canonical, `${path}: canonical`)
  const robots = Array.from(document.querySelectorAll('meta[name="robots"]')).map((el) => el.content).join(",")
  assert.equal(robots.includes("noindex"), !indexable, `${path}: robots`)
  assert.ok(robots.includes("follow"), `${path}: follow`)
  assert.equal(document.querySelectorAll("h1").length, 1, `${path}: H1`)
  assert.ok(document.querySelector("h1")?.textContent.trim(), `${path}: H1 text`)
  const title = document.querySelector("title")?.textContent
  const description = document.querySelector('meta[name="description"]')?.content
  assert.ok(title && description, `${path}: metadata`)
  const links = Array.from(document.querySelectorAll("a[href]")).map((el) => el.getAttribute("href"))
  assert.ok(links.includes("/catalog/women"), `${path}: crawlable category links`)
  assert.ok(!links.some((href) => /^\/catalog\?category=(women|men|kids|footwear|bags|vintage|accessories|perfume)(?:&|$)/.test(href)), `${path}: old internal links`)
  const listingLinks = links.filter((href) => href.startsWith("/listing/"))
  const schema = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((el) => JSON.parse(el.textContent))
  if (indexable) {
    assert.ok(schema.some((entry) => entry["@graph"]?.some((node) => node["@type"] === "CollectionPage" && node.url === canonical)), `${path}: CollectionPage URL`)
    assert.ok(!JSON.stringify(schema).includes("?category="), `${path}: structured URLs`)
  }
  results.push({ path, status: response.status, canonical, robots, h1: document.querySelector("h1").textContent, listingLinks: listingLinks.length })
  return { title, description, listingLinks }
}

for (const category of categories) {
  const path = `/catalog/${category}`
  const page = await verify(path, `https://samosell.ge${path}`, true)
  titles.add(page.title)
  descriptions.add(page.description)
  const { response } = await read(`/catalog?category=${category}&size=M&brand=Zara&color=red&color=blue&page=2`)
  assert.equal(response.status, 308)
  const location = new URL(response.headers.get("location"), base)
  assert.equal(location.pathname, path)
  assert.equal(location.searchParams.has("category"), false)
  assert.equal(location.searchParams.get("brand"), "Zara")
  assert.equal(location.searchParams.get("size"), "M")
  assert.equal(location.searchParams.get("page"), "2")
  assert.deepEqual(location.searchParams.getAll("color"), ["red", "blue"])
}
assert.equal(titles.size, 8)
assert.equal(descriptions.size, 8)
for (const query of ["size=M", "sort=price_asc", "q=zara"]) {
  await verify(`/catalog/women?${query}`, "https://samosell.ge/catalog/women", false)
}
await verify("/catalog/accessories?page=2", "https://samosell.ge/catalog/accessories?page=2", true)
for (const path of ["/catalog/not-a-real-category", "/catalog/Women", "/&", "/$"]) {
  const { response } = await read(path)
  assert.equal(response.status, 404, `${path}: true 404`)
}
const { response, html: xml } = await read("/sitemap.xml")
assert.equal(response.status, 200, "sitemap: status")
assert.ok(!xml.includes("?category="), "sitemap: old category URLs")
assert.ok(!/favicon|opengraph-image|catalog-not-found/.test(xml), "sitemap: asset/error URLs")
const sitemapUrls = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), (match) => match[1])
const categoryEntries = sitemapUrls.filter((url) => url.startsWith("https://samosell.ge/catalog/"))
for (const url of categoryEntries) {
  const path = new URL(url).pathname
  assert.ok(categories.includes(path.split("/").at(-1)))
  assert.ok(results.find((result) => result.path === path)?.listingLinks > 0, `${path}: sitemap requires real active listings in SSR HTML`)
}
console.log(JSON.stringify({ base, categoryPages: results, uniqueTitles: titles.size, uniqueDescriptions: descriptions.size, categoryEntries, sitemapListings: sitemapUrls.filter((url) => url.includes("/listing/")).length, sitemapSellers: sitemapUrls.filter((url) => url.includes("/seller/")).length, status: "PASS" }, null, 2))
