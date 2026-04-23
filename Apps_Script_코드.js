// ================================================================
// 사업관리 앱 - Google Apps Script
// 구글 시트 ID: 1hd2oopC89u2a4sKOLNQ-EWQ6Gum6tBa1tfF6-R1jrgM
//
// [설치 방법]
// 1. 구글 시트 열기 → 상단 메뉴 "확장 프로그램" → "Apps Script"
// 2. 아래 코드 전체 붙여넣기 (기존 내용 삭제 후)
// 3. 저장(Ctrl+S) → "배포" 버튼 → "새 배포"
// 4. 유형: 웹 앱 / 액세스: 모든 사용자 → 배포
// 5. 배포된 URL을 복사해서 index.html의 APPS_SCRIPT_URL에 붙여넣기
// ================================================================

const SHEET_ID = '1hd2oopC89u2a4sKOLNQ-EWQ6Gum6tBa1tfF6-R1jrgM';

// 시트별 헤더 정의
const PROJECT_HEADERS = [
  'ID','사업구분','사업명','발주기관','시스템구분','사업유형','진행상태',
  '시작일','종료일','총사업비(VAT포함)','사업비(VAT제외)','청구방식',
  '직접비항목','담당PM','디자인','퍼블리싱','개발',
  '기관담당자','행정이벤트','비고','진행현황','등록일','수정일'
];

const MAINT_HEADERS = [
  'ID','사업구분','사업명','발주기관','시스템구분','사업유형','진행상태',
  '시작일','종료일','총사업비(VAT포함)','사업비(VAT제외)','청구방식',
  '직접비항목','담당PM','디자인','퍼블리싱','개발',
  '기관담당자','행정이벤트','비고','진행현황','등록일','수정일'
];

// ── 시트 초기화 (헤더 없으면 추가) ──────────────────────────────
function initSheet(sheetName, headers) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#7F77DD')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
  }
  return sheet;
}

// ── CORS 헤더 ──────────────────────────────────────────────────
function setCors(output) {
  return output
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET,POST')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function doOptions(e) {
  return setCors(ContentService.createTextOutput(''));
}

// ── GET: 데이터 불러오기 ────────────────────────────────────────
function doGet(e) {
  try {
    const type = e.parameter.type; // 'project' | 'maintenance' | 'all'
    const result = {};

    if (type === 'project' || type === 'all') {
      const sheet = initSheet('프로젝트', PROJECT_HEADERS);
      result.projects = sheetToJson(sheet);
    }
    if (type === 'maintenance' || type === 'all') {
      const sheet = initSheet('유지보수', MAINT_HEADERS);
      result.maintenance = sheetToJson(sheet);
    }

    return setCors(ContentService.createTextOutput(JSON.stringify({ ok: true, data: result })));
  } catch(err) {
    return setCors(ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message })));
  }
}

// ── POST: 데이터 저장/수정/삭제 ────────────────────────────────
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const { action, sheetType, data } = body;
    // sheetType: 'project' | 'maintenance'
    const sheetName = sheetType === 'project' ? '프로젝트' : '유지보수';
    const headers   = sheetType === 'project' ? PROJECT_HEADERS : MAINT_HEADERS;
    const sheet = initSheet(sheetName, headers);

    if (action === 'save') {
      // ID 있으면 수정, 없으면 추가
      if (data.ID) {
        updateRow(sheet, headers, data);
      } else {
        data.ID = Utilities.getUuid().split('-')[0]; // 짧은 ID
        data['등록일'] = new Date().toISOString().split('T')[0];
        data['수정일'] = data['등록일'];
        appendRow(sheet, headers, data);
      }
      return setCors(ContentService.createTextOutput(JSON.stringify({ ok: true, id: data.ID })));
    }

    if (action === 'delete') {
      deleteRow(sheet, data.ID);
      return setCors(ContentService.createTextOutput(JSON.stringify({ ok: true })));
    }

    return setCors(ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'unknown action' })));
  } catch(err) {
    return setCors(ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message })));
  }
}

// ── 유틸 함수 ──────────────────────────────────────────────────
function sheetToJson(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function appendRow(sheet, headers, data) {
  sheet.appendRow(headers.map(h => data[h] !== undefined ? data[h] : ''));
}

function updateRow(sheet, headers, data) {
  const idCol = 1; // ID는 1번 컬럼
  const lastRow = sheet.getLastRow();
  for (let r = 2; r <= lastRow; r++) {
    if (sheet.getRange(r, idCol).getValue() == data.ID) {
      data['수정일'] = new Date().toISOString().split('T')[0];
      headers.forEach((h, i) => {
        if (data[h] !== undefined) sheet.getRange(r, i + 1).setValue(data[h]);
      });
      return;
    }
  }
}

function deleteRow(sheet, id) {
  const lastRow = sheet.getLastRow();
  for (let r = lastRow; r >= 2; r--) {
    if (sheet.getRange(r, 1).getValue() == id) {
      sheet.deleteRow(r);
      return;
    }
  }
}
