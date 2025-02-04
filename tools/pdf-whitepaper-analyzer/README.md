# PDF Whitepaper Analyzer

A powerful tool designed to analyze whitepapers in PDF format. This tool extracts text from PDFs and performs comprehensive analysis using advanced language models.

## Features

- **PDF Text Extraction**: Automatically extracts text content from PDF documents
- **Project & Author Identification**: Identifies project names, companies, and authors from the whitepaper
- **Customizable Analysis**: Analyzes whitepaper content based on configurable analysis guides
- **Review Integration**: Fetches relevant reviews and additional context about the project

## Usage

The tool accepts a PDF URL as input and provides three main outputs:
- Project and author information
- Detailed analysis based on the provided analysis guide
- Related reviews and external context

### Input Parameters

- `pdfUrl`: URL of the PDF whitepaper to analyze
- `analysisGuide` (optional): Custom analysis guidelines. If not provided, defaults to the built-in analysis guide

### Output Format

```typescript
{
    projectAndAuthors: string;  // Project, company, and author information
    analysis: string;           // Detailed analysis based on the guide
    reviews: string;           // Related reviews and context
}
```

## Dependencies

- PDF.js for PDF text extraction
- Internal LLM processing tools
- Smart search engine for review aggregation
