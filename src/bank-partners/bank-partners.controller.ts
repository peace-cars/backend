import { Controller, Get, Query, Param } from '@nestjs/common';
import { BankPartnersService } from './bank-partners.service';

@Controller('bank-partners')
export class BankPartnersController {
  constructor(private readonly bankPartnersService: BankPartnersService) {}

  @Get()
  async getAll(@Query('all') all?: string) {
    const activeOnly = all !== 'true';
    return this.bankPartnersService.getAll(activeOnly);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.bankPartnersService.getById(id);
  }
}
