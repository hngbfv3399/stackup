import { useState, useMemo } from 'react';
import { useStackStore } from '@/store/useStackStore';
import { Schedule } from '@/types';

export function useCalendarLogic() {
  const {
    transactions,
    schedules,
    addSchedule,
    deleteSchedule,
    settleSchedule,
  } = useStackStore();

  // 오늘 날짜 기본 세팅 (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // 모달 상태
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [activeSchedule, setActiveSchedule] = useState<Schedule | null>(null);

  // 일정 입력 폼 상태
  const [newTitle, setNewTitle] = useState('');
  const [newExpectedAmount, setNewExpectedAmount] = useState('');
  const [newPayType, setNewPayType] = useState<'solo' | 'dutch_pay'>('solo');

  // 정산 입력 폼 상태
  const [settleActualAmount, setSettleActualAmount] = useState('');

  // 1. 날짜별 금액 합산 메타데이터 생성 (markedDates 전달용)
  const calendarDataMap = useMemo(() => {
    const map: Record<string, { income: number; expense: number; expected: number; saving: number }> = {};

    // 실제 가계부 거래 합산
    transactions.forEach((tx) => {
      const date = tx.date;
      if (!map[date]) {
        map[date] = { income: 0, expense: 0, expected: 0, saving: 0 };
      }
      if (tx.type === 'income') {
        map[date].income += tx.amount;
      } else if (tx.type === 'expense' || tx.type === 'credit_card') {
        map[date].expense += tx.amount;
      } else if (tx.type === 'saving') {
        map[date].saving += tx.amount;
      }
    });

    // 예정 일정 예상 소비액 합산
    schedules.forEach((sched) => {
      if (sched.isSettled) return; // 이미 정산된 일정은 제외
      const date = sched.date;
      if (!map[date]) {
        map[date] = { income: 0, expense: 0, expected: 0, saving: 0 };
      }
      map[date].expected += sched.expectedAmount;
    });

    return map;
  }, [transactions, schedules]);

  // 2. 선택된 연월(YYYY-MM)에 속한 실적 요약 계산
  const monthlySummary = useMemo(() => {
    const yearMonth = selectedDate.substring(0, 7);
    let totalIncome = 0;
    let totalExpense = 0;
    let totalSaving = 0;

    transactions.forEach((tx) => {
      if (tx.date.startsWith(yearMonth)) {
        if (tx.type === 'income') {
          totalIncome += tx.amount;
        } else if (tx.type === 'expense' || tx.type === 'credit_card') {
          totalExpense += tx.amount;
        } else if (tx.type === 'saving') {
          totalSaving += tx.amount;
        }
      }
    });

    return {
      totalIncome,
      totalExpense,
      totalSaving,
    };
  }, [transactions, selectedDate]);

  // 3. 선택된 날짜의 실제 거래 내역 필터링
  const selectedDayTransactions = useMemo(() => {
    return transactions.filter((tx) => tx.date === selectedDate);
  }, [transactions, selectedDate]);

  // 4. 선택된 날짜의 예정 일정 필터링
  const selectedDaySchedules = useMemo(() => {
    return schedules.filter((s) => s.date === selectedDate);
  }, [schedules, selectedDate]);

  // 4. 새 일정 등록 핸들러
  const handleAddScheduleSubmit = () => {
    const amountNum = parseInt(newExpectedAmount.replace(/,/g, ''), 10);
    if (!newTitle.trim()) {
      return { success: false, message: '일정 약속 이름을 입력해주세요.' };
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      return { success: false, message: '예상 소비 금액을 올바르게 입력해주세요.' };
    }

    addSchedule({
      title: newTitle.trim(),
      date: selectedDate,
      expectedAmount: amountNum,
      payType: newPayType,
    });

    // 폼 초기화 및 닫기
    setNewTitle('');
    setNewExpectedAmount('');
    setNewPayType('solo');
    setIsAddModalOpen(false);
    return { success: true };
  };

  // 5. 정산 등록 핸들러
  const handleSettleSubmit = () => {
    if (!activeSchedule) return { success: false, message: '정산 대상 일정을 찾을 수 없습니다.' };
    const amountNum = parseInt(settleActualAmount.replace(/,/g, ''), 10);
    if (isNaN(amountNum) || amountNum < 0) {
      return { success: false, message: '실제 소비 금액을 올바르게 입력해주세요.' };
    }

    settleSchedule(activeSchedule.id, amountNum);
    
    // 초기화
    setSettleActualAmount('');
    setActiveSchedule(null);
    setIsSettleModalOpen(false);
    return { success: true };
  };

  const handleOpenSettle = (sched: Schedule) => {
    setActiveSchedule(sched);
    setSettleActualAmount(String(sched.expectedAmount)); // 초기값은 예상금액으로 채워줌
    setIsSettleModalOpen(true);
  };

  return {
    // 상태 및 계산된 데이터
    selectedDate,
    setSelectedDate,
    calendarDataMap,
    selectedDayTransactions,
    selectedDaySchedules,
    todayStr,
    monthlySummary,

    // 일정 추가 관련
    isAddModalOpen,
    setIsAddModalOpen,
    newTitle,
    setNewTitle,
    newExpectedAmount,
    setNewExpectedAmount,
    newPayType,
    setNewPayType,
    handleAddScheduleSubmit,
    handleDeleteSchedule: deleteSchedule,

    // 정산 관련
    isSettleModalOpen,
    setIsSettleModalOpen,
    activeSchedule,
    settleActualAmount,
    setSettleActualAmount,
    handleOpenSettle,
    handleSettleSubmit,
  };
}
