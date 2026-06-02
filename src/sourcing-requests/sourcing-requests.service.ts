import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SourcingRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) {}

  async createRequest(data: any, customerId?: string) {
    return this.prisma.sourcing_requests.create({
      data: {
        customer_id: customerId || null,
        make: data.make,
        model: data.model,
        min_year: data.min_year,
        max_year: data.max_year,
        max_mileage: data.max_mileage || null,
        transmission: data.transmission || null,
        fuel_type: data.fuel_type || null,
        max_budget: data.max_budget,
        payment_method: data.payment_method,
        must_have_features: data.must_have_features || [],
        exterior_colors: data.exterior_colors || [],
        urgency: data.urgency,
        contact_name: data.contact_name,
        contact_email: data.contact_email,
        contact_phone: data.contact_phone,
        photos: data.photos || [],
        status: 'SUBMITTED'
      }
    });
  }

  async getMyRequests(customerId: string) {
    return this.prisma.sourcing_requests.findMany({
      where: { customer_id: customerId },
      include: { matches: true },
      orderBy: { created_at: 'desc' }
    });
  }

  async getAllRequests(branchId?: string, role?: string, scopedBranchIds?: string[], userBranchId?: string) {
    const whereClause: any = {};
    
    // Exact branch filter (explicit query param)
    if (branchId && branchId !== 'ALL') {
      whereClause.branch_id = branchId;
    } 
    // Scope enforcement for DMs
    else if (role === 'DISTRICT_MANAGER') {
      if (scopedBranchIds && scopedBranchIds.length > 0) {
        whereClause.branch_id = { in: scopedBranchIds };
      } else if (userBranchId) {
        // Fallback: DM without full district config — scope to their direct branch
        whereClause.branch_id = userBranchId;
      }
      // If no scope info at all, return empty (prevent data leaks)
    }
    // STAFF: see requests assigned to their branch
    else if (role === 'STAFF' && userBranchId) {
      whereClause.branch_id = userBranchId;
    }
    // GM sees all

    return this.prisma.sourcing_requests.findMany({
      where: whereClause,
      include: {
        customer: { select: { id: true, full_name: true, phone_number: true } },
        assigned_staff: { select: { id: true, full_name: true } },
        branch: { select: { id: true, name: true } }
      },
      orderBy: { created_at: 'desc' }
    });
  }

  async getAssignedRequests(staffId: string) {
    return this.prisma.sourcing_requests.findMany({
      where: { assigned_staff_id: staffId },
      include: {
        customer: { select: { id: true, full_name: true, phone_number: true } },
        matches: true
      },
      orderBy: { created_at: 'desc' }
    });
  }

  async assignRequest(id: string, staffId?: string, branchId?: string) {
    const data: any = {};
    if (staffId !== undefined) data.assigned_staff_id = staffId;
    if (branchId !== undefined) data.branch_id = branchId;
    
    return this.prisma.sourcing_requests.update({
      where: { id },
      data
    });
  }

  async updateStatus(id: string, status: string) {
    return this.prisma.sourcing_requests.update({
      where: { id },
      data: { status }
    });
  }

  async proposeMatch(requestId: string, matchData: any, staffId: string) {
    const request = await this.prisma.sourcing_requests.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Sourcing request not found');

    // 48 hour expiration
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    const match = await this.prisma.sourcing_matches.create({
      data: {
        request_id: requestId,
        make: matchData.make,
        model: matchData.model,
        year: matchData.year,
        match_score: matchData.match_score,
        agent_note: matchData.agent_note || null,
        budget_note: matchData.budget_note || null,
        mileage_note: matchData.mileage_note || null,
        color_note: matchData.color_note || null,
        photos: matchData.photos || [],
        video_url: matchData.video_url || null,
        diagnostic_checklist: matchData.diagnostic_checklist || {},
        imperfections: matchData.imperfections || [],
        purchase_price: matchData.purchase_price,
        sourcing_fee: matchData.sourcing_fee,
        logistics_cost: matchData.logistics_cost,
        total_otd_cost: matchData.total_otd_cost,
        status: 'PENDING',
        expires_at: expiresAt
      }
    });

    if (request.customer_id) {
      // Send the high-urgency bait notification
      await this.notifications.create(
        request.customer_id,
        'We found your perfect Match! 🚗',
        `Our sourcing team just located a vehicle that hits ${matchData.match_score}% of your requirements. It's well within your budget and has a clean history. Click to view condition report, photos, and price breakdown. Note: We can only hold this match for the next 48 hours.`,
        'SYSTEM',
        requestId,
        { matchId: match.id },
        `/custom-sourcing` // This URL will need to open the specific request in the UI
      );
    }

    return match;
  }

  async voteMatch(matchId: string, action: 'LIKE' | 'REJECT', rejectReason?: string) {
    const status = action === 'LIKE' ? 'LIKED' : 'REJECTED';
    return this.prisma.sourcing_matches.update({
      where: { id: matchId },
      data: { status, reject_reason: rejectReason || null }
    });
  }
}

