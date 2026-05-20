import { Controller, Post, Body, Headers, ForbiddenException, Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { ConfigService } from '@nestjs/config';

@Controller('telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
  ) {}

  @Post('webhook')
  async handleWebhook(@Body() update: any, @Headers('x-telegram-bot-api-secret-token') secretHeader?: string) {
    const secret = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET');
    if (secret) {
      if (!secretHeader || secretHeader !== secret) {
        this.logger.warn('Telegram webhook rejected due to invalid secret header');
        throw new ForbiddenException('Invalid webhook secret');
      }
    }

    // Forward the raw update to the bot instance for processing
    await this.telegram.processUpdate(update);
    return { ok: true };
  }
}
