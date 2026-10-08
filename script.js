// =============================================
// script.js — 바이브 카페 주문서 기능 코드 (탭 + 주문 내역 포함)
// =============================================


// =============================================
// 0. Supabase 설정
// =============================================
// Supabase는 구글의 Firebase와 비슷한 클라우드 데이터베이스 서비스입니다
// 아래 두 값은 Supabase 프로젝트 대시보드 → Settings → API에서 확인할 수 있습니다

// 프로젝트 URL (예: https://abcdefg.supabase.co)
const SUPABASE_URL = '여기에_본인_URL_입력';

// anon/public 키 (길고 복잡한 문자열입니다 — 공개용 키라 외부에 노출되어도 괜찮습니다)
const SUPABASE_KEY = '여기에_본인_ANON_KEY_입력';

// Supabase 클라이언트 생성
// CDN으로 불러온 라이브러리가 window.supabase 객체를 제공합니다
// .createClient(url, key) 를 호출하면 DB와 연결된 클라이언트 객체가 만들어집니다
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


// =============================================
// 1. HTML 요소 미리 가져오기
// =============================================

const drinkSelect   = document.getElementById('drink');
const sizeRadios    = document.querySelectorAll('input[name="size"]');
const optionChecks  = document.querySelectorAll('input[name="options"]');
const quantityInput = document.getElementById('quantity');
const estimatedEl   = document.getElementById('estimated-price');
const nameInput     = document.getElementById('name');
const nameError     = document.getElementById('name-error');
const orderConfirm  = document.getElementById('order-confirm');
const form          = document.getElementById('order-form');
const btnReset      = document.getElementById('btn-reset');
const btnClearAll   = document.getElementById('btn-clear-all');
const ordersList    = document.getElementById('orders-list');    // 주문 카드 목록 영역
const ordersSummary = document.getElementById('orders-summary'); // 요약 영역
const ordersTotalText = document.getElementById('orders-total-text'); // 총 금액 텍스트
const orderBadge    = document.getElementById('order-badge');    // 탭 배지


// =============================================
// 2. 주문 데이터 저장소
// =============================================
// orders: 접수된 주문들을 저장하는 배열입니다
// 배열 안에는 주문 1건을 나타내는 객체(object)가 들어갑니다
// 예: [ { no: 1, name: '홍길동', drink: '카페라떼', ... }, ... ]
let orders = [];

// orderCount: 주문 번호를 순서대로 매기기 위한 카운터입니다
// 주문이 취소돼도 번호는 다시 쓰지 않습니다 (1, 2, 3, ... 계속 증가)
let orderCount = 0;


// =============================================
// 3. calculateTotal() — 예상 금액 계산 함수
// =============================================
// 이벤트 연결과 주문 처리 양쪽에서 이 함수를 재사용합니다

function calculateTotal() {

  // 음료 가격: 선택된 option의 data-price 속성을 숫자로 변환
  const drinkPrice = Number(drinkSelect.selectedOptions[0].getAttribute('data-price'));

  // 사이즈 추가 금액: 선택된 라디오 버튼의 data-price
  const checkedSize = Array.from(sizeRadios).find(function(r) { return r.checked; });
  const sizePrice   = checkedSize ? Number(checkedSize.getAttribute('data-price')) : 0;

  // 추가 옵션 합산: 체크된 항목의 data-price를 모두 더함
  const optionPrice = Array.from(optionChecks).reduce(function(sum, cb) {
    return cb.checked ? sum + Number(cb.getAttribute('data-price')) : sum;
  }, 0);

  // 수량
  const qty   = parseInt(quantityInput.value) || 1;

  // 최종 금액 = (음료 + 사이즈 + 옵션) × 수량
  const total = (drinkPrice + sizePrice + optionPrice) * qty;

  // 화면에 표시 (toLocaleString: 천 단위 콤마)
  estimatedEl.textContent = total.toLocaleString() + '원';

  return total; // 주문 처리에서도 사용하기 위해 반환
}


// =============================================
// 4. 실시간 금액 계산 — 이벤트 연결
// =============================================
drinkSelect.addEventListener('change', calculateTotal);
quantityInput.addEventListener('input', calculateTotal);
sizeRadios.forEach(function(r)  { r.addEventListener('change', calculateTotal); });
optionChecks.forEach(function(c){ c.addEventListener('change', calculateTotal); });


// =============================================
// 5. switchTab() — 탭 전환 함수
// =============================================
// 클릭된 탭을 활성화하고 나머지 탭의 패널을 숨깁니다

