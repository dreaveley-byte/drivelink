import { NextRequest, NextResponse } from 'next/server'

const VALID_CATEGORIES = ['wait_time', 'repairs', 'tolls', 'parking', 'storage', 'additional_mileage', 'fuel', 'food', 'inspection', 'return_transport', 'hotel', 'other']

export async function POST(req: NextRequest) {
  const { photo } = await req.json()
  if (!photo) {
    return NextResponse.json({ error: 'Missing photo.' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Receipt scanning is not configured.' }, { status: 501 })
  }

  const match = photo.match(/^data:(image\/\w+);base64,(.+)$/)
  if (!match) {
    return NextResponse.json({ error: 'Invalid image data.' }, { status: 400 })
  }
  const [, mediaType, base64Data] = match

  const prompt =
    'This is a photo of a receipt for a work-related expense a delivery driver is submitting for reimbursement. ' +
    'Extract the total amount paid and figure out which category it belongs to. ' +
    `Valid categories are exactly: ${VALID_CATEGORIES.join(', ')}. ` +
    'Use "additional_mileage" only for mileage reimbursement receipts, "fuel" for gas station receipts, "food" for meals, ' +
    '"tolls" for toll roads/bridges, "parking" for parking fees, "repairs" for vehicle repair/service, "storage" for vehicle storage fees, ' +
    '"inspection" for vehicle inspection fees, "hotel" for hotel/motel stays, "return_transport" for Uber/bus/taxi getting the driver back home, ' +
    'and "other" if nothing else clearly fits. ' +
    'Reply with ONLY raw JSON, no markdown formatting, no code fences, in exactly this shape: ' +
    '{"amount": 12.34, "category": "fuel", "vendor": "Shell", "description": "short description under 8 words"}. ' +
    'If you cannot read an amount at all, set "amount" to null. If the image is not a receipt, set "category" to "other" and "description" to "Could not read receipt".'

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    })
    const data = await res.json()
    const text: string = data?.content?.[0]?.text ?? ''
    const cleaned = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)

    const category = VALID_CATEGORIES.includes(parsed.category) ? parsed.category : 'other'
    const amount = typeof parsed.amount === 'number' && parsed.amount > 0 ? parsed.amount : null

    return NextResponse.json({
      amount,
      category,
      vendor: typeof parsed.vendor === 'string' ? parsed.vendor : null,
      description: typeof parsed.description === 'string' ? parsed.description : null,
    })
  } catch (e) {
    console.error('Receipt extraction failed:', e)
    return NextResponse.json({ error: 'Could not read the receipt automatically — enter the details manually.' }, { status: 500 })
  }
}
