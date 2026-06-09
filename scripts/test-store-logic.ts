import { useStackStore } from '../src/store/useStackStore';

// 테스트 결과 유틸
function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

console.log('🚀 StackUp Zustand Core 로직 단위 테스트를 시작합니다...\n');

// 1. 초기 상태 검증
const store = useStackStore.getState();
assert(store.transactions.length === 0, '최초 거래 내역은 비어 있어야 합니다.');
assert(store.towers.length === 0, '최초 스택 타워는 비어 있어야 합니다.');
assert(store.fixedSettings.length === 0, '최초 고정비 설정은 비어 있어야 합니다.');

// 2. 거래 내역 추가 및 이번 달 잔액 검증
// 시나리오: 2026-06 기준 수입 1,000,000원, 변동 지출 300,000원, 스택 100,000원 추가
store.addTransaction({
  type: 'income',
  amount: 1000000,
  category: '급여',
  storeName: '회사',
  date: '2026-06-01',
});

store.addTransaction({
  type: 'expense',
  amount: 300000,
  category: '식비',
  storeName: '맛있는식당',
  date: '2026-06-05',
});

store.addTransaction({
  type: 'stack',
  amount: 100000,
  category: '저금',
  date: '2026-06-10',
  goalId: 'dummy-tower-id',
});

let updatedStore = useStackStore.getState();
let sim = updatedStore.getMonthlySimulation('2026-06');

assert(sim.thisMonthIncome === 1000000, '이번 달 수입은 1,000,000원이어야 합니다.');
assert(sim.thisMonthVariableExpense === 300000, '이번 달 변동 지출은 300,000원이어야 합니다.');
assert(sim.thisMonthStack === 100000, '이번 달 스택액은 100,000원이어야 합니다.');
assert(sim.thisMonthRemaining === 600000, '이번 달 남은 금액은 600,000원이어야 합니다. (100만 - 30만 - 10만)');

// 3. 신용카드 지출 추가 및 다음 달 예상 잔액 예측 검증
// 시나리오: 2026-06에 신용카드로 200,000원 긁음.
// 이번 달 남은 금액은 그대로여야 하지만, 다음 달 예상 잔액 계산 시 이 200,000원이 대금으로 빠져나가야 함.
store.addTransaction({
  type: 'credit_card',
  amount: 200000,
  category: '쇼핑',
  storeName: '백화점',
  date: '2026-06-15',
});

updatedStore = useStackStore.getState();
sim = updatedStore.getMonthlySimulation('2026-06');

assert(sim.thisMonthRemaining === 600000, '신용카드 사용은 이번 달 남은 실물 잔액에 영향을 주지 않아야 합니다.');
assert(sim.nextMonthCreditCardBill === 200000, '이번 달 긁은 신용카드는 다음 달 청구서로 200,000원이 잡혀야 합니다.');

// 고정 수입 1,500,000원 / 고정 지출 400,000원이 활성화되어 있다고 치면
store.addFixedSetting({
  type: 'income',
  title: '월급',
  amount: 1500000,
  category: '급여',
  day: 10,
  isActive: true,
});

store.addFixedSetting({
  type: 'expense',
  title: '월세',
  amount: 400000,
  category: '주거',
  day: 25,
  isActive: true,
});

updatedStore = useStackStore.getState();
sim = updatedStore.getMonthlySimulation('2026-06');

// 다음 달 예상 잔액 = 다음 달 예상 수입(고정수입 150만) - 다음 달 고정지출(40만) - 이번달 신용카드대금(20만) - 예상스택(0) = 90만
assert(sim.nextMonthExpectedRemaining === 900000, `다음 달 예상 잔액은 900,000원이어야 합니다. 실제 계산값: ${sim.nextMonthExpectedRemaining}`);

// 4. 고정비 자동 생성 엔진 작동 검증
// 시나리오: lastProcessedFixedDate가 2026-06-01 이고 오늘이 2026-06-26 일 때,
// 10일 월급(수입)과 25일 월세(지출)가 자동으로 트랜잭션에 등록되어야 함.
const currentSettings = useStackStore.getState().fixedSettings;
useStackStore.getState().updateFixedSetting(currentSettings[0].id, { day: 10 });
useStackStore.getState().updateFixedSetting(currentSettings[1].id, { day: 25 });

