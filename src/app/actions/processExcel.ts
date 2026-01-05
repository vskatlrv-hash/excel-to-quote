'use server';

import { parseExcelBuffer, rowsToMarkdown, parseQuantity, parsePrice } from '@/lib/excelParser';
import { analyzeAllRisks } from '@/lib/riskDetector';
import { LIMITS, MAX_FILE_SIZE_BYTES, shouldEnforceLimit, getEffectiveLimit } from '@/lib/limits';
import type { QuoteAnalysis, ParsedRow, ColumnMapping } from '@/types/quote';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

// AI column mapping schema
const columnMappingSchema = z.object({
    partNumber: z.string().nullable().describe('Column name for part numbers/SKUs'),
    quantity: z.string().nullable().describe('Column name for quantities'),
    description: z.string().nullable().describe('Column name for descriptions'),
    unitPrice: z.string().nullable().describe('Column name for unit prices'),
    unitOfMeasure: z.string().nullable().describe('Column name for units of measure'),
    notes: z.string().nullable().describe('Column name for notes/comments'),
    terms: z.string().nullable().describe('Column name for terms/conditions'),
    headerRow: z.number().describe('Row number where headers are located (1-indexed)'),
});

/**
 * Main server action to process an uploaded Excel file
 * Implements zero-data-retention: all processing is in-memory only
 */