function switchTab(tabName) {
  // tabName: 'order' 또는 'history'

  // --- 탭 버튼 active 상태 변경 ---
  // querySelectorAll로 탭 버튼 2개를 모두 가져와서
  // 모두 active를 제거한 뒤, 클릭된 버튼에만 추가합니다
  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.classList.remove('active');
  });
  document.getElementById('tab-btn-' + tabName).classList.add('active');
  // 예: tabName이 'history'면 id="tab-btn-history" 버튼에 active 추가

  // --- 탭 패널 보이기/숨기기 ---
  // tab-order와 tab-history 중 선택된 것만 보입니다
  document.getElementById('tab-order').classList.add('hidden');
  document.getElementById('tab-history').classList.add('hidden');
  document.getElementById('tab-' + tabName).classList.remove('hidden');
}


// =============================================
// 6. renderOrders() — 주문 내역 화면 그리기 함수
// =============================================
// orders 배열을 읽어서 카드 목록을 화면에 그립니다
// 주문 추가/취소/전체 삭제 후 항상 이 함수를 호출합니다

function renderOrders() {

  // --- 배지 업데이트 ---
  // 주문 건수를 탭 배지에 표시합니다
  const count = orders.length;
  orderBadge.textContent = count;

  if (count === 0) {
    // 배지 숨기기
    orderBadge.classList.add('hidden');
  } else {
    // 배지 보이기
    orderBadge.classList.remove('hidden');
  }

  // --- 주문 내역이 없을 때 안내 메시지 ---
  if (count === 0) {
    ordersList.innerHTML = ''; // 기존 카드 모두 제거

    // 빈 상태 안내 문구를 만듭니다
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'orders-empty';
    emptyMsg.textContent = '아직 주문 내역이 없어요 ☕';
    // textContent: 사용자 입력이 아니라 고정 문자열이지만 습관적으로 textContent 사용
    ordersList.appendChild(emptyMsg);

    // 요약 영역 숨기기
    ordersSummary.classList.add('hidden');
    return; // 더 이상 실행할 게 없으므로 함수 종료
  }

  // --- 주문 카드 목록 그리기 ---
  ordersList.innerHTML = ''; // 이전에 그려진 카드를 모두 지우고 다시 그립니다

  // 최신 주문이 맨 위에 오도록 배열을 뒤집어서 순회합니다
  // slice(): 원본 배열을 건드리지 않고 복사본을 만듭니다
  // reverse(): 배열 순서를 뒤집습니다 (원본 reverse는 원본을 바꾸므로 slice 먼저!)
  const reversed = orders.slice().reverse();

  reversed.forEach(function(order) {
    // ----- 카드 바깥 div -----
    const card = document.createElement('div');
    // createElement: 새 HTML 요소를 만듭니다 (아직 화면에는 없음)
    card.className = 'order-card';

    // ----- 카드 헤더 (1줄): "#번호 이름님 · 금액" + 취소 버튼 -----
    const cardHeader = document.createElement('div');
    cardHeader.className = 'order-card-header';

    // 제목 텍스트
    const titleEl = document.createElement('span');
    titleEl.className = 'order-title';
    // textContent: 손님이 입력한 이름이 포함되므로 반드시 textContent 사용
    // innerHTML을 쓰면 '<script>...' 같은 악성 코드가 실행될 수 있습니다
    titleEl.textContent = '#' + order.no + ' ' + order.name + '님 · ' + order.total.toLocaleString() + '원';

    // 취소 버튼
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel-btn';
    cancelBtn.textContent = '취소';
    // 클릭 이벤트: 이 주문의 번호(order.no)를 cancelOrder 함수에 전달
    cancelBtn.addEventListener('click', function() {
      cancelOrder(order.no);
    });

    cardHeader.appendChild(titleEl);   // 제목을 헤더에 추가
    cardHeader.appendChild(cancelBtn); // 취소 버튼을 헤더에 추가

    // ----- 주문 상세 (2줄): "음료 사이즈 (옵션) N잔" -----
    const detailEl = document.createElement('p');
    detailEl.className = 'order-detail';

    let detailText = order.drink + ' ' + order.size + '사이즈';
    if (order.options.length > 0) {
      // 옵션이 있으면 괄호 안에 표시
      detailText += ' (' + order.options.join(', ') + ')';
    }
    detailText += ' ' + order.qty + '잔';
    detailEl.textContent = detailText; // 사용자 입력 포함 → textContent 사용

    // ----- 메타 정보 (3줄): 요청사항 · 주문 시간 -----
    const metaEl = document.createElement('p');
    metaEl.className = 'order-meta';

    let metaText = '';
    if (order.request) {
      // 요청사항이 있을 때만 앞에 붙입니다
      metaText += '📝 ' + order.request + ' · ';
    }
    metaText += order.time;
    metaEl.textContent = metaText; // 요청사항은 사용자 입력 → textContent 사용

    // ----- 카드에 자식 요소들 추가 -----
    card.appendChild(cardHeader);
    card.appendChild(detailEl);
    card.appendChild(metaEl);

    // ----- 카드를 목록에 추가 -----
    ordersList.appendChild(card);
  });

  // --- 요약 영역 업데이트 ---
  const grandTotal = orders.reduce(function(sum, o) {
    return sum + o.total;
  }, 0);
  // 모든 주문의 금액을 합산합니다

  // 요약 텍스트 (사용자 입력 없음 → textContent로도 충분)
  ordersTotalText.textContent =
    '총 주문 금액: ' + grandTotal.toLocaleString() + '원 (' + count + '건)';

  ordersSummary.classList.remove('hidden'); // 요약 영역 보이기
}


