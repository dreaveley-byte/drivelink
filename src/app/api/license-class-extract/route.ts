import { NextRequest, NextResponse } from 'next/server'

// BC driver's license classes - the same set already offered as a
// dropdown when a driver self-reports their class during application.
const VALID_CLASSES = ['Class 5', 'Class 7', 'Class 4', 'Class 3', 'Class 2', 'Class 1', 'Other/Out of province']

export async function POST(req: NextRequest) {
  const { photo } = await req.json()
  if (!photo) {
    return NextResponse.json({ error: 'Missing photo.' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'License scanning is not configured.' }, { status: 501 })
  }

  const match = photo.match(/^data:(image\/\w+);base64,(.+)$/)
  if (!match) {
    return NextResponse.json({ error: 'Invalid image data.' }, { status: 400 })
  }
  const [, mediaType, base64Data] = match

  const prompt =
    'This is a photo of a driver\'s license. Read the vehicle class/licence class printed on it (in BC this is usually a single digit like 5, 7, 4, 3, 2, or 1, sometimes labelled "CLASS" or "CLS"). ' +
    `Reply with ONLY raw JSON, no markdown formatting, no code fences, in exactly this shape: {"licenseClass": "Class 5", "confident": true}. ` +
    `The "licenseClass" value must be exactly one of: ${VALID_CLASSES.join(', ')}. ` +
    'Use "Other/Out of province" if the license is clearly not a BC license, or if you cannot make out a class matching the list above. ' +
    'Set "confident" to false if the image is blurry, cropped, or you are genuinely unsure of the class, even if you provide a best guess.'

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
        max_tokens: 100,
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

    const licenseClass = VALID_CLASSES.includes(parsed.licenseClass) ? parsed.licenseClass : null
    const confident = parsed.confident === true

    return NextResponse.json({ licenseClass, confident })
  } catch {
    return NextResponse.json({ licenseClass: null, confident: false })
  }
}
