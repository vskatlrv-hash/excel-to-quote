import { streamText, convertToModelMessages, tool } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { storeFixedRows, applyQuantityFixes, findMissingQuantities } from '@/lib/excelExport';
import { LIMITS, shouldEnforceLimit, getEffectiveLimit } from '@/lib/limits';
import type { ParsedRow, ColumnMapping } from '@/types/quote';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const SYSTEM_PROMPT = `You are the Excel-to-Quote AI Copilot.
You have access to the user's uploaded BOM analysis (summary, risks, rows) relative to the discussion.

**CRITICAL INSTRUCTIONS:**
1. **Be Context-Aware:** If the user mentions "the issue" or "the risks", refer IMMEDIATELY to the 'Risk Assessment' section in the context. Do NOT ask "what issue?" if risks are present.
2. **Be Helpful but controlled:** If the file has risks, explain them clearly. You may PROPOSE a fix, but do NOT execute the 'fix_missing_quantities' or other modification tools unless the user explicitly asks you to (e.g., "fix it", "yes", "go ahead").
3. **Tool Usage:** You CAN now fix issues and generate download links. When the user asks to fix or modify data:
   - Use 'fix_missing_quantities' to fix rows with missing quantity values
   - Use 'update_cell_value' to change a specific cell value (e.g., change quantity from 3 to 4)
   - Use 'delete_rows' to remove specific rows (e.g. "remove row 5 and 6")
   - Use 'clear_column' to clear all data in a specific column (e.g. "clear the Unit Price column", "remove the quantity column", "delete the notes column")
   - Use 'generate_corrected_download' to create a download link for the corrected file
4. **Role:** Act as a senior Sales Engineer—strategic, precise, and helpful.
5. **Reference Resolution:** If the user gives a COMMAND like "fix it" or "remove that row", look at the context to infer intent. However, if the user asks a QUESTION like "what is the issue?", ONLY explain the issue. Do NOT fix it until they say so.
6. **Command Override:** If the user asks to "remove" or "delete" a column, you MUST use the 'clear_column' tool. Do NOT say "I cannot remove the column". Just clear the data and say "Removed data from [column name] column". this is the expected behavior for this application.


**Analysis Categories:**
- **Quote Analysis**: BOM validation.
- **Risk Assessment**: Incoterms, LDs, UoM conflicts.
- **Strategy**: Pricing & Margins.`;