// 처리 시점 설정
useStackStore.setState({ lastProcessedFixedDate: '2026-06-01' });

// 엔진 가동
store.processFixedSettings('2026-06-26');

updatedStore = useStackStore.getState();
const fixedTxs = updatedStore.transactions.filter(tx => tx.isFixed);

assert(fixedTxs.length === 2, `고정비 이체일에 맞추어 2개의 고정비 거래가 추가되어야 합니다. 실제 추가된 개수: ${fixedTxs.length}`);
assert(fixedTxs.some(tx => tx.amount === 1500000 && tx.date === '2026-06-10'), '10일에 1,500,000원 고정 수입이 자동 등록되어야 합니다.');
assert(fixedTxs.some(tx => tx.amount === 400000 && tx.date === '2026-06-25'), '25일에 400,000원 고정 지출이 자동 등록되어야 합니다.');

// 월말 예외 조건 테스트: 31일 고정비 설정이 2월 28일(마지막날)을 지날 때
store.addFixedSetting({
  type: 'expense',
  title: '말일공과금',
  amount: 50000,
  category: '공과금',
  day: 31, // 31일로 설정
  isActive: true,
});

useStackStore.setState({ lastProcessedFixedDate: '2026-02-27' });
store.processFixedSettings('2026-03-01'); // 2월 28일을 통과하게 함

updatedStore = useStackStore.getState();
const febEndTx = updatedStore.transactions.find(tx => tx.date === '2026-02-28' && tx.amount === 50000);
assert(!!febEndTx, '31일로 고정된 지출은 2월 28일(마지막날)에 생성되어야 합니다.');

// 5. 훈수 엔진 (멘토 피드백 룰) 검증
// 시나리오 1: 다음 달 예상 잔액이 빵구나는 상황 만들기
// 다음 달 예상 수입(150만) - 다음 달 고정비(45만) - 이번달 신용카드(130만) = -25만
store.addTransaction({
  type: 'credit_card',
  amount: 1100000, // 카드 추가로 긁음 (누적 130만)
  category: '쇼핑',
  date: '2026-06-20',
});

updatedStore = useStackStore.getState();
const feedbacks = updatedStore.getMentorFeedbacks('2026-06');

assert(feedbacks.some(f => f.id === 'rule-next-month-warning'), '다음 달 마이너스 예상 시 미래 차압 경고가 발생해야 합니다.');
assert(feedbacks.some(f => f.id === 'rule-credit-card-abuse'), '신용카드 지출 비율이 현금보다 클 때 카드 폭주 경고가 발생해야 합니다.');


// 6. 예적금 및 일정 로직 신규 검증
console.log('\n--- 6. 예적금 및 일정 신규 로직 테스트 시작 ---');

// Mock Data 로드 테스트
store.loadMockData();
updatedStore = useStackStore.getState();
assert(updatedStore.bankProducts.length === 2, 'loadMockData 후 예적금 상품은 2개여야 합니다.');
assert(updatedStore.schedules.length === 4, 'loadMockData 후 일정은 4개여야 합니다.');
assert(updatedStore.transactions.length > 10, 'loadMockData 후 거래 내역은 10개 이상 적재되어야 합니다.');

// 일정 추가 테스트
store.addSchedule({
  title: '생일 파티 약속',
  date: '2026-06-25',
  expectedAmount: 80000,
  payType: 'solo',
});
updatedStore = useStackStore.getState();
const addedSched = updatedStore.schedules.find(s => s.title === '생일 파티 약속');
assert(!!addedSched, '일정이 성공적으로 추가되어야 합니다.');
assert(addedSched?.isSettled === false, '추가된 일정은 초기 정산 여부가 false여야 합니다.');

// 일정 정산 테스트
const schedId = addedSched!.id;
store.settleSchedule(schedId, 75000); // 실제로는 75,000원 지출함
updatedStore = useStackStore.getState();

const settledSched = updatedStore.schedules.find(s => s.id === schedId);
assert(settledSched?.isSettled === true, '정산 완료 시 isSettled가 true여야 합니다.');
assert(settledSched?.actualAmount === 75000, '정산 완료 시 실제 소비 금액이 75,000원이어야 합니다.');

