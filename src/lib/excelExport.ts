import * as XLSX from 'xlsx';
import type { ParsedRow, ColumnMapping, RowRemediation, DownloadResult } from '@/types/quote';

// In-memory storage for corrected files (session-based, keyed by token)
const correctedFilesStore = new Map<string, {
    rows: ParsedRow[];
    columnMapping: ColumnMapping;
    fileName: string;
    remediations: RowRemediation[];
    createdAt: number;
}>();

// Cleanup old entries after 10 minutes
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

function cleanupOldEntries(): void {
    const now = Date.now();
    for (const [token, data] of correctedFilesStore.entries()) {
        if (now - data.createdAt > CLEANUP_INTERVAL_MS) {
            correctedFilesStore.delete(token);
        }
    }
}

/**
 * Generate a random token for download URLs
 */
function generateToken(): string {
    return `dl_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Store fixed rows for later download
 */
export function storeFixedRows(
    rows: ParsedRow[],
    columnMapping: ColumnMapping,
    fileName: string,
    remediations: RowRemediation[]
): DownloadResult {
    cleanupOldEntries();

    const token = generateToken();
    correctedFilesStore.set(token, {
        rows,
        columnMapping,
        fileName,
        remediations,
        createdAt: Date.now(),
    });

    return {
        token,
        fileName: fileName.replace(/\.[^/.]+$/, '') + '_corrected.xlsx',
        remediations,
    };
}

/**
 * Retrieve stored rows by token
 */
export function getStoredData(token: string): {
    rows: ParsedRow[];
    columnMapping: ColumnMapping;
    fileName: string;
} | null {
    const data = correctedFilesStore.get(token);
    if (!data) return null;
    return {
        rows: data.rows,
        columnMapping: data.columnMapping,
        fileName: data.fileName,
    };
}

/**
 * Generate an Excel buffer from parsed rows
 */
export function generateExcelBuffer(
    rows: ParsedRow[],
    columnMapping: ColumnMapping
): ArrayBuffer {
    // Create worksheet data
    const headers = ['Row #', 'Part Number', 'Description', 'Quantity', 'Unit', 'Unit Price', 'Notes'];

    const wsData = [
        headers,
        ...rows.map(row => [
            row.rowNumber,
            row.partNumber,
            row.description,
            row.quantity,
            row.unitOfMeasure,
            row.unitPrice,
            row.notes,
        ]),
    ];

    // Create worksheet and workbook
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Corrected Data');

    // Set column widths for better readability
    ws['!cols'] = [
        { wch: 6 },   // Row #
        { wch: 15 },  // Part Number
        { wch: 40 },  // Description
        { wch: 10 },  // Quantity
        { wch: 8 },   // Unit
        { wch: 12 },  // Unit Price
        { wch: 30 },  // Notes
    ];

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    return buffer;
}

/**
 * Apply quantity fixes to rows
 */
export function applyQuantityFixes(
    rows: ParsedRow[],
    fixes: Array<{ rowNumber: number; quantity: number; reason: string }>
): { fixedRows: ParsedRow[]; remediations: RowRemediation[] } {
    const remediations: RowRemediation[] = [];

    const fixedRows = rows.map(row => {
        const fix = fixes.find(f => f.rowNumber === row.rowNumber);
        if (fix) {
            remediations.push({
                rowNumber: row.rowNumber,
                field: 'quantity',
                oldValue: row.quantity,
                newValue: fix.quantity,
                reason: fix.reason,
            });
            return {
                ...row,
                quantity: fix.quantity,
            };
        }
        return row;
    });

    return { fixedRows, remediations };
}

/**
 * Find rows with missing quantities
 */
export function findMissingQuantities(rows: ParsedRow[]): number[] {
    return rows
        .filter(row => row.quantity === null || row.quantity === undefined || row.quantity === 0)
        .map(row => row.rowNumber);
}
