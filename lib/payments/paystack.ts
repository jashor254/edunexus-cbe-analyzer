import crypto from 'crypto';

export interface InitializePaymentParams {
  email: string;
  amount: number;
  reference: string;
  currency?: string;
  callback_url: string;
  metadata?: Record<string, any>;
  phone?: string;
}

export interface InitializePaymentResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export class PaystackClient {
  private secretKey: string;
  private baseUrl = 'https://api.paystack.co';

  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY!;
  }

  generateReference(): string {
    return `EDU-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  toKobo(amount: number): number {
    return amount * 100;
  }

  /**
   * Verify Paystack webhook signature
   * This is CRITICAL for security!
   */
  verifyWebhookSignature(signature: string, body: string): boolean {
    try {
      // Create HMAC SHA512 hash using your secret key
      const hash = crypto
        .createHmac('sha512', this.secretKey)
        .update(body)
        .digest('hex');
      
      // Compare the hash with Paystack's signature
      return hash === signature;
    } catch (error) {
      console.error('Webhook signature verification error:', error);
      return false;
    }
  }

  async initializePayment(params: InitializePaymentParams): Promise<InitializePaymentResponse> {
    const response = await fetch(`${this.baseUrl}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Paystack initialization failed');
    }

    return response.json();
  }

  async verifyPayment(reference: string) {
    const response = await fetch(`${this.baseUrl}/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
      },
    });

    if (!response.ok) {
      throw new Error('Payment verification failed');
    }

    return response.json();
  }

  /**
   * List banks (for transfers)
   */
  async listBanks() {
    const response = await fetch(`${this.baseUrl}/bank`, {
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch banks');
    }

    return response.json();
  }

  /**
   * Create transfer recipient
   */
  async createTransferRecipient(params: {
    type: 'nuban' | 'mobile_money' | 'basa';
    name: string;
    account_number: string;
    bank_code: string;
    currency?: string;
  }) {
    const response = await fetch(`${this.baseUrl}/transferrecipient`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error('Failed to create transfer recipient');
    }

    return response.json();
  }

  /**
   * Initiate transfer
   */
  async initiateTransfer(params: {
    source: 'balance';
    amount: number;
    recipient: string;
    reason?: string;
    reference?: string;
  }) {
    const response = await fetch(`${this.baseUrl}/transfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error('Failed to initiate transfer');
    }

    return response.json();
  }
}

// Singleton instance
export const paystackClient = new PaystackClient();