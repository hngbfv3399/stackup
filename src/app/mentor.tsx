import React, { useMemo } from 'react';
import { StyleSheet, View, ScrollView, useColorScheme, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStackStore } from '@/store/useStackStore';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing, MaxContentWidth, BottomTabInset } from '@/constants/theme';

export default function MentorScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  const { getMentorFeedbacks, transactions } = useStackStore();

  const currentYearMonth = useMemo(() => {
    const now = new Date();
    const yStr = now.getFullYear();
    const mStr = String(now.getMonth() + 1).padStart(2, '0');
    return `${yStr}-${mStr}`;
  }, []);

  const feedbacks = getMentorFeedbacks(currentYearMonth);

  // 카테고리별 소비 합산 계산 (일반 지출 + 신용카드 지출 대상)
  const getCategoryStats = () => {
    const thisMonthTxs = transactions.filter(
      (tx) => tx.date.startsWith(currentYearMonth) && (tx.type === 'expense' || tx.type === 'credit_card')
    );

    const categoryMap: Record<string, number> = {};
    let totalExpense = 0;

    thisMonthTxs.forEach((tx) => {
      const cat = tx.category;
      categoryMap[cat] = (categoryMap[cat] || 0) + tx.amount;
      totalExpense += tx.amount;
    });

    // 정렬된 리스트로 반환
    const statsList = Object.entries(categoryMap)
      .map(([category, amount]) => ({
        category,
        amount,
        percent: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      statsList,
      totalExpense,
    };
  };

  const { statsList, totalExpense } = getCategoryStats();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        
        {/* 헤더 */}
        <View style={styles.header}>
          <ThemedText type="subtitle">🧐 StackUp 멘토 피드백</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            소비 패턴을 분석하여 습관을 고치는 뼈아픈 잔소리 보드
          </ThemedText>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ────────────────────────────────────────── */}
          {/* [1] 이번 달 소비 카테고리 분석 */}
          {/* ────────────────────────────────────────── */}
          <ThemedView type="backgroundElement" style={styles.statsCard}>
            <ThemedText type="smallBold" themeColor="textSecondary">이번 달 총 지출</ThemedText>
            <ThemedText type="title" style={styles.totalExpenseText}>
              {totalExpense.toLocaleString()}원
            </ThemedText>

            <View style={styles.divider} />

            <ThemedText type="smallBold" themeColor="textSecondary" style={{ marginBottom: Spacing.two }}>
              카테고리별 소비 점유율
            </ThemedText>

            {statsList.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                이번 달 지출 내역이 아직 없습니다.
              </ThemedText>
            ) : (
              statsList.map((item) => (
                <View key={item.category} style={styles.categoryRow}>
                  <View style={styles.categoryLabelRow}>
                    <ThemedText type="smallBold" style={{ flex: 1 }}>{item.category}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {item.percent}% ({item.amount.toLocaleString()}원)
                    </ThemedText>
                  </View>
                  <View style={[styles.barBackground, { backgroundColor: colors.backgroundSelected }]}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${item.percent}%`,
                          backgroundColor:
                            item.category === '식비' || item.category === '쇼핑'
                              ? '#F59E0B' // 황색 경고색
                              : '#3B82F6', // 일반 청색
                        },
                      ]}
                    />
                  </View>
                </View>
              ))
            )}
          </ThemedView>

          {/* ────────────────────────────────────────── */}
          {/* [2] 멘토의 훈수 카드 리스트 */}
          {/* ────────────────────────────────────────── */}
          <View style={styles.feedbackTitleRow}>
            <ThemedText type="smallBold">실시간 훈수 및 조언 ({feedbacks.length}건)</ThemedText>
          </View>

          {feedbacks.map((f) => {
            // 타입별 테두리 & 배경 컬러 선정
            let borderColor = '#3B82F6';
            let badgeBg = '#3B82F622';
            let titleColor: string = colors.text;

            if (f.type === 'danger') {
              borderColor = '#EF4444';
              badgeBg = '#EF444422';
              titleColor = '#EF4444';
            } else if (f.type === 'warning') {
              borderColor = '#F59E0B';
              badgeBg = '#F59E0B22';
              titleColor = '#F59E0B';
            } else if (f.type === 'success') {
              borderColor = '#10B981';
              badgeBg = '#10B98122';
              titleColor = '#10B981';
            }

            return (
              <ThemedView
                key={f.id}
                type="backgroundElement"
                style={[styles.feedbackCard, { borderLeftColor: borderColor }]}
              >
                <View style={[styles.feedbackBadge, { backgroundColor: badgeBg }]}>
                  <ThemedText type="code" style={{ color: titleColor, fontSize: 10, fontWeight: 'bold' }}>
                    {f.type === 'danger'
                      ? 'DANGER'
                      : f.type === 'warning'
                      ? 'WARNING'
                      : f.type === 'success'
                      ? 'SUCCESS'
                      : 'INFO'}
                  </ThemedText>
                </View>
                <ThemedText type="subtitle" style={[styles.feedbackTitle, { color: titleColor }]}>
                  {f.title}
                </ThemedText>
                <ThemedText type="small" style={styles.feedbackMsg}>
                  {f.message}
                </ThemedText>

                <View style={[styles.suggestionBox, { backgroundColor: colors.backgroundSelected }]}>
                  <ThemedText type="small" style={{ fontWeight: 'bold' }}>💡 개선 가이드:</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 2, fontSize: 12 }}>
                    {f.suggestion}
                  </ThemedText>
                </View>
              </ThemedView>
            );
          })}
        </ScrollView>

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
    gap: Spacing.four,
  },
  statsCard: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
  },
  totalExpenseText: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: Spacing.one,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB22',
    marginVertical: Spacing.three,
  },
  categoryRow: {
    marginBottom: Spacing.three,
  },
  categoryLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
  },
  barBackground: {
    height: 8,
    borderRadius: Spacing.one,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: Spacing.three,
  },
  feedbackTitleRow: {
    marginTop: Spacing.two,
  },
  feedbackCard: {
    borderRadius: Spacing.two,
    padding: Spacing.four,
    borderLeftWidth: 4,
    gap: Spacing.two,
  },
  feedbackBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.one,
  },
  feedbackTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  feedbackMsg: {
    lineHeight: 18,
  },
  suggestionBox: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginTop: Spacing.one,
  },
});
