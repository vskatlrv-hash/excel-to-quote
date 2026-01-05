'use client';

import type { QuoteAnalysis, ParsedRow } from '@/types/quote';

interface ExportButtonsProps {
    analysis: QuoteAnalysis | null;
}

export default function ExportButtons({ analysis }: ExportButtonsProps) {
    if (!analysis || !analysis.success) {
        return null;
    }

    const exportToCSV = () => {
        const headers = ['Row', 'Part Number', 'Description', 'Quantity', 'UoM', 'Unit Price', 'Notes'];
        const rows = analysis.rows.map(row => [
            row.rowNumber,
            row.partNumber,
            `"${(row.description || '').replace(/"/g, '""')}"`,
            row.quantity ?? '',
            row.unitOfMeasure,
            row.unitPrice ?? '',
            `"${(row.notes || '').replace(/"/g, '""')}"`,
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        downloadFile(csvContent, `${analysis.fileName.replace(/\.[^/.]+$/, '')}_parsed.csv`, 'text/csv');
    };

    const exportToJSON = () => {
        const exportData = {
            fileName: analysis.fileName,
            processedAt: analysis.processedAt,
            summary: analysis.summary,
            columnMapping: analysis.columnMapping,
            rows: analysis.rows,
            risks: analysis.risks,
        };

        const jsonContent = JSON.stringify(exportData, null, 2);
        downloadFile(jsonContent, `${analysis.fileName.replace(/\.[^/.]+$/, '')}_analysis.json`, 'application/json');
    };

    const exportRiskReport = () => {
        const report = generateRiskReport(analysis);
        downloadFile(report, `${analysis.fileName.replace(/\.[^/.]+$/, '')}_risk_report.txt`, 'text/plain');
    };

    const downloadFile = (content: string, filename: string, type: string) => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="export-buttons">
            <button onClick={exportToCSV} className="export-btn csv">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14,2 14,8 20,8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                Export CSV
            </button>

            <button onClick={exportToJSON} className="export-btn json">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14,2 14,8 20,8" />
                    <path d="M8 13h2" />
                    <path d="M8 17h2" />
                    <path d="M14 13h2" />
                    <path d="M14 17h2" />
                </svg>
                Export JSON
            </button>

            {analysis.risks.length > 0 && (
                <button onClick={exportRiskReport} className="export-btn risk">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    Risk Report
                </button>
            )}
        </div>
    );
}

function generateRiskReport(analysis: QuoteAnalysis): string {
    const lines: string[] = [
        '═══════════════════════════════════════════════════════════════',
        '                    QUOTE RISK ASSESSMENT REPORT                ',
        '═══════════════════════════════════════════════════════════════',
        '',
        `File: ${analysis.fileName}`,
        `Processed: ${new Date(analysis.processedAt).toLocaleString()}`,
        '',
        '───────────────────────────────────────────────────────────────',
        '                          SUMMARY                               ',
        '───────────────────────────────────────────────────────────────',
        '',
        `Total Line Items: ${analysis.summary.totalRows}`,
        `Valid Line Items: ${analysis.summary.validRows}`,
        '',
        `Total Risks Detected: ${analysis.summary.totalRisks}`,
        `  • Critical: ${analysis.summary.criticalRisks}`,
        `  • High: ${analysis.summary.highRisks}`,
        `  • Medium: ${analysis.summary.mediumRisks}`,
        `  • Low: ${analysis.summary.lowRisks}`,
        '',
    ];

    if (analysis.risks.length > 0) {
        lines.push('───────────────────────────────────────────────────────────────');
        lines.push('                      RISK DETAILS                             ');
        lines.push('───────────────────────────────────────────────────────────────');
        lines.push('');

        for (const risk of analysis.risks) {
            lines.push(`[${risk.level.toUpperCase()}] ${risk.title}`);
            lines.push(`Type: ${risk.type}`);
            lines.push(`Description: ${risk.description}`);
            if (risk.extractedValue) {
                lines.push(`Detected Value: ${risk.extractedValue}`);
            }
            if (risk.affectedRows && risk.affectedRows.length > 0) {
                lines.push(`Affected Rows: ${risk.affectedRows.join(', ')}`);
            }
            lines.push(`Recommendation: ${risk.recommendation}`);
            lines.push('');
        }
    }

    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('                     END OF REPORT                             ');
    lines.push('═══════════════════════════════════════════════════════════════');

    return lines.join('\n');
}
