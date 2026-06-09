export type TransactionType = 'income' | 'expense' | 'credit_card' | 'stack';

export interface Transaction {
  id: string;
  type: TransactionType;
  isFixed: boolean; // 고정비 템플릿에 의해 자동 생성된 거래인지 여부
  fixedSettingId?: string; // 고정비 설정 ID (연결용)
  amount: number;
  category: string;
  storeName?: string; // 매장명/사용처
  date: string; // ISO YYYY-MM-DD 형식
  memo?: string;
  goalId?: string; // type이 'stack'인 경우 연결될 스택 타워 ID
}

export interface StackTower {
  id: string;
  title: string;
  targetAmount: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (목표 기한)
  isCompleted: boolean;
}

export interface FixedSetting {
  id: string;
  type: 'income' | 'expense';
  title: string;
  amount: number;
  category: string;
  day: number; // 매달 생성될 일자 (1 ~ 31)
  storeName?: string;
  isActive: boolean;
}

export interface MentorFeedback {
  id: string;
  type: 'warning' | 'danger' | 'success' | 'info';
  title: string;
  message: string;
  suggestion: string;
}

export interface MonthlySimulation {
  thisMonthIncome: number;
  thisMonthFixedExpense: number;
  thisMonthVariableExpense: number;
  thisMonthStack: number;
  thisMonthRemaining: number; // 이번달 남은 가용 잔액
  
  nextMonthExpectedIncome: number;
  nextMonthFixedExpense: number;
  nextMonthCreditCardBill: number; // 이번달에 긁은 신용카드 대금 (다음 달 청구)
  nextMonthExpectedStack: number; // 다음 달 목표 스택액
  nextMonthExpectedRemaining: number; // 다음 달 예상 잔액 (가용 한도 억제선)
}

export interface BankProduct {
  id: string;
  type: 'deposit' | 'savings'; // 예금 | 적금
  bankName: string;            // 은행명
  title: string;               // 상품명
  amount: number;              // 현재 잔액
  interestRate: number;        // 이율 (%)
  maturityDate: string;        // 만기일 (YYYY-MM-DD)
  monthlyPayment?: number;     // 적금 시 월 납입액
}

export interface Schedule {
  id: string;
  title: string;
  date: string;                // YYYY-MM-DD
  expectedAmount: number;      // 예상 지출액
  actualAmount?: number;       // 실제 지출액 (정산 시 기입)
  isSettled: boolean;          // 정산 완료 여부
  payType: 'solo' | 'dutch_pay'; // 1인 지불 | 더치페이(N분의 1)
}
