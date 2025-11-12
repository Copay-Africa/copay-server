import { Injectable, Logger } from '@nestjs/common';

export enum PaymentFrequency {
  DAILY = 'DAILY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export interface BillingPeriod {
  startDate: Date;
  endDate: Date;
  periodIdentifier: string; // Unique identifier for the period (e.g., "2025-11", "2025-11-12")
}

export interface CooperativeSettings {
  paymentFrequency: PaymentFrequency;
  billingDayOfMonth?: number; // For MONTHLY billing (1-31)
  billingDayOfYear?: Date; // For YEARLY billing
}

@Injectable()
export class PaymentPeriodService {
  private readonly logger = new Logger(PaymentPeriodService.name);

  /**
   * Get the current billing period for a cooperative based on its payment frequency
   */
  getCurrentBillingPeriod(
    cooperativeSettings: CooperativeSettings,
    referenceDate: Date = new Date(),
  ): BillingPeriod {
    switch (cooperativeSettings.paymentFrequency) {
      case PaymentFrequency.DAILY:
        return this.getDailyPeriod(referenceDate);
      case PaymentFrequency.MONTHLY:
        return this.getMonthlyPeriod(
          referenceDate,
          cooperativeSettings.billingDayOfMonth,
        );
      case PaymentFrequency.YEARLY:
        return this.getYearlyPeriod(
          referenceDate,
          cooperativeSettings.billingDayOfYear,
        );
      default:
        throw new Error(
          `Unsupported payment frequency: ${cooperativeSettings.paymentFrequency}`,
        );
    }
  }

  /**
   * Check if a payment date falls within a specific billing period
   */
  isPaymentInPeriod(paymentDate: Date, billingPeriod: BillingPeriod): boolean {
    return (
      paymentDate >= billingPeriod.startDate &&
      paymentDate <= billingPeriod.endDate
    );
  }

  /**
   * Get the next billing period after the current one
   */
  getNextBillingPeriod(
    cooperativeSettings: CooperativeSettings,
    currentPeriod: BillingPeriod,
  ): BillingPeriod {
    const nextPeriodStart = new Date(currentPeriod.endDate);
    nextPeriodStart.setDate(nextPeriodStart.getDate() + 1);

    return this.getCurrentBillingPeriod(cooperativeSettings, nextPeriodStart);
  }

  /**
   * Get daily billing period (24-hour period starting from 00:00:00)
   */
  private getDailyPeriod(referenceDate: Date): BillingPeriod {
    const startDate = new Date(referenceDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setHours(23, 59, 59, 999);

    const periodIdentifier = startDate.toISOString().split('T')[0]; // YYYY-MM-DD

    return {
      startDate,
      endDate,
      periodIdentifier,
    };
  }

  /**
   * Get monthly billing period based on billing day
   */
  private getMonthlyPeriod(
    referenceDate: Date,
    billingDayOfMonth?: number,
  ): BillingPeriod {
    const currentDate = new Date(referenceDate);
    const targetDay = billingDayOfMonth || 1; // Default to 1st of month

    // Calculate the billing cycle start date
    let startDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      targetDay,
    );

    // If we're before the billing day this month, the period started last month
    if (currentDate.getDate() < targetDay) {
      startDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - 1,
        targetDay,
      );
    }

    // Calculate end date (day before next billing cycle)
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(endDate.getDate() - 1);
    endDate.setHours(23, 59, 59, 999);

    const periodIdentifier = `${startDate.getFullYear()}-${String(
      startDate.getMonth() + 1,
    ).padStart(2, '0')}`;

    return {
      startDate,
      endDate,
      periodIdentifier,
    };
  }

  /**
   * Get yearly billing period based on billing date
   */
  private getYearlyPeriod(
    referenceDate: Date,
    billingDayOfYear?: Date,
  ): BillingPeriod {
    const currentDate = new Date(referenceDate);
    const currentYear = currentDate.getFullYear();

    // Default to January 1st if no specific date provided
    let startDate: Date;
    if (billingDayOfYear) {
      startDate = new Date(
        currentYear,
        billingDayOfYear.getMonth(),
        billingDayOfYear.getDate(),
      );
    } else {
      startDate = new Date(currentYear, 0, 1); // January 1st
    }

    // If we're before the billing date this year, the period started last year
    if (currentDate < startDate) {
      if (billingDayOfYear) {
        startDate = new Date(
          currentYear - 1,
          billingDayOfYear.getMonth(),
          billingDayOfYear.getDate(),
        );
      } else {
        startDate = new Date(currentYear - 1, 0, 1);
      }
    }

    // Calculate end date (day before next billing cycle)
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);
    endDate.setDate(endDate.getDate() - 1);
    endDate.setHours(23, 59, 59, 999);

    const periodIdentifier = startDate.getFullYear().toString();

    return {
      startDate,
      endDate,
      periodIdentifier,
    };
  }

  /**
   * Get a human-readable description of the billing period
   */
  describeBillingPeriod(period: BillingPeriod): string {
    const start = period.startDate.toLocaleDateString('en-RW');
    const end = period.endDate.toLocaleDateString('en-RW');
    return `${start} to ${end}`;
  }

  /**
   * Check if two billing periods are the same
   */
  isSamePeriod(period1: BillingPeriod, period2: BillingPeriod): boolean {
    return period1.periodIdentifier === period2.periodIdentifier;
  }
}
