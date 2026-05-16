import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const TelegramBot = require('node-telegram-bot-api');

const BUY_STEPS = {
  ASK_PHONE: 'BUY_ASK_PHONE',
  ASK_PAYMENT: 'BUY_ASK_PAYMENT',
  ASK_NOTES: 'BUY_ASK_NOTES',
};

@Injectable()
export class TelegramService implements OnModuleInit {
  private bot: any = null;
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {}

  onModuleInit() {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set — Telegram bot is DISABLED.');
      return;
    }

    this.bot = new TelegramBot(token, { polling: true });
    
    // Add error handling to prevent crashes on network timeouts
    this.bot.on('polling_error', (error: any) => {
      this.logger.error(`🤖 Telegram Polling Error: ${error.code} - ${error.message}`);
    });

    this.bot.on('error', (error: any) => {
      this.logger.error(`🤖 Telegram General Error: ${error.message}`);
    });

    this.logger.log('🤖 PeaceCars Telegram Bot started (polling).');

    this.registerHandlers();
  }

  // ─── Command Handlers ──────────────────────────────────────────────

  private registerHandlers() {
    if (!this.bot) return;

    // /start — optionally with a vehicle deeplink
    this.bot.onText(/\/start\s*(.*)/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      const payload = (match?.[1] || '').trim();

      this.logger.log(`Bot /start received. Payload: "${payload}"`);

      if (payload.startsWith('vehicle_')) {
        const vehicleId = payload.replace('vehicle_', '').trim();
        await this.handleVehicleInquiry(chatId, vehicleId, msg);
      } else {
        await this.sendWelcome(chatId);
      }
    });

    // /buy command
    this.bot.onText(/\/buy/, async (msg: any) => {
      await this.handleBuyCommand(msg.chat.id);
    });

    // Any free-text message (not a command) → route to sales or handle form
    this.bot.on('message', async (msg: any) => {
      if (msg.text?.startsWith('/')) return;
      
      // Handle contact sharing
      if (msg.contact) {
        await this.handleContact(msg);
        return;
      }

      await this.handleFreeMessage(msg);
    });

    // /browse command
    this.bot.onText(/\/browse/, async (msg: any) => {
      await this.handleBrowse(msg.chat.id);
    });

    // /search command
    this.bot.onText(/\/search\s*(.*)/, async (msg: any, match: any) => {
      const query = (match?.[1] || '').trim();
      await this.handleSearch(msg.chat.id, query);
    });

    // Callback queries for inline buttons
    this.bot.on('callback_query', async (query: any) => {
      if (!query.data) return;

      if (query.data.startsWith('inquire_')) {
        const vehicleId = query.data.replace('inquire_', '');
        await this.bot.answerCallbackQuery(query.id);
        await this.handleVehicleInquiry(query.message!.chat.id, vehicleId, query.message);
      }

      if (query.data === 'browse_all') {
        await this.bot.answerCallbackQuery(query.id);
        await this.handleBrowse(query.message!.chat.id);
      }

      if (query.data.startsWith('buy_now_')) {
        const vehicleId = query.data.replace('buy_now_', '');
        await this.bot.answerCallbackQuery(query.id);
        await this.handleBuyCommand(query.message!.chat.id, vehicleId);
      }

      if (query.data.startsWith('pay_')) {
        const method = query.data.replace('pay_', '');
        await this.bot.answerCallbackQuery(query.id);
        await this.handlePaymentMethodSelection(query.message!.chat.id, method);
      }
    });
  }

  // ─── Buy Form Flow ────────────────────────────────────────────────

  private async handleBuyCommand(chatId: number, vehicleId?: string) {
    const client = this.supabase.getClient();
    
    // If no vehicleId provided, try to find the last viewed vehicle from session
    let vid = vehicleId;
    if (!vid) {
      const { data: session } = await client
        .from('telegram_sessions')
        .select('vehicle_id')
        .eq('telegram_chat_id', chatId.toString())
        .single();
      vid = session?.vehicle_id;
    }

    try {
      if (!vid) {
        await this.bot.sendMessage(chatId, '🛒 To start a purchase, please first /browse and select a vehicle.');
        return;
      }

      // Initialize session with step and vehicle
      await client.from('telegram_sessions').upsert({
        telegram_chat_id: chatId.toString(),
        vehicle_id: vid,
        current_step: BUY_STEPS.ASK_PHONE,
        form_data: { vehicle_id: vid },
      }, { onConflict: 'telegram_chat_id' });

      await this.bot.sendMessage(chatId, '🚀 *Initiating Purchase Request*\n\nPlease share your phone number so our sales team can contact you to finalize the details.', {
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [[{ text: '📞 Share Phone Number', request_contact: true }]],
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to handle buy command for chat ${chatId}`, err);
    }
  }

  private async handleContact(msg: any) {
    const chatId = msg.chat.id;
    const phone = msg.contact.phone_number;
    const client = this.supabase.getClient();

    const { data: session } = await client
      .from('telegram_sessions')
      .select('*')
      .eq('telegram_chat_id', chatId.toString())
      .single();

    if (session?.current_step !== BUY_STEPS.ASK_PHONE) return;

    const updatedFormData = { ...(session.form_data || {}), phone };

    try {
      await client.from('telegram_sessions').update({
        current_step: BUY_STEPS.ASK_PAYMENT,
        form_data: updatedFormData,
      }).eq('telegram_chat_id', chatId.toString());

      await this.bot.sendMessage(chatId, '✅ Phone number received.\n\n*Step 2: Payment Method*\nHow would you like to handle the payment?', {
        parse_mode: 'Markdown',
        reply_markup: {
          remove_keyboard: true,
          inline_keyboard: [
            [{ text: '🏦 Bank Transfer', callback_data: 'pay_BANK' }],
            [{ text: '💵 Cash', callback_data: 'pay_CASH' }],
            [{ text: '📈 Finance / Loan', callback_data: 'pay_FINANCE' }],
          ],
        },
      });
    } catch (err) {
      this.logger.error(`Failed to handle contact for chat ${chatId}`, err);
    }
  }

  private async handlePaymentMethodSelection(chatId: number, method: string) {
    const client = this.supabase.getClient();
    const { data: session } = await client
      .from('telegram_sessions')
      .select('*')
      .eq('telegram_chat_id', chatId.toString())
      .single();

    if (session?.current_step !== BUY_STEPS.ASK_PAYMENT) return;

    const updatedFormData = { ...(session.form_data || {}), payment_method: method };

    try {
      await client.from('telegram_sessions').update({
        current_step: BUY_STEPS.ASK_NOTES,
        form_data: updatedFormData,
      }).eq('telegram_chat_id', chatId.toString());

      await this.bot.sendMessage(chatId, '📝 *Final Step: Notes*\nDo you have any special requests or questions for our sales team? (Type below or send "none")');
    } catch (err) {
      this.logger.error(`Failed to handle payment selection for chat ${chatId}`, err);
    }
  }

  private async finalizeBuyRequest(chatId: number, notes: string) {
    const client = this.supabase.getClient();
    const { data: session } = await client
      .from('telegram_sessions')
      .select('*')
      .eq('telegram_chat_id', chatId.toString())
      .single();

    if (session?.current_step !== BUY_STEPS.ASK_NOTES) return;

    const finalData = { 
      ...(session.form_data || {}), 
      notes: notes.toLowerCase() === 'none' ? '' : notes,
      timestamp: new Date().toISOString()
    };

    // 1. Get vehicle info for the summary
    const { data: vehicle } = await client
      .from('vehicles')
      .select('make, model, year, retail_price_etb')
      .eq('id', session.vehicle_id)
      .single();

    // 2. Clear session step
    await client.from('telegram_sessions').update({
      current_step: null,
      form_data: {},
    }).eq('telegram_chat_id', chatId.toString());

    try {
      // 3. Send confirmation to user
      const summary = [
        `🏁 *Purchase Request Submitted!*`,
        ``,
        `🚗 Vehicle: ${vehicle?.year} ${vehicle?.make} ${vehicle?.model}`,
        `📞 Phone: ${finalData.phone}`,
        `💰 Payment: ${finalData.payment_method}`,
        finalData.notes ? `📝 Notes: ${finalData.notes}` : null,
        ``,
        `Our team will reach out to you within 24 hours.`,
      ].filter(Boolean).join('\n');

      await this.bot.sendMessage(chatId, summary, { parse_mode: 'Markdown' });

      // 4. Forward to Sales Group
      const salesGroupId = this.config.get<string>('TELEGRAM_SALES_GROUP_ID');
      if (salesGroupId) {
        const groupAlert = [
          `🚨 *NEW BUY REQUEST (Telegram)*`,
          ``,
          `👤 Customer: ${this.getTelegramName({ from: { first_name: '', last_name: '' } })}`, // Will handle better in actual call
          `🚗 Vehicle: ${vehicle?.year} ${vehicle?.make} ${vehicle?.model}`,
          `📞 Phone: ${finalData.phone}`,
          `💰 Payment: ${finalData.payment_method}`,
          `📝 Notes: ${finalData.notes || 'N/A'}`,
          ``,
          `🔗 Portal: https://peacecars.com/admin/inventory?id=${session.vehicle_id}`,
        ].join('\n');

        await this.bot.sendMessage(salesGroupId, groupAlert, { parse_mode: 'Markdown' });
      }
    } catch (err) {
      this.logger.error(`Failed to finalize buy request for chat ${chatId}`, err);
    }

    // 5. Save to Portal as a system message
    await this.saveBuyRequestToPortal(chatId, finalData, vehicle);
  }

  private async saveBuyRequestToPortal(chatId: number, data: any, vehicle: any) {
    const client = this.supabase.getClient();
    const summary = `[PURCHASE REQUEST] Vehicle: ${vehicle?.year} ${vehicle?.make} ${vehicle?.model} | Payment: ${data.payment_method} | Phone: ${data.phone} | Notes: ${data.notes || 'None'}`;
    
    // Create/update conversation
    await this.saveMessageToPortal(chatId, { text: summary }, data.vehicle_id);
  }

  // ─── Vehicle Inquiry (deep-link) ───────────────────────────────────

  private async handleVehicleInquiry(chatId: number, vehicleId: string, msg: any) {
    this.logger.debug(`Processing inquiry for vehicleId: [${vehicleId}]`);
    const client = this.supabase.getClient();

    const { data: vehicle, error } = await client
      .from('vehicles')
      .select(`
        id, make, model, year, retail_price_etb, fuel, duty, images, branch_id, status,
        range_km, motor_power_kw, drive_train, interior_color, battery_capacity_kwh, features
      `)
      .eq('id', vehicleId)
      .single();

    if (error) {
      this.logger.error(`Database error fetching vehicle [${vehicleId}]: ${error.message}`, error);
      await this.bot.sendMessage(chatId, `❌ Vehicle lookup failed. (ID: ${vehicleId.substring(0, 8)}...)`);
      return;
    }

    if (!vehicle) {
      this.logger.warn(`Vehicle not found in DB: [${vehicleId}]`);
      await this.bot.sendMessage(chatId, '❌ Vehicle not found. It may have been sold or removed from inventory.');
      return;
    }

    // 1. Send all images as an album (Media Group)
    const images = (vehicle.images || []).slice(0, 10);
    if (images.length > 0) {
      const media = images.map((url: string, index: number) => ({
        type: 'photo',
        media: url,
        caption: index === 0 ? `📸 Photos of ${vehicle.year} ${vehicle.make} ${vehicle.model}` : '',
      }));
      try {
        await this.bot.sendMediaGroup(chatId, media);
      } catch (err) {
        this.logger.error('Failed to send media group', err);
        // Fallback to single photo if album fails
        await this.bot.sendPhoto(chatId, images[0]);
      }
    }

    // 2. Prepare detailed caption with technical specs
    const priceFormatted = vehicle.retail_price_etb
      ? `${(Number(vehicle.retail_price_etb) / 1_000_000).toFixed(2)}M ETB`
      : 'Price on Request';

    const details = [
      `🚗 *${vehicle.year} ${vehicle.make} ${vehicle.model}*`,
      `💰 Price: *${priceFormatted}*`,
      ``,
      `*Technical Specifications:*`,
      `⛽ Fuel/Energy: ${vehicle.fuel || 'N/A'}`,
      vehicle.range_km ? `🔋 Range: ${vehicle.range_km} km` : null,
      vehicle.battery_capacity_kwh ? `🔋 Battery: ${vehicle.battery_capacity_kwh} kWh` : null,
      vehicle.motor_power_kw ? `⚡ Power: ${vehicle.motor_power_kw} kW` : null,
      vehicle.drive_train ? `⚙️ Drive: ${vehicle.drive_train}` : null,
      vehicle.interior_color ? `🎨 Interior: ${vehicle.interior_color}` : null,
      `📋 Duty: ${(vehicle.duty || '').replace(/_/g, ' ')}`,
      ``,
      vehicle.features && vehicle.features.length > 0 ? `✨ *Key Features:* \n${vehicle.features.join(', ')}\n` : null,
      `📍 Status: ${vehicle.status}`,
      ``,
      `📞 *Call Sales:* +251 919 192414`,
      ``,
      `💬 *Inquiry:* Type your message below to talk to our sales team!`,
    ].filter(Boolean).join('\n');

    const inlineKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🚀 Buy Now', callback_data: `buy_now_${vehicleId}` },
            { text: '🌐 Website', url: `https://peacecars.com/inventory/${vehicleId}` },
          ],
          [
            { text: '🛒 Browse All', callback_data: 'browse_all' },
          ],
        ],
      },
    };

    try {
      await this.bot.sendMessage(chatId, details, {
        parse_mode: 'Markdown',
        ...inlineKeyboard,
      });
    } catch (err) {
      this.logger.error(`Failed to send vehicle details to chat ${chatId}`, err);
    }

    // 3. Mark this vehicle as the active context for this chat
    await this.setActiveVehicle(chatId, vehicleId);

    // 4. Log inquiry to portal
    await this.logInquiryToPortal(chatId, vehicleId, vehicle, msg);
  }

  // ─── Browse Showroom ─────────────────────────────────────────────

  private async handleBrowse(chatId: number) {
    const client = this.supabase.getClient();

    const { data: vehicles, error } = await client
      .from('vehicles')
      .select('id, make, model, year, retail_price_etb, images')
      .eq('status', 'SHOWROOM')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      this.logger.error(`Error fetching showroom vehicles: ${error.message}`, error);
      await this.bot.sendMessage(chatId, '❌ Sorry, there was an error connecting to our showroom database.');
      return;
    }

    if (!vehicles || vehicles.length === 0) {
      await this.bot.sendMessage(chatId, '📭 Our showroom is currently empty. Please check back later or visit our website!');
      return;
    }

    try {
      await this.bot.sendMessage(chatId, `🏢 *PeaceCars Showroom* \nHere are some of our latest verified vehicles:`, { parse_mode: 'Markdown' });

      for (const v of vehicles) {
        const price = v.retail_price_etb ? `${(Number(v.retail_price_etb) / 1_000_000).toFixed(2)}M ETB` : 'Price on Request';
        const images = v.images || [];
        const photo = images[0] || null;

        const caption = `🚗 *${v.year} ${v.make} ${v.model}* \n💰 Price: ${price}`;
        
        const opts = {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '🔍 View Details', callback_data: `inquire_${v.id}` }]]
          }
        };

        if (photo) {
          await this.bot.sendPhoto(chatId, photo, { caption, ...opts });
        } else {
          await this.bot.sendMessage(chatId, caption, opts);
        }
      }

      await this.bot.sendMessage(chatId, '🌐 See full inventory at peacecars.com/inventory');
    } catch (err) {
      this.logger.error(`Failed to send browse results to chat ${chatId}`, err);
    }
  }

  // ─── Search Showroom ─────────────────────────────────────────────

  private async handleSearch(chatId: number, query: string) {
    if (!query) {
      await this.bot.sendMessage(chatId, '🔍 Please provide a search term. \nExample: `/search Toyota` or `/search EV`', { parse_mode: 'Markdown' });
      return;
    }

    const client = this.supabase.getClient();
    const fuelTypes = ['EV', 'PETROL', 'DIESEL', 'HYBRID', 'PHEV'];
    const isFuelType = fuelTypes.includes(query.toUpperCase());
    const orQuery = isFuelType 
      ? `make.ilike.%${query}%,model.ilike.%${query}%,fuel.eq.${query.toUpperCase()}`
      : `make.ilike.%${query}%,model.ilike.%${query}%`;

    // Search make, model, or fuel type
    const { data: vehicles, error } = await client
      .from('vehicles')
      .select('id, make, model, year, retail_price_etb, images')
      .eq('status', 'SHOWROOM')
      .or(orQuery)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      this.logger.error(`Error searching vehicles: ${error.message}`, error);
      await this.bot.sendMessage(chatId, '❌ Sorry, there was an error searching our inventory.');
      return;
    }

    if (!vehicles || vehicles.length === 0) {
      await this.bot.sendMessage(chatId, `📭 We couldn't find any showroom vehicles matching "${query}". Please try a different search or use /browse.`);
      return;
    }

    try {
      await this.bot.sendMessage(chatId, `🔍 *Search Results for "${query}"* \nHere are the top matches:`, { parse_mode: 'Markdown' });

      for (const v of vehicles) {
        const price = v.retail_price_etb ? `${(Number(v.retail_price_etb) / 1_000_000).toFixed(2)}M ETB` : 'Price on Request';
        const images = v.images || [];
        const photo = images[0] || null;

        const caption = `🚗 *${v.year} ${v.make} ${v.model}* \n💰 Price: ${price}`;
        
        const opts = {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '🔍 View Details', callback_data: `inquire_${v.id}` }]]
          }
        };

        if (photo) {
          await this.bot.sendPhoto(chatId, photo, { caption, ...opts });
        } else {
          await this.bot.sendMessage(chatId, caption, opts);
        }
      }

      await this.bot.sendMessage(chatId, '🌐 See full inventory at peacecars.com/inventory');
    } catch (err) {
      this.logger.error(`Failed to send search results to chat ${chatId}`, err);
    }
  }

  // ─── Free Message Handling ─────────────────────────────────────────

  private async handleFreeMessage(msg: any) {
    if (!msg.text) return;
    const chatId = msg.chat.id;
    const client = this.supabase.getClient();

    const { data: session } = await client
      .from('telegram_sessions')
      .select('*')
      .eq('telegram_chat_id', chatId.toString())
      .single();

    // Check if in the middle of a Buy Flow
    if (session?.current_step === BUY_STEPS.ASK_NOTES) {
      await this.finalizeBuyRequest(chatId, msg.text);
      return;
    }

    const vehicleId = session?.vehicle_id || null;

    // 1. Save message to conversations/messages tables (web portal)
    await this.saveMessageToPortal(chatId, msg, vehicleId);

    // 2. Forward to Telegram sales group & DM
    await this.forwardToSalesTeam(chatId, msg, vehicleId);

    // 3. Acknowledge to user
    const autoReplyText = '✅ Your message has been received! Our sales team will get back to you shortly.\n\n' +
      '✨ Find your perfect match. Take our 30-second quiz to identify the best vehicle for your lifestyle and budget in Ethiopia.\n\n' +
      '📞 For urgent inquiries, call: +251-919-192414';

    try {
      await this.bot.sendMessage(chatId, autoReplyText);
    } catch (err) {
      this.logger.error(`Failed to send auto-reply to chat ${chatId}`, err);
    }

    // 4. Save bot reply to portal
    await this.saveBotReplyToPortal(chatId, autoReplyText);
  }

  // ─── Portal Integration (conversations + messages tables) ──────────

  private async logInquiryToPortal(chatId: number, vehicleId: string, vehicle: any, msg: any) {
    const client = this.supabase.getClient();

    // Check if conversation exists
    const { data: existing } = await client
      .from('conversations')
      .select('id')
      .eq('telegram_chat_id', chatId.toString())
      .eq('vehicle_id', vehicleId)
      .single();

    const payload = {
      customer_name: this.getTelegramName(msg),
      last_message: `[Telegram Inquiry] Viewing ${vehicle.make} ${vehicle.model}`,
      updated_at: new Date().toISOString(),
      source: 'TELEGRAM',
    };

    let convErr = null;

    if (existing) {
      const { error } = await client.from('conversations').update(payload).eq('id', existing.id);
      convErr = error;
    } else {
      const { error } = await client.from('conversations').insert({
        ...payload,
        vehicle_id: vehicleId,
        telegram_chat_id: chatId.toString(),
      });
      convErr = error;
    }

    if (convErr) {
      this.logger.error('Failed to log inquiry to portal', convErr.message);
    }
  }

  private async saveMessageToPortal(chatId: number, msg: any, vehicleId: string | null) {
    const client = this.supabase.getClient();

    let query = client
      .from('conversations')
      .select('id')
      .eq('telegram_chat_id', chatId.toString())
      .order('updated_at', { ascending: false })
      .limit(1);

    if (vehicleId) {
      query = query.eq('vehicle_id', vehicleId);
    }

    const { data: conv } = await query.single();
    let conversationId = conv?.id;

    if (!conversationId) {
      const { data: newConv, error } = await client
        .from('conversations')
        .insert({
          telegram_chat_id: chatId.toString(),
          customer_name: this.getTelegramName(msg),
          vehicle_id: vehicleId,
          last_message: msg.text,
          source: 'TELEGRAM',
        })
        .select()
        .single();

      if (error) {
        this.logger.error('Failed to create conversation', error.message);
        return;
      }
      conversationId = newConv.id;
    }

    await client.from('messages').insert({
      conversation_id: conversationId,
      text: msg.text,
      sender_name: this.getTelegramName(msg),
      source: 'TELEGRAM',
      telegram_chat_id: chatId.toString(),
    });

    await client
      .from('conversations')
      .update({ last_message: msg.text, updated_at: new Date().toISOString() })
      .eq('id', conversationId);
  }

  private async saveBotReplyToPortal(chatId: number, text: string) {
    const client = this.supabase.getClient();
    
    // Find the latest conversation for this chat
    const { data: conv } = await client
      .from('conversations')
      .select('id')
      .eq('telegram_chat_id', chatId.toString())
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (conv?.id) {
      await client.from('messages').insert({
        conversation_id: conv.id,
        text: text,
        sender_name: 'PeaceCars Bot',
        source: 'SYSTEM',
        telegram_chat_id: chatId.toString(),
      });
    }
  }

  // ─── Telegram Group Forwarding ─────────────────────────────────────

  private async forwardToSalesTeam(chatId: number, msg: any, vehicleId: string | null) {
    const client = this.supabase.getClient();
    const senderName = this.getTelegramName(msg);
    const u = msg?.from || {};
    const username = u.username ? ` (@${u.username})` : '';
    const phone = msg?.contact?.phone_number ? `\n📞 Phone: ${msg.contact.phone_number}` : '';
    let vehicleInfo = '';

    if (vehicleId) {
      const { data: v } = await client
        .from('vehicles')
        .select('make, model, year, branch_id')
        .eq('id', vehicleId)
        .single();

      if (v) {
        vehicleInfo = `\n🚗 Vehicle: ${v.year} ${v.make} ${v.model}`;

        if (v.branch_id) {
          await this.notifyBranchDM(v.branch_id, `${senderName}${username}${phone}`, msg.text!, v);
        }
      }
    }

    const salesGroupId = this.config.get<string>('TELEGRAM_SALES_GROUP_ID');
    if (salesGroupId && this.bot) {
      const forwardText = [
        `📩 *New Customer Inquiry*`,
        `👤 From: ${senderName}${username}${phone}`,
        vehicleInfo,
        ``,
        `💬 "${msg.text}"`,
        ``,
        `🤖 *Bot Auto-Replied:*`,
        `"Find your perfect match. Take our 30-second quiz to identify the best vehicle for your lifestyle and budget in Ethiopia."`,
        ``,
        `📱 Reply via Admin/Staff Portal or Telegram.`,
      ].join('\n');

      try {
        await this.bot.sendMessage(salesGroupId, forwardText, { parse_mode: 'Markdown' });
      } catch (err) {
        this.logger.error('Failed to forward to sales group', err);
      }
    }
  }

  // ─── Branch-Specific DM Notification ───────────────────────────────

  private async notifyBranchDM(branchId: string, customerName: string, messageText: string, vehicle: any) {
    const client = this.supabase.getClient();

    const { data: dm } = await client
      .from('profiles')
      .select('id, full_name, telegram_chat_id')
      .eq('location_id', branchId)
      .eq('role', 'DISTRICT_MANAGER')
      .limit(1)
      .single();

    if (!dm?.telegram_chat_id || !this.bot) return;

    const dmMessage = [
      `🔔 *District Inquiry Alert*`,
      ``,
      `👤 Customer: ${customerName}`,
      `🚗 Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      `💬 "${messageText}"`,
      ``,
      `_This inquiry is from your branch. Please respond via the Admin Portal._`,
    ].join('\n');

    try {
      await this.bot.sendMessage(dm.telegram_chat_id, dmMessage, { parse_mode: 'Markdown' });
      this.logger.log(`Notified DM ${dm.full_name} for branch ${branchId}`);
    } catch (err) {
      this.logger.error(`Failed to notify DM ${dm?.full_name}`, err);
    }
  }

  // ─── Session / Context Management ──────────────────────────────────

  private async setActiveVehicle(chatId: number, vehicleId: string) {
    const client = this.supabase.getClient();
    await client.from('telegram_sessions').upsert(
      {
        telegram_chat_id: chatId.toString(),
        vehicle_id: vehicleId,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'telegram_chat_id' },
    );
  }

  // ─── Welcome Message ──────────────────────────────────────────────

  private async sendWelcome(chatId: number) {
    const welcome = [
      `🚗 *Welcome to PeaceCars!*`,
      ``,
      `Ethiopia's premier verified vehicle marketplace.`,
      ``,
      `Here's what I can help you with:`,
      `• /browse — See our latest collection`,
      `• /search [keyword] — Search by make, model, or fuel type`,
      `• /buy — Start a purchase for the last car you viewed`,
      `• Get instant vehicle details & pricing`,
      `• Connect you with our sales specialists`,
      ``,
      `🌐 Visit our showroom: peacecars.com/inventory`,
      ``,
      `Or simply type what you're looking for!`,
      `_Example: "EV under 5M" or "Toyota Land Cruiser"_`,
      ``,
      `📞 For urgent inquiries: +251-919-192414`,
    ].join('\n');

    try {
      await this.bot.sendMessage(chatId, welcome, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🛒 Browse Collection', callback_data: 'browse_all' }],
          ],
        },
      });
    } catch (err) {
      this.logger.error(`Failed to send welcome to chat ${chatId}`, err);
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  private getTelegramName(msg: any): string {
    const u = msg.from;
    if (!u || (!u.first_name && !u.username)) return 'Unknown User';
    return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'Unknown User';
  }

  // Public method: send a reply from portal back to Telegram
  async sendReplyToCustomer(telegramChatId: string, text: string) {
    if (!this.bot) {
      this.logger.warn('Telegram bot not initialized, cannot send reply.');
      return;
    }
    try {
      await this.bot.sendMessage(telegramChatId, `📩 *PeaceCars Team:*\n\n${text}`, {
        parse_mode: 'Markdown',
      });
    } catch (err) {
      this.logger.error(`Failed to send reply to Telegram chat ${telegramChatId}`, err);
    }
  }
}
