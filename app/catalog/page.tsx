import CatalogView from "./catalog-view"
import { buildCatalogMetadata, type CatalogPageParams } from "@/lib/catalog-seo"

type Props = { searchParams?: Promise<CatalogPageParams> }

export async function generateMetadata({ searchParams }: Props) {
  return buildCatalogMetadata((await searchParams) ?? {})
}

export default async function CatalogPage({ searchParams }: Props) {
  return <CatalogView params={(await searchParams) ?? {}} />
}
