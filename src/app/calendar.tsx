import React from 'react';
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
import { Calendar, DateData } from 'react-native-calendars';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing, MaxContentWidth, BottomTabInset } from '@/constants/theme';
import { useCalendarLogic } from '@/hooks/useCalendarLogic';
import { Schedule } from '@/types';



const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    alert(`${title}: ${message}`);
  } else {
    Alert.alert(title, message);
  }
};

export default function CalendarScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  
  // 아키텍처 규칙 준수: 복잡한 연산 및 상태 관리는 커스텀 훅으로 위임
  const {
    selectedDate,
    setSelectedDate,
    calendarDataMap,
    selectedDayTransactions,
    selectedDaySchedules,
    todayStr,

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
    handleDeleteSchedule,

    // 정산 관련
    isSettleModalOpen,
    setIsSettleModalOpen,
    activeSchedule,
    settleActualAmount,
    setSettleActualAmount,
    handleOpenSettle,
    handleSettleSubmit,
    monthlySummary,
  } = useCalendarLogic();

  // 일정 추가 모달 제출
  const onAddSubmit = () => {
    const res = handleAddScheduleSubmit();
    if (!res.success) {
      showAlert('알림', res.message || '오류가 발생했습니다.');
    }
  };

  // 정산 모달 제출
  const onSettleSubmit = () => {
    const res = handleSettleSubmit();
    if (!res.success) {
      showAlert('알림', res.message || '오류가 발생했습니다.');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        
        {/* 헤더 */}
        <View style={styles.header}>
          <ThemedText type="subtitle">📅 달력 / 일정 보드</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            계획된 소비 일정과 지나간 실제 지출을 한곳에서 모니터링
          </ThemedText>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* 📊 [0] 월간 누적 실적 요약 카드 */}
          <ThemedView type="backgroundElement" style={styles.monthlySummaryCard}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={{ marginBottom: Spacing.two }}>
              {selectedDate.substring(5, 7)}월 누적 리포트
            </ThemedText>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <ThemedText type="small" themeColor="textSecondary">총 수입</ThemedText>
                <ThemedText type="subtitle" style={{ color: '#10B981', marginTop: 4 }}>
                  +{monthlySummary.totalIncome.toLocaleString()}원
                </ThemedText>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <ThemedText type="small" themeColor="textSecondary">총 지출</ThemedText>
                <ThemedText type="subtitle" style={{ color: '#EF4444', marginTop: 4 }}>
                  -{monthlySummary.totalExpense.toLocaleString()}원
                </ThemedText>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <ThemedText type="small" themeColor="textSecondary">총 저축</ThemedText>
                <ThemedText type="subtitle" style={{ color: '#3B82F6', marginTop: 4 }}>
                  {monthlySummary.totalSaving.toLocaleString()}원
                </ThemedText>
              </View>
            </View>
          </ThemedView>

          {/* ────────────────────────────────────────── */}
          {/* [1] 외부 라이브러리 react-native-calendars 연동 */}
          {/* ────────────────────────────────────────── */}
          <View style={[styles.calendarWrapper, { backgroundColor: colors.backgroundElement }]}>
            <Calendar
              key={scheme} // 라이브러리 테마 강제 리렌더링용
              current={selectedDate}
              onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
              theme={{
                calendarBackground: colors.backgroundElement,
                textSectionTitleColor: colors.textSecondary,
                selectedDayBackgroundColor: colors.text,
                selectedDayTextColor: colors.background,
                todayTextColor: '#3B82F6',
                dayTextColor: colors.text,
                textDisabledColor: colors.textSecondary + '44',
                monthTextColor: colors.text,
                arrowColor: colors.text,
                textDayFontWeight: 'bold',
                textMonthFontWeight: 'bold',
                textDayHeaderFontWeight: 'bold',
              }}
              // 날짜 칸 커스텀 렌더링 (도트 마킹 방식)
              dayComponent={({ date, state }: { date?: DateData; state?: any }) => {
                if (!date) return null;
                const isSelected = date.dateString === selectedDate;
                const isToday = date.dateString === todayStr;
                const dayData = calendarDataMap[date.dateString] || { income: 0, expense: 0, expected: 0, saving: 0 };
                
                const showIncome = dayData.income > 0;
                const showExpense = dayData.expense > 0;
                const showExpected = dayData.expected > 0;
                const showSaving = dayData.saving > 0;

                return (
                  <Pressable
                    onPress={() => setSelectedDate(date.dateString)}
                    style={[
                      styles.customDayContainer,
                      isSelected && { backgroundColor: colors.textSecondary + '22', borderRadius: Spacing.two },
                    ]}
                  >
                    {/* 날짜 숫자 */}
                    <ThemedText
                      type="smallBold"
                      style={[
                        styles.dayText,
                        state === 'disabled' && { color: colors.textSecondary + '44' },
                        isToday && { color: '#3B82F6', textDecorationLine: 'underline' },
                        isSelected && { color: colors.text, fontWeight: '900' },
                      ]}
                    >
                      {date.day}
                    </ThemedText>

                    {/* 수입/소비/저축/예상 일정 도트 마커 (옵션 A 적용) */}
                    <View style={styles.dotContainer}>
                      {showIncome && <View style={[styles.indicatorDot, { backgroundColor: '#10B981' }]} />}
                      {showExpense && <View style={[styles.indicatorDot, { backgroundColor: '#EF4444' }]} />}
                      {showSaving && <View style={[styles.indicatorDot, { backgroundColor: '#3B82F6' }]} />}
                      {showExpected && <View style={[styles.indicatorDot, { backgroundColor: '#8B5CF6' }]} />}
                    </View>
                  </Pressable>
                );
              }}
            />
          </View>

          {/* ────────────────────────────────────────── */}
          {/* [2] 선택 날짜 일정 및 거래 내역 상세 섹션 */}
          {/* ────────────────────────────────────────── */}
          <View style={styles.detailSection}>
            <View style={styles.sectionHeaderRow}>
              <ThemedText type="subtitle">
                📌 {selectedDate === todayStr ? '오늘' : selectedDate} 상세
              </ThemedText>
              
              {/* 일정 추가 버튼 */}
              <Pressable
                onPress={() => setIsAddModalOpen(true)}
                style={[styles.addScheduleBtn, { backgroundColor: colors.backgroundSelected }]}
              >
                <ThemedText type="smallBold" style={{ color: '#3B82F6' }}>+ 소비 일정 추가</ThemedText>
              </Pressable>
            </View>

            {/* 소비 일정 파트 */}
            <ThemedText type="smallBold" style={styles.subTitleText}>소비 예정 일정</ThemedText>
            {selectedDaySchedules.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                예정된 소비 약속이 없습니다.
              </ThemedText>
            ) : (
              selectedDaySchedules.map((sched: Schedule) => (
                <ThemedView key={sched.id} type="backgroundElement" style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.titleWithBadge}>
                      <ThemedText type="smallBold">{sched.title}</ThemedText>
                      <View
                        style={[
                          styles.payTypeBadge,
                          { backgroundColor: sched.payType === 'dutch_pay' ? '#F59E0B' : '#6B7280' },
                        ]}
                      >
                        <ThemedText type="code" style={{ color: '#fff', fontSize: 10 }}>
                          {sched.payType === 'dutch_pay' ? '더치페이' : '단독 지출'}
                        </ThemedText>
                      </View>
                    </View>
                    
                    <Pressable
                      onPress={() => {
                        if (Platform.OS === 'web') {
                          if (confirm('이 일정을 삭제하시겠습니까?')) {
                            handleDeleteSchedule(sched.id);
                          }
                        } else {
                          Alert.alert('일정 삭제', '이 일정을 삭제하시겠습니까?', [
                            { text: '취소', style: 'cancel' },
                            { text: '삭제', style: 'destructive', onPress: () => handleDeleteSchedule(sched.id) },
                          ]);
                        }
                      }}
                      style={styles.deleteBtn}
                    >
                      <ThemedText type="code" style={{ color: '#EF4444' }}>삭제</ThemedText>
                    </Pressable>
                  </View>

                  <View style={styles.cardBody}>
                    <View>
                      <ThemedText type="small" themeColor="textSecondary">예상 소비</ThemedText>
                      <ThemedText type="smallBold">{sched.expectedAmount.toLocaleString()}원</ThemedText>
                    </View>

                    {sched.isSettled ? (
                      <View style={{ alignItems: 'flex-end' }}>
                        <ThemedText type="small" style={{ color: '#10B981', fontWeight: 'bold' }}>정산 완료</ThemedText>
                        <ThemedText type="smallBold" style={{ color: '#10B981' }}>
                          실제 {sched.actualAmount?.toLocaleString()}원
                        </ThemedText>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => handleOpenSettle(sched)}
                        style={styles.settleActionBtn}
                      >
                        <ThemedText type="code" style={{ color: '#fff' }}>정산하기</ThemedText>
                      </Pressable>
                    )}
                  </View>
                </ThemedView>
              ))
            )}

            {/* 실제 가계부 실적 파트 */}
            <ThemedText type="smallBold" style={[styles.subTitleText, { marginTop: Spacing.three }]}>
              실제 가계부 실적
            </ThemedText>
            {selectedDayTransactions.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                기록된 실제 거래 내역이 없습니다.
              </ThemedText>
            ) : (
              selectedDayTransactions.map((tx) => {
                const isIncome = tx.type === 'income';
                const prefix = isIncome ? '+' : '-';
                const txColor = isIncome ? '#10B981' : tx.type === 'credit_card' ? '#EF4444' : colors.text;
                
                return (
                  <ThemedView key={tx.id} type="backgroundElement" style={styles.txItemCard}>
                    <View style={styles.txRow}>
                      <View>
                        <ThemedText type="smallBold">{tx.storeName || tx.category}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {tx.category} {tx.memo ? `| ${tx.memo}` : ''}
                        </ThemedText>
                      </View>
                      <ThemedText type="smallBold" style={{ color: txColor }}>
                        {prefix}{tx.amount.toLocaleString()}원
                      </ThemedText>
                    </View>
                  </ThemedView>
                );
              })
            )}
          </View>
        </ScrollView>

        {/* ────────────────────────────────────────── */}
        {/* [3] 모달 - 소비 일정 추가 모달 */}
        {/* ────────────────────────────────────────── */}
        <Modal visible={isAddModalOpen} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <ThemedView type="backgroundElement" style={styles.modalContent}>
              <ThemedText type="subtitle" style={styles.modalTitle}>
                📝 새로운 소비 일정 계획 ({selectedDate})
              </ThemedText>

              {/* 일정 제목 */}
              <TextInput
                placeholder="약속 또는 일정 이름 (예: 친구 생일파티)"
                placeholderTextColor={colors.textSecondary}
                value={newTitle}
                onChangeText={setNewTitle}
                style={[styles.inputField, { borderColor: colors.backgroundSelected, color: colors.text }]}
              />

              {/* 예상 금액 */}
              <TextInput
                placeholder="예상 소비 금액 (원)"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                value={newExpectedAmount}
                onChangeText={(val) => setNewExpectedAmount(val.replace(/[^0-9]/g, ''))}
                style={[styles.inputField, { borderColor: colors.backgroundSelected, color: colors.text }]}
              />

              {/* 지불 분류 (더치페이 / 혼자지출) */}
              <ThemedText type="smallBold" style={{ marginTop: Spacing.one }}>지불 방식 분류</ThemedText>
              <View style={styles.modalTypeSelector}>
                {(['solo', 'dutch_pay'] as const).map((type) => {
                  const label = type === 'solo' ? '혼자서 지불 🧍' : '더치페이 (N분의 1) 👥';
                  const active = newPayType === type;
                  return (
                    <Pressable
                      key={type}
                      onPress={() => setNewPayType(type)}
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

              {/* 모달 액션 */}
              <View style={[styles.buttonRow, { marginTop: Spacing.three }]}>
                <Pressable
                  onPress={() => setIsAddModalOpen(false)}
                  style={[styles.modalActionButton, { backgroundColor: '#EF4444' }]}
                >
                  <ThemedText type="smallBold" style={{ color: '#fff' }}>취소</ThemedText>
                </Pressable>
                <Pressable
                  onPress={onAddSubmit}
                  style={[styles.modalActionButton, { backgroundColor: '#10B981' }]}
                >
                  <ThemedText type="smallBold" style={{ color: '#fff' }}>일정 등록</ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          </View>
        </Modal>

        {/* ────────────────────────────────────────── */}
        {/* [4] 모달 - 정산하기 모달 */}
        {/* ────────────────────────────────────────── */}
        <Modal visible={isSettleModalOpen} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <ThemedView type="backgroundElement" style={styles.modalContent}>
              <ThemedText type="subtitle" style={styles.modalTitle}>
                ⚖️ 실제 소비 금액 정산
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: Spacing.two }}>
                약속 일정: &quot;{activeSchedule?.title}&quot; | 예상 지출: {activeSchedule?.expectedAmount.toLocaleString()}원
              </ThemedText>

              {/* 실제 정산 금액 */}
              <TextInput
                placeholder="실제 소비한 금액 입력 (원)"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                value={settleActualAmount}
                onChangeText={(val) => setSettleActualAmount(val.replace(/[^0-9]/g, ''))}
                style={[styles.inputField, { borderColor: colors.backgroundSelected, color: colors.text }]}
              />

              <ThemedText type="small" themeColor="textSecondary" style={styles.helperText}>
                * 정산 완료 시 자동으로 가계부 지출(Transaction)에 자동 이관 기입됩니다.
              </ThemedText>

              {/* 모달 액션 */}
              <View style={[styles.buttonRow, { marginTop: Spacing.three }]}>
                <Pressable
                  onPress={() => setIsSettleModalOpen(false)}
                  style={[styles.modalActionButton, { backgroundColor: '#EF4444' }]}
                >
                  <ThemedText type="smallBold" style={{ color: '#fff' }}>취소</ThemedText>
                </Pressable>
                <Pressable
                  onPress={onSettleSubmit}
                  style={[styles.modalActionButton, { backgroundColor: '#10B981' }]}
                >
                  <ThemedText type="smallBold" style={{ color: '#fff' }}>정산 완료</ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          </View>
        </Modal>

      </SafeAreaView>
    </ThemedView>
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
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  calendarWrapper: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
    paddingVertical: Spacing.two,
  },
  customDayContainer: {
    width: '100%',
    height: 54,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  dayText: {
    fontSize: 12,
  },
  monthlySummaryCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E5E7EB22',
  },
  dotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    gap: 3,
  },
  indicatorDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  detailSection: {
    marginTop: Spacing.two,
    gap: Spacing.two,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  addScheduleBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  subTitleText: {
    fontSize: 14,
    marginTop: Spacing.one,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: Spacing.three,
  },
  card: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  payTypeBadge: {
    paddingHorizontal: Spacing.one,
    paddingVertical: 1,
    borderRadius: Spacing.one,
  },
  deleteBtn: {
    padding: Spacing.one,
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB11',
    paddingTop: Spacing.two,
  },
  settleActionBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.one,
  },
  txItemCard: {
    borderRadius: Spacing.one,
    padding: Spacing.three,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    maxHeight: '80%',
  },
  modalTitle: {
    marginBottom: Spacing.two,
  },
  inputField: {
    borderWidth: 1,
    height: 48,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 14,
    marginBottom: Spacing.one,
  },
  modalTypeSelector: {
    flexDirection: 'row',
    gap: Spacing.one,
    marginBottom: Spacing.two,
    marginTop: Spacing.one,
  },
  typeButton: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  modalActionButton: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Spacing.two,
  },
  helperText: {
    fontSize: 11,
    marginTop: -Spacing.one,
    marginBottom: Spacing.two,
  },
});
