import { expect,it } from "vitest"
import { classifyViewport,getDocumentMetricContext } from "@/lib/web-vitals-context"
it.each([[360,"phone"],[390,"phone"],[767,"phone"],[768,"tablet"],[1024,"tablet"],[1440,"desktop"],[1905,"desktop"]] as const)("classifies %s px as %s",(width,bucket)=>expect(classifyViewport(width)).toBe(bucket))
it("attributes finalized metrics to the original document after SPA navigation",()=>{
 expect(getDocumentMetricContext("https://samosell.ge/", "https://samosell.ge/listing/item")).toEqual({pathname:"/",routeGroup:"home"})
 expect(getDocumentMetricContext("https://samosell.ge/catalog?q=nike", "https://samosell.ge/listing/item")).toEqual({pathname:"/catalog",routeGroup:"search"})
})
