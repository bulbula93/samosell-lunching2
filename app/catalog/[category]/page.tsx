import { notFound } from "next/navigation"
import CatalogView from "../catalog-view"
import { isCatalogCategory } from "@/lib/catalog-urls"
import { buildCatalogMetadata, type CatalogPageParams } from "@/lib/catalog-seo"

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
  return buildCatalogMetadata(await resolveParams(props))
}

export default async function CategoryPage(props: Props) {
  return <CatalogView params={await resolveParams(props)} />
}