// =============================================
// 7. cancelOrder() — 주문 1건 취소 함수
// =============================================

function cancelOrder(orderNo) {
  // confirm(): 확인/취소 버튼이 있는 대화상자를 띄웁니다
  // 확인 → true, 취소 → false
  const confirmed = confirm('#' + orderNo + ' 주문을 취소할까요?');
  if (!confirmed) return; // 취소를 누르면 아무것도 하지 않음

  // orders 배열에서 해당 주문번호의 항목을 제거합니다
  // filter(): 조건에 맞는 요소만 남긴 새 배열을 반환합니다
  // order.no !== orderNo: 취소하려는 번호(orderNo)와 다른 것들만 남깁니다
  orders = orders.filter(function(order) {
    return order.no !== orderNo;
  });

  renderOrders(); // 화면을 다시 그립니다
}


// =============================================
// 8. 주문하기 버튼 — 폼 제출 처리 (Supabase 저장 포함)
// =============================================
// async function: 비동기 함수입니다
// 비동기란 "시간이 걸리는 작업(DB 저장 등)을 기다리는 동안 다른 일을 막지 않는 방식"입니다
// await: 비동기 작업이 끝날 때까지 이 줄에서 기다립니다

form.addEventListener('submit', async function(event) {
  event.preventDefault(); // 페이지 새로고침 방지

  // ----- 이름 검사 -----
  const nameValue = nameInput.value.trim();
  if (nameValue === '') {
    alert('이름을 입력해주세요.');
    nameInput.focus();
    return;
  }

  // ----- 음료 선택 검사 -----
  if (drinkSelect.value === '') {
    alert('음료를 선택해주세요.');
    drinkSelect.focus();
    return;
  }

  // ----- 주문 정보 수집 -----

  // 음료 이름: "카페라떼 4,000원" → 공백으로 쪼개서 첫 단어만
  const drinkName = drinkSelect.selectedOptions[0].text.split(' ')[0];

  // 음료 단가: 선택된 option의 data-price 값 (수량 곱하기 전 1잔 가격)
  const drinkPrice = Number(drinkSelect.selectedOptions[0].getAttribute('data-price'));

  // 사이즈 값: "S", "M", "L" 중 선택된 것
  const selectedSize = Array.from(sizeRadios).find(function(r) {
    return r.checked;
  }).value;

  // 선택된 추가 옵션 이름 목록 (배열)
  const selectedOptions = Array.from(optionChecks)
    .filter(function(cb) { return cb.checked; })
    .map(function(cb) {
      const lbl = document.querySelector('label[for="' + cb.id + '"]');
      const parts = lbl.textContent.trim().split(/\s+/);
      return parts[0] + (parts[1] ? ' ' + parts[1] : '');
    });

  const qty     = parseInt(quantityInput.value) || 1;
  const request = document.getElementById('request').value.trim();
  const total   = calculateTotal(); // 금액 계산 함수 재사용

  // 주문 시간: 현재 시각을 "HH:MM" 형태로 만듭니다
  const now = new Date();
  const timeStr =
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0');

  // ----- 주문하기 버튼 비활성화 -----
  // Supabase에 저장하는 동안 버튼을 비활성화해서 중복 클릭을 막습니다
  const btnSubmit = document.getElementById('btn-submit');
  btnSubmit.disabled = true;
  // disabled = true: 버튼을 클릭할 수 없는 상태로 만듭니다
  btnSubmit.textContent = '저장 중...';
  // 버튼 텍스트를 바꿔서 사용자에게 진행 중임을 알립니다

  // ----- Supabase에 주문 저장 -----
  // supabaseClient.from('테이블이름') : 저장할 테이블을 지정합니다
  // .insert([{ 열이름: 값, ... }]) : 새 행(row)을 삽입합니다
  //   배열 안에 객체를 넣습니다. 열 이름은 Supabase 테이블 열 이름과 정확히 일치해야 합니다
  // await: 저장이 완료될 때까지 기다립니다 (성공 또는 실패 결과를 받을 때까지)
  const { error } = await supabaseClient
    .from('cafe_menu03')
    .insert([{
      customer_name: nameValue,         // 손님 이름
      phone:         document.getElementById('phone').value.trim(), // 전화번호
      drink:         drinkName,         // 음료 이름 (예: '카페라떼')
      drink_price:   drinkPrice,        // 음료 단가 (1잔 기준, 옵션/사이즈 제외)
      size:          selectedSize,      // 사이즈 ('S', 'M', 'L')
      options:       selectedOptions,   // 추가 옵션 배열 (예: ['샷 추가', '크림 추가'])
      quantity:      qty,               // 수량
      request:       request || null,   // 요청사항 (없으면 null로 저장)
      total_price:   total              // 최종 금액 (옵션·사이즈·수량 모두 반영)
    }]);
  // 구조 분해 할당: const { error } = 결과객체
  //   Supabase insert는 { data, error } 형태의 객체를 반환합니다
  //   error가 null이면 성공, 값이 있으면 실패입니다

  // ----- 버튼 원상복구 -----
  // 성공·실패에 관계없이 항상 버튼을 다시 활성화합니다
  btnSubmit.disabled = false;
  btnSubmit.textContent = '주문하기';

  // ----- 저장 실패 처리 -----
  if (error) {
    // 콘솔에 상세 에러 내용을 출력합니다 (개발자 도구 F12 → Console에서 확인)
    console.error('Supabase 저장 실패:', error);
    // alert: 사용자에게 실패를 알립니다
    alert('주문 저장에 실패했어요. 잠시 후 다시 시도해주세요.');
    return; // 저장 실패 시 아래 성공 처리를 실행하지 않고 종료합니다
  }

  // ----- 저장 성공: orders 배열에도 저장 (화면 내역 표시용) -----
  orderCount++;

  orders.push({
    no:      orderCount,
    name:    nameValue,
    drink:   drinkName,
    size:    selectedSize,
    options: selectedOptions,
    qty:     qty,
    request: request,
    total:   total,
    time:    timeStr
  });

  renderOrders(); // 주문 내역 탭 화면 업데이트

  // ----- 주문 확인 메시지 표시 -----
  let optionText = '';
  if (selectedOptions.length > 0) {
    optionText = ' (' + selectedOptions.join(', ') + ')';
  }

  orderConfirm.textContent =
    nameValue + '님, ' +
    drinkName + ' ' + selectedSize + '사이즈' +
    optionText + ' ' +
    qty + '잔, 총 ' +
    total.toLocaleString() + '원 주문이 접수되었습니다!';

  orderConfirm.removeAttribute('hidden');
  orderConfirm.scrollIntoView({ behavior: 'smooth', block: 'center' });
});


