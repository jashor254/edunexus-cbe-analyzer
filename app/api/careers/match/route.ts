// app/api/careers/match/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { careerMatcher } from '@/lib/academicClinic/careerMatcher';

export async function POST(req: NextRequest) {
  try {
    const { studentId, action, careerName } = await req.json();

    if (!studentId) {
      return NextResponse.json({ error: 'Student ID required' }, { status: 400 });
    }

    let result;

    switch (action) {
      case 'full-assessment':
        result = await careerMatcher.generateMatches(studentId);
        break;
      
      case 'specific-career':
        if (!careerName) {
          return NextResponse.json({ error: 'Career name required' }, { status: 400 });
        }
        result = await careerMatcher.assessSpecificCareer(studentId, careerName);
        break;
      
      default:
        // Default to full assessment
        result = await careerMatcher.generateMatches(studentId);
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Career matching error:', error);
    return NextResponse.json(
      { error: 'Failed to generate career matches' },
      { status: 500 }
    );
  }
}

