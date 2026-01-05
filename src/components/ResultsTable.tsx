'use client';

import type { ParsedRow } from '@/types/quote';

interface ResultsTableProps {
    rows: ParsedRow[];
    isLoading?: boolean;
}

export default function ResultsTable({ rows, isLoading }: ResultsTableProps) {
    console.log('ResultsTable rendering with rows:', rows.length, 'Row 2 qty:', rows.find(r => r.rowNumber === 2)?.quantity);
    if (isLoading) {
        return (
            <div className="results-table-container">
                <div className="table-loading">
                    <div className="skeleton-row"></div>
                    <div className="skeleton-row"></div>
                    <div className="skeleton-row"></div>
                    <div className="skeleton-row"></div>
                    <div className="skeleton-row"></div>
                </div>
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <div className="results-table-container">
                <div className="table-empty">
                    <p>No data to display</p>
                    <span>Upload an Excel file to see parsed results</span>
                </div>
            </div>
        );
    }

    return (
        <div className="results-table-container">
            <div className="table-header">
                <h3>📋 Parsed Line Items</h3>
                <span className="row-count">{rows.length} items</span>
            </div>

            <div className="table-scroll">
                <table className="results-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Part Number</th>
                            <th>Description</th>
                            <th>Qty</th>
                            <th>UoM</th>
                            <th>Unit Price</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, index) => (
                            <tr
                                key={row.rowNumber}
                                className={`table-row ${!row.partNumber ? 'row-warning' : ''}`}
                                style={{ animationDelay: `${index * 30}ms` }}
                            >
                                <td className="row-number">{row.rowNumber}</td>
                                <td className="part-number">
                                    {row.partNumber || <span className="empty-cell">—</span>}
                                </td>
                                <td className="description">
                                    {row.description ? (
                                        <span title={row.description}>
                                            {row.description.length > 50
                                                ? row.description.substring(0, 50) + '...'
                                                : row.description}
                                        </span>
                                    ) : (
                                        <span className="empty-cell">—</span>
                                    )}
                                </td>
                                <td className="quantity">
                                    {row.quantity !== null ? (
                                        row.quantity.toLocaleString()
                                    ) : (
                                        <span className="empty-cell">—</span>
                                    )}
                                </td>
                                <td className="uom">
                                    {row.unitOfMeasure || <span className="empty-cell">—</span>}
                                </td>
                                <td className="price">
                                    {row.unitPrice !== null ? (
                                        `$${row.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                                    ) : (
                                        <span className="empty-cell">—</span>
                                    )}
                                </td>
                                <td className="notes">
                                    {row.notes ? (
                                        <span title={row.notes}>
                                            {row.notes.length > 30
                                                ? row.notes.substring(0, 30) + '...'
                                                : row.notes}
                                        </span>
                                    ) : (
                                        <span className="empty-cell">—</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
