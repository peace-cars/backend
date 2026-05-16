import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  async generateProFormaInvoice(invoiceData: any): Promise<Buffer> {
    this.logger.log(`Generating Enterprise Pro-Forma for ${invoiceData.customerName}...`);
    
    // Construct Elite 2026 Dealership OS HTML Template string natively
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <style>
              body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; padding: 40px; margin: 0; }
              .header { border-bottom: 2px solid #6d28d9; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; }
              .logo { font-size: 24px; font-weight: 900; color: #6d28d9; letter-spacing: -1px; }
              .title { font-size: 32px; font-weight: 300; text-transform: uppercase; color: #4b5563; }
              .details-grid { display: flex; justify-content: space-between; margin-bottom: 40px; }
              .box { background: #f3f4f6; padding: 20px; border-radius: 8px; width: 45%; }
              .box h4 { margin-top: 0; color: #4b5563; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
              .box p { font-size: 14px; margin: 5px 0; font-weight: 600; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
              th { background: #1a1a2e; color: white; text-align: left; padding: 12px; font-size: 12px; text-transform: uppercase; }
              td { padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
              .totals { width: 50%; float: right; }
              .total-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
              .grand-total { font-size: 20px; font-weight: 900; color: #6d28d9; border-bottom: none; }
              .footer { clear: both; padding-top: 40px; font-size: 10px; color: #9ca3af; text-align: center; }
          </style>
      </head>
      <body>
          <div class="header">
              <div class="logo">PEACE CARS</div>
              <div class="title">Pro-Forma Invoice</div>
          </div>
          
          <div class="details-grid">
              <div class="box">
                  <h4>Customer Details</h4>
                  <p>${invoiceData.customerName}</p>
                  <p>TIN: ${invoiceData.customerTIN || 'N/A'}</p>
                  <p>Phone: ${invoiceData.customerPhone || 'N/A'}</p>
              </div>
              <div class="box" style="text-align: right;">
                  <h4>Invoice Meta</h4>
                  <p>Date: ${new Date().toLocaleDateString()}</p>
                  <p>Valid Until: ${new Date(Date.now() + 14*24*60*60*1000).toLocaleDateString()}</p>
                  <p>Ref: #INV-${Math.floor(Date.now() / 1000)}</p>
              </div>
          </div>

          <table>
              <thead>
                  <tr>
                      <th>Description</th>
                      <th>VIN/Chassis</th>
                      <th>Specs</th>
                      <th style="text-align: right;">Amount (ETB)</th>
                  </tr>
              </thead>
              <tbody>
                  <tr>
                      <td>
                        <strong>${invoiceData.vehicleMake} ${invoiceData.vehicleModel}</strong><br/>
                        <span style="color:#6b7280; font-size: 12px;">Year: ${invoiceData.vehicleYear} | Condition: Excellent</span>
                      </td>
                      <td>${invoiceData.vin || 'Pending Final Allocation'}</td>
                      <td>
                        Fuel: ${invoiceData.fuelType}<br/>
                        Duty: ${invoiceData.dutyStatus}<br/>
                        ${invoiceData.fuelType === 'ELECTRIC' ? `SOH: ${invoiceData.batterySoh || 100}%` : ''}
                      </td>
                      <td style="text-align: right; font-weight: bold;">
                        ${Number(invoiceData.amount).toLocaleString()}
                      </td>
                  </tr>
              </tbody>
          </table>

          <div class="totals">
              <div class="total-row">
                  <span>Subtotal:</span>
                  <span>${Number(invoiceData.amount).toLocaleString()} ETB</span>
              </div>
              <div class="total-row">
                  <span>VAT (15%):</span>
                  <span>${(Number(invoiceData.amount) * 0.15).toLocaleString()} ETB</span>
              </div>
              <div class="total-row grand-total">
                  <span>Grand Total:</span>
                  <span>${(Number(invoiceData.amount) * 1.15).toLocaleString()} ETB</span>
              </div>
              
              <div style="margin-top: 20px; background: #6d28d915; padding: 15px; border-radius: 8px; border: 1px solid #6d28d940;">
                 <h4 style="margin:0 0 5px 0; color:#6d28d9; font-size: 12px; text-transform:uppercase;">Bank Linking Details</h4>
                 <p style="margin:0; font-size: 14px; font-weight: 600;">Account: ${invoiceData.bankPartner || 'CBE / Awash / BOA'}</p>
                 <p style="margin:5px 0 0 0; font-size: 12px; color: #4b5563;">This pro-forma validates the asset exclusively for local Ethiopian financing.</p>
              </div>
          </div>

          <div class="footer">
              This is a system generated document mapped natively from the PeaceCars Enterprise OS.<br/>
              Valid for 14 Days. Subject to Global Exchange Rate / Black Market Fluctuations.
          </div>
      </body>
      </html>
    `;

    // 2. Launch Puppeteer Invisible Engine
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    // 3. Render and buffer
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    
    await browser.close();
    
    // Format natively for NestJS stream (Buffer to Uint8Array)
    return Buffer.from(pdfBuffer);
  }
}