// 정산 후 Transaction 자동 기입 확인
const settleTx = updatedStore.transactions.find(tx => tx.storeName === '생일 파티 약속');
assert(!!settleTx, '정산 후 해당하는 지출 거래가 Transaction으로 기입되어야 합니다.');
assert(settleTx?.amount === 75000, '기입된 거래 금액은 실제 정산 금액 75,000원이어야 합니다.');
assert(settleTx?.date === '2026-06-25', '기입된 거래 날짜는 일정 날짜여야 합니다.');

// 예적금 CRUD 테스트
store.addBankProduct({
  type: 'deposit',
  bankName: '국민은행',
  title: 'KB 정기예금',
  amount: 5000000,
  interestRate: 3.8,
  maturityDate: '2027-06-09',
});
updatedStore = useStackStore.getState();
const kbProd = updatedStore.bankProducts.find(p => p.bankName === '국민은행');
assert(!!kbProd, '예적금 상품이 정상 등록되어야 합니다.');

store.updateBankProduct(kbProd!.id, { amount: 6000000 });
updatedStore = useStackStore.getState();
const updatedKb = updatedStore.bankProducts.find(p => p.id === kbProd!.id);
assert(updatedKb?.amount === 6000000, '예적금 상품의 금액 수정이 정상 적용되어야 합니다.');

store.deleteBankProduct(kbProd!.id);
updatedStore = useStackStore.getState();
assert(!updatedStore.bankProducts.some(p => p.id === kbProd!.id), '예적금 상품의 삭제가 정상 수행되어야 합니다.');

// --- 7. 예적금 자동화 엔진 & 중도해지 로직 검증 ---
console.log('\n--- 7. 예적금 자동화 엔진 & 중도해지 로직 테스트 시작 ---');

// [A] 적금 자동 납입 검증
// 시나리오: 15일 이체일인 적금을 등록하고, 지난 정산일이 14일, 오늘이 16일일 때, 15일에 자동으로 100,000원이 적금에 납입되어 잔액이 500,000원 -> 600,000원으로 늘어나고 가계부에 저축(saving) 거래가 기입되어야 함.
store.addBankProduct({
  type: 'savings',
  bankName: '우리은행',
  title: '우리 청년 적금',
  amount: 500000,
  interestRate: 4.0,
  maturityDate: '2026-12-15',
  monthlyPayment: 100000,
  paymentDay: 15,
});

updatedStore = useStackStore.getState();
const savingsProd = updatedStore.bankProducts.find(p => p.bankName === '우리은행');
assert(!!savingsProd, '적금 상품이 정상 등록되어야 합니다.');
assert(savingsProd?.status === 'active', '신규 적금의 기본 상태는 active 여야 합니다.');

// 처리 기준일 설정
useStackStore.setState({ lastProcessedFixedDate: '2026-06-14' });
// 엔진 가동 (6월 16일)
store.processFixedSettings('2026-06-16');

updatedStore = useStackStore.getState();
const processedSavings = updatedStore.bankProducts.find(p => p.id === savingsProd!.id);
assert(processedSavings?.amount === 600000, `적금 자동 납입 후 잔액이 600,000원이어야 합니다. 실제 잔액: ${processedSavings?.amount}`);

const savingsTx = updatedStore.transactions.find(tx => tx.fixedSettingId === `savings-pay-${savingsProd!.id}-2026-06-15`);
assert(!!savingsTx, '적금 자동 납입 시 가계부 거래 내역이 자동 생성되어야 합니다.');
assert(savingsTx?.type === 'saving', `생성된 가계부 거래 타입은 저축(saving)이어야 합니다. 실제 타입: ${savingsTx?.type}`);
assert(savingsTx?.amount === 100000, '가계부 거래 금액은 월 납입액 100,000원이어야 합니다.');

// 멱등성 검증: 동일 구간에 대해 한 번 더 돌려도 중복 기입 및 중복 잔액 증가가 없어야 함
store.processFixedSettings('2026-06-16');
updatedStore = useStackStore.getState();
const reProcessedSavings = updatedStore.bankProducts.find(p => p.id === savingsProd!.id);
assert(reProcessedSavings?.amount === 600000, '중복 처리 방지로 인해 적금 잔액이 추가로 늘어나지 않아야 합니다.');


