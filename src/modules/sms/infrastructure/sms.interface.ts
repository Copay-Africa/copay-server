export interface SmsProvider {
  sendSms(to: string, message: string, messageRef?: string): Promise<SmsResult>;
}

export interface SmsResult {
  success: boolean;
  message: string;
  messageId?: string;
  gatewayRef?: string;
  cost?: number;
  error?: string;
}

// FDI Authentication interfaces
export interface FdiAuthRequest {
  api_username: string;
  api_password: string;
}

export interface FdiAuthResponse {
  success: boolean;
  expires_at: string;
  access_token: string;
  refresh_token: string;
}

// FDI SMS sending interfaces
export interface FdiSmsRequest {
  msisdn: string;
  message: string;
  dlr?: string;
  sender_id?: string;
  msgRef: string;
}

export interface FdiSmsResponse {
  success: boolean;
  message: string;
  cost: number;
  msgRef: string;
  gatewayRef: string;
}
