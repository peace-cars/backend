export enum Role {
  USER = 'USER',
  BROKER = 'BROKER',
  STAFF = 'STAFF',
  DISTRICT_MANAGER = 'DISTRICT_MANAGER',
  GENERAL_MANAGER = 'GENERAL_MANAGER',
  FINANCE_AUDITOR = 'FINANCE_AUDITOR',
}

export interface AuthenticatedUser {
  id: string;
  userId: string;
  email: string;
  role: Role;
  fullName: string;
  phoneNumber: string | null;
  branchId: string | null;
  districtId: string | null;
  locationId: string | null;
  isVerified: boolean;
  gamificationPoints: number;
  permissions: string[];
  scopedBranchIds: string[];
}
