import { LandingProductPreview } from "./product-preview"

export default async function ProductPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ surface?: string }>
}) {
  const { surface } = await searchParams

  return <LandingProductPreview surface={surface === "competitor" ? "competitor" : "overview"} />
}
