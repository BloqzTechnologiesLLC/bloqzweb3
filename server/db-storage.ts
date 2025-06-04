import { db } from "./db";
import { 
  users, 
  prescriptions, 
  pharmacies, 
  medicationPrices, 
  insuranceClaims, 
  aiInteractions, 
  blockchainTransactions,
  auditLogs,
  dataAccessLogs,
  securityIncidents,
  complianceReports,
  type User, 
  type InsertUser, 
  type Prescription, 
  type InsertPrescription,
  type Pharmacy,
  type InsertPharmacy,
  type MedicationPrice,
  type InsertMedicationPrice,
  type InsuranceClaim,
  type InsertInsuranceClaim,
  type AiInteraction,
  type InsertAiInteraction,
  type BlockchainTransaction,
  type InsertBlockchainTransaction,
  type AuditLog,
  type InsertAuditLog,
  type DataAccessLog,
  type InsertDataAccessLog,
  type SecurityIncident,
  type InsertSecurityIncident,
  type ComplianceReport,
  type InsertComplianceReport
} from "@shared/schema";
import { IStorage } from "./storage";
import { eq, and, inArray, sql } from "drizzle-orm";

export class DbStorage implements IStorage {
  // User management
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, role));
  }

  // Prescription management
  async createPrescription(insertPrescription: InsertPrescription): Promise<Prescription> {
    const result = await db.insert(prescriptions).values(insertPrescription).returning();
    return result[0];
  }

  async getPrescription(id: number): Promise<Prescription | undefined> {
    const result = await db.select().from(prescriptions).where(eq(prescriptions.id, id)).limit(1);
    return result[0];
  }

  async getPrescriptionsByPatient(patientId: number): Promise<Prescription[]> {
    return await db.select().from(prescriptions).where(eq(prescriptions.patientId, patientId));
  }

  async getPrescriptionsByDoctor(doctorId: number): Promise<Prescription[]> {
    return await db.select().from(prescriptions).where(eq(prescriptions.doctorId, doctorId));
  }

  async getPrescriptionsByPharmacy(pharmacyId: number): Promise<Prescription[]> {
    return await db.select().from(prescriptions).where(eq(prescriptions.pharmacyId, pharmacyId));
  }

  async updatePrescriptionStatus(id: number, status: string): Promise<Prescription> {
    const result = await db.update(prescriptions)
      .set({ status })
      .where(eq(prescriptions.id, id))
      .returning();
    return result[0];
  }

  // Pharmacy management
  async createPharmacy(insertPharmacy: InsertPharmacy): Promise<Pharmacy> {
    const result = await db.insert(pharmacies).values(insertPharmacy).returning();
    return result[0];
  }

  async getPharmacy(id: number): Promise<Pharmacy | undefined> {
    const result = await db.select().from(pharmacies).where(eq(pharmacies.id, id)).limit(1);
    return result[0];
  }

  async searchPharmacies(filters: {
    latitude?: number;
    longitude?: number;
    radius?: number;
    medication?: string;
    inNetworkOnly?: boolean;
  }): Promise<Pharmacy[]> {
    let query = db.select().from(pharmacies);
    
    const conditions = [];
    
    if (filters.inNetworkOnly) {
      conditions.push(eq(pharmacies.isInNetwork, true));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query;

    // Filter by medication inventory (basic check)
    if (filters.medication) {
      return results.filter(pharmacy => {
        const inventory = pharmacy.inventory as any;
        return inventory && inventory[filters.medication!.toLowerCase()] > 0;
      });
    }

    return results;
  }

  async getPharmacyInventory(pharmacyId: number): Promise<any> {
    const pharmacy = await this.getPharmacy(pharmacyId);
    return pharmacy?.inventory || {};
  }

  // Medication pricing
  async createMedicationPrice(insertPrice: InsertMedicationPrice): Promise<MedicationPrice> {
    const result = await db.insert(medicationPrices).values(insertPrice).returning();
    return result[0];
  }

  async getMedicationPrice(id: number): Promise<MedicationPrice | undefined> {
    const result = await db.select().from(medicationPrices).where(eq(medicationPrices.id, id)).limit(1);
    return result[0];
  }

  async compareMedicationPrices(medication: string, pharmacyIds: number[]): Promise<MedicationPrice[]> {
    return await db.select().from(medicationPrices)
      .where(and(
        sql`lower(${medicationPrices.medicationName}) LIKE ${`%${medication.toLowerCase()}%`}`,
        inArray(medicationPrices.pharmacyId, pharmacyIds)
      ));
  }

  async updateMedicationPrice(id: number, updates: Partial<MedicationPrice>): Promise<MedicationPrice> {
    const result = await db.update(medicationPrices)
      .set(updates)
      .where(eq(medicationPrices.id, id))
      .returning();
    return result[0];
  }

  // Insurance claims
  async createInsuranceClaim(insertClaim: InsertInsuranceClaim): Promise<InsuranceClaim> {
    const result = await db.insert(insuranceClaims).values(insertClaim).returning();
    return result[0];
  }

  async getInsuranceClaim(id: number): Promise<InsuranceClaim | undefined> {
    const result = await db.select().from(insuranceClaims).where(eq(insuranceClaims.id, id)).limit(1);
    return result[0];
  }

  async getClaimsByProvider(provider: string, status?: string, limit: number = 50): Promise<InsuranceClaim[]> {
    let query = db.select().from(insuranceClaims)
      .where(eq(insuranceClaims.insuranceProvider, provider));

    if (status) {
      query = query.where(and(
        eq(insuranceClaims.insuranceProvider, provider),
        eq(insuranceClaims.status, status)
      ));
    }

    return await query.limit(limit);
  }

  async getClaimsByPatient(patientId: number): Promise<InsuranceClaim[]> {
    return await db.select().from(insuranceClaims).where(eq(insuranceClaims.patientId, patientId));
  }

  async processInsuranceClaim(id: number, status: string, reason?: string): Promise<InsuranceClaim> {
    const result = await db.update(insuranceClaims)
      .set({ 
        status, 
        reason: reason || null,
        processedAt: new Date()
      })
      .where(eq(insuranceClaims.id, id))
      .returning();
    return result[0];
  }

  // AI interactions
  async createAiInteraction(insertInteraction: InsertAiInteraction): Promise<AiInteraction> {
    const result = await db.insert(aiInteractions).values(insertInteraction).returning();
    return result[0];
  }

  async getAiInteractionsByUser(userId: number, portal?: string): Promise<AiInteraction[]> {
    let query = db.select().from(aiInteractions)
      .where(eq(aiInteractions.userId, userId));

    if (portal) {
      query = query.where(and(
        eq(aiInteractions.userId, userId),
        eq(aiInteractions.portal, portal)
      ));
    }

    return await query.orderBy(sql`${aiInteractions.createdAt} DESC`);
  }

  async getAiInteractionsByPortal(portal: string): Promise<AiInteraction[]> {
    return await db.select().from(aiInteractions)
      .where(eq(aiInteractions.portal, portal))
      .orderBy(sql`${aiInteractions.createdAt} DESC`);
  }

  // Blockchain transactions
  async createBlockchainTransaction(insertTransaction: InsertBlockchainTransaction): Promise<BlockchainTransaction> {
    const result = await db.insert(blockchainTransactions).values(insertTransaction).returning();
    return result[0];
  }

  async getBlockchainTransaction(hash: string): Promise<BlockchainTransaction | undefined> {
    const result = await db.select().from(blockchainTransactions)
      .where(eq(blockchainTransactions.transactionHash, hash))
      .limit(1);
    return result[0];
  }

  async getRecentBlockchainTransactions(limit: number): Promise<BlockchainTransaction[]> {
    return await db.select().from(blockchainTransactions)
      .orderBy(sql`${blockchainTransactions.createdAt} DESC`)
      .limit(limit);
  }

  async updateBlockchainTransactionStatus(id: number, status: string): Promise<BlockchainTransaction> {
    const result = await db.update(blockchainTransactions)
      .set({ status })
      .where(eq(blockchainTransactions.id, id))
      .returning();
    return result[0];
  }

  // HIPAA Compliance
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const result = await db.insert(auditLogs).values(log).returning();
    return result[0];
  }

  async getAuditLogs(userId?: number): Promise<AuditLog[]> {
    let query = db.select().from(auditLogs);
    if (userId) {
      query = query.where(eq(auditLogs.userId, userId));
    }
    return await query.orderBy(sql`${auditLogs.timestamp} DESC`);
  }

  async createDataAccessLog(log: InsertDataAccessLog): Promise<DataAccessLog> {
    const result = await db.insert(dataAccessLogs).values(log).returning();
    return result[0];
  }

  async getDataAccessLogs(userId?: number): Promise<DataAccessLog[]> {
    let query = db.select().from(dataAccessLogs);
    if (userId) {
      query = query.where(eq(dataAccessLogs.userId, userId));
    }
    return await query.orderBy(sql`${dataAccessLogs.timestamp} DESC`);
  }

  async createSecurityIncident(incident: InsertSecurityIncident): Promise<SecurityIncident> {
    const result = await db.insert(securityIncidents).values(incident).returning();
    return result[0];
  }

  async getSecurityIncidents(status?: string): Promise<SecurityIncident[]> {
    let query = db.select().from(securityIncidents);
    if (status) {
      query = query.where(eq(securityIncidents.status, status));
    }
    return await query.orderBy(sql`${securityIncidents.timestamp} DESC`);
  }

  async updateSecurityIncident(id: number, updates: Partial<SecurityIncident>): Promise<SecurityIncident> {
    const result = await db.update(securityIncidents)
      .set(updates)
      .where(eq(securityIncidents.id, id))
      .returning();
    return result[0];
  }

  async createComplianceReport(report: InsertComplianceReport): Promise<ComplianceReport> {
    const result = await db.insert(complianceReports).values(report).returning();
    return result[0];
  }

  async getComplianceReports(): Promise<ComplianceReport[]> {
    return await db.select().from(complianceReports)
      .orderBy(sql`${complianceReports.createdAt} DESC`);
  }
}