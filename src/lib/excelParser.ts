import * as XLSX from 'xlsx';
import type { ExcelParseResult } from '@/types/quote';

/**
 * Parse an Excel file buffer in-memory (zero data retention)
 * The buffer is only held in memory during processing and garbage collected after
 */
export function parseExcelBuffer(buffer: ArrayBuffer): ExcelParseResult {
    try {
        // Read the workbook from the buffer (in-memory only)
        const workbook = XLSX.read(buffer, { type: 'array' });

        // Get the first sheet
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
            return {
                success: false,
                headers: [],
                rows: [],
                rawText: '',
                error: 'No sheets found in the Excel file',
            };
        }

        const worksheet = workbook.Sheets[firstSheetName];
        if (!worksheet) {
            return {
                success: false,
                headers: [],
                rows: [],
                rawText: '',
                error: 'Could not read worksheet',
            };
        }

        // Convert to JSON with headers
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
            defval: '', // Default value for empty cells
            raw: false, // Convert all values to strings for consistency
        });

        // Also get raw text for risk scanning
        const rawText = XLSX.utils.sheet_to_txt(worksheet);

        // Extract headers from the first row
        const headers = jsonData.length > 0
            ? Object.keys(jsonData[0] as Record<string, unknown>)
            : [];

        return {
            success: true,
            headers,
            rows: jsonData,
            rawText,
        };
    } catch (error) {
        return {
            success: false,
            headers: [],
            rows: [],
            rawText: '',
            error: error instanceof Error ? error.message : 'Failed to parse Excel file',
        };
    }
}

/**
 * Convert parsed rows to a markdown table for AI analysis
 */
export function rowsToMarkdown(
    headers: string[],
    rows: Record<string, unknown>[],
    maxRows: number = 10
): string {
    if (headers.length === 0 || rows.length === 0) {
        return '(No data available)';
    }

    // Create header row
    const headerRow = `| ${headers.join(' | ')} |`;
    const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;

    // Create data rows (limit to maxRows for token efficiency)
    const dataRows = rows.slice(0, maxRows).map(row => {
        const cells = headers.map(header => {
            const value = row[header];
            return String(value ?? '').replace(/\|/g, '\\|').substring(0, 50);
        });
        return `| ${cells.join(' | ')} |`;
    });

    return [headerRow, separatorRow, ...dataRows].join('\n');
}

/**
 * Detect potential header row by looking for rows with mostly text content
 */
export function detectHeaderRow(rows: Record<string, unknown>[]): number {
    // Simple heuristic: first row is usually the header
    // More sophisticated detection could analyze text vs numeric content
    return 1;
}

/**
 * Normalize a quantity string to a number
 */
export function parseQuantity(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const strValue = String(value).replace(/[,\s]/g, '');
    const num = parseFloat(strValue);

    return isNaN(num) ? null : num;
}

/**
 * Normalize a price string to a number
 */
export function parsePrice(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    // Remove currency symbols and formatting
    const strValue = String(value)
        .replace(/[$€£¥₩,\s]/g, '')
        .replace(/[()]/g, ''); // Handle accounting format (1,234.56)

    const num = parseFloat(strValue);

    return isNaN(num) ? null : num;
}
