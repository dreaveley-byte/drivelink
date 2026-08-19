import { createClient } from '@/lib/supabase/server'
import { requiredDocsForApplicationType, type LegalDocSlug } from '@/lib/legalDocuments'

export type OutstandingLegalDoc = {
  slug: LegalDocSlug
  title: string
  version: number
}

// Compares the current version of every document required for a given
// application type against what the user has actually accepted. Used both by
// the apply flows (implicitly, via LegalDocumentChecklist) and by the
// re-sign gate for already-approved drivers/dealers.
export async function getOutstandingLegalDocs(
  userId: string,
  applicationType: 'driver' | 'dealer'
): Promise<OutstandingLegalDoc[]> {
  const supabase = await createClient()
  const requiredSlugs = requiredDocsForApplicationType(applicationType)

  const { data: currentDocs } = await supabase
    .from('legal_documents')
    .select('slug, version, title')
    .in('slug', requiredSlugs)
    .eq('is_current', true)

  if (!currentDocs || currentDocs.length === 0) return []

  const { data: acceptances } = await supabase
    .from('legal_acceptances')
    .select('document_slug, document_version')
    .eq('user_id', userId)
    .in('document_slug', requiredSlugs)

  const acceptedVersions = new Map<string, Set<number>>()
  for (const a of acceptances ?? []) {
    const set = acceptedVersions.get(a.document_slug) ?? new Set<number>()
    set.add(a.document_version)
    acceptedVersions.set(a.document_slug, set)
  }

  return currentDocs
    .filter((doc) => !acceptedVersions.get(doc.slug)?.has(doc.version))
    .map((doc) => ({ slug: doc.slug as LegalDocSlug, title: doc.title, version: doc.version }))
}
