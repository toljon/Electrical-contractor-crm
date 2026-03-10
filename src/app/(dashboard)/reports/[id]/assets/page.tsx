import { redirect } from 'next/navigation'

// Assets page has been replaced by the readings page
export default async function AssetsRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/reports/${id}/readings`)
}
