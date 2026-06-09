import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from './mmkvStorage';
import { Transaction, StackTower, FixedSetting, MentorFeedback, MonthlySimulation, BankProduct, Schedule } from '../types';

interface StackState {
  transactions: Transaction[];
  towers: StackTower[];
  fixedSettings: FixedSetting[];
  lastProcessedFixedDate: string | null; // YYYY-MM-DD 마지막 고정비 자동 생성 처리일
  totalAsset: number; // 전체 연동 자산 초기값 (수익/지출 계산의 베이스라인)
  schedules: Schedule[];
  bankProducts: BankProduct[];
  
  // Actions
  setTotalAsset: (amount: number) => void;
  
  // Transaction Actions
  addTransaction: (tx: Omit<Transaction, 'id' | 'isFixed'>) => void;
  deleteTransaction: (id: string) => void;
  updateTransaction: (id: string, tx: Partial<Transaction>) => void;
  
  // Stack Tower Actions
  addTower: (tower: Omit<StackTower, 'id' | 'isCompleted'>) => void;
  deleteTower: (id: string) => void;
  updateTower: (id: string, tower: Partial<StackTower>) => void;
  
  // Fixed Setting Actions
  addFixedSetting: (setting: Omit<FixedSetting, 'id'>) => void;
  deleteFixedSetting: (id: string) => void;
  updateFixedSetting: (id: string, setting: Partial<FixedSetting>) => void;

  // Bank Product Actions
  addBankProduct: (product: Omit<BankProduct, 'id' | 'status' | 'maturedDate' | 'finalReceivedAmount'>) => void;
  deleteBankProduct: (id: string) => void;
  updateBankProduct: (id: string, product: Partial<BankProduct>) => void;
  terminateBankProduct: (id: string, actualReceivedAmount: number) => void;

  // Schedule Actions
  addSchedule: (schedule: Omit<Schedule, 'id' | 'isSettled'>) => void;
  deleteSchedule: (id: string) => void;
  settleSchedule: (id: string, actualAmount: number) => void;

  // Mock Data Actions
  loadMockData: () => void;
  
  // Core Business Engine Actions
  processFixedSettings: (todayStr: string) => void;
  getMonthlySimulation: (yearMonth: string) => MonthlySimulation;
  getMentorFeedbacks: (yearMonth: string) => MentorFeedback[];
}

