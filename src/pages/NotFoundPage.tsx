import { PageHeader } from '../components/PageHeader'
import { ButtonLink } from '../components/ui/Button'

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" description="This page is not part of the workspace." />
      <ButtonLink to="/">Back to dashboard</ButtonLink>
    </>
  )
}
