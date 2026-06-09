import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  useColorScheme,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStackStore } from '@/store/useStackStore';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing, MaxContentWidth, BottomTabInset } from '@/constants/theme';
import { StackTower } from '@/types';

export default function TowersScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  // Zustand Store
  const { towers, transactions, addTower, deleteTower, updateTower } = useStackStore();

  // UI 상태
  const [modalVisible, setModalVisible] = useState(false);
  const [towerTitle, setTowerTitle] = useState('');
  const [towerTarget, setTowerTarget] = useState('');
  const [towerEndDate, setTowerEndDate] = useState('');

  // 특정 타워의 실시간 누적 스택액(저금액) 계산
  const getTowerCurrentAmount = (towerId: string) => {
    return transactions
      .filter((tx) => tx.type === 'stack' && tx.goalId === towerId)
      .reduce((sum, tx) => sum + tx.amount, 0);
  };

  // 타워별 남은 기한 및 월 필수 스택 가이드 계산
  const getTowerStats = (tower: StackTower) => {
    const currentAmount = getTowerCurrentAmount(tower.id);
    const now = new Date();
    const end = new Date(tower.endDate);
    
    // 남은 개월 수 계산 (최소 1개월로 보정하여 나누기 0 오류 방지)
    const diffMonths = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
    const remainingToCollect = tower.targetAmount - currentAmount;
    
    let monthlyRequired = 0;
    if (remainingToCollect > 0) {
      if (diffMonths <= 0) {
        monthlyRequired = remainingToCollect;
      } else {
        monthlyRequired = Math.ceil(remainingToCollect / diffMonths);
      }
    }

    const progressPercent = Math.min(Math.round((currentAmount / tower.targetAmount) * 100), 100);

    return {
      currentAmount,
      remainingToCollect: Math.max(remainingToCollect, 0),
      diffMonths: Math.max(diffMonths, 0),
      monthlyRequired,
      progressPercent,
    };
  };

  // 새로운 타워 건설 핸들러
  const handleCreateTower = () => {
    const amountNum = parseInt(towerTarget.replace(/,/g, ''), 10);
    if (!towerTitle.trim()) {
      Alert.alert('알림', '타워의 이름을 입력해주세요.');
      return;
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('알림', '목표 금액을 올바르게 입력해주세요.');
      return;
    }
    
    // 간단한 날짜 YYYY-MM-DD 포맷 검증
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(towerEndDate)) {
      Alert.alert('알림', '목표일자를 YYYY-MM-DD 형식으로 입력해주세요. (예: 2027-12-31)');
      return;
    }

    const now = new Date();
    const startDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    addTower({
      title: towerTitle.trim(),
      targetAmount: amountNum,
      startDate: startDateStr,
      endDate: towerEndDate,
    });

    // 폼 초기화 및 닫기
    setTowerTitle('');
    setTowerTarget('');
    setTowerEndDate('');
    setModalVisible(false);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        
        {/* 헤더 */}
        <View style={styles.header}>
          <ThemedText type="subtitle">🏗️ 스택 타워</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            목표를 설정하고 스택을 쌓아올리는 건설 보드
          </ThemedText>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* 건설하기 상단 배너 버튼 */}
          <Pressable
            onPress={() => {
              // 오늘 날짜로부터 1년 뒤를 기본 마감일로 제안
              const future = new Date();
              future.setFullYear(future.getFullYear() + 1);
              const m = String(future.getMonth() + 1).padStart(2, '0');
              const d = String(future.getDate()).padStart(2, '0');
              setTowerEndDate(`${future.getFullYear()}-${m}-${d}`);
              setModalVisible(true);
            }}
            style={[styles.createBanner, { backgroundColor: colors.text }]}
          >
            <ThemedText type="smallBold" style={{ color: colors.background }}>
              + 새로운 스택 타워 건설하기 (목표 추가)
            </ThemedText>
          </Pressable>

          {towers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <ThemedText type="subtitle" style={styles.emptyIcon}>🏗️</ThemedText>
              <ThemedText type="smallBold" themeColor="textSecondary">
                아직 건설된 타워가 없습니다.
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptySubText}>
                새로운 타워를 지어 미래의 목표(여행, IT 기기, 비상금 등)를 하나씩 정하고 스택을 채워보세요!
              </ThemedText>
            </View>
          ) : (
            towers.map((tower) => {
              const stats = getTowerStats(tower);
              const isCompleted = stats.progressPercent >= 100 || tower.isCompleted;

              // 타워 완료 시 자동 트리거 (한 번만 적용되게 상태 체크 후 갱신)
              if (isCompleted && !tower.isCompleted) {
                updateTower(tower.id, { isCompleted: true });
              } else if (!isCompleted && tower.isCompleted) {
                updateTower(tower.id, { isCompleted: false });
              }

              return (
                <ThemedView key={tower.id} type="backgroundElement" style={styles.towerCard}>
                  
                  {/* 타워 헤더 */}
                  <View style={styles.towerHeaderRow}>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="subtitle">🏗️ {tower.title}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        기한: {tower.startDate} ~ {tower.endDate} ({stats.diffMonths}개월 남음)
                      </ThemedText>
                    </View>
                    {isCompleted ? (
                      <View style={styles.completeBadge}>
                        <ThemedText type="code" style={{ color: '#fff', fontSize: 11 }}>
                           완공
                        </ThemedText>
                      </View>
                    ) : (
                      <View style={styles.progressBadge}>
                        <ThemedText type="code" style={{ color: colors.text, fontSize: 11 }}>
                          진행 중
                        </ThemedText>
                      </View>
                    )}
                  </View>

                  {/* 타워 빌딩 그래픽 블록 (시각 효과) */}
                  <View style={styles.buildingVisualContainer}>
                    <View style={[styles.visualBackground, { backgroundColor: colors.backgroundSelected }]}>
                      {/* 진행도에 따라 쌓이는 블록 탑 */}
                      <View
                        style={[
                          styles.visualActiveFill,
                          {
                            height: `${stats.progressPercent}%`,
                            backgroundColor: isCompleted ? '#10B981' : '#3B82F6',
                          },
                        ]}
                      />
                      <ThemedText type="code" style={styles.visualText}>
                        {stats.progressPercent}%
                      </ThemedText>
                    </View>
                  </View>

                  {/* 스택 현황 세부 정보 */}
                  <View style={styles.statsRow}>
                    <View>
                      <ThemedText type="small" themeColor="textSecondary">현재 쌓은 스택</ThemedText>
                      <ThemedText type="smallBold">{stats.currentAmount.toLocaleString()}원</ThemedText>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <ThemedText type="small" themeColor="textSecondary">목표 스택</ThemedText>
                      <ThemedText type="smallBold">{tower.targetAmount.toLocaleString()}원</ThemedText>
                    </View>
                  </View>

                  {/* 월 필수 스택 가이드 (완료 시 비노출) */}
                  {!isCompleted && (
                    <View style={[styles.guideBox, { backgroundColor: colors.backgroundSelected }]}>
                      <ThemedText type="smallBold" style={{ color: colors.text }}>
                        💡 이번 달 권장 스택: {stats.monthlyRequired.toLocaleString()}원
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, marginTop: 4 }}>
                        목표 기한 안에 완공하려면 매달 이만큼씩 저축(스택)해야 합니다.
                      </ThemedText>
                    </View>
                  )}

                  {/* 타워 해체(삭제) */}
                  <View style={styles.actionsRow}>
                    <Pressable
                      onPress={() => {
                        Alert.alert(
                          '타워 해체 경고',
                          `'${tower.title}' 타워를 해체하시겠습니까? 관련 적립 스택 내역이 전부 영구 삭제됩니다.`,
                          [
                            { text: '취소', style: 'cancel' },
                            {
                              text: '해체',
                              style: 'destructive',
                              onPress: () => deleteTower(tower.id),
                            },
                          ]
                        );
                      }}
                      style={styles.deleteButton}
                    >
                      <ThemedText type="code" style={{ color: '#EF4444' }}>타워 해체</ThemedText>
                    </Pressable>
                  </View>

                </ThemedView>
              );
            })
          )}
        </ScrollView>

        {/* ────────────────────────────────────────── */}
        {/* 새로운 타워 건설 모달 */}
        {/* ────────────────────────────────────────── */}
        <Modal visible={modalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <ThemedView type="backgroundElement" style={styles.modalContent}>
              <ThemedText type="subtitle" style={styles.modalTitle}>🏗️ 새로운 스택 타워 건설</ThemedText>

              {/* 타워명 */}
              <TextInput
                placeholder="목표 타워 이름 (예: 맥북 프로, 여름 휴가, 비상금)"
                placeholderTextColor={colors.textSecondary}
                value={towerTitle}
                onChangeText={setTowerTitle}
                style={[styles.inputField, { borderColor: colors.backgroundSelected, color: colors.text }]}
              />

              {/* 목표 금액 */}
              <TextInput
                placeholder="목표 금액 입력 (원)"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                value={towerTarget}
                onChangeText={(val) => setTowerTarget(val.replace(/[^0-9]/g, ''))}
                style={[styles.inputField, { borderColor: colors.backgroundSelected, color: colors.text }]}
              />

              {/* 목표 일자 */}
              <TextInput
                placeholder="완공 목표일 입력 (YYYY-MM-DD)"
                placeholderTextColor={colors.textSecondary}
                value={towerEndDate}
                onChangeText={setTowerEndDate}
                style={[styles.inputField, { borderColor: colors.backgroundSelected, color: colors.text }]}
              />
              <ThemedText type="small" themeColor="textSecondary" style={styles.helperText}>
                예시: 2027-12-31 (YYYY-MM-DD 형식 엄수)
              </ThemedText>

              {/* 버튼 행 */}
              <View style={[styles.buttonRow, { marginTop: Spacing.four }]}>
                <Pressable
                  onPress={() => setModalVisible(false)}
                  style={[styles.modalActionButton, { backgroundColor: '#EF4444' }]}
                >
                  <ThemedText type="smallBold" style={{ color: '#fff' }}>취소</ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleCreateTower}
                  style={[styles.modalActionButton, { backgroundColor: '#10B981' }]}
                >
                  <ThemedText type="smallBold" style={{ color: '#fff' }}>건설 시작</ThemedText>
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
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  createBanner: {
    height: 48,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  emptyContainer: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: Spacing.two,
  },
  emptySubText: {
    textAlign: 'center',
    paddingHorizontal: Spacing.five,
    lineHeight: 18,
  },
  towerCard: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  towerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  completeBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.one,
  },
  progressBadge: {
    backgroundColor: '#E5E7EB22',
    borderColor: '#E5E7EB44',
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.one,
  },
  buildingVisualContainer: {
    height: 120,
    borderRadius: Spacing.two,
    overflow: 'hidden',
  },
  visualBackground: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
  },
  visualActiveFill: {
    width: '100%',
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
  visualText: {
    zIndex: 10,
    marginBottom: Spacing.two,
    fontWeight: 'bold',
    fontSize: 16,
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
  },
  guideBox: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  deleteButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
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
  helperText: {
    fontSize: 11,
    marginTop: -Spacing.one,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.one,
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
});
