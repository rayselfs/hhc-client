import { PdfService } from '@/services/pdf'

export interface PdfProcessingResult {
  pageCount: number
  thumbnail: Blob | null
  title?: string
  author?: string
}

/**
 * Process a PDF file to extract metadata and generate thumbnail
 * Used during file import to populate FileItem metadata
 *
 * @param fileUrl - The URL of the PDF file (file:// or http://)
 * @returns Processing result with page count and thumbnail
 */
export async function processPdfFile(fileUrl: string): Promise<PdfProcessingResult> {
  const pdfService = new PdfService()

  try {
    const metadata = await pdfService.loadDocument(fileUrl)
    const thumbnail = await pdfService.generateThumbnail(1, 300)

    return {
      pageCount: metadata.pageCount,
      thumbnail,
      title: metadata.title,
      author: metadata.author,
    }
  } finally {
    pdfService.dispose()
  }
}
