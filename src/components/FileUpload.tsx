'use client';

import { useState, useRef, useCallback } from 'react';

interface FileUploadProps {
    onFileSelect: (file: File) => void;
    isProcessing: boolean;
}

export default function FileUpload({ onFileSelect, isProcessing }: FileUploadProps) {
    const [isDragActive, setIsDragActive] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragActive(true);
        } else if (e.type === 'dragleave') {
            setIsDragActive(false);
        }
    }, []);

    const validateFile = (file: File): boolean => {
        const validTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'text/csv', // .csv
            'application/csv',
        ];
        const validExtensions = ['.xlsx', '.xls', '.csv'];

        const hasValidType = validTypes.includes(file.type);
        const hasValidExtension = validExtensions.some(ext =>
            file.name.toLowerCase().endsWith(ext)
        );

        return hasValidType || hasValidExtension;
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (validateFile(file)) {
                setSelectedFile(file);
                onFileSelect(file);
            } else {
                alert('Please upload an Excel file (.xlsx, .xls) or CSV file.');
            }
        }
    }, [onFileSelect]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            if (validateFile(file)) {
                setSelectedFile(file);
                onFileSelect(file);
            } else {
                alert('Please upload an Excel file (.xlsx, .xls) or CSV file.');
            }
        }
    }, [onFileSelect]);

    const handleClick = () => {
        inputRef.current?.click();
    };

    const handleDemoClick = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent triggering file input click
        try {
            const response = await fetch('/SAMPLE2.xlsx');
            const blob = await response.blob();
            const file = new File([blob], 'SAMPLE2.xlsx', {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            setSelectedFile(file);
            onFileSelect(file);
        } catch (error) {
            console.error('Failed to load demo file:', error);
            alert('Failed to load demo file. Please try uploading manually.');
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="file-upload-container">
            <div
                className={`file-upload-zone ${isDragActive ? 'drag-active' : ''} ${isProcessing ? 'processing' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={handleClick}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleChange}
                    style={{ display: 'none' }}
                />

                {isProcessing ? (
                    <div className="upload-processing">
                        <div className="spinner"></div>
                        <p>Analyzing your file...</p>
                        <span className="processing-subtext">AI is mapping columns and detecting risks</span>
                    </div>
                ) : selectedFile ? (
                    <div className="upload-success">
                        <div className="file-icon">📊</div>
                        <p className="file-name">{selectedFile.name}</p>
                        <span className="file-size">{formatFileSize(selectedFile.size)}</span>
                        <span className="upload-hint">Click or drag to replace</span>
                    </div>
                ) : (
                    <div className="upload-prompt">
                        <button
                            className="demo-button"
                            onClick={handleDemoClick}
                            type="button"
                        >
                            ✨ Try Demo File
                        </button>
                        <div className="upload-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                <polyline points="17,8 12,3 7,8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                        </div>
                        <p className="upload-title">Drop your Excel file here</p>
                        <span className="upload-subtitle">or click to browse</span>
                        <div className="supported-formats">
                            <span>.xlsx</span>
                            <span>.xls</span>
                            <span>.csv</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="security-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>Zero Data Retention • Files processed in-memory only</span>
            </div>
        </div>
    );
}
