export type AgreementDocText = {
  slug: string
  title: string
  version: number | null
  acceptedAt: string | null
  body: string | null
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })
}

// Prints the complete wording of every agreement the person accepted - the
// exact version they accepted, not just a tick - so a printed copy stands on
// its own as the signed contract. Each document starts on a new printed page.
export default function AgreementFullText({ docs, signerName, signatureUrl, signedAt }: {
  docs: AgreementDocText[]
  signerName: string
  signatureUrl: string | null
  signedAt: string | null
}) {
  return (
    <div className="mt-10">
      {docs.map((d, i) => (
        <section key={d.slug} className="border-t border-gray-300 pt-6 mt-8 print:mt-0 print:pt-0 print:border-0" style={i === 0 ? undefined : { breakBefore: 'page' }}>
          <h2 className="text-base font-semibold text-gray-900">{d.title}</h2>
          <p className="text-xs text-gray-500 mb-3">
            {d.version != null ? `Version ${d.version}` : 'Version not recorded'}
            {d.acceptedAt ? ` — accepted by ${signerName} on ${fmt(d.acceptedAt)}` : ' — NOT accepted'}
          </p>
          {d.body ? (
            <div className="text-[13px] leading-relaxed text-gray-800 whitespace-pre-line">{d.body}</div>
          ) : (
            <p className="text-sm text-red-600">The text of this document version could not be loaded.</p>
          )}
        </section>
      ))}

      <section className="mt-10 pt-6 border-t border-gray-300" style={{ breakInside: 'avoid' }}>
        <p className="text-sm text-gray-800 mb-3">
          By signing below, {signerName} confirms they have read, understood and agree to all of the documents above.
        </p>
        {signatureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={signatureUrl} alt="Signature" className="border border-gray-200 rounded-lg max-w-xs bg-white" />
        ) : (
          <p className="text-sm text-gray-400">No signature on file.</p>
        )}
        <p className="text-xs text-gray-500 mt-2">
          {signerName}{signedAt ? ` — signed ${fmt(signedAt)}` : ''}
        </p>
      </section>
    </div>
  )
}
