import { useState, useMemo } from 'react';
import { useStackStore } from '@/store/useStackStore';
import { TransactionType } from '@/types';

export function useHomeLogic() {
  const {
    transactions,
    towers,
    schedules,
    bankProducts,
    fixedSettings,
    addBankProduct,
    deleteBankProduct,
    terminateBankProduct,
    addTransaction,
    deleteTransaction,
    addFixedSetting,
    deleteFixedSetting,
    updateFixedSetting,
    processFixedSettings,
    getMonthlySimulation,
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
  const [bankPaymentDay, setBankPaymentDay] = useState(''); // 적금 납입일

  // 예적금 중도해지 모달 및 폼 상태
  const [isTermModalOpen, setIsTermModalOpen] = useState(false);
  const [termProductId, setTermProductId] = useState<string | null>(null);
  const [termActualReceived, setTermActualReceived] = useState('');

  // UI 필터 및 모달 노출 상태
  const [filterType, setFilterType] = useState<TransactionType | 'all'>('all');
  const [txModalVisible, setTxModalVisible] = useState(false);
  const [fixedModalVisible, setFixedModalVisible] = useState(false);
  const [fixedListVisible, setFixedListVisible] = useState(false);

  // 거래 내역 입력 폼 상태
  const [txType, setTxType] = useState<TransactionType>('expense');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState('');
  const [txStore, setTxStore] = useState('');
  const [txMemo, setTxMemo] = useState('');
  const [txTowerId, setTxTowerId] = useState('');

  // 고정비 등록 폼 상태
  const [fixedType, setFixedType] = useState<'income' | 'expense'>('expense');
  const [fixedTitle, setFixedTitle] = useState('');
  const [fixedAmount, setFixedAmount] = useState('');
  const [fixedCategory, setFixedCategory] = useState('');
  const [fixedDay, setFixedDay] = useState('');
  const [fixedStore, setFixedStore] = useState('');

  // 1. 현재 연월 획득 (YYYY-MM)
  const currentYearMonth = useMemo(() => {
    const now = new Date();
    const yStr = now.getFullYear();
    const mStr = String(now.getMonth() + 1).padStart(2, '0');
    return `${yStr}-${mStr}`;
  }, []);

  // 2. 시뮬레이션 결과 연산
  const simulation = getMonthlySimulation(currentYearMonth);

  // 3. 필터링된 거래 내역
  const filteredTransactions = useMemo(() => {
    if (filterType === 'all') return transactions;
    return transactions.filter((tx) => tx.type === filterType);
  }, [transactions, filterType]);

  // 4. 미니 달력용 MarkedDates 계산 (수입: 초록 점, 지출: 빨간 점, 저축: 파란 점)
  const miniCalendarMarkedDates = useMemo(() => {
    const marked: Record<string, { dots: { key: string; color: string }[] }> = {};
    transactions.forEach((tx) => {
      const date = tx.date;
      if (!marked[date]) {
        marked[date] = { dots: [] };
      }
      const dots = marked[date].dots;
      if (tx.type === 'income' && !dots.some((d) => d.key === 'income')) {
        dots.push({ key: 'income', color: '#10B981' });
      } else if (
        (tx.type === 'expense' || tx.type === 'credit_card') &&
        !dots.some((d) => d.key === 'expense')
      ) {
        dots.push({ key: 'expense', color: '#EF4444' });
      } else if (tx.type === 'saving' && !dots.some((d) => d.key === 'saving')) {
        dots.push({ key: 'saving', color: '#3B82F6' }); // 저축은 파란색 점!
      }
    });
    return marked;
  }, [transactions]);

  // 5. 이번 주 수입/지출/저축 실적 요약 계산
  const weeklySummary = useMemo(() => {
    const today = new Date();
    const day = today.getDay();
    const diffToMonday = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diffToMonday));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    let weeklyIncome = 0;
    let weeklyExpense = 0;
    let weeklySaving = 0; // 저축 분리!

    transactions.forEach((tx) => {
      const txDate = new Date(tx.date);
      if (txDate >= monday && txDate <= sunday) {
        if (tx.type === 'income') {
          weeklyIncome += tx.amount;
        } else if (tx.type === 'expense' || tx.type === 'credit_card') {
          weeklyExpense += tx.amount;
        } else if (tx.type === 'saving') {
          weeklySaving += tx.amount; // 저축 실적 분리 합산
        }
      }
    });

    return {
      weeklyIncome,
      weeklyExpense,
      weeklySaving,
    };
  }, [transactions]);

  // 6. 스택 타워 완공까지 남은 금액 현황 문구 가공
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

  // 7. 가장 가까운 소비 일정 필터링 및 D-Day 정렬 (최대 3개)
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

  // 8. 예적금 통계 및 리스트
  const bankSummary = useMemo(() => {
    // 활성 상태 예적금만 총 자산에 잡음 (만기되거나 해지되면 이미 실물자산 totalAsset으로 기입되었으므로 빼줌)
    const activeProducts = bankProducts.filter((p) => p.status === 'active');
    
    const totalDeposit = activeProducts
      .filter((p) => p.type === 'deposit')
      .reduce((sum, p) => sum + p.amount, 0);
    const totalSavings = activeProducts
      .filter((p) => p.type === 'savings')
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      totalDeposit,
      totalSavings,
      totalBankAssets: totalDeposit + totalSavings,
    };
  }, [bankProducts]);

  // 9. 예적금 상품 신규 추가 등록
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
    let payDayNum: number | undefined;
    
    if (bankType === 'savings') {
      if (bankMonthlyPayment) {
        monthlyPayNum = parseInt(bankMonthlyPayment.replace(/,/g, ''), 10);
        if (isNaN(monthlyPayNum) || monthlyPayNum <= 0) {
          return { success: false, message: '적금 월 납입액을 올바르게 입력해주세요.' };
        }
      }
      
      if (bankPaymentDay) {
        payDayNum = parseInt(bankPaymentDay, 10);
        if (isNaN(payDayNum) || payDayNum < 1 || payDayNum > 31) {
          return { success: false, message: '적금 납입일자를 1~31일 사이로 입력해주세요.' };
        }
      } else {
        return { success: false, message: '적금 매월 납입일을 입력해주세요.' };
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
      paymentDay: payDayNum,
    });

    // 폼 클리어
    setBankName('');
    setBankTitle('');
    setBankAmount('');
    setBankRate('');
    setBankMaturity('');
    setBankMonthlyPayment('');
    setBankPaymentDay('');
    setIsAddBankOpen(false);

    return { success: true };
  };

  // 9-1. 예적금 상품 수동 중도해지 제출
  const handleTerminateBankProductSubmit = () => {
    if (!termProductId) {
      return { success: false, message: '해지 대상 상품이 없습니다.' };
    }
    const receivedNum = parseInt(termActualReceived.replace(/,/g, ''), 10);
    if (isNaN(receivedNum) || receivedNum <= 0) {
      return { success: false, message: '실제 해지 수령액을 올바르게 입력해주세요.' };
    }

    terminateBankProduct(termProductId, receivedNum);

    // 초기화
    setTermProductId(null);
    setTermActualReceived('');
    setIsTermModalOpen(false);

    return { success: true };
  };

  const handleOpenTerminate = (id: string, currentAmount: number) => {
    setTermProductId(id);
    setTermActualReceived(String(currentAmount)); // 해지 수령 예상액 초기값을 원금으로 설정
    setIsTermModalOpen(true);
  };

  // 10. 거래 내역 신규 추가 등록
  const handleAddTransactionSubmit = () => {
    const amountNum = parseInt(txAmount.replace(/,/g, ''), 10);
    if (isNaN(amountNum) || amountNum <= 0) {
      return { success: false, message: '금액을 올바르게 입력해주세요.' };
    }
    if (!txCategory) {
      return { success: false, message: '카테고리를 선택해주세요.' };
    }
    if (txType === 'stack' && !txTowerId) {
      return { success: false, message: '적립할 스택 타워를 선택해주세요.' };
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;

    addTransaction({
      type: txType,
      amount: amountNum,
      category: txCategory,
      storeName: txStore.trim() || undefined,
      date: dateStr,
      memo: txMemo.trim() || undefined,
      goalId: txType === 'stack' ? txTowerId : undefined,
    });

    // 폼 초기화 및 모달 닫기
    setTxAmount('');
    setTxStore('');
    setTxMemo('');
    setTxTowerId('');
    setTxModalVisible(false);

    return { success: true };
  };

  // 11. 고정비 등록 핸들러
  const handleAddFixedSettingSubmit = () => {
    const amountNum = parseInt(fixedAmount.replace(/,/g, ''), 10);
    const dayNum = parseInt(fixedDay, 10);
    if (!fixedTitle.trim()) {
      return { success: false, message: '고정비 항목명을 입력해주세요.' };
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      return { success: false, message: '금액을 올바르게 입력해주세요.' };
    }
    if (!fixedCategory) {
      return { success: false, message: '카테고리를 선택해주세요.' };
    }
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
      return { success: false, message: '반복 일자를 1~31일 사이로 입력해주세요.' };
    }

    addFixedSetting({
      type: fixedType,
      title: fixedTitle.trim(),
      amount: amountNum,
      category: fixedCategory,
      day: dayNum,
      storeName: fixedStore.trim() || undefined,
      isActive: true,
    });

    // 폼 초기화 및 닫기
    setFixedTitle('');
    setFixedAmount('');
    setFixedCategory('');
    setFixedDay('');
    setFixedStore('');
    setFixedModalVisible(false);

    return { success: true };
  };

  return {
    transactions,
    fixedSettings,
    bankProducts,
    towers,
    weeklySummary,
    towerProgressMessages,
    upcomingSchedules,
    bankSummary,
    loadMockData,
    processFixedSettings,
    
    // 시뮬레이션
    currentYearMonth,
    simulation,

    // 필터링된 거래 내역
    filterType,
    setFilterType,
    filteredTransactions,

    // 미니 달력 마크 데이터
    miniCalendarMarkedDates,
    
    // 예적금 추가 모달 및 폼
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
    bankPaymentDay,
    setBankPaymentDay,
    handleAddBankProductSubmit,
    handleDeleteBankProduct: deleteBankProduct,

    // 중도해지 관련
    isTermModalOpen,
    setIsTermModalOpen,
    termProductId,
    termActualReceived,
    setTermActualReceived,
    handleOpenTerminate,
    handleTerminateBankProductSubmit,

    // 거래 내역 추가 모달 및 폼
    txModalVisible,
    setTxModalVisible,
    txType,
    setTxType,
    txAmount,
    setTxAmount,
    txCategory,
    setTxCategory,
    txStore,
    setTxStore,
    txMemo,
    setTxMemo,
    txTowerId,
    setTxTowerId,
    handleAddTransactionSubmit,
    deleteTransaction,

    // 고정비 모달 및 폼
    fixedModalVisible,
    setFixedModalVisible,
    fixedListVisible,
    setFixedListVisible,
    fixedType,
    setFixedType,
    fixedTitle,
    setFixedTitle,
    fixedAmount,
    setFixedAmount,
    fixedCategory,
    setFixedCategory,
    fixedDay,
    setFixedDay,
    handleAddFixedSettingSubmit,
    deleteFixedSetting,
    updateFixedSetting,
  };
}