// =============================================
// 9. 다시 작성 버튼 — 주문서만 초기화
// =============================================
// 주문 내역(orders 배열)은 건드리지 않습니다

btnReset.addEventListener('click', function() {
  form.reset();
  // form.reset(): 폼의 모든 입력을 HTML 기본값으로 되돌립니다
  // → 사이즈: M(checked 속성), 수량: 1(value="1"), 음료: 첫 항목

  estimatedEl.textContent = '0원';

  orderConfirm.setAttribute('hidden', '');
  orderConfirm.textContent = '';

  window.scrollTo({ top: 0, behavior: 'smooth' });
});


// =============================================
// 10. 내역 모두 지우기 버튼
// =============================================

btnClearAll.addEventListener('click', function() {
  const confirmed = confirm('주문 내역을 모두 지울까요?');
  if (!confirmed) return;

  orders = []; // 배열을 빈 배열로 초기화 (전체 삭제)
  renderOrders(); // 화면 업데이트
});


// =============================================
// 11. 페이지 처음 로드 시 초기화
// =============================================

document.addEventListener('DOMContentLoaded', function() {
  calculateTotal(); // 예상 금액 초기 표시 (M 사이즈 기본 선택 상태)
  renderOrders();   // 주문 내역 초기 상태 표시 (빈 화면)
});
