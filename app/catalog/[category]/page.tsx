import { notFound } from "next/navigation"
import CatalogView from "../catalog-view"
import { isCatalogCategory } from "@/lib/catalog-urls"
import { type CatalogPageParams } from "@/lib/catalog-seo"
import { buildServerCatalogMetadata } from "@/lib/catalog-seo-server"

type Props = {
  params: Promise<{ category: string }>
  searchParams?: Promise<CatalogPageParams>
}

async function resolveParams(props: Props) {
  const { category } = await props.params
  if (!isCatalogCategory(category)) notFound()
  const search = (await props.searchParams) ?? {}
  return { ...search, ...(search.category !== undefined ? { category_query: search.category } : {}), category }
}

export async function generateMetadata(props: Props) {
  return buildServerCatalogMetadata(await resolveParams(props))
}

export default async function CategoryPage(props: Props) {
  return <CatalogView params={await resolveParams(props)} />
}
