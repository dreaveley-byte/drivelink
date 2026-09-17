import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendSms } from '@/lib/sms'

function anonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { type } = body
  const supabase = anonClient()

  if (type === 'driver') {
    const { fullName, homeAddress, cellPhone, homePhone, email } = body
    if (!fullName || !homeAddress || !cellPhone || !email) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }
    const { data, error } = await supabase.rpc('start_driver_signup', {
      p_full_name: fullName, p_home_address: homeAddress, p_cell_phone: cellPhone, p_home_phone: homePhone || null, p_email: email,
    })
    if (error || !data?.[0]) {
      return NextResponse.json({ error: error?.message ?? 'Could not start signup.' }, { status: 500 })
    }
    const { lead_id, code } = data[0]
    const sms = await sendSms(cellPhone, `Your Drivflo verification code is ${code}. It expires in 10 minutes.`)
    if (!sms.ok) {
      return NextResponse.json({ error: `Could not send verification text: ${sms.error}` }, { status: 500 })
    }
    return NextResponse.json({ leadId: lead_id })
  }

  if (type === 'dealer') {
    const { businessName, businessAddress, contactFullName, contactPosition, storePhone, contactEmail, contactCellPhone } = body
    if (!businessName || !businessAddress || !contactFullName || !contactEmail || !contactCellPhone) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }
    const { data, error } = await supabase.rpc('start_dealer_signup', {
      p_business_name: businessName, p_business_address: businessAddress, p_contact_full_name: contactFullName,
      p_contact_position: contactPosition || null, p_store_phone: storePhone || null, p_contact_email: contactEmail, p_contact_cell_phone: contactCellPhone,
    })
    if (error || !data?.[0]) {
      return NextResponse.json({ error: error?.message ?? 'Could not start signup.' }, { status: 500 })
    }
    const { lead_id, code } = data[0]
    const sms = await sendSms(contactCellPhone, `Your Drivflo verification code is ${code}. It expires in 10 minutes.`)
    if (!sms.ok) {
      return NextResponse.json({ error: `Could not send verification text: ${sms.error}` }, { status: 500 })
    }
    return NextResponse.json({ leadId: lead_id })
  }

  return NextResponse.json({ error: 'Invalid signup type.' }, { status: 400 })
}
