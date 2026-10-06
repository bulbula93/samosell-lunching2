import CatalogView from "./catalog-view"
import { type CatalogPageParams } from "@/lib/catalog-seo"
import { buildServerCatalogMetadata } from "@/lib/catalog-seo-server"

type Props = { searchParams?: Promise<CatalogPageParams> }

export async function generateMetadata({ searchParams }: Props) {
  return buildServerCatalogMetadata((await searchParams) ?? {})
}

export default async function CatalogPage({ searchParams }: Props) {
  return <CatalogView params={(await searchParams) ?? {}} />
}
