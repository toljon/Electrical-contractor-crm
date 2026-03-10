import { redirect } from 'next/navigation'

// Preview page has been removed — PDF download is on the report detail page
export default async function PreviewRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/reports/${id}`)
}
