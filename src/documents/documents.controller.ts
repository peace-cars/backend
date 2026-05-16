import { Controller, Post, Body, Res, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('pro-forma')
  async generateProForma(@Body() invoiceData: any, @Res() res: Response) {
    if (!invoiceData || !invoiceData.customerName) {
      throw new BadRequestException("Malstructured Invoice Data Payload");
    }

    try {
      const pdfBuffer = await this.documentsService.generateProFormaInvoice(invoiceData);

      // Define standard HTTP streaming configuration for the Binary Output
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Pro-Forma-${invoiceData.customerName.replace(/ /g, '_')}.pdf"`,
        'Content-Length': pdfBuffer.length,
      });

      res.end(pdfBuffer);
    } catch (e) {
      console.error(e);
      throw new BadRequestException("Puppeteer Engaged Failure: Could not render HTML stack.");
    }
  }
}
