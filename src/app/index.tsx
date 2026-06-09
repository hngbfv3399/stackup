import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  useColorScheme,
  Alert,
  Platform,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { useStackStore } from '@/store/useStackStore';
import { useHomeLogic } from '@/hooks/useHomeLogic';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing, MaxContentWidth, BottomTabInset } from '@/constants/theme';
import { TransactionType } from '@/types';

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    alert(`${title}: ${message}`);
  } else {
    Alert.alert(title, message);
  }
};

// 기본 카테고리 목록 정의
const CATEGORIES: Record<TransactionType, string[]> = {
  income: ['급여', '용돈', '부업', '금융소득', '기타'],
  expense: ['식비', '교통비', '쇼핑', '문화생활', '주거/통신', '의료/건강', '생필품', '기타'],
  credit_card: ['쇼핑', '외식/배달', '여행/숙박', '가전/디지털', '패션/뷰티', '기타'],
  stack: ['스택타워 적립', '비상금', '기타'],
};

export default function HomeScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  // Zustand Store
  const {
    transactions,
    towers,
    fixedSettings,
    addTransaction,
    deleteTransaction,
    addFixedSetting,
    deleteFixedSetting,
    updateFixedSetting,
    processFixedSettings,
    getMonthlySimulation,
  } = useStackStore();

  // 아키텍처 규칙 준수: 복잡한 비즈니스 데이터 연산 및 예적금 관리는 커스텀 훅으로 위임
  const {
    weeklySummary,
    towerProgressMessages,
    upcomingSchedules,
    bankProducts,
    bankSummary,
    loadMockData,
    
    // 예적금 관련 상태 및 핸들러
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
    handleDeleteBankProduct,
  } = useHomeLogic();

  // 현재 연월 획득 (YYYY-MM)
  const currentYearMonth = useMemo(() => {
    const now = new Date();
    const yStr = now.getFullYear();
    const mStr = String(now.getMonth() + 1).padStart(2, '0');
    return `${yStr}-${mStr}`;
  }, []);

  useEffect(() => {
    const now = new Date();
    const yStr = now.getFullYear();
    const mStr = String(now.getMonth() + 1).padStart(2, '0');
    const todayStr = `${yStr}-${mStr}-${String(now.getDate()).padStart(2, '0')}`;

    // 앱 켤 때 오늘 날짜 기준으로 고정비 이체 체크 및 자동 기입 실행
    processFixedSettings(todayStr);
  }, [processFixedSettings]);

  // 시뮬레이션 결과 불러오기
  const simulation = getMonthlySimulation(currentYearMonth || '2026-06');

  // UI 상태 관리
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

  // 미니 달력용 MarkedDates 계산 (수입: 초록 점, 지출: 빨간 점)
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
      }
    });
    return marked;
  }, [transactions]);

  // 거래 등록 핸들러
  const handleAddTx = () => {
    const amountNum = parseInt(txAmount.replace(/,/g, ''), 10);
    if (isNaN(amountNum) || amountNum <= 0) {
      showAlert('알림', '금액을 올바르게 입력해주세요.');
      return;
    }
    if (!txCategory) {
      showAlert('알림', '카테고리를 선택해주세요.');
      return;
    }
    if (txType === 'stack' && !txTowerId) {
      showAlert('알림', '적립할 스택 타워를 선택해주세요.');
      return;
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
  };

  // 고정비 등록 핸들러
  const handleAddFixed = () => {
    const amountNum = parseInt(fixedAmount.replace(/,/g, ''), 10);
    const dayNum = parseInt(fixedDay, 10);
    if (!fixedTitle.trim()) {
      showAlert('알림', '고정비 항목명을 입력해주세요.');
      return;
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      showAlert('알림', '금액을 올바르게 입력해주세요.');
      return;
    }
    if (!fixedCategory) {
      showAlert('알림', '카테고리를 선택해주세요.');
      return;
    }
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
      showAlert('알림', '반복 일자를 1~31일 사이로 입력해주세요.');
      return;
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

    setFixedTitle('');
    setFixedAmount('');
    setFixedDay('');
    setFixedStore('');
    setFixedModalVisible(false);
  };

  // 예적금 등록 핸들러
  const handleAddBank = () => {
    const res = handleAddBankProductSubmit();
    if (!res.success) {
      showAlert('알림', res.message ?? '오류가 발생했습니다.');
    }
  };

  // 필터링된 트랜잭션 목록
  const filteredTxs = transactions.filter((tx) => {
    if (filterType === 'all') return true;
    return tx.type === filterType;
  });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        
        {/* 헤더 타이틀 & 샘플 데이터 로드 버튼 */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View>
              <ThemedText type="subtitle">StackUp 스택 보드</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                소비 습관을 쌓고, 낭비를 허무는 공간
              </ThemedText>
            </View>
            <Pressable
              onPress={() => {
                loadMockData();
                showAlert('알림', '가상 Mock Data가 성공적으로 로드되었습니다.');
              }}
              style={[styles.mockBtn, { backgroundColor: '#3B82F6' }]}
            >
              <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
                샘플 데이터 로드 ⚡
              </ThemedText>
            </Pressable>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ────────────────────────────────────────── */}
          {/* [0] 목표 달성 진척 배너 */}
          {/* ────────────────────────────────────────── */}
          {towerProgressMessages.length > 0 && (
            <View style={styles.bannerContainer}>
              {towerProgressMessages.map((t) => (
                <View key={t.id} style={[styles.bannerCard, { backgroundColor: colors.backgroundSelected }]}>
                  <ThemedText type="smallBold" style={{ color: t.isCompleted ? '#10B981' : colors.text }}>
                    {t.message}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}

          {/* ────────────────────────────────────────── */}
          {/* [1] 이번 주 실적 요약 카드 */}
          {/* ────────────────────────────────────────── */}
          <ThemedView type="backgroundElement" style={styles.dashboardCard}>
            <ThemedText type="smallBold" themeColor="textSecondary">이번 주 실적 요약</ThemedText>
            <View style={styles.dashboardRow}>
              <View>
                <ThemedText type="small" themeColor="textSecondary">이번 주 수입</ThemedText>
                <ThemedText type="subtitle" style={{ color: '#10B981', marginTop: 4 }}>
                  +{weeklySummary.weeklyIncome.toLocaleString()}원
                </ThemedText>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <ThemedText type="small" themeColor="textSecondary">이번 주 소비</ThemedText>
                <ThemedText type="subtitle" style={{ color: '#EF4444', marginTop: 4 }}>
                  -{weeklySummary.weeklyExpense.toLocaleString()}원
                </ThemedText>
              </View>
            </View>
          </ThemedView>

          {/* ────────────────────────────────────────── */}
          {/* [2] 미니 흐름 달력 */}
          {/* ────────────────────────────────────────── */}
          <ThemedView type="backgroundElement" style={styles.dashboardCard}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={{ marginBottom: Spacing.two }}>
              미니 달력 흐름 (수입: 초록, 소비: 빨강)
            </ThemedText>
            {Platform.OS !== 'web' ? (
              <Calendar
                key={scheme}
                markingType="multi-dot"
                markedDates={miniCalendarMarkedDates}
                theme={{
                  calendarBackground: 'transparent',
                  textSectionTitleColor: colors.textSecondary,
                  dayTextColor: colors.text,
                  todayTextColor: '#3B82F6',
                  arrowColor: colors.text,
                  monthTextColor: colors.text,
                  textDayFontWeight: 'bold',
                  textMonthFontWeight: 'bold',
                }}
                style={{ borderRadius: Spacing.two }}
              />
            ) : (
              <View style={{ paddingVertical: Spacing.three, alignItems: 'center', backgroundColor: colors.backgroundSelected, borderRadius: Spacing.two }}>
                <ThemedText type="small" themeColor="textSecondary">
                  🖥️ 웹 환경에서는 상세 달력을 &quot;달력/일정&quot; 탭에서 확인해 주세요!
                </ThemedText>
              </View>
            )}
          </ThemedView>

          {/* ────────────────────────────────────────── */}
          {/* [3] 가장 가까운 소비 일정 리스트 */}
          {/* ────────────────────────────────────────── */}
          <ThemedView type="backgroundElement" style={styles.dashboardCard}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={{ marginBottom: Spacing.two }}>
              다가오는 소비 일정 (가까운 순)
            </ThemedText>
            {upcomingSchedules.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                예정된 소비 일정이 없습니다.
              </ThemedText>
            ) : (
              upcomingSchedules.map((sched) => (
                <View key={sched.id} style={styles.schedRow}>
                  <View style={styles.schedLeft}>
                    <View style={[styles.dDayBadge, { backgroundColor: sched.diffDays <= 3 ? '#EF4444' : '#3B82F6' }]}>
                      <ThemedText type="code" style={{ color: '#fff', fontSize: 10 }}>
                        {sched.dDayStr}
                      </ThemedText>
                    </View>
                    <ThemedText type="smallBold">{sched.title}</ThemedText>
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    {sched.expectedAmount.toLocaleString()}원 ({sched.payType === 'dutch_pay' ? '더치페이' : '혼자'})
                  </ThemedText>
                </View>
              ))
            )}
          </ThemedView>

          {/* ────────────────────────────────────────── */}
          {/* [4] 내 예적금 자산 카드 */}
          {/* ────────────────────────────────────────── */}
          <ThemedView type="backgroundElement" style={styles.dashboardCard}>
            <View style={styles.dashboardHeaderRow}>
              <ThemedText type="smallBold" themeColor="textSecondary">내 예적금 자산 ({bankProducts.length}개)</ThemedText>
              <Pressable onPress={() => setIsAddBankOpen(true)}>
                <ThemedText type="smallBold" style={{ color: '#3B82F6' }}>+ 계좌 추가</ThemedText>
              </Pressable>
            </View>
            <ThemedText type="subtitle" style={{ marginVertical: Spacing.one }}>
              총 예적금액: {bankSummary.totalBankAssets.toLocaleString()}원
            </ThemedText>
            <View style={{ gap: Spacing.one, marginTop: Spacing.one }}>
              {bankProducts.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  등록된 예적금이 없습니다.
                </ThemedText>
              ) : (
                bankProducts.map((p) => (
                  <View key={p.id} style={styles.bankItemRow}>
                    <View>
                      <ThemedText type="smallBold">{p.bankName} - {p.title}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        이율 {p.interestRate}% | 만기 {p.maturityDate} {p.monthlyPayment ? `| 월 ${p.monthlyPayment.toLocaleString()}원` : ''}
                      </ThemedText>
                    </View>
                    <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: Spacing.two }}>
                      <ThemedText type="smallBold">{p.amount.toLocaleString()}원</ThemedText>
                      <Pressable
                        onPress={() => {
                          Alert.alert('계좌 삭제', '이 계좌를 삭제하시겠습니까?', [
                            { text: '취소', style: 'cancel' },
                            { text: '삭제', style: 'destructive', onPress: () => handleDeleteBankProduct(p.id) },
                          ]);
                        }}
                      >
                        <ThemedText type="code" style={{ color: '#EF4444' }}>삭제</ThemedText>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ThemedView>

          {/* ────────────────────────────────────────── */}
          {/* [5] 예산 시뮬레이터 카드 */}
          {/* ────────────────────────────────────────── */}
          <ThemedView type="backgroundElement" style={styles.simCard}>
            <ThemedText type="smallBold" themeColor="textSecondary">이번 달 잔액 현황</ThemedText>
            <View style={styles.simRow}>
              <ThemedText type="subtitle">이번 달 가용 잔액</ThemedText>
              <ThemedText type="subtitle" style={{ color: simulation.thisMonthRemaining >= 0 ? '#10B981' : '#EF4444' }}>
                {simulation.thisMonthRemaining.toLocaleString()}원
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.simHelpText}>
              (수입 {simulation.thisMonthIncome.toLocaleString()}원 - 고정비 {simulation.thisMonthFixedExpense.toLocaleString()}원 - 지출 {simulation.thisMonthVariableExpense.toLocaleString()}원 - 스택 {simulation.thisMonthStack.toLocaleString()}원)
            </ThemedText>

            <View style={styles.divider} />

            <ThemedText type="smallBold" themeColor="textSecondary">다음 달 가상 차압 예측</ThemedText>
            <View style={styles.simRow}>
              <ThemedText type="subtitle">다음 달 예상 잔액</ThemedText>
              <ThemedText type="subtitle" style={{ color: simulation.nextMonthExpectedRemaining >= 0 ? '#10B981' : '#EF4444' }}>
                {simulation.nextMonthExpectedRemaining.toLocaleString()}원
              </ThemedText>
            </View>
            <View style={styles.simDetailList}>
              <ThemedText type="small" themeColor="textSecondary">
                • 예상 수입: +{simulation.nextMonthExpectedIncome.toLocaleString()}원 (고정 수입)
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                • 고정 지출: -{simulation.nextMonthFixedExpense.toLocaleString()}원 (고정 지출)
              </ThemedText>
              <ThemedText type="small" style={{ color: '#EF4444', fontWeight: 'bold' }}>
                • 신용카드 청구: -{simulation.nextMonthCreditCardBill.toLocaleString()}원 (이번 달 카드 승인액)
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                • 타워 목표 스택: -{simulation.nextMonthExpectedStack.toLocaleString()}원
              </ThemedText>
            </View>

            {simulation.nextMonthExpectedRemaining < 0 && (
              <View style={styles.warningAlertBox}>
                <ThemedText type="smallBold" style={styles.warningTitle}>💳 카드 남용 위험 경고</ThemedText>
                <ThemedText type="small" style={styles.warningText}>
                  이번 달 신용카드를 너무 많이 사용했습니다! 다음 달 예상 잔고가 적자상태입니다. 체크카드로 당장 전환하고 지출을 동결하세요.
                </ThemedText>
              </View>
            )}
          </ThemedView>

          {/* ────────────────────────────────────────── */}
          {/* [6] 퀵 버튼 (거래 등록 & 고정비 관리) */}
          {/* ────────────────────────────────────────── */}
          <View style={styles.buttonRow}>
            <Pressable
              onPress={() => {
                setTxType('expense');
                setTxCategory(CATEGORIES.expense[0]);
                setTxModalVisible(true);
              }}
              style={[styles.actionButton, { backgroundColor: colors.backgroundSelected }]}
            >
              <ThemedText type="smallBold">🧱 내역 등록</ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setFixedListVisible(!fixedListVisible)}
              style={[styles.actionButton, { backgroundColor: colors.backgroundSelected }]}
            >
              <ThemedText type="smallBold">⚙️ 고정비 관리 ({fixedSettings.length})</ThemedText>
            </Pressable>
          </View>

          {/* 고정비 아코디언 목록 */}
          {fixedListVisible && (
            <ThemedView type="backgroundElement" style={styles.fixedListContainer}>
              <View style={styles.fixedListHeader}>
                <ThemedText type="smallBold">고정비 템플릿 설정</ThemedText>
                <Pressable
                  onPress={() => {
                    setFixedType('expense');
                    setFixedCategory(CATEGORIES.expense[0]);
                    setFixedModalVisible(true);
                  }}
                  style={styles.fixedAddButton}
                >
                  <ThemedText type="smallBold" style={{ color: '#10B981' }}>+ 추가</ThemedText>
                </Pressable>
              </View>

              {fixedSettings.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  등록된 고정 수입/지출이 없습니다.
                </ThemedText>
              ) : (
                fixedSettings.map((item) => (
                  <View key={item.id} style={styles.fixedItemRow}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.fixedItemTitleRow}>
                        <ThemedText type="smallBold">{item.title}</ThemedText>
                        <OpenBadge type={item.type} />
                      </View>
                      <ThemedText type="small" themeColor="textSecondary">
                        매월 {item.day}일 | {item.category} | {item.amount.toLocaleString()}원
                      </ThemedText>
                    </View>
                    <View style={styles.fixedItemActions}>
                      <Pressable
                        onPress={() => updateFixedSetting(item.id, { isActive: !item.isActive })}
                        style={[styles.toggleButton, { backgroundColor: item.isActive ? '#10B981' : '#9CA3AF' }]}
                      >
                        <ThemedText type="code" style={{ color: '#fff' }}>
                          {item.isActive ? 'ON' : 'OFF'}
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={() => deleteFixedSetting(item.id)}
                        style={styles.deleteMiniButton}
                      >
                        <ThemedText type="code" style={{ color: '#EF4444' }}>삭제</ThemedText>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </ThemedView>
          )}

          {/* ────────────────────────────────────────── */}
          {/* [7] 거래 필터 칩 */}
          {/* ────────────────────────────────────────── */}
          <View style={styles.filterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              {(['all', 'income', 'expense', 'credit_card', 'stack'] as const).map((type) => {
                const label =
                  type === 'all'
                    ? '전체'
                    : type === 'income'
                    ? '수입'
                    : type === 'expense'
                    ? '지출(현금)'
                    : type === 'credit_card'
                    ? '신용카드'
                    : '스택(저금)';
                const isSelected = filterType === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => setFilterType(type)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: isSelected ? colors.text : colors.backgroundElement,
                      },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{
                        color: isSelected ? colors.background : colors.text,
                        fontWeight: isSelected ? 'bold' : 'normal',
                      }}
                    >
                      {label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* ────────────────────────────────────────── */}
          {/* [8] 거래 내역 로그 */}
          {/* ────────────────────────────────────────── */}
          <View style={styles.txHeaderRow}>
            <ThemedText type="smallBold">내역 로그 ({filteredTxs.length}건)</ThemedText>
          </View>

          {filteredTxs.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
              기록된 내역이 없습니다. 블록을 쌓아보세요!
            </ThemedText>
          ) : (
            filteredTxs.map((tx) => {
              let typeLabel = '지출';
              let color: string = colors.text;
              if (tx.type === 'income') {
                typeLabel = '수입';
                color = '#10B981';
              } else if (tx.type === 'credit_card') {
                typeLabel = '카드';
                color = '#EF4444';
              } else if (tx.type === 'stack') {
                typeLabel = '스택';
                color = '#3B82F6';
              }

              return (
                <ThemedView key={tx.id} type="backgroundElement" style={styles.txCard}>
                  <View style={styles.txTopRow}>
                    <View>
                      <View style={styles.titleWithBadge}>
                        <ThemedText type="smallBold">
                          {tx.storeName || tx.category}
                        </ThemedText>
                        <View style={[styles.txBadge, { backgroundColor: color }]}>
                          <ThemedText type="code" style={{ color: '#fff', fontSize: 10 }}>
                            {typeLabel}
                          </ThemedText>
                        </View>
                        {tx.isFixed && (
                          <View style={[styles.txBadge, { backgroundColor: '#6B7280' }]}>
                            <ThemedText type="code" style={{ color: '#fff', fontSize: 10 }}>
                              고정
                            </ThemedText>
                          </View>
                        )}
                      </View>
                      <ThemedText type="small" themeColor="textSecondary">
                        {tx.date} | {tx.category} {tx.memo ? `(${tx.memo})` : ''}
                      </ThemedText>
                    </View>
                    <View style={styles.txRightCol}>
                      <ThemedText type="smallBold" style={{ color }}>
                        {tx.type === 'income' ? '+' : '-'}{tx.amount.toLocaleString()}원
                      </ThemedText>
                      <Pressable
                        onPress={() => {
                          Alert.alert('삭제 확인', '이 내역을 삭제하시겠습니까?', [
                            { text: '취소', style: 'cancel' },
                            { text: '삭제', style: 'destructive', onPress: () => deleteTransaction(tx.id) },
                          ]);
                        }}
                        style={styles.deleteTxButton}
                      >
                        <ThemedText type="code" style={{ color: '#EF4444', fontSize: 11 }}>삭제</ThemedText>
                      </Pressable>
                    </View>
                  </View>
                </ThemedView>
              );
            })
          )}
        </ScrollView>

        {/* ────────────────────────────────────────── */}
        {/* 모달 - 거래 내역 등록 모달 */}
        {/* ────────────────────────────────────────── */}
        <Modal visible={txModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <ThemedView type="backgroundElement" style={styles.modalContent}>
              <ThemedText type="subtitle" style={styles.modalTitle}>🧱 새로운 블록 쌓기 (내역 등록)</ThemedText>

              <View style={styles.modalTypeSelector}>
                {(['income', 'expense', 'credit_card', 'stack'] as const).map((type) => {
                  const label =
                    type === 'income'
                      ? '수입'
                      : type === 'expense'
                      ? '지출(현금)'
                      : type === 'credit_card'
                      ? '신용카드'
                      : '스택(저금)';
                  const active = txType === type;
                  return (
                    <Pressable
                      key={type}
                      onPress={() => {
                        setTxType(type);
                        setTxCategory(CATEGORIES[type][0]);
                      }}
                      style={[
                        styles.typeButton,
                        { backgroundColor: active ? colors.text : colors.backgroundSelected },
                      ]}
                    >
                      <ThemedText
                        type="code"
                        style={{ color: active ? colors.background : colors.text, fontSize: 11 }}
                      >
                        {label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                placeholder="금액 입력 (원)"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                value={txAmount}
                onChangeText={(val) => setTxAmount(val.replace(/[^0-9]/g, ''))}
                style={[styles.inputField, { borderColor: colors.backgroundSelected, color: colors.text }]}
              />

              <TextInput
                placeholder={txType === 'income' ? '원천/수입처 (예: 월급, 용돈)' : '매장명 / 사용처 (예: 스타벅스, 쿠팡)'}
                placeholderTextColor={colors.textSecondary}
                value={txStore}
                onChangeText={setTxStore}
                style={[styles.inputField, { borderColor: colors.backgroundSelected, color: colors.text }]}
              />

              <TextInput
                placeholder="메모 (선택사항)"
                placeholderTextColor={colors.textSecondary}
                value={txMemo}
                onChangeText={setTxMemo}
                style={[styles.inputField, { borderColor: colors.backgroundSelected, color: colors.text }]}
              />

              <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>카테고리 선택</ThemedText>
              <View style={styles.categoryGrid}>
                {CATEGORIES[txType].map((cat) => {
                  const active = txCategory === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setTxCategory(cat)}
                      style={[
                        styles.categoryChip,
                        { backgroundColor: active ? colors.text : colors.backgroundSelected },
                      ]}
                    >
                      <ThemedText
                        type="code"
                        style={{ color: active ? colors.background : colors.text, fontSize: 11 }}
                      >
                        {cat}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              {txType === 'stack' && (
                <View style={{ marginTop: Spacing.two }}>
                  <ThemedText type="smallBold">적립할 스택 타워 선택</ThemedText>
                  {towers.length === 0 ? (
                    <ThemedText type="small" style={{ color: '#EF4444', marginTop: Spacing.one }}>
                      건설된 스택 타워가 없습니다. 스택 타워 탭에서 타워를 먼저 생성하세요!
                    </ThemedText>
                  ) : (
                    <View style={styles.categoryGrid}>
                      {towers.map((tower) => {
                        const active = txTowerId === tower.id;
                        return (
                          <Pressable
                            key={tower.id}
                            onPress={() => setTxTowerId(tower.id)}
                            style={[
                              styles.categoryChip,
                              { backgroundColor: active ? colors.text : colors.backgroundSelected },
                            ]}
                          >
                            <ThemedText
                              type="code"
                              style={{ color: active ? colors.background : colors.text, fontSize: 11 }}
                            >
                              🏗️ {tower.title}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              <View style={[styles.buttonRow, { marginTop: Spacing.four }]}>
                <Pressable
                  onPress={() => setTxModalVisible(false)}
                  style={[styles.modalActionButton, { backgroundColor: '#EF4444' }]}
                >
                  <ThemedText type="smallBold" style={{ color: '#fff' }}>취소</ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleAddTx}
                  style={[styles.modalActionButton, { backgroundColor: '#10B981' }]}
                >
                  <ThemedText type="smallBold" style={{ color: '#fff' }}>등록</ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          </View>
        </Modal>

        {/* ────────────────────────────────────────── */}
        {/* 모달 - 고정비 등록 모달 */}
        {/* ────────────────────────────────────────── */}
        <Modal visible={fixedModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <ThemedView type="backgroundElement" style={styles.modalContent}>
              <ThemedText type="subtitle" style={styles.modalTitle}>⚙️ 고정 수입/지출 등록</ThemedText>

              <View style={styles.modalTypeSelector}>
                {(['income', 'expense'] as const).map((type) => {
                  const label = type === 'income' ? '고정 수입' : '고정 지출';
                  const active = fixedType === type;
                  return (
                    <Pressable
                      key={type}
                      onPress={() => {
                        setFixedType(type);
                        setFixedCategory(CATEGORIES[type][0]);
                      }}
                      style={[
                        styles.typeButton,
                        { flex: 1, backgroundColor: active ? colors.text : colors.backgroundSelected },
                      ]}
                    >
                      <ThemedText
                        type="code"
                        style={{ color: active ? colors.background : colors.text }}
                      >
                        {label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                placeholder="항목 이름 (예: 월세, 급여, 넷플릭스)"
                placeholderTextColor={colors.textSecondary}
                value={fixedTitle}
                onChangeText={setFixedTitle}
                style={[styles.inputField, { borderColor: colors.backgroundSelected, color: colors.text }]}
              />

              <TextInput
                placeholder="매달 이체될 금액 (원)"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                value={fixedAmount}
                onChangeText={(val) => setFixedAmount(val.replace(/[^0-9]/g, ''))}
                style={[styles.inputField, { borderColor: colors.backgroundSelected, color: colors.text }]}
              />

              <TextInput
                placeholder="매월 반복될 일자 (1 ~ 31일)"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                value={fixedDay}
                onChangeText={(val) => setFixedDay(val.replace(/[^0-9]/g, ''))}
                style={[styles.inputField, { borderColor: colors.backgroundSelected, color: colors.text }]}
              />

              <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>카테고리 선택</ThemedText>
              <View style={styles.categoryGrid}>
                {CATEGORIES[fixedType].map((cat) => {
                  const active = fixedCategory === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setFixedCategory(cat)}
                      style={[
                        styles.categoryChip,
                        { backgroundColor: active ? colors.text : colors.backgroundSelected },
                      ]}
                    >
                      <ThemedText
                        type="code"
                        style={{ color: active ? colors.background : colors.text, fontSize: 11 }}
                      >
                        {cat}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.buttonRow, { marginTop: Spacing.four }]}>
                <Pressable
                  onPress={() => setFixedModalVisible(false)}
                  style={[styles.modalActionButton, { backgroundColor: '#EF4444' }]}
                >
                  <ThemedText type="smallBold" style={{ color: '#fff' }}>취소</ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleAddFixed}
                  style={[styles.modalActionButton, { backgroundColor: '#10B981' }]}
                >
                  <ThemedText type="smallBold" style={{ color: '#fff' }}>등록</ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          </View>
        </Modal>

        {/* ────────────────────────────────────────── */}
        {/* 모달 - 예적금 등록 모달 */}
        {/* ────────────────────────────────────────── */}
        <Modal visible={isAddBankOpen} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <ThemedView type="backgroundElement" style={styles.modalContent}>
              <ThemedText type="subtitle" style={styles.modalTitle}>🏦 새 예적금 계좌 추가</ThemedText>

              {/* 종류 선택 */}
              <View style={styles.modalTypeSelector}>
                {(['deposit', 'savings'] as const).map((type) => {
                  const label = type === 'deposit' ? '예금 계좌 🏦' : '적금 상품 💰';
                  const active = bankType === type;
                  return (
                    <Pressable
                      key={type}
                      onPress={() => setBankType(type)}
                      style={[
                        styles.typeButton,
                        { backgroundColor: active ? colors.text : colors.backgroundSelected },
                      ]}
                    >
                      <ThemedText
                        type="code"
                        style={{ color: active ? colors.background : colors.text, fontSize: 11 }}
                      >
                        {label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                placeholder="은행명 (예: 신한은행)"
                placeholderTextColor={colors.textSecondary}
                value={bankName}
                onChangeText={setBankName}
                style={[styles.inputField, { borderColor: colors.backgroundSelected, color: colors.text }]}
              />

              <TextInput
                placeholder="계좌/상품 이름 (예: 청년도약적금)"
                placeholderTextColor={colors.textSecondary}
                value={bankTitle}
                onChangeText={setBankTitle}
                style={[styles.inputField, { borderColor: colors.backgroundSelected, color: colors.text }]}
              />

              <TextInput
                placeholder="현재 예치/적립 잔액 (원)"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                value={bankAmount}
                onChangeText={(val) => setBankAmount(val.replace(/[^0-9]/g, ''))}
                style={[styles.inputField, { borderColor: colors.backgroundSelected, color: colors.text }]}
              />

              <TextInput
                placeholder="금리 (%) (예: 5.5)"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={bankRate}
                onChangeText={setBankRate}
                style={[styles.inputField, { borderColor: colors.backgroundSelected, color: colors.text }]}
              />

              <TextInput
                placeholder="만기일 (YYYY-MM-DD)"
                placeholderTextColor={colors.textSecondary}
                value={bankMaturity}
                onChangeText={setBankMaturity}
                style={[styles.inputField, { borderColor: colors.backgroundSelected, color: colors.text }]}
              />

              {bankType === 'savings' && (
                <TextInput
                  placeholder="월 납입액 (선택사항, 원)"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                  value={bankMonthlyPayment}
                  onChangeText={(val) => setBankMonthlyPayment(val.replace(/[^0-9]/g, ''))}
                  style={[styles.inputField, { borderColor: colors.backgroundSelected, color: colors.text }]}
                />
              )}

              <View style={[styles.buttonRow, { marginTop: Spacing.four }]}>
                <Pressable
                  onPress={() => setIsAddBankOpen(false)}
                  style={[styles.modalActionButton, { backgroundColor: '#EF4444' }]}
                >
                  <ThemedText type="smallBold" style={{ color: '#fff' }}>취소</ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleAddBank}
                  style={[styles.modalActionButton, { backgroundColor: '#10B981' }]}
                >
                  <ThemedText type="smallBold" style={{ color: '#fff' }}>계좌 등록</ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          </View>
        </Modal>

      </SafeAreaView>
    </ThemedView>
  );
}

// 뱃지 컴포넌트
function OpenBadge({ type }: { type: 'income' | 'expense' }) {
  return (
    <View style={[styles.badgeText, { backgroundColor: type === 'income' ? '#10B981' : '#374151' }]}>
      <ThemedText type="code" style={{ color: '#fff', fontSize: 9 }}>
        {type === 'income' ? '수입' : '지출'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: '100%',
    paddingBottom: BottomTabInset,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    marginTop: Platform.select({ web: 90, default: 0 }),
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mockBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  bannerContainer: {
    gap: Spacing.one,
    marginBottom: Spacing.one,
  },
  bannerCard: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  dashboardCard: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
  },
  dashboardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  dashboardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  schedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB11',
  },
  schedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dDayBadge: {
    paddingHorizontal: Spacing.one,
    paddingVertical: 1,
    borderRadius: Spacing.one,
  },
  bankItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB11',
  },
  simCard: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  simRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  simHelpText: {
    fontSize: 11,
    marginTop: Spacing.half,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB22',
    marginVertical: Spacing.two,
  },
  simDetailList: {
    gap: Spacing.half,
    marginTop: Spacing.one,
    paddingLeft: Spacing.two,
  },
  warningAlertBox: {
    backgroundColor: '#EF444415',
    borderColor: '#EF444433',
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginTop: Spacing.three,
  },
  warningTitle: {
    color: '#EF4444',
  },
  warningText: {
    color: '#FCA5A5',
    marginTop: Spacing.one,
    lineHeight: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionButton: {
    flex: 1,
    height: 48,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fixedListContainer: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  fixedListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fixedAddButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  fixedItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB11',
  },
  fixedItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  badgeText: {
    paddingHorizontal: Spacing.one,
    paddingVertical: 1,
    borderRadius: 3,
  },
  fixedItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  toggleButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.one,
  },
  deleteMiniButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  filterContainer: {
    marginVertical: Spacing.one,
  },
  filterScroll: {
    gap: Spacing.two,
  },
  filterChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  txHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  txCard: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
  },
  txTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  txBadge: {
    paddingHorizontal: Spacing.one,
    paddingVertical: 1,
    borderRadius: Spacing.one,
  },
  txRightCol: {
    alignItems: 'flex-end',
    gap: Spacing.one,
  },
  deleteTxButton: {
    padding: Spacing.one,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: Spacing.three,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000000AA',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
    maxHeight: '90%',
  },
  modalTitle: {
    marginBottom: Spacing.two,
  },
  modalTypeSelector: {
    flexDirection: 'row',
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  typeButton: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputField: {
    borderWidth: 1,
    height: 48,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 14,
    marginBottom: Spacing.one,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginVertical: Spacing.one,
  },
  categoryChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
  },
  modalActionButton: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Spacing.two,
  },
});