// [B] 예적금 자동 만기 검증
// 시나리오: 2026-06-20 만기인 예금을 등록. 6월 21일에 엔진을 구동하면 20일 시점에 만기 처리되어 원금 1,000,000원 + 이자 35,000원(3.5%) = 1,035,000원이 가계부 수입(금융소득)으로 들어오고 status가 matured로 변경되어야 함.
store.addBankProduct({
  type: 'deposit',
  bankName: '농협은행',
  title: 'NH 정기예금',
  amount: 1000000,
  interestRate: 3.5,
  maturityDate: '2026-06-20',
});

updatedStore = useStackStore.getState();
const depositProd = updatedStore.bankProducts.find(p => p.bankName === '농협은행');
assert(!!depositProd, '예금 상품이 정상 등록되어야 합니다.');

const assetBeforeMaturity = updatedStore.totalAsset;

// 엔진 가동 (6월 21일)
store.processFixedSettings('2026-06-21');

updatedStore = useStackStore.getState();
const maturedProd = updatedStore.bankProducts.find(p => p.id === depositProd!.id);
assert(maturedProd?.status === 'matured', `만기 도달 시 status는 matured여야 합니다. 실제 상태: ${maturedProd?.status}`);
assert(maturedProd?.maturedDate === '2026-06-20', 'maturedDate가 만기일인 2026-06-20으로 세팅되어야 합니다.');
assert(maturedProd?.finalReceivedAmount === 1035000, `최종 수령 금액은 이자가 포함된 1,035,000원이어야 합니다. 실제 수령액: ${maturedProd?.finalReceivedAmount}`);

const maturityTx = updatedStore.transactions.find(tx => tx.fixedSettingId === `bank-mat-${depositProd!.id}`);
assert(!!maturityTx, '만기 수령 가계부 거래 내역이 생성되어야 합니다.');
assert(maturityTx?.type === 'income', '만기 수령 거래 타입은 수입(income)이어야 합니다.');
assert(maturityTx?.amount === 1035000, '수령 기입된 수입 금액은 1,035,000원이어야 합니다.');

// 자산 총액 반영 검증
const expectedAsset = assetBeforeMaturity + 1035000;
assert(updatedStore.totalAsset === expectedAsset, `만기 금액 수령 후 총 자산이 반영되어야 합니다. 예상: ${expectedAsset}, 실제: ${updatedStore.totalAsset}`);


// [C] 적금 수동 중도해지 검증
// 시나리오: 적금을 신규 등록하고, 바로 수동으로 중도해지 액션을 수행하여 원금 및 중도해지 이자 수입을 회수함.
store.addBankProduct({
  type: 'savings',
  bankName: '하나은행',
  title: '하나 청년 비상금 적금',
  amount: 300000,
  interestRate: 5.0,
  maturityDate: '2027-06-09',
  monthlyPayment: 50000,
  paymentDay: 5,
});

updatedStore = useStackStore.getState();
const termProd = updatedStore.bankProducts.find(p => p.bankName === '하나은행');
assert(!!termProd, '중도해지용 적금 상품이 등록되어야 합니다.');

const assetBeforeTerm = updatedStore.totalAsset;

// 실제 중도해지 실행 (원금 30만 + 중도해지 이자 1,000원 = 301,000원 수령)
store.terminateBankProduct(termProd!.id, 301000);

updatedStore = useStackStore.getState();
const terminatedProd = updatedStore.bankProducts.find(p => p.id === termProd!.id);
assert(terminatedProd?.status === 'terminated', `중도해지 후 status는 terminated여야 합니다. 실제 상태: ${terminatedProd?.status}`);
assert(terminatedProd?.finalReceivedAmount === 301000, '최종 해지 수령액은 301,000원이어야 합니다.');

const termTx = updatedStore.transactions.find(tx => tx.storeName === '하나은행 하나 청년 비상금 적금' && tx.amount === 301000);
assert(!!termTx, '중도해지 수령 가계부 수입 거래가 등록되어야 합니다.');
assert(termTx?.type === 'income', '중도해지 수령 거래 타입은 수입(income)이어야 합니다.');
assert(updatedStore.totalAsset === assetBeforeTerm + 301000, '중도해지 수령액이 총 자산에 합산되어야 합니다.');


console.log('\n⭐ 모든 단위 테스트 시나리오가 성공적으로 통과되었습니다! ⭐');

