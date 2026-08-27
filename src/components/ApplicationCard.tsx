'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Doc = { label: string; path: string | null }

export default function ApplicationCard({
  table,
  id,
  title,
  subtitle,
  status,
  bucket,
  docs,
  userId,
  profilePhotoPath,
  vehiclePhotoPath,
  vehicleYear,
  vehicleMake,
  vehicleModel,
  licenseClass,
  extractedLicenseClass,
  canTowTrailer,
  preferredJobTypes,
  driverFullName,
  driverPhone,
  dealerSubmittedBy,
  dealerOrganizationId,
  dealerBusinessName,
}: {
  table: 'driver_applications' | 'dealer_applications'
  id: string
  title: string
  subtitle: string
  status: string
  bucket: 'driver-documents' | 'dealer-documents'
  docs: Doc[]
  userId?: string
  profilePhotoPath?: string | null
  vehiclePhotoPath?: string | null
  vehicleYear?: number | null
  vehicleMake?: string | null
  vehicleModel?: string | null
  licenseClass?: string | null
  extractedLicenseClass?: string | null
  canTowTrailer?: boolean | null
  preferredJobTypes?: string[] | null
  driverFullName?: string | null
  driverPhone?: string | null
  dealerSubmittedBy?: string
  dealerOrganizationId?: string | null
  dealerBusinessName?: string | null
}) {
  const router = useRouter()
  const [showDocs, setShowDocs] = useState(false)
  const [links, setLinks] = useState<Record<string, string>>({})
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [updating, setUpdating] = useState(false)

  const statusStyles: Record<string, string> = {
    pending: 'border-gray-300 text-gray-700',
    in_review: 'border-blue-300 text-blue-700',
    approved: 'border-green-300 text-green-700',
    rejected: 'border-red-300 text-red-700',
  }

  async function toggleDocs() {
    if (showDocs) {
      setShowDocs(false)
      return
    }
    setLoadingDocs(true)
    const supabase = createClient()
    const entries: Record<string, string> = {}
    for (const doc of docs) {
      if (!doc.path) continue
      const { data } = await supabase.storage.from(bucket).createSignedUrl(doc.path, 60 * 10)
      if (data?.signedUrl) entries[doc.label] = data.signedUrl
    }
    setLinks(entries)
    setLoadingDocs(false)
    setShowDocs(true)
  }

  async function updateStatus(newStatus: string) {
    setUpdating(true)
    const supabase = createClient()

    if (newStatus === 'approved') {
      if (table === 'driver_applications' && userId) {
        // Copy their profile photo to the public bucket so it can be shown on job
        // cards without needing a signed URL every time.
        if (profilePhotoPath) {
          const { data: fileBlob } = await supabase.storage.from('driver-documents').download(profilePhotoPath)
          if (fileBlob) {
            const ext = profilePhotoPath.split('.').pop() || 'jpg'
            const publicPath = `${userId}/photo.${ext}`
            await supabase.storage.from('driver-photos').upload(publicPath, fileBlob, { upsert: true })
            const { data: urlData } = supabase.storage.from('driver-photos').getPublicUrl(publicPath)
            await supabase.from('profiles').update({ photo_url: urlData.publicUrl }).eq('id', userId)
          }
        }
        // Same pattern for the vehicle photo - the customer tracking page for
        // a ride needs to show the actual car showing up, not just the
        // driver's face, so this needs to be public-bucket accessible too.
        if (vehiclePhotoPath) {
          const { data: fileBlob } = await supabase.storage.from('driver-documents').download(vehiclePhotoPath)
          if (fileBlob) {
            const ext = vehiclePhotoPath.split('.').pop() || 'jpg'
            const publicPath = `${userId}/vehicle.${ext}`
            await supabase.storage.from('driver-photos').upload(publicPath, fileBlob, { upsert: true })
            const { data: urlData } = supabase.storage.from('driver-photos').getPublicUrl(publicPath)
            await supabase.from('profiles').update({ vehicle_photo_url: urlData.publicUrl }).eq('id', userId)
          }
        }
        if (vehicleYear || vehicleMake || vehicleModel) {
          await supabase.from('profiles').update({ vehicle_year: vehicleYear, vehicle_make: vehicleMake, vehicle_model: vehicleModel }).eq('id', userId)
        }
        if (licenseClass || extractedLicenseClass || canTowTrailer != null || preferredJobTypes) {
          await supabase.from('profiles').update({
            license_class: licenseClass ?? null,
            extracted_license_class: extractedLicenseClass ?? null,
            can_tow_trailer: canTowTrailer ?? null,
            preferred_job_types: preferredJobTypes ?? null,
          }).eq('id', userId)
        }
        // This is the actual activation step — without it, an "approved" driver
        // never shows up in the admin drivers list or is able to claim jobs.
        // Also copies name/phone from the application, since the profile itself
        // never collects these anywhere else — without this, every approved
        // driver would show up as "Unnamed driver, no phone on file". Also
        // assigns a unique, human-readable Driver ID (DRV-1001, DRV-1002, etc.)
        // for identification purposes.
        const { data: newDriverCode } = await supabase.rpc('generate_driver_code')
        const { error: activateError } = await supabase
          .from('profiles')
          .update({
            role: 'driver',
            driver_code: newDriverCode,
            ...(driverFullName && { full_name: driverFullName }),
            ...(driverPhone && { phone: driverPhone }),
          })
          .eq('id', userId)
        if (activateError) {
          setUpdating(false)
          alert(`Approved, but activating the driver's account failed: ${activateError.message}. They may not show up correctly — contact support if this persists.`)
          return
        }
      }

      if (table === 'dealer_applications' && dealerSubmittedBy) {
        let orgId = dealerOrganizationId ?? null

        if (!orgId) {
          const { data: newOrg, error: orgError } = await supabase
            .from('organizations')
            .insert({ name: dealerBusinessName || 'New Dealer', org_type: 'dealer_customer' })
            .select('id')
            .single()
          if (orgError || !newOrg) {
            setUpdating(false)
            alert(`Could not create this dealer's organization: ${orgError?.message ?? 'unknown error'}. The dealer was not activated — nothing was approved yet, try again.`)
            return
          }
          orgId = newOrg.id
          await supabase.from('dealer_applications').update({ organization_id: orgId }).eq('id', id)
        }

        // Same idea as the driver activation above — without linking the org,
        // an "approved" dealer never gets a working dashboard or shows up for admin.
        const { error: linkError } = await supabase.from('profiles').update({ organization_id: orgId, role: 'org_admin' }).eq('id', dealerSubmittedBy)
        if (linkError) {
          setUpdating(false)
          alert(`Organization was created, but linking the dealer's account to it failed: ${linkError.message}. They won't show up correctly yet — contact support if retrying doesn't fix it.`)
          return
        }
      }
    }

    const { error: statusError } = await supabase.from(table).update({ status: newStatus }).eq('id', id)
    setUpdating(false)
    if (statusError) {
      alert(`Could not update the application status: ${statusError.message}`)
      return
    }
    router.refresh()
  }

  return (
    <div className="border border-gray-200 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          {preferredJobTypes && preferredJobTypes.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {preferredJobTypes.map((jt) => (
                <span key={jt} className="text-[10px] border border-gray-200 text-gray-500 rounded-full px-2 py-0.5">
                  {jt}
                </span>
              ))}
            </div>
          )}
        </div>
        <span className={`text-xs border rounded-full px-2.5 py-1 whitespace-nowrap ${statusStyles[status] ?? 'border-gray-300 text-gray-700'}`}>
          {status.replace('_', ' ')}
        </span>
      </div>

      <div className="flex items-center gap-3 mt-3">
        <button onClick={toggleDocs} className="text-xs text-gray-600 hover:text-gray-900 underline">
          {loadingDocs ? 'Loading...' : showDocs ? 'Collapse documents' : 'Expand all documents & uploads'}
        </button>

        {status !== 'approved' && (
          <button
            onClick={() => updateStatus('approved')}
            disabled={updating}
            className="text-xs bg-[#378ADD] text-white px-3 py-1 rounded-lg hover:bg-[#2d6ead] disabled:opacity-50"
          >
            Approve
          </button>
        )}
        {status !== 'rejected' && (
          <button
            onClick={() => updateStatus('rejected')}
            disabled={updating}
            className="text-xs border border-gray-300 text-gray-600 px-3 py-1 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Reject
          </button>
        )}
      </div>

      {showDocs && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
          {docs.map((doc) => {
            const url = doc.path ? links[doc.label] : undefined
            const isImage = doc.path ? /\.(jpe?g|png|webp|gif)$/i.test(doc.path) : false
            return (
              <div key={doc.label} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${doc.path ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    {doc.path ? '✓' : '–'}
                  </span>
                  <span className={`text-xs truncate ${doc.path ? 'text-gray-900' : 'text-gray-400'}`}>{doc.label}</span>
                </div>
                {url ? (
                  <div className="flex items-center gap-2 shrink-0">
                    {isImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={doc.label} className="w-10 h-10 object-cover rounded border border-gray-200" />
                    )}
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline whitespace-nowrap">
                      View
                    </a>
                  </div>
                ) : (
                  <span className="text-xs text-gray-300 shrink-0">Not uploaded</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
