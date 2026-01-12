const API_URL = "https://spla3.yuu26.com/api/schedule";

// 時間整形
function formatTime(timeStr) {
    const date = new Date(timeStr);
    return date.getHours().toString().padStart(2, '0') + ":" + 
           date.getMinutes().toString().padStart(2, '0');
}

// ステージリスト生成
function createStageList(dataList) {
    if (!dataList || dataList.length === 0) return "情報がありません";
    return dataList.slice(0, 2).map(item => {
        const start = formatTime(item.start_time);
        const end = formatTime(item.end_time);
        let stageText = "???";
        if (item.stages && item.stages.length > 0) {
            stageText = item.stages.map(s => s.name).join(" / ");
        }
        const ruleName = item.rule ? `<span style="font-size:0.8em; color:#888; margin-right:5px;">[${item.rule.name}]</span><br>` : "";
        return `
            <div class="schedule-item">
                <span class="time">${start} - ${end}</span>
                <div class="stages">${ruleName}${stageText}</div>
            </div>
        `;
    }).join("");
}

// APIデータ取得
async function fetchData() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        const result = data.result;
        document.getElementById("x-match-content").innerHTML = createStageList(result.x);
        document.getElementById("bankara-open-content").innerHTML = createStageList(result.bankara_open);
    } catch (error) {
        console.error("Error:", error);
        document.querySelectorAll(".content").forEach(el => {
            if(!el.querySelector('input')) el.innerHTML = '<p class="error">データの読み込みに失敗しました。</p>';
        });
    }
}

// --- 勝率管理機能（強化版） ---

const STORAGE_KEY = 'spla3_battle_records';

// 日本語名から武器データを検索するヘルパー関数
function findWeaponData(japaneseName) {
    if (typeof WEAPON_DB === 'undefined') return null;
    return WEAPON_DB.find(w => w.name.ja_JP === japaneseName);
}

// ページ読み込み時に実行すること
document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    initWeaponList(); // 入力補完リストを作る
    updateStatsDisplay(); // 統計を表示する
});

// 入力補完リスト（datalist）をJSONから自動生成
function initWeaponList() {
    if (typeof WEAPON_DB === 'undefined') return;
    
    const datalist = document.getElementById('weapon-list');
    WEAPON_DB.forEach(weapon => {
        const option = document.createElement('option');
        option.value = weapon.name.ja_JP; // 日本語名を設定
        datalist.appendChild(option);
    });
}

function loadRecords() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function saveRecords(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function addRecord(isWin) {
    const input = document.getElementById('weapon-input');
    const weaponName = input.value.trim();

    // 入力チェック：JSONにある正しい名前か確認する
    const weaponData = findWeaponData(weaponName);
    if (!weaponData) {
        alert("正しいブキ名をリストから選択してください");
        return;
    }

    const records = loadRecords();
    records.push({
        weapon: weaponName,
        result: isWin ? 'win' : 'lose',
        date: new Date().toISOString()
    });

    saveRecords(records);
    input.value = '';
    updateStatsDisplay();
}

// 集計と表示（メイン、サブ、スペシャル全て計算）
function updateStatsDisplay() {
    const records = loadRecords();
    
    if (records.length === 0) {
        document.getElementById('stats-list').innerHTML = "データがありません";
        document.getElementById('sub-stats-list').innerHTML = "データがありません";
        document.getElementById('special-stats-list').innerHTML = "データがありません";
        return;
    }

    // 3つの集計箱を用意
    const mainStats = {};
    const subStats = {};
    const specialStats = {};

    records.forEach(r => {
        const isWin = (r.result === 'win');
        
        // 1. メイン武器の集計
        updateCount(mainStats, r.weapon, isWin);

        // 武器データがあればサブとスペシャルも集計
        const wData = findWeaponData(r.weapon);
        if (wData) {
            // 2. サブの集計
            const subName = wData.sub.name.ja_JP;
            updateCount(subStats, subName, isWin);

            // 3. スペシャルの集計
            const specialName = wData.special.name.ja_JP;
            updateCount(specialStats, specialName, isWin);
        }
    });

    // それぞれHTMLに出力
    renderStatsTable('stats-list', mainStats);
    renderStatsTable('sub-stats-list', subStats);
    renderStatsTable('special-stats-list', specialStats);
}

// 集計用ヘルパー
function updateCount(statsObj, key, isWin) {
    if (!statsObj[key]) statsObj[key] = { win: 0, total: 0 };
    statsObj[key].total++;
    if (isWin) statsObj[key].win++;
}

// テーブル描画用ヘルパー
function renderStatsTable(elementId, statsObj) {
    const container = document.getElementById(elementId);
    
    // 勝率順（または対戦数順）にソート
    const sorted = Object.keys(statsObj).map(key => {
        const d = statsObj[key];
        const rate = (d.win / d.total) * 100;
        return { key, rate, ...d };
    }).sort((a, b) => b.total - a.total); // 対戦数が多い順

    let html = '';
    // 上位5件だけ表示（多すぎると見づらいため）
    sorted.slice(0, 5).forEach(item => {
        const color = item.rate >= 50 ? '#e91e63' : '#2196f3';
        html += `
            <div class="stat-item">
                <span style="font-size:0.9em;">${item.key}</span>
                <span class="stat-rate" style="color: ${color}">
                    ${item.rate.toFixed(0)}% <span style="font-size:0.8em; color:#999;">(${item.win}/${item.total})</span>
                </span>
            </div>
        `;
    });
    
    if(sorted.length > 5) {
        html += `<div style="text-align:center; font-size:0.8em; color:#999;">他 ${sorted.length - 5} 件</div>`;
    }

    container.innerHTML = html || "データなし";
}

function clearData() {
    if(confirm("全ての記録データを消去しますか？")) {
        localStorage.removeItem(STORAGE_KEY);
        updateStatsDisplay();
    }
}