export async function processExcelFile(formData: FormData): Promise<QuoteAnalysis> {
    const file = formData.get('file') as File | null;

    if (!file) {
        return {
            success: false,
            fileName: '',
            processedAt: new Date().toISOString(),
            columnMapping: {
                partNumber: null,
                quantity: null,
                description: null,
                unitPrice: null,
                unitOfMeasure: null,
                notes: null,
                terms: null,
                headerRow: 1,
            },
            rows: [],
            risks: [{
                id: 'error-no-file',
                type: 'general',
                level: 'critical',
                title: 'No File Provided',
                description: 'Please upload an Excel file to analyze.',
                recommendation: 'Select a .xlsx, .xls, or .csv file to upload.',
            }],
            summary: {
                totalRows: 0,
                validRows: 0,
                totalRisks: 1,
                criticalRisks: 1,
                highRisks: 0,
                mediumRisks: 0,
                lowRisks: 0,
            },
        };
    }

    try {
        // ═══════════════════════════════════════════════════════════════
        // FILE SIZE LIMIT CHECK
        // ═══════════════════════════════════════════════════════════════
        if (shouldEnforceLimit() && file.size > MAX_FILE_SIZE_BYTES) {
            throw new Error(`File too large. Maximum size is ${LIMITS.MAX_FILE_SIZE_MB}MB.`);
        }

        // Convert file to ArrayBuffer (in-memory only - zero data retention)
        const buffer = await file.arrayBuffer();

        // Parse Excel file
        const parseResult = parseExcelBuffer(buffer);

        if (!parseResult.success) {
            return {
                success: false,
                fileName: file.name,
                processedAt: new Date().toISOString(),
                columnMapping: {
                    partNumber: null,
                    quantity: null,
                    description: null,
                    unitPrice: null,
                    unitOfMeasure: null,
                    notes: null,
                    terms: null,
                    headerRow: 1,
                },
                rows: [],
                risks: [{
                    id: 'error-parse',
                    type: 'general',
                    level: 'critical',
                    title: 'Parse Error',
                    description: parseResult.error || 'Failed to parse Excel file.',
                    recommendation: 'Ensure the file is a valid Excel document (.xlsx, .xls) or CSV.',
                }],
                summary: {
                    totalRows: 0,
                    validRows: 0,
                    totalRisks: 1,
                    criticalRisks: 1,
                    highRisks: 0,
                    mediumRisks: 0,
                    lowRisks: 0,
                },
            };
        }

        // Use AI to map columns (if API key is available)
        let columnMapping: ColumnMapping;

        const apiKey = process.env.OPENAI_API_KEY;

        if (apiKey && parseResult.headers.length > 0) {
            const openai = createOpenAI({ apiKey });

            const markdownTable = rowsToMarkdown(
                parseResult.headers,
                parseResult.rows.slice(0, 5) as Record<string, unknown>[]
            );

            try {
                const result = await generateObject({
                    model: openai('gpt-4o'),
                    schema: columnMappingSchema,
                    prompt: `Analyze this Excel data and map columns to a standard quote format.

Available columns: ${parseResult.headers.join(', ')}

Sample data:
${markdownTable}

Map these columns to the following fields (use exact column names from the list, or null if not found):
- partNumber: Column containing part numbers, SKUs, item codes, or product IDs
- quantity: Column containing quantities, amounts, or order quantities
- description: Column containing item descriptions, names, or titles
- unitPrice: Column containing prices, costs, or unit prices
- unitOfMeasure: Column containing units like each, box, kg, meter, etc.
- notes: Column containing notes, comments, remarks, or specifications
- terms: Column containing terms, conditions, shipping info, or delivery terms

Also identify the header row number (usually 1).`,
                });

                columnMapping = result.object as ColumnMapping;
            } catch (aiError) {
                console.error('AI mapping failed, using fallback:', aiError);
                columnMapping = fallbackColumnMapping(parseResult.headers);
            }
        } else {
            columnMapping = fallbackColumnMapping(parseResult.headers);
        }

        // Parse rows using the column mapping
        // Apply row limit
        const maxRows = getEffectiveLimit(LIMITS.MAX_ROWS);
        const rowsToProcess = (parseResult.rows as Record<string, unknown>[]).slice(0, maxRows);
        const wasLimited = parseResult.rows.length > maxRows;

        const parsedRows: ParsedRow[] = rowsToProcess.map((row, index) => {
            return {
                rowNumber: index + 2, // 1-indexed, accounting for header row
                partNumber: String(row[columnMapping.partNumber || ''] ?? ''),
                quantity: parseQuantity(row[columnMapping.quantity || '']),
                description: String(row[columnMapping.description || ''] ?? ''),
                unitPrice: parsePrice(row[columnMapping.unitPrice || '']),
                unitOfMeasure: String(row[columnMapping.unitOfMeasure || ''] ?? ''),
                notes: String(row[columnMapping.notes || ''] ?? ''),
                // Ensure rawData is a plain object safely
                rawData: JSON.parse(JSON.stringify(row)),
            };
        });

        // Run risk detection
        const risks = analyzeAllRisks(parseResult.rawText, parsedRows);

        // Add warning if rows were limited
        if (wasLimited && shouldEnforceLimit()) {
            risks.unshift({
                id: 'warning-row-limit',
                type: 'general',
                level: 'medium',
                title: `Row Limit Applied (${LIMITS.MAX_ROWS} rows)`,
                description: `Only the first ${LIMITS.MAX_ROWS} rows were processed. Your file contains ${parseResult.rows.length} total rows.`,
                recommendation: 'For the demo, row processing is limited. Contact the developer for full access.',
            });
        }

        // Calculate summary
        const validRows = parsedRows.filter(r => r.partNumber && r.partNumber.trim() !== '').length;

        const summary = {
            totalRows: parsedRows.length,
            validRows,
            totalRisks: risks.length,
            criticalRisks: risks.filter(r => r.level === 'critical').length,
            highRisks: risks.filter(r => r.level === 'high').length,
            mediumRisks: risks.filter(r => r.level === 'medium').length,
            lowRisks: risks.filter(r => r.level === 'low').length,
        };

        return {
            success: true,
            fileName: file.name,
            processedAt: new Date().toISOString(),
            columnMapping,
            rows: parsedRows,
            risks,
            summary,
        };

    } catch (error) {
        console.error('Processing error:', error);
        return {
            success: false,
            fileName: file.name,
            processedAt: new Date().toISOString(),
            columnMapping: {
                partNumber: null,
                quantity: null,
                description: null,
                unitPrice: null,
                unitOfMeasure: null,
                notes: null,
                terms: null,
                headerRow: 1,
            },
            rows: [],
            risks: [{
                id: 'error-processing',
                type: 'general',
                level: 'critical',
                title: 'Processing Error',
                description: error instanceof Error ? error.message : 'An unexpected error occurred.',
                recommendation: 'Please try again or contact support if the issue persists.',
            }],
            summary: {
                totalRows: 0,
                validRows: 0,
                totalRisks: 1,
                criticalRisks: 1,
                highRisks: 0,
                mediumRisks: 0,
                lowRisks: 0,
            },
        };
    }
}

/**
 * Fallback column mapping using common header patterns
 */
function fallbackColumnMapping(headers: string[]): ColumnMapping {
    const lowerHeaders = headers.map(h => h.toLowerCase());

    const findColumn = (patterns: string[]): string | null => {
        for (const pattern of patterns) {
            const index = lowerHeaders.findIndex(h => h.includes(pattern));
            if (index !== -1) return headers[index];
        }
        return null;
    };

    return {
        partNumber: findColumn(['part', 'sku', 'item', 'product', 'code', 'p/n', 'pn', 'number']),
        quantity: findColumn(['qty', 'quantity', 'amount', 'count', 'units', 'order']),
        description: findColumn(['description', 'desc', 'name', 'title', 'product name']),
        unitPrice: findColumn(['price', 'cost', 'unit price', 'rate', 'amount']),
        unitOfMeasure: findColumn(['uom', 'unit', 'measure', 'um']),
        notes: findColumn(['notes', 'comment', 'remark', 'spec', 'specification']),
        terms: findColumn(['terms', 'condition', 'shipping', 'delivery', 'incoterm']),
        headerRow: 1,
    };
}
