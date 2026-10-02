export const POPULAR_BRANDS = [
  { name: "Zara", domain: "zara.com" },
  { name: "adidas", domain: "adidas.com" },
  { name: "Nike", domain: "nike.com" },
  { name: "Mango", domain: "mango.com" },
  { name: "H&M", domain: "hm.com" },
  { name: "Bershka", domain: "bershka.com" },
  { name: "Pull&Bear", domain: "pullandbear.com" },
  { name: "Stradivarius", domain: "stradivarius.com" },
  { name: "Massimo Dutti", domain: "massimodutti.com" },
  { name: "New Balance", domain: "newbalance.com" },
  { name: "Levi's", domain: "levi.com" },
  { name: "Puma", domain: "puma.com" },
  { name: "Reebok", domain: "reebok.com" },
  { name: "Uniqlo", domain: "uniqlo.com" },
  { name: "Vans", domain: "vans.com" },
  { name: "The North Face", domain: "thenorthface.com" },
  { name: "Lacoste", domain: "lacoste.com" },
  { name: "Calvin Klein", domain: "calvinklein.com" },
  { name: "Gucci", domain: "gucci.com" },
  { name: "Prada", domain: "prada.com" },
] as const

export const POPULAR_BRAND_NAMES = POPULAR_BRANDS.map((brand) => brand.name)
