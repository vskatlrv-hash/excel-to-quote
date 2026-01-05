import { NextRequest, NextResponse } from 'next/server';
import { getStoredData, generateExcelBuffer } from '@/lib/excelExport';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;

    const data = getStoredData(token);

    if (!data) {
        return NextResponse.json(
            { error: 'Download link expired or invalid' },
            { status: 404 }
        );
    }

    const buffer = generateExcelBuffer(data.rows, data.columnMapping);

    return new NextResponse(buffer, {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${data.fileName.replace(/\.[^/.]+$/, '')}_corrected.xlsx"`,
        },
    });
}
