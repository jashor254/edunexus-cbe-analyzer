import { NextResponse } from "next/server"

// Fake starter data — unaweza replace later na DB
export async function GET() {
  try {
    const stats = {
      users: 1,
      analyses: 0,
      lastSync: new Date().toISOString(),
    }

    return NextResponse.json(stats)
  } catch (err) {
    console.error(err)

    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    )
  }
}