export async function POST(req: Request) {
    const { messages, analysis } = await req.json();

    // ═══════════════════════════════════════════════════════════════
    // USAGE LIMIT CHECKS
    // ═══════════════════════════════════════════════════════════════
    if (shouldEnforceLimit()) {
        // Check message count limit
        if (messages.length > getEffectiveLimit(LIMITS.MAX_MESSAGES_PER_SESSION)) {
            return new Response(
                JSON.stringify({
                    error: `Session limit reached (${LIMITS.MAX_MESSAGES_PER_SESSION} messages). Please refresh to start a new session.`
                }),
                { status: 429, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Check last message length
        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.content && lastMessage.content.length > LIMITS.MAX_MESSAGE_LENGTH) {
            return new Response(
                JSON.stringify({
                    error: `Message too long. Maximum ${LIMITS.MAX_MESSAGE_LENGTH} characters allowed.`
                }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }
    }

    console.log('[route.ts] Incoming messages count:', messages.length);
    if (messages.length > 0) {
        console.log('[route.ts] Last user message:', messages[messages.length - 1].content);
        // Log previous assistant message to see if it contextually leads to the user's request
        if (messages.length > 1) {
            console.log('[route.ts] Prev assistant message:', messages[messages.length - 2].content);
        }
    }

    // Store current state for this request
    let currentRows: ParsedRow[] = analysis?.rows ?? [];
    const currentColumnMapping: ColumnMapping = analysis?.columnMapping ?? {
        partNumber: null,
        quantity: null,
        description: null,
        unitPrice: null,
        unitOfMeasure: null,
        notes: null,
        terms: null,
        headerRow: 1,
    };
    const appliedRemediations: Array<{ rowNumber: number; quantity: number; reason: string }> = [];

    const contextPart = analysis ? `
\n=== CURRENT FILE ANALYSIS ===
File Name: "${analysis.fileName}"
Summary: ${JSON.stringify(analysis.summary)}
Risk Assessment: ${JSON.stringify(analysis.risks)}
Valid Rows (First 50): ${JSON.stringify(analysis.rows?.slice(0, 50) ?? [])}
Missing Quantity Rows: ${JSON.stringify(findMissingQuantities(analysis.rows ?? []))}
(Note: Only first 50 rows included for brevity. Ask user if specific details needed for others.)
=== END ANALYSIS ===
` : '';

    console.log('AI Context (First 500 chars):', contextPart.substring(0, 500));
    if (analysis && analysis.rows) {
        console.log('Row 0:', JSON.stringify(analysis.rows[0]));
        console.log('Rows count:', analysis.rows.length);
    }

    // Define tools inline with execute functions that have access to request context
    const excelTools = {
        fix_missing_quantities: tool({
            description: 'Fix rows that have missing or null quantity values. Returns the number of rows fixed and the changes made. Call this when the user asks to fix missing quantities or data issues.',
            inputSchema: z.object({
                defaultQuantity: z.number().default(1).describe('Default quantity value to use for missing entries'),
                affectedRowNumbers: z.array(z.number()).optional().describe('Specific row numbers to fix. If not provided, all rows with missing quantities will be fixed.'),
            }),
            execute: async ({ defaultQuantity, affectedRowNumbers }) => {
                const missingRows = affectedRowNumbers ?? findMissingQuantities(currentRows);

                // Create fixes
                const fixes = missingRows.map(rowNum => ({
                    rowNumber: rowNum,
                    quantity: defaultQuantity,
                    reason: `Auto-fixed: Set missing quantity to ${defaultQuantity}`,
                }));

                // Apply fixes
                const { fixedRows, remediations } = applyQuantityFixes(currentRows, fixes);
                currentRows = fixedRows;
                appliedRemediations.push(...fixes);

                console.log(`Fixed ${remediations.length} rows with missing quantities`);

                // Generate download for this modification
                const downloadResult = storeFixedRows(
                    currentRows,
                    currentColumnMapping,
                    analysis?.fileName ?? 'corrected_data.xlsx',
                    fixes.map(fix => ({
                        rowNumber: fix.rowNumber,
                        field: 'quantity' as const,
                        oldValue: null,
                        newValue: fix.quantity,
                        reason: fix.reason,
                    }))
                );

                return {
                    success: true,
                    fixedCount: remediations.length,
                    affectedRows: missingRows,
                    message: `Fixed ${remediations.length} rows with missing quantities by setting them to ${defaultQuantity}.`,
                    downloadUrl: `/api/download/${downloadResult.token}`,
                    fileName: downloadResult.fileName,
                };
            },
        }),

        generate_corrected_download: tool({
            description: 'Generate a corrected Excel file with all applied fixes and return a download link. Call this after fixing data issues when the user wants to download the corrected file.',
            inputSchema: z.object({
                includeRemediationNotes: z.boolean().default(true).describe('Whether to include notes about what was changed'),
            }),
            execute: async ({ includeRemediationNotes }) => {
                // Store the corrected data and get download token
                const downloadResult = storeFixedRows(
                    currentRows,
                    currentColumnMapping,
                    analysis?.fileName ?? 'corrected_data.xlsx',
                    appliedRemediations.map(fix => ({
                        rowNumber: fix.rowNumber,
                        field: 'quantity' as const,
                        oldValue: null,
                        newValue: fix.quantity,
                        reason: includeRemediationNotes ? fix.reason : '',
                    }))
                );

                console.log(`Generated download link for ${downloadResult.fileName}`);

                return {
                    success: true,
                    downloadUrl: `/api/download/${downloadResult.token}`,
                    fileName: downloadResult.fileName,
                    remediationsCount: appliedRemediations.length,
                    message: `Created download link for corrected file with ${appliedRemediations.length} fixes applied.`,
                };
            },
        }),

        update_cell_value: tool({
            description: 'Update a specific cell value in a row. Use this to change existing values like quantity, unit price, description, or notes. For example: change quantity from 3 to 4 in row 2.',
            inputSchema: z.object({
                rowNumber: z.number().describe('The row number to update (from the rowNumber field in the data)'),
                field: z.enum(['quantity', 'unitPrice', 'description', 'notes', 'partNumber', 'unitOfMeasure']).describe('The field/column to update'),
                newValue: z.union([z.string(), z.number()]).describe('The new value to set'),
            }),
            execute: async ({ rowNumber, field, newValue }) => {
                const rowIndex = currentRows.findIndex(r => r.rowNumber === rowNumber);

                if (rowIndex === -1) {
                    return {
                        success: false,
                        message: `Row ${rowNumber} not found in the data.`,
                    };
                }

                const oldValue = currentRows[rowIndex][field];

                // Update the value based on field type
                if (field === 'quantity' || field === 'unitPrice') {
                    currentRows[rowIndex] = {
                        ...currentRows[rowIndex],
                        [field]: typeof newValue === 'number' ? newValue : parseFloat(String(newValue)),
                    };
                } else {
                    currentRows[rowIndex] = {
                        ...currentRows[rowIndex],
                        [field]: String(newValue),
                    };
                }

                // Track the remediation
                appliedRemediations.push({
                    rowNumber,
                    quantity: field === 'quantity' ? (typeof newValue === 'number' ? newValue : parseFloat(String(newValue))) : 0,
                    reason: `Updated ${field} from ${oldValue} to ${newValue}`,
                });

                console.log(`Updated row ${rowNumber}: ${field} = ${newValue}`);

                // Generate download for this modification
                const downloadResult = storeFixedRows(
                    currentRows,
                    currentColumnMapping,
                    analysis?.fileName ?? 'corrected_data.xlsx',
                    [{
                        rowNumber,
                        field: field as 'quantity' | 'unitPrice' | 'description',
                        oldValue,
                        newValue,
                        reason: `Updated ${field} from ${oldValue} to ${newValue}`,
                    }]
                );

                return {
                    success: true,
                    rowNumber,
                    field,
                    oldValue,
                    newValue,
                    message: `Updated ${field} in row ${rowNumber} from ${oldValue} to ${newValue}.`,
                    downloadUrl: `/api/download/${downloadResult.token}`,
                    fileName: downloadResult.fileName,
                };
            },
        }),

        delete_rows: tool({
            description: 'Delete specific rows from the data. Use this when the user wants to remove items.',
            inputSchema: z.object({
                rowNumbers: z.array(z.number()).describe('The list of row numbers to delete'),
            }),
            execute: async ({ rowNumbers }) => {
                const originalCount = currentRows.length;
                currentRows = currentRows.filter(r => !rowNumbers.includes(r.rowNumber));
                const deletedCount = originalCount - currentRows.length;

                // Track remediation (generic reason)
                rowNumbers.forEach(rowNum => {
                    appliedRemediations.push({
                        rowNumber: rowNum,
                        quantity: 0,
                        reason: 'Row deleted by user request',
                    });
                });

                console.log(`Deleted ${deletedCount} rows: ${rowNumbers.join(', ')}`);

                // Generate download for this modification
                const downloadResult = storeFixedRows(
                    currentRows,
                    currentColumnMapping,
                    analysis?.fileName ?? 'corrected_data.xlsx',
                    rowNumbers.map(rn => ({
                        rowNumber: rn,
                        field: 'quantity' as const,
                        oldValue: 'ROW',
                        newValue: 'DELETED',
                        reason: 'Row deleted by user request',
                    }))
                );

                return {
                    success: true,
                    deletedCount,
                    rowNumbers,
                    message: `Deleted ${deletedCount} rows from the data.`,
                    downloadUrl: `/api/download/${downloadResult.token}`,
                    fileName: downloadResult.fileName,
                };
            },
        }),

        clear_column: tool({
            description: 'Clear all data in a specific column. Use this when a column contains incorrect or irrelevant data (e.g. "clear the notes column"). Also use this if the user asks to "remove" or "delete" a column, as we cannot remove the column itself but we can clear its values.',
            inputSchema: z.object({
                field: z.enum(['quantity', 'unitPrice', 'description', 'notes', 'partNumber', 'unitOfMeasure']).describe('The field/column to clear'),
            }),
            execute: async ({ field }) => {
                let affectedCount = 0;
                currentRows = currentRows.map(row => {
                    if (row[field] !== null && row[field] !== '') {
                        affectedCount++;
                        return {
                            ...row,
                            [field]: field === 'quantity' || field === 'unitPrice' ? null : '',
                        };
                    }
                    return row;
                });

                // Track remediation (just one entry to represent the action)
                if (affectedCount > 0) {
                    appliedRemediations.push({
                        rowNumber: 0, // 0 represents global/bulk action
                        quantity: 0,
                        reason: `Cleared column: ${field}`,
                    });
                }

                console.log(`Cleared column ${field}, affected ${affectedCount} rows`);

                // Generate download for this modification
                const downloadResult = storeFixedRows(
                    currentRows,
                    currentColumnMapping,
                    analysis?.fileName ?? 'corrected_data.xlsx',
                    [{
                        rowNumber: 0,
                        field: field as 'quantity' | 'unitPrice' | 'description',
                        oldValue: 'ALL',
                        newValue: null,
                        reason: `Cleared column: ${field}`,
                    }]
                );

                return {
                    success: true,
                    field,
                    affectedCount,
                    message: `Cleared data in column '${field}' for ${affectedCount} rows.`,
                    downloadUrl: `/api/download/${downloadResult.token}`,
                    fileName: downloadResult.fileName,
                };
            },
        }),
    };

    const result = streamText({
        model: google('gemini-2.5-flash-lite'),
        system: SYSTEM_PROMPT + contextPart,
        messages: await convertToModelMessages(messages),
        tools: excelTools,
    });

    return result.toUIMessageStreamResponse();
}
