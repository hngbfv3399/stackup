import { useState, useMemo } from 'react';
import { useStackStore } from '@/store/useStackStore';

export function useHomeLogic() {
  const {
    transactions,
    towers,
    schedules,
    bankProducts,
    addBankProduct,
    deleteBankProduct,
    loadMockData,
  } = useStackStore();

  // 예적금 추가 모달 상태
  const [isAddBankOpen, setIsAddBankOpen] = useState(false);
  
  // 예적금 폼 상태
  const [bankType, setBankType] = useState<'deposit' | 'savings'>('savings');
  const [bankName, setBankName] = useState('');
  const [bankTitle, setBankTitle] = useState('');
  const [bankAmount, setBankAmount] = useState('');
  const [bankRate, setBankRate] = useState('');
  const [bankMaturity, setBankMaturity] = useState('');
  const [bankMonthlyPayment, setBankMonthlyPayment] = useState('');

  // 1. 이번 주 수입/지출 실적 요약 계산
  const weeklySummary = useMemo(() => {
    const today = new Date();
    // 이번 주 월요일 구하기
    const day = today.getDay();
    const diffToMonday = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diffToMonday));
    monday.setHours(0, 0, 0, 0);

    // 이번 주 일요일 구하기
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    let weeklyIncome = 0;
    let weeklyExpense = 0;

    transactions.forEach((tx) => {
      const txDate = new Date(tx.date);
      if (txDate >= monday && txDate <= sunday) {
        if (tx.type === 'income') {
          weeklyIncome += tx.amount;
        } else if (tx.type === 'expense' || tx.type === 'credit_card') {
          weeklyExpense += tx.amount;
        }
      }
    });

    return {
      weeklyIncome,
      weeklyExpense,
    };
  }, [transactions]);

  // 2. 스택 타워 완공까지 남은 금액 현황 문구 가공
  const towerProgressMessages = useMemo(() => {
    return towers.map((tower) => {
      const currentCollected = transactions
        .filter((tx) => tx.type === 'stack' && tx.goalId === tower.id)
        .reduce((sum, tx) => sum + tx.amount, 0);

      const remaining = Math.max(tower.targetAmount - currentCollected, 0);
      const percent = Math.min(Math.round((currentCollected / tower.targetAmount) * 100), 100);

      return {
        id: tower.id,
        title: tower.title,
        remaining,
        percent,
        isCompleted: percent >= 100 || tower.isCompleted,
        message: percent >= 100 
          ? `🏗️ ${tower.title} 타워를 완공했습니다! 대단합니다 🎉` 
          : `🏗️ ${tower.title} 완공까지 ${remaining.toLocaleString()}원 남았습니다! (${percent}% 쌓음)`,
      };
    });
  }, [towers, transactions]);

  // 3. 가장 가까운 소비 일정 필터링 및 D-Day 정렬 (최대 3개)
  const upcomingSchedules = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return schedules
      .filter((s) => !s.isSettled)
      .map((s) => {
        const schedDate = new Date(s.date);
        schedDate.setHours(0, 0, 0, 0);
        
        const diffTime = schedDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let dDayStr = '';
        if (diffDays === 0) {
          dDayStr = 'D-Day';
        } else if (diffDays > 0) {
          dDayStr = `D-${diffDays}`;
        } else {
          dDayStr = `D+${Math.abs(diffDays)} (지남)`;
        }

        return {
          ...s,
          dDayStr,
          diffDays,
        };
      })
      .sort((a, b) => a.diffDays - b.diffDays)
      .slice(0, 3);
  }, [schedules]);

  // 4. 예적금 통계 및 리스트
  const bankSummary = useMemo(() => {
    const totalDeposit = bankProducts
      .filter((p) => p.type === 'deposit')
      .reduce((sum, p) => sum + p.amount, 0);
    const totalSavings = bankProducts
      .filter((p) => p.type === 'savings')
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      totalDeposit,
      totalSavings,
      totalBankAssets: totalDeposit + totalSavings,
    };
  }, [bankProducts]);

  // 5. 예적금 상품 신규 추가 등록
  const handleAddBankProductSubmit = () => {
    const amountNum = parseInt(bankAmount.replace(/,/g, ''), 10);
    const rateNum = parseFloat(bankRate);
    
    if (!bankName.trim()) {
      return { success: false, message: '은행명을 입력해주세요.' };
    }
    if (!bankTitle.trim()) {
      return { success: false, message: '상품명을 입력해주세요.' };
    }
    if (isNaN(amountNum) || amountNum < 0) {
      return { success: false, message: '현재 잔액을 올바르게 입력해주세요.' };
    }
    if (isNaN(rateNum) || rateNum <= 0) {
      return { success: false, message: '이율을 올바르게 입력해주세요.' };
    }
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(bankMaturity)) {
      return { success: false, message: '만기일을 YYYY-MM-DD 형식으로 입력해주세요.' };
    }

    let monthlyPayNum: number | undefined;
    if (bankType === 'savings' && bankMonthlyPayment) {
      monthlyPayNum = parseInt(bankMonthlyPayment.replace(/,/g, ''), 10);
      if (isNaN(monthlyPayNum) || monthlyPayNum <= 0) {
        return { success: false, message: '적금 월 납입액을 올바르게 입력해주세요.' };
      }
    }

    addBankProduct({
      type: bankType,
      bankName: bankName.trim(),
      title: bankTitle.trim(),
      amount: amountNum,
      interestRate: rateNum,
      maturityDate: bankMaturity,
      monthlyPayment: monthlyPayNum,
    });

    // 폼 클리어
    setBankName('');
    setBankTitle('');
    setBankAmount('');
    setBankRate('');
    setBankMaturity('');
    setBankMonthlyPayment('');
    setIsAddBankOpen(false);

    return { success: true };
  };

  return {
    weeklySummary,
    towerProgressMessages,
    upcomingSchedules,
    bankProducts,
    bankSummary,
    loadMockData,
    
    // 예적금 추가
    isAddBankOpen,
    setIsAddBankOpen,
    bankType,
    setBankType,
    bankName,
    setBankName,
    bankTitle,
    setBankTitle,
    bankAmount,
    setBankAmount,
    bankRate,
    setBankRate,
    bankMaturity,
    setBankMaturity,
    bankMonthlyPayment,
    setBankMonthlyPayment,
    handleAddBankProductSubmit,
    handleDeleteBankProduct: deleteBankProduct,
  };
}
