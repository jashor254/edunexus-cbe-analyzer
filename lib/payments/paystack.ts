// lib/payments/paystack.ts
import crypto from 'crypto';

interface PaystackConfig {
  publicKey: string;
  secretKey: string;
  baseUrl: string;
}

interface InitializePaymentParams {
  email: string;
  amount: number;
  reference: string;
  callback_url: string;
  metadata?: {
    user_id: string;
    plan_type: string;
    payment_id: string;
    [key: string]: any;
  };
  channels?: string[];
}

interface InitializePaymentResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

interface VerifyPaymentResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    domain: string;
    status: string;
    reference: string;
    amount: number;
    message: string | null;
    gateway_response: string;
    paid_at: string;
    created_at: string;
    channel: string;
    currency: string;
    ip_address: string;
    metadata: any;
    fees: number;
    customer: {
      id: number;
      email: string;
      customer_code: string;
    };
  };
}

class PaystackClient {
  private config: PaystackConfig;

  constructor() {
    this.config = {
      publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
      secretKey: process.env.PAYSTACK_SECRET_KEY || '',
      baseUrl: 'https://api.paystack.co',
    };

    if (!this.config.secretKey) {
      console.warn('Paystack secret key not configured');
    }
  }

  generateReference(): string {
    return `TXN_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  }

  async initializePayment(
    params: InitializePaymentParams
  ): Promise<InitializePaymentResponse> {
    try {
      const response = await fetch(`${this.config.baseUrl}/transaction/initialize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (!response.ok || !data.status) {
        throw new Error(data.message || 'Payment initialization failed');
      }

      return data;
    } catch (error: any) {
      console.error('Paystack initialization error:', error);
      throw error;
    }
  }

  async verifyPayment(reference: string): Promise<VerifyPaymentResponse> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/transaction/verify/${reference}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.config.secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Payment verification failed');
      }

      return data;
    } catch (error: any) {
      console.error('Paystack verification error:', error);
      throw error;
    }
  }

  verifyWebhookSignature(signature: string, body: string): boolean {
    try {
      const hash = crypto
        .createHmac('sha512', this.config.secretKey)
        .update(body)
        .digest('hex');

      return hash === signature;
    } catch (error) {
      console.error('Webhook signature verification error:', error);
      return false;
    }
  }

  toKobo(amount: number): number {
    return Math.round(amount * 100);
  }

  fromKobo(kobo: number): number {
    return kobo / 100;
  }

  getPublicKey(): string {
    return this.config.publicKey;
  }

  formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
    
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }
    
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    }
    
    if (!cleaned.startsWith('254')) {
      cleaned = '254' + cleaned;
    }
    
    return cleaned;
  }
}

export const paystackClient = new PaystackClient();

export type {
  InitializePaymentParams,
  InitializePaymentResponse,
  VerifyPaymentResponse,
};