// Helper: YYYY-MM-DD 형식 검증 및 변환
const parseDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useStackStore = create<StackState>()(
  persist(
    (set, get) => ({
      transactions: [],
      towers: [],
      fixedSettings: [],
      lastProcessedFixedDate: null,
      totalAsset: 0,
      schedules: [],
      bankProducts: [],

      setTotalAsset: (amount) => set({ totalAsset: amount }),

      addBankProduct: (product) => {
        const newProd: BankProduct = {
          ...product,
          id: generateId(),
          status: 'active',
        };
        set((state) => ({
          bankProducts: [...state.bankProducts, newProd],
        }));
      },

      deleteBankProduct: (id) => set((state) => ({
        bankProducts: state.bankProducts.filter((p) => p.id !== id),
      })),

      updateBankProduct: (id, updated) => set((state) => ({
        bankProducts: state.bankProducts.map((p) =>
          p.id === id ? { ...p, ...updated } : p
        ),
      })),

      terminateBankProduct: (id, actualReceivedAmount) => {
        const state = get();
        const product = state.bankProducts.find((p) => p.id === id);
        if (!product || product.status !== 'active') return;

        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        const newTx: Transaction = {
          id: generateId(),
          type: 'income',
          isFixed: false,
          amount: actualReceivedAmount,
          category: '금융소득',
          storeName: `${product.bankName} ${product.title}`,
          date: dateStr,
          memo: `[예적금 중도해지] 원금 및 중도해지 이자 수령 (원금: ${product.amount.toLocaleString()}원)`,
        };

        set((state) => ({
          bankProducts: state.bankProducts.map((p) =>
            p.id === id
              ? {
                  ...p,
                  status: 'terminated',
                  maturedDate: dateStr,
                  finalReceivedAmount: actualReceivedAmount,
                }
              : p
          ),
          transactions: [newTx, ...state.transactions],
          totalAsset: state.totalAsset + actualReceivedAmount,
        }));
      },

      addSchedule: (schedule) => {
        const newSched: Schedule = {
          ...schedule,
          id: generateId(),
          isSettled: false,
        };
        set((state) => ({
          schedules: [...state.schedules, newSched],
        }));
      },

      deleteSchedule: (id) => set((state) => ({
        schedules: state.schedules.filter((s) => s.id !== id),
      })),

      settleSchedule: (id, actualAmount) => {
        const state = get();
        const schedule = state.schedules.find((s) => s.id === id);
        if (!schedule) return;

        // 실제 가계부 거래 내역(Transaction)으로 자동 기입
        const newTx: Transaction = {
          id: generateId(),
          type: 'expense',
          isFixed: false,
          amount: actualAmount,
          category: '기타',
          storeName: schedule.title,
          date: schedule.date,
          memo: `[일정 정산 - ${schedule.payType === 'dutch_pay' ? '더치페이' : '혼자 지출'}]`,
        };

        set((state) => ({
          schedules: state.schedules.map((s) =>
            s.id === id ? { ...s, isSettled: true, actualAmount } : s
          ),
          transactions: [newTx, ...state.transactions],
        }));
      },

      loadMockData: () => {
        const today = new Date();
        const formatDateOffset = (offsetDays: number): string => {
          const d = new Date(today);
          d.setDate(d.getDate() + offsetDays);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const dateNum = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${dateNum}`;
        };

        // N달 전 특정 일자 계산
        const dateMonthAgo = (months: number, dayNum: number): string => {
          const d = new Date(today.getFullYear(), today.getMonth() - months, dayNum);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const dateStr = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${dateStr}`;
        };

        // 이번 주 월요일~일요일에 데이터 안전 배치를 위한 헬퍼
        const todayDay = today.getDay();
        const mondayOffset = -(todayDay === 0 ? 6 : todayDay - 1);
        const getThisOfWeekDate = (dayIndex: number): string => {
          // dayIndex: 0(월) ~ 6(일)
          return formatDateOffset(mondayOffset + dayIndex);
        };
        const currentDayIdx = todayDay === 0 ? 7 : todayDay; // 1(월)~7(일)

        // 과거 정산 세트 날짜 결정 (오늘이 월요일이면 지난주 일요일, 그 외는 이번 주 어제)
        const settledDateStr = currentDayIdx === 1 ? formatDateOffset(-1) : getThisOfWeekDate(currentDayIdx - 2);

        const towerId1 = 'tower-macbook';
        const towerId2 = 'tower-travel';

        const mockTowers: StackTower[] = [
          {
            id: towerId1,
            title: '맥북 프로 구매 타워 💻',
            targetAmount: 2500000,
            startDate: dateMonthAgo(1, 1),
            endDate: formatDateOffset(300), // 약 10개월 뒤
            isCompleted: false,
          },
          {
            id: towerId2,
            title: '겨울 온천 여행 타워 ♨️',
            targetAmount: 1200000,
            startDate: dateMonthAgo(0, 1),
            endDate: formatDateOffset(180), // 약 6개월 뒤
            isCompleted: false,
          },
        ];

        const mockFixed: FixedSetting[] = [
          {
            id: 'fixed-salary',
            type: 'income',
            title: '정기 급여',
            amount: 3000000,
            category: '급여',
            day: 25,
            isActive: true,
          },
          {
            id: 'fixed-rent',
            type: 'expense',
            title: '월세 납부',
            amount: 500000,
            category: '주거/통신',
            day: 10,
            isActive: true,
          },
          {
            id: 'fixed-netflix',
            type: 'expense',
            title: '넷플릭스 구독',
            amount: 170000, // 1.7만(원래 17,000이나 큰금액 테스트 유도)
            category: '문화생활',
            day: 5,
            isActive: true,
          },
        ];

        const mockTransactions: Transaction[] = [
          // [이번 주 수입 및 지출]
          {
            id: 'tx-week-income-1',
            type: 'income',
            isFixed: false,
            amount: 150000,
            category: '용돈',
            storeName: '부모님 송금',
            date: getThisOfWeekDate(0), // 이번 주 월요일 수입 기입
          },
          {
            id: 'tx-week-expense-1',
            type: 'expense',
            isFixed: false,
            amount: 32000,
            category: '식비',
            storeName: '청년다방',
            date: settledDateStr,
          },
          // 소비 일정 정산에 의해 실제 가계부로 이관 기입된 예시 데이터
          {
            id: 'tx-week-settled-1',
            type: 'expense',
            isFixed: false,
            amount: 25000,
            category: '기타',
            storeName: '동창회 모임 🍻',
            date: settledDateStr,
            memo: '[일정 정산 - 더치페이]',
          },
          {
            id: 'tx-week-expense-2',
            type: 'expense',
            isFixed: false,
            amount: 15000,
            category: '식비',
            storeName: '스타벅스 커피',
            date: formatDateOffset(0), // 오늘 지출
          },
          // 이번달
          {
            id: 'tx-1',
            type: 'income',
            isFixed: false,
            amount: 250000,
            category: '용돈',
            storeName: '부모님 용돈',
            date: dateMonthAgo(0, 2),
          },
          {
            id: 'tx-2',
            type: 'expense',
            isFixed: false,
            amount: 32000,
            category: '식비',
            storeName: '김밥천국',
            date: dateMonthAgo(0, 3),
          },
          {
            id: 'tx-3',
            type: 'credit_card',
            isFixed: false,
            amount: 150000,
            category: '쇼핑',
            storeName: '무신사',
            date: dateMonthAgo(0, 4),
          },
          {
            id: 'tx-4',
            type: 'stack',
            isFixed: false,
            amount: 100000,
            category: '스택타워 적립',
            goalId: towerId1,
            storeName: '맥북 타워 적립',
            date: dateMonthAgo(0, 5),
          },
          // 지난달 고정 수입 및 지출
          {
            id: 'tx-fixed-salary-1',
            type: 'income',
            isFixed: true,
            fixedSettingId: 'fixed-salary',
            amount: 3000000,
            category: '급여',
            storeName: '정기 급여 (고정)',
            date: dateMonthAgo(1, 25),
          },
          {
            id: 'tx-fixed-rent-1',
            type: 'expense',
            isFixed: true,
            fixedSettingId: 'fixed-rent',
            amount: 500000,
            category: '주거/통신',
            storeName: '월세 납부 (고정)',
            date: dateMonthAgo(1, 10),
          },
          {
            id: 'tx-fixed-netflix-1',
            type: 'expense',
            isFixed: true,
            fixedSettingId: 'fixed-netflix',
            amount: 170000,
            category: '문화생활',
            storeName: '넷플릭스 구독 (고정)',
            date: dateMonthAgo(1, 5),
          },
          // 지난달 일반 지출
          {
            id: 'tx-5',
            type: 'expense',
            isFixed: false,
            amount: 86000,
            category: '식비',
            storeName: '아웃백 스테이크',
            date: dateMonthAgo(1, 12),
          },
          {
            id: 'tx-6',
            type: 'expense',
            isFixed: false,
            amount: 45000,
            category: '교통비',
            storeName: 'KTX 오송역',
            date: dateMonthAgo(1, 15),
          },
          {
            id: 'tx-7',
            type: 'stack',
            isFixed: false,
            amount: 200000,
            category: '스택타워 적립',
            goalId: towerId1,
            storeName: '맥북 타워 적립',
            date: dateMonthAgo(1, 20),
          },
          {
            id: 'tx-8',
            type: 'stack',
            isFixed: false,
            amount: 100000,
            category: '스택타워 적립',
            goalId: towerId2,
            storeName: '온천 타워 적립',
            date: dateMonthAgo(1, 22),
          },
          // 지지난달 고정 수입/지출
          {
            id: 'tx-fixed-salary-2',
            type: 'income',
            isFixed: true,
            fixedSettingId: 'fixed-salary',
            amount: 3000000,
            category: '급여',
            storeName: '정기 급여 (고정)',
            date: dateMonthAgo(2, 25),
          },
          {
            id: 'tx-fixed-rent-2',
            type: 'expense',
            isFixed: true,
            fixedSettingId: 'fixed-rent',
            amount: 500000,
            category: '주거/통신',
            storeName: '월세 납부 (고정)',
            date: dateMonthAgo(2, 10),
          },
          {
            id: 'tx-9',
            type: 'expense',
            isFixed: false,
            amount: 120000,
            category: '쇼핑',
            storeName: '이마트 장보기',
            date: dateMonthAgo(2, 11),
          },
          {
            id: 'tx-10',
            type: 'stack',
            isFixed: false,
            amount: 100000,
            category: '스택타워 적립',
            goalId: towerId1,
            storeName: '맥북 타워 적립',
            date: dateMonthAgo(2, 20),
          },
        ];

        const mockBankProducts: BankProduct[] = [
          {
            id: 'bank-1',
            type: 'savings',
            bankName: '신한은행',
            title: '신한 청년 도약 적금 💰',
            amount: 2500000,
            interestRate: 5.5,
            maturityDate: formatDateOffset(365),
            monthlyPayment: 500000,
            paymentDay: 10,
            status: 'active',
          },
          {
            id: 'bank-2',
            type: 'deposit',
            bankName: '카카오뱅크',
            title: '카카오 정기 예금 🏦',
            amount: 10000000,
            interestRate: 3.5,
            maturityDate: formatDateOffset(180),
            status: 'active',
          },
        ];

        const mockSchedules: Schedule[] = [
          // 1. 이미 실제 가계부로 정산 완료된 소비 일정 예시
          {
            id: 'sched-settled-1',
            title: '동창회 모임 🍻',
            date: settledDateStr,
            expectedAmount: 30000,
            actualAmount: 25000,
            isSettled: true,
            payType: 'dutch_pay',
          },
          // 2. 오늘 정산 대기 중인 예정 일정 예시
          {
            id: 'sched-1',
            title: '카페 커피 약속 ☕',
            date: formatDateOffset(0), // 오늘
            expectedAmount: 12000,
            isSettled: false,
            payType: 'solo',
          },
          // 3. 내일 정산 대기 중인 예정 일정 예시
          {
            id: 'sched-2',
            title: '주말 영화 관람 🎬',
            date: formatDateOffset(1), // 내일
            expectedAmount: 30000,
            isSettled: false,
            payType: 'dutch_pay',
          },
          // 4. 3일 뒤 예정 일정
          {
            id: 'sched-3',
            title: '친구와 뮤지컬 관람 🎭',
            date: formatDateOffset(3), // 3일 뒤
            expectedAmount: 120000,
            isSettled: false,
            payType: 'dutch_pay',
          },
        ];

        set({
          towers: mockTowers,
          fixedSettings: mockFixed,
          transactions: mockTransactions,
          bankProducts: mockBankProducts,
          schedules: mockSchedules,
          totalAsset: 12500000,
          lastProcessedFixedDate: formatDateOffset(0),
        });
      },

      addTransaction: (tx) => {
        const newTx: Transaction = {
          ...tx,
          id: generateId(),
          isFixed: false,
        };
        
        // 만약 스택 타입이면, 연결된 타워의 누적 금액을 실시간 계산하기 위해 towers 상태는 갱신하지 않고 
        // 트랜잭션 추가를 통해 나중에 누적 합산하도록 설계 (데이터 일관성 보장)
        set((state) => ({
          transactions: [newTx, ...state.transactions],
        }));
      },

      deleteTransaction: (id) => set((state) => ({
        transactions: state.transactions.filter((tx) => tx.id !== id),
      })),

      updateTransaction: (id, updatedTx) => set((state) => ({
        transactions: state.transactions.map((tx) =>
          tx.id === id ? { ...tx, ...updatedTx } : tx
        ),
      })),

      addTower: (tower) => {
        const newTower: StackTower = {
          ...tower,
          id: generateId(),
          isCompleted: false,
        };
        set((state) => ({
          towers: [...state.towers, newTower],
        }));
      },

      deleteTower: (id) => set((state) => ({
        towers: state.towers.filter((t) => t.id !== id),
        // 연관된 스택 트랜잭션들도 정리
        transactions: state.transactions.filter((tx) => !(tx.type === 'stack' && tx.goalId === id)),
      })),

      updateTower: (id, updatedTower) => set((state) => ({
        towers: state.towers.map((t) =>
          t.id === id ? { ...t, ...updatedTower } : t
        ),
      })),

      addFixedSetting: (setting) => {
        const newSetting: FixedSetting = {
          ...setting,
          id: generateId(),
        };
        set((state) => ({
          fixedSettings: [...state.fixedSettings, newSetting],
        }));
      },

      deleteFixedSetting: (id) => set((state) => ({
        fixedSettings: state.fixedSettings.filter((s) => s.id !== id),
      })),

      updateFixedSetting: (id, updatedSetting) => set((state) => ({
        fixedSettings: state.fixedSettings.map((s) =>
          s.id === id ? { ...s, ...updatedSetting } : s
        ),
      })),

      // ──────────────────────────────────────────
      // 고정비 자동 생성 엔진 (A안 구현)
      // ──────────────────────────────────────────
      processFixedSettings: (todayStr) => {
        const { fixedSettings, bankProducts, lastProcessedFixedDate, transactions } = get();
        
        // 고정비 템플릿과 예적금 중 활성화된 항목 필터링
        const activeSettings = fixedSettings.filter((s) => s.isActive);
        const activeBankProducts = bankProducts.filter((p) => p.status === 'active');
        
        if (activeSettings.length === 0 && activeBankProducts.length === 0) {
          set({ lastProcessedFixedDate: todayStr });
          return;
        }

        if (!lastProcessedFixedDate) {
          // 최초 실행 시 오늘을 기점으로 설정하고 실행은 생략
          set({ lastProcessedFixedDate: todayStr });
          return;
        }

        const startDate = parseDate(lastProcessedFixedDate);
        const endDate = parseDate(todayStr);

        if (startDate.getTime() >= endDate.getTime()) {
          return; // 이미 오늘 혹은 미래 시점까지 처리 완료
        }

        const newTransactions: Transaction[] = [];
        let tempBankProducts = [...bankProducts];
        let tempTotalAsset = get().totalAsset;
        
        // 시작일 다음 날부터 오늘까지 하루씩 전진하며 체크
        const currentCheck = new Date(startDate);
        
        while (currentCheck.getTime() < endDate.getTime()) {
          currentCheck.setDate(currentCheck.getDate() + 1);
          const currentYear = currentCheck.getFullYear();
          const currentMonth = currentCheck.getMonth();
          const currentDateNum = currentCheck.getDate();
          const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
          const dateStr = formatDate(currentCheck);

          // 1. 고정 수입/지출 처리
          for (const setting of activeSettings) {
            let isTriggered = false;
            
            // 날짜 판별 조건:
            // 1. 해당 일자와 고정비 지정일이 정확히 일치할 때
            // 2. 지정일이 31일인데 해당 월이 30일(혹은 28/29일)이어서 마지막 날인 경우
            if (setting.day === currentDateNum) {
              isTriggered = true;
            } else if (setting.day > daysInMonth && currentDateNum === daysInMonth) {
              isTriggered = true;
            }

            if (isTriggered) {
              const isDuplicated = transactions.some(
                (tx) => tx.fixedSettingId === setting.id && tx.date === dateStr
              );

              if (!isDuplicated) {
                newTransactions.push({
                  id: generateId(),
                  type: setting.type,
                  isFixed: true,
                  fixedSettingId: setting.id,
                  amount: setting.amount,
                  category: setting.category,
                  storeName: setting.storeName || `${setting.title} (고정)`,
                  date: dateStr,
                  memo: `[고정비 자동이체] ${setting.title}`,
                });
              }
            }
          }

          // 2. 적금 자동 납입 처리 (매달 납입일 체크)
          tempBankProducts = tempBankProducts.map((product) => {
            if (product.type === 'savings' && product.status === 'active' && product.paymentDay) {
              let isSavingsTriggered = false;
              if (product.paymentDay === currentDateNum) {
                isSavingsTriggered = true;
              } else if (product.paymentDay > daysInMonth && currentDateNum === daysInMonth) {
                isSavingsTriggered = true;
              }

              if (isSavingsTriggered && product.monthlyPayment) {
                const uniqueKey = `savings-pay-${product.id}-${dateStr}`;
                const isDuplicated = transactions.some((tx) => tx.fixedSettingId === uniqueKey) || 
                                     newTransactions.some((tx) => tx.fixedSettingId === uniqueKey);

                if (!isDuplicated) {
                  newTransactions.push({
                    id: generateId(),
                    type: 'saving', // 저축 분리!
                    isFixed: true,
                    fixedSettingId: uniqueKey,
                    amount: product.monthlyPayment,
                    category: '저축',
                    storeName: product.title,
                    date: dateStr,
                    memo: `[적금 자동 납입] ${product.bankName}`,
                  });
                  return { ...product, amount: product.amount + product.monthlyPayment };
                }
              }
            }
            return product;
          });

          // 3. 예적금 자동 만기 처리
          tempBankProducts = tempBankProducts.map((product) => {
            if (product.status === 'active' && product.maturityDate === dateStr) {
              const uniqueKey = `bank-mat-${product.id}`;
              const isDuplicated = transactions.some((tx) => tx.fixedSettingId === uniqueKey) ||
                                   newTransactions.some((tx) => tx.fixedSettingId === uniqueKey);

              if (!isDuplicated) {
                let interest = 0;
                if (product.type === 'deposit') {
                  interest = Math.round(product.amount * (product.interestRate / 100));
                } else if (product.type === 'savings') {
                  interest = Math.round(product.amount * (product.interestRate / 100) * 0.5);
                }
                const finalAmount = product.amount + interest;

                newTransactions.push({
                  id: generateId(),
                  type: 'income', // 만기 환급은 소득으로 소득 전환!
                  isFixed: true,
                  fixedSettingId: uniqueKey,
                  amount: finalAmount,
                  category: '금융소득',
                  storeName: product.title,
                  date: dateStr,
                  memo: `[예적금 만기 수령] 원금: ${product.amount.toLocaleString()}원, 이자: ${interest.toLocaleString()}원`,
                });

                tempTotalAsset += finalAmount;

                return {
                  ...product,
                  status: 'matured',
                  maturedDate: dateStr,
                  finalReceivedAmount: finalAmount,
                };
              }
            }
            return product;
          });
        }

        // 상태 일괄 업데이트
        const nextState: Partial<StackState> = {
          lastProcessedFixedDate: todayStr,
          bankProducts: tempBankProducts,
          totalAsset: tempTotalAsset,
        };

        if (newTransactions.length > 0) {
          nextState.transactions = [...newTransactions, ...transactions];
        }

        set(nextState as any);
      },

      // ──────────────────────────────────────────
      // 이번달 및 다음달 예상 잔액 시뮬레이터
      // ──────────────────────────────────────────
      getMonthlySimulation: (yearMonth) => {
        const { transactions, fixedSettings } = get();
        
        // 1. 이번 달 계산
        const thisMonthTxs = transactions.filter((tx) => tx.date.startsWith(yearMonth));
        
        let thisMonthIncome = 0;
        let thisMonthFixedExpense = 0;
        let thisMonthVariableExpense = 0;
        let thisMonthStack = 0;
        let thisMonthCreditCard = 0;

        thisMonthTxs.forEach((tx) => {
          if (tx.type === 'income') {
            thisMonthIncome += tx.amount;
          } else if (tx.type === 'expense') {
            if (tx.isFixed) {
              thisMonthFixedExpense += tx.amount;
            } else {
              thisMonthVariableExpense += tx.amount;
            }
          } else if (tx.type === 'stack') {
            thisMonthStack += tx.amount;
          } else if (tx.type === 'credit_card') {
            thisMonthCreditCard += tx.amount; // 이번달 카드 승인 금액
          }
        });

        // 이번달 가용 잔액 = 이번달 수입 - 이번달 지출(고정+변동) - 이번달 스택
        const thisMonthRemaining = thisMonthIncome - (thisMonthFixedExpense + thisMonthVariableExpense) - thisMonthStack;

        // 2. 다음 달 계산을 위한 타겟 연월 산정

        // 다음 달 예상 고정 수입 및 고정 지출
        let nextMonthExpectedIncome = 0;
        let nextMonthFixedExpense = 0;

        fixedSettings.forEach((s) => {
          if (s.isActive) {
            if (s.type === 'income') {
              nextMonthExpectedIncome += s.amount;
            } else {
              nextMonthFixedExpense += s.amount;
            }
          }
        });

        // 다음 달 신용카드 청구서 = 이번 달 신용카드 지출 총액
        const nextMonthCreditCardBill = thisMonthCreditCard;

        // 다음 달 예상 스택액 계산 (현재 활성화된 타워들의 이번 달 최소 스택액 기반 예측)
        let nextMonthExpectedStack = 0;
        const now = parseDate(`${yearMonth}-01`);
        
        get().towers.forEach((t) => {
          if (!t.isCompleted) {
            const end = parseDate(t.endDate);
            // 남은 개월 수 계산
            const diffMonths = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
            const remainingToCollect = t.targetAmount - get().transactions
              .filter(tx => tx.type === 'stack' && tx.goalId === t.id)
              .reduce((sum, tx) => sum + tx.amount, 0);
            
            if (remainingToCollect > 0) {
              if (diffMonths <= 0) {
                // 기한이 이번 달 내이거나 지난 경우 잔액 전부
                nextMonthExpectedStack += remainingToCollect;
              } else {
                nextMonthExpectedStack += Math.ceil(remainingToCollect / diffMonths);
              }
            }
          }
        });

        // 다음 달 예상 잔액 = 다음 달 예상 수입 - 다음 달 고정 지출 - 이번 달 신용카드 지출 총액 - 다음 달 예상 스택액
        const nextMonthExpectedRemaining = nextMonthExpectedIncome - nextMonthFixedExpense - nextMonthCreditCardBill - nextMonthExpectedStack;

        return {
          thisMonthIncome,
          thisMonthFixedExpense,
          thisMonthVariableExpense,
          thisMonthStack,
          thisMonthRemaining,
          nextMonthExpectedIncome,
          nextMonthFixedExpense,
          nextMonthCreditCardBill,
          nextMonthExpectedStack,
          nextMonthExpectedRemaining,
        };
      },

      // ──────────────────────────────────────────
      // 로컬 훈수 엔진 (멘토링 룰)
      // ──────────────────────────────────────────
      getMentorFeedbacks: (yearMonth) => {
        const { getMonthlySimulation, transactions, towers } = get();
        const sim = getMonthlySimulation(yearMonth);
        const feedbacks: MentorFeedback[] = [];

        // 룰 1: 이번 달 잔액 마이너스 (위험)
        if (sim.thisMonthRemaining < 0) {
          feedbacks.push({
            id: 'rule-this-month-red',
            type: 'danger',
            title: '적자 비상 사태 🚨',
            message: `이번 달 가용 잔액이 ${Math.abs(sim.thisMonthRemaining).toLocaleString()}원 빵구났습니다.`,
            suggestion: '지금 당장 소비를 멈춰야 합니다! 다음 지출을 등록하기 전에 고정 구독 서비스나 불필요한 배달 음식을 취소하세요.',
          });
        }

        // 룰 2: 다음 달 예상 잔액 마이너스 (경고)
        if (sim.nextMonthExpectedRemaining < 0) {
          feedbacks.push({
            id: 'rule-next-month-warning',
            type: 'warning',
            title: '다음 달 미래 차압 경고 ⚠️',
            message: `다음 달 예상 잔액이 ${Math.abs(sim.nextMonthExpectedRemaining).toLocaleString()}원 마이너스입니다. 신용카드와 고정 지출이 다음 달의 나를 옥죄고 있습니다.`,
            suggestion: '이번 달 신용카드 사용액이 너무 큽니다. 체크카드로 당장 전환하고 다음 달의 소비 예정 건을 취소해 잔고를 메워두세요.',
          });
        }

        // 룰 3: 신용카드 과도한 사용 (경고)
        const totalCashExpense = sim.thisMonthFixedExpense + sim.thisMonthVariableExpense;
        const totalCardExpense = sim.nextMonthCreditCardBill;
        if (totalCardExpense > 0 && totalCardExpense > totalCashExpense) {
          feedbacks.push({
            id: 'rule-credit-card-abuse',
            type: 'warning',
            title: '신용카드 폭주 중 💳',
            message: `이번 달 체크/현금 지출(${totalCashExpense.toLocaleString()}원)보다 신용카드 지출(${totalCardExpense.toLocaleString()}원)이 훨씬 큽니다.`,
            suggestion: '이것은 미래의 소득을 훔쳐 쓰는 행위입니다. 신용카드를 눈에 보이지 않는 곳에 치우고, 가용한 실물 현금 범위 내에서만 소비하는 습관을 들이세요.',
          });
        }

        // 룰 4: 스택 타워(목표) 미달 (경고)
        let totalRequiredStackThisMonth = 0;
        const now = parseDate(`${yearMonth}-01`);
        
        towers.forEach((t) => {
          const end = parseDate(t.endDate);
          const diffMonths = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
          const stacked = transactions
            .filter(tx => tx.type === 'stack' && tx.goalId === t.id)
            .reduce((sum, tx) => sum + tx.amount, 0);
          const remain = t.targetAmount - stacked;
          
          if (remain > 0) {
            if (diffMonths <= 0) {
              totalRequiredStackThisMonth += remain;
            } else {
              totalRequiredStackThisMonth += Math.ceil(remain / diffMonths);
            }
          }
        });

        if (totalRequiredStackThisMonth > 0 && sim.thisMonthStack < totalRequiredStackThisMonth) {
          const lack = totalRequiredStackThisMonth - sim.thisMonthStack;
          feedbacks.push({
            id: 'rule-stack-lack',
            type: 'info',
            title: '스택 타워가 가라앉고 있습니다 🧱',
            message: `이번 달 필수 스택 목표(${totalRequiredStackThisMonth.toLocaleString()}원)보다 ${lack.toLocaleString()}원 부족하게 스택을 쌓았습니다.`,
            suggestion: '스택 타워 완공일이 점점 늦춰지고 있습니다. 1회성 변동 지출(커피, 배달 등)을 20%만 줄이고 그 금액을 즉시 스택 타워에 입금(스택)해 보세요.',
          });
        }

        // 룰 5: 카테고리 특정 과다 소비 (식비/쇼핑) (주의)
        const thisMonthTxs = transactions.filter((tx) => tx.date.startsWith(yearMonth));
        let foodExpense = 0;
        let shoppingExpense = 0;

        thisMonthTxs.forEach((tx) => {
          if (tx.type === 'expense' || tx.type === 'credit_card') {
            const cat = tx.category.trim();
            if (cat === '식비' || cat === '외식' || cat === '배달') {
              foodExpense += tx.amount;
            } else if (cat === '쇼핑' || cat === '패션') {
              shoppingExpense += tx.amount;
            }
          }
        });

        if (foodExpense > 400000) {
          feedbacks.push({
            id: 'rule-food-over',
            type: 'warning',
            title: '배달/식비 주의보 🍔',
            message: `이번 달 밥값으로만 ${foodExpense.toLocaleString()}원을 지출했습니다. 뱃살과 함께 가계부 적자도 함께 자라나는 중입니다.`,
            suggestion: '냉장고 털기(냉털)를 실천하고, 주 3회 배달 시키던 것을 주 1회로 줄이세요. 요리를 해 먹는 것만으로도 수십만 원의 스택 여력이 생깁니다.',
          });
        }

        if (shoppingExpense > 300000) {
          feedbacks.push({
            id: 'rule-shopping-over',
            type: 'warning',
            title: '지름신 강림 경고 🛍️',
            message: `의류/쇼핑에 이번 달 ${shoppingExpense.toLocaleString()}원을 썼습니다. 혹시 옷장에 입지 않는 옷들이 쌓여있지 않나요?`,
            suggestion: '물건을 사기 전에 "이게 정말 필요한 것인가(Needs)?" 아니면 "그냥 갖고 싶은 것인가(Wants)?"를 스스로 3번 물어보세요. 장바구니에 담아두고 3일 뒤에 다시 결제하는 습관을 들이세요.',
          });
        }

        // 룰 6: 스택 모범생 (성공/격려)
        if (sim.thisMonthStack >= totalRequiredStackThisMonth && totalRequiredStackThisMonth > 0 && sim.thisMonthRemaining >= 0) {
          feedbacks.push({
            id: 'rule-stack-success',
            type: 'success',
            title: '스택 마스터! 👍',
            message: '이번 달 필수 스택 목표를 초과 달성했으며, 잔고 역시 흑자를 유지하고 있습니다. 아주 훌륭한 소비 절제력을 보여주고 계십니다.',
            suggestion: '지금의 페이스를 유지하세요! 이 추세라면 목표했던 스택 타워를 완공 기한보다 더 일찍 완성할 수 있습니다.',
          });
        }

        // 만약 아무런 경고도 없는 완전 클린 상태
        if (feedbacks.length === 0) {
          feedbacks.push({
            id: 'rule-clean-state',
            type: 'info',
            title: '안정적인 시작 🧘',
            message: '이번 달 아직 눈에 띄는 과소비나 카드 무리가 포착되지 않았습니다. 차분하게 계획을 유지하세요.',
            suggestion: '고정 지출과 저금 목표 스택을 먼저 선저금(선스택)하고, 남은 돈으로 소비를 통제해 보세요.',
          });
        }

        return feedbacks;
      },
    }),
    {
      name: 'stackup-store',
      storage: createJSONStorage(() => mmkvStorage),
      // persist 시 계산 메서드나 헬퍼 등은 저장할 필요가 없으므로 state 상태값들만 저장되도록 자동 처리됨
      partialize: (state) => ({
        transactions: state.transactions,
        towers: state.towers,
        fixedSettings: state.fixedSettings,
        lastProcessedFixedDate: state.lastProcessedFixedDate,
        totalAsset: state.totalAsset,
        schedules: state.schedules,
        bankProducts: state.bankProducts,
      }),
    }
  )